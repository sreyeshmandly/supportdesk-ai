const express = require('express');
const { z } = require('zod');

const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { chunkText } = require('../ai/chunking');
const {
  embedDocument,
  EMBEDDING_MODEL
} = require('../ai/embeddings');
const {
  retrieveRelevantChunks
} = require('../ai/retrieval');

const {
  generateGroundedAnswer
} = require('../ai/answer');

const router = express.Router();

router.use(requireAuth);

const idParam = z.coerce.number().int().positive();

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().min(20).max(50000)
});

const updateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  content: z.string().trim().min(20).max(50000).optional()
}).refine(
  data => data.title !== undefined || data.content !== undefined,
  { message: 'Provide a title or content to update' }
);
const askSchema = z.object({
  question: z.string().trim().min(3).max(2000)
});

function articleMatchesSnapshot(current, snapshot) {
  return Boolean(
    current &&
    Number(current.id) === Number(snapshot.id) &&
    current.title === snapshot.title &&
    current.content === snapshot.content &&
    current.status === snapshot.status
  );
}
function buildChunks(content) {
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    throw new Error('Article content produced no chunks');
  }

  return chunks;
}

async function buildEmbeddings(chunks, title) {
  const result = [];

  // Sequential requests avoid sending an unbounded number of
  // embedding requests to the Gemini API at the same time.
  for (let index = 0; index < chunks.length; index += 1) {
    const embedding = await embedDocument(chunks[index], title);

    result.push({
      chunkIndex: index,
      chunkText: chunks[index],
      embedding
    });
  }

  return result;
}

async function replaceChunks(conn, orgId, articleId, chunks) {
  await conn.execute(
    `DELETE FROM kb_article_chunks
     WHERE org_id = ? AND article_id = ?`,
    [orgId, articleId]
  );

  for (const chunk of chunks) {
    await conn.execute(
      `INSERT INTO kb_article_chunks
        (org_id, article_id, chunk_index, chunk_text,
         embedding, embedding_model)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        orgId,
        articleId,
        chunk.chunkIndex,
        chunk.chunkText,
        JSON.stringify(chunk.embedding),
        EMBEDDING_MODEL
      ]
    );
  }
}


// Answer a question using published knowledge-base articles.
// The organization ID always comes from the authenticated user.
router.post('/ask', async (req, res, next) => {
  try {
    const { question } = askSchema.parse(req.body);

    const chunks = await retrieveRelevantChunks({
      orgId: req.user.orgId,
      question,
      topK: 5
    });

    const result = await generateGroundedAnswer({
      question,
      chunks
    });

    const sources = chunks.map(chunk => ({
      articleId: chunk.articleId,
      title: chunk.title,
      chunkIndex: chunk.chunkIndex,
      similarity: Number(chunk.similarity.toFixed(4))
    }));

    res.json({
      question,
      answer: result.answer,
      sources,
      model: result.model,
      usage: result.usage
    });
  } catch (err) {
    next(err);
  }
});

// List only articles belonging to the authenticated organization.
router.get('/', async (req, res, next) => {
  try {
    const [articles] = await pool.execute(
      `SELECT id, title, status, embedded_at
       FROM kb_articles
       WHERE org_id = ?
       ORDER BY id DESC`,
      [req.user.orgId]
    );

    res.json({ articles });
  } catch (err) {
    next(err);
  }
});

// View an article. Draft content is visible only to staff.
router.get('/:id', async (req, res, next) => {
  try {
    const id = idParam.parse(req.params.id);

    let sql = `
      SELECT id, org_id, title, content, status, embedded_at
      FROM kb_articles
      WHERE id = ? AND org_id = ?
    `;

    const params = [id, req.user.orgId];

    if (req.user.role === 'customer') {
      sql += " AND status = 'published'";
    }

    const [rows] = await pool.execute(sql, params);

    if (!rows.length) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ article: rows[0] });
  } catch (err) {
    next(err);
  }
});

// Create an article as a draft. Drafts are not indexed for retrieval.
router.post(
  '/',
  requireRole('admin', 'agent'),
  async (req, res, next) => {
    try {
      const data = createSchema.parse(req.body);

      const [result] = await pool.execute(
        `INSERT INTO kb_articles (org_id, title, content, status)
         VALUES (?, ?, ?, 'draft')`,
        [req.user.orgId, data.title, data.content]
      );

      res.status(201).json({
        id: result.insertId,
        title: data.title,
        status: 'draft'
      });
    } catch (err) {
      next(err);
    }
  }
);

// Update a draft or published article.
// Published articles are re-embedded before any existing data is changed.
router.patch(
  '/:id',
  requireRole('admin', 'agent'),
  async (req, res, next) => {
    let conn;

    try {
      const id = idParam.parse(req.params.id);
      const data = updateSchema.parse(req.body);

      const [rows] = await pool.execute(
        `SELECT id, title, content, status
         FROM kb_articles
         WHERE id = ? AND org_id = ?`,
        [id, req.user.orgId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Article not found' });
      }

      const article = rows[0];
      const title = data.title ?? article.title;
      const content = data.content ?? article.content;

      let preparedChunks = null;

      if (article.status === 'published') {
        const textChunks = buildChunks(content);
        preparedChunks = await buildEmbeddings(textChunks, title);
      }

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [currentRows] = await conn.execute(
        `SELECT id, title, content, status
         FROM kb_articles
         WHERE id = ? AND org_id = ?
         FOR UPDATE`,
        [id, req.user.orgId]
      );

      if (!currentRows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Article not found' });
      }

      if (!articleMatchesSnapshot(currentRows[0], article)) {
        await conn.rollback();
        return res.status(409).json({
          error: 'Article changed while processing. Fetch the latest article and retry.'
        });
      }

      await conn.execute(
        `UPDATE kb_articles
         SET title = ?, content = ?,
             embedded_at = CASE
               WHEN status = 'published' THEN NOW()
               ELSE NULL
             END
         WHERE id = ? AND org_id = ?`,
        [title, content, id, req.user.orgId]
      );

      if (preparedChunks) {
        await replaceChunks(
          conn,
          req.user.orgId,
          id,
          preparedChunks
        );
      } else {
        await conn.execute(
          `DELETE FROM kb_article_chunks
           WHERE org_id = ? AND article_id = ?`,
          [req.user.orgId, id]
        );
      }

      await conn.commit();

      res.json({
        id,
        title,
        status: article.status,
        chunksIndexed: preparedChunks ? preparedChunks.length : 0
      });
    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (rollbackError) {
          console.error('Knowledge-base rollback failed:', rollbackError.message);
        }
      }

      next(err);
    } finally {
      if (conn) conn.release();
    }
  }
);

// Publish a draft and index its content for RAG retrieval.
router.post(
  '/:id/publish',
  requireRole('admin', 'agent'),
  async (req, res, next) => {
    let conn;

    try {
      const id = idParam.parse(req.params.id);

      const [rows] = await pool.execute(
        `SELECT id, title, content, status
         FROM kb_articles
         WHERE id = ? AND org_id = ?`,
        [id, req.user.orgId]
      );

      if (!rows.length) {
        return res.status(404).json({ error: 'Article not found' });
      }

      const article = rows[0];
      const textChunks = buildChunks(article.content);

      // Generate embeddings before changing published database state.
      const preparedChunks = await buildEmbeddings(
        textChunks,
        article.title
      );

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [lockedRows] = await conn.execute(
        `SELECT id, title, content, status
         FROM kb_articles
         WHERE id = ? AND org_id = ?
         FOR UPDATE`,
        [id, req.user.orgId]
      );

      if (!lockedRows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Article not found' });
      }

      if (!articleMatchesSnapshot(lockedRows[0], article)) {
        await conn.rollback();
        return res.status(409).json({
          error: 'Article changed while processing. Fetch the latest article and retry.'
        });
      }

      await replaceChunks(
        conn,
        req.user.orgId,
        id,
        preparedChunks
      );

      await conn.execute(
        `UPDATE kb_articles
         SET status = 'published', embedded_at = NOW()
         WHERE id = ? AND org_id = ?`,
        [id, req.user.orgId]
      );

      await conn.commit();

      res.json({
        id,
        status: 'published',
        chunksIndexed: preparedChunks.length,
        embeddingModel: EMBEDDING_MODEL
      });
    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (rollbackError) {
          console.error('Knowledge-base rollback failed:', rollbackError.message);
        }
      }

      next(err);
    } finally {
      if (conn) conn.release();
    }
  }
);

module.exports = router;
