require('dotenv').config();

const pool = require('../src/config/db');
const {
  embedDocument,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS
} = require('../src/ai/embeddings');
const { chunkText } = require('../src/ai/chunking');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

async function main() {
  let conn;
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is missing in server/.env');
    }

    const [databaseRows] = await pool.query('SELECT DATABASE() AS databaseName');
    const databaseName = databaseRows[0].databaseName;

    console.log('\n========== KNOWLEDGE-BASE REINDEX ==========');
    console.log('Database:', databaseName);
    console.log('Embedding model:', EMBEDDING_MODEL);
    console.log('Embedding dimensions:', EMBEDDING_DIMENSIONS);

    if (databaseName !== 'supportdesk_rag_test') {
      throw new Error(
        'Safety check failed. This script only allows the supportdesk_rag_test database.'
      );
    }

    const [articles] = await pool.execute(
      `SELECT id, org_id, title, content
       FROM kb_articles
       WHERE status = 'published'
       ORDER BY org_id, id`
    );

    console.log('Published articles:', articles.length);

    if (articles.length === 0) {
      console.log('No published articles found.');
      return;
    }

    for (const article of articles) {
      console.log(
        `- Article ${article.id} | Organization ${article.org_id} | ${article.title}`
      );
    }

    const answer = await rl.question(
      '\nType REINDEX to re-embed these articles in supportdesk_rag_test: '
    );

    if (answer.trim() !== 'REINDEX') {
      console.log('Cancelled. No database records were changed.');
      return;
    }

    for (const article of articles) {
      console.log(`\nProcessing article ${article.id}: ${article.title}`);

      const textChunks = chunkText(article.content);

      if (textChunks.length === 0) {
        throw new Error(`Article ${article.id} produced no chunks.`);
      }

      const preparedChunks = [];

      for (let index = 0; index < textChunks.length; index += 1) {
        console.log(`Generating embedding ${index + 1}/${textChunks.length}...`);

        const embedding = await embedDocument(textChunks[index], article.title);

        if (
          !Array.isArray(embedding) ||
          embedding.length !== EMBEDDING_DIMENSIONS ||
          !embedding.every(Number.isFinite)
        ) {
          throw new Error(`Invalid embedding for article ${article.id}.`);
        }

        preparedChunks.push({
          chunkIndex: index,
          chunkText: textChunks[index],
          embedding
        });
      }

      conn = await pool.getConnection();
      await conn.beginTransaction();

      try {
        const [lockedRows] = await conn.execute(
          `SELECT id, title, content, status
           FROM kb_articles
           WHERE id = ? AND org_id = ?
           FOR UPDATE`,
          [article.id, article.org_id]
        );

        if (
          lockedRows.length !== 1 ||
          lockedRows[0].status !== 'published' ||
          lockedRows[0].title !== article.title ||
          lockedRows[0].content !== article.content
        ) {
          throw new Error(
            `Article ${article.id} changed during reindexing.`
          );
        }

        await conn.execute(
          `DELETE FROM kb_article_chunks
           WHERE org_id = ? AND article_id = ?`,
          [article.org_id, article.id]
        );

        for (const chunk of preparedChunks) {
          await conn.execute(
            `INSERT INTO kb_article_chunks
              (org_id, article_id, chunk_index, chunk_text, embedding, embedding_model)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              article.org_id,
              article.id,
              chunk.chunkIndex,
              chunk.chunkText,
              JSON.stringify(chunk.embedding),
              EMBEDDING_MODEL
            ]
          );
        }

        await conn.execute(
          `UPDATE kb_articles
           SET embedded_at = NOW()
           WHERE id = ? AND org_id = ? AND status = 'published'`,
          [article.id, article.org_id]
        );

        await conn.commit();

        console.log(
          `Article ${article.id} reindexed successfully (${preparedChunks.length} chunks).`
        );
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
        conn = null;
      }
    }

    console.log('\nReindexing completed successfully.');
  } finally {
    rl.close();

    if (conn) {
      conn.release();
    }

    await pool.end();
  }
}

main().catch(error => {
  console.error('\nReindexing failed:', error.message);
  process.exitCode = 1;
});
