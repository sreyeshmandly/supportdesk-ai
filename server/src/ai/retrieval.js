const pool = require('../config/db');
const { embedQuery } = require('./embeddings');

const MAX_CANDIDATES = 500;
const DEFAULT_TOP_K = 5;
const MIN_SIMILARITY = 0.35;

function parseEmbedding(value) {
  let embedding = value;

  if (typeof embedding === 'string') {
    try {
      embedding = JSON.parse(embedding);
    } catch {
      return null;
    }
  }

  if (
    !Array.isArray(embedding) ||
    embedding.length !== 768 ||
    !embedding.every(Number.isFinite)
  ) {
    return null;
  }

  return embedding;
}

function cosineSimilarity(a, b) {
  if (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== b.length ||
    a.length === 0
  ) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

async function retrieveRelevantChunks({
  orgId,
  question,
  topK = DEFAULT_TOP_K
}) {
  if (!orgId) {
    throw new TypeError('Organization ID is required');
  }

  if (typeof question !== 'string' || !question.trim()) {
    throw new TypeError('Question must be a non-empty string');
  }

  if (!Number.isInteger(topK) || topK < 1 || topK > 10) {
    throw new TypeError('topK must be an integer between 1 and 10');
  }

  const queryEmbedding = await embedQuery(question.trim());

  const [rows] = await pool.execute(
    `SELECT
       c.article_id,
       c.chunk_index,
       c.chunk_text,
       c.embedding,
       a.title
     FROM kb_article_chunks AS c
     INNER JOIN kb_articles AS a
       ON a.id = c.article_id
      AND a.org_id = c.org_id
     WHERE c.org_id = ?
       AND a.org_id = ?
       AND a.status = 'published'
     ORDER BY c.article_id DESC, c.chunk_index ASC
     LIMIT ?`,
    [orgId, orgId, MAX_CANDIDATES]
  );

  const ranked = rows
    .map(row => {
      const embedding = parseEmbedding(row.embedding);

      if (!embedding) {
        return null;
      }

      const similarity = cosineSimilarity(
        queryEmbedding,
        embedding
      );

      return {
        articleId: Number(row.article_id),
        title: row.title,
        chunkIndex: Number(row.chunk_index),
        text: row.chunk_text,
        similarity
      };
    })
    .filter(
      chunk =>
        chunk !== null &&
        Number.isFinite(chunk.similarity) &&
        chunk.similarity >= MIN_SIMILARITY
    )
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return ranked;
}

module.exports = {
  retrieveRelevantChunks,
  cosineSimilarity,
  parseEmbedding,
  MAX_CANDIDATES,
  DEFAULT_TOP_K,
  MIN_SIMILARITY
};