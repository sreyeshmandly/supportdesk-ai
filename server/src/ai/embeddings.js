const { GoogleGenAI } = require('@google/genai');

const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

const EMBEDDING_DIMENSIONS = 768;

let geminiClient;

function getGeminiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing in server/.env');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });
  }

  return geminiClient;
}

async function embedText(text, taskType) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new TypeError('Text to embed must be a non-empty string');
  }

  if (
    taskType !== 'RETRIEVAL_DOCUMENT' &&
    taskType !== 'RETRIEVAL_QUERY'
  ) {
    throw new TypeError('Unsupported embedding task type');
  }

  const ai = getGeminiClient();

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text.trim(),
    config: {
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS
    }
  });

  const embedding = response.embeddings?.[0]?.values;

  if (
    !Array.isArray(embedding) ||
    embedding.length !== EMBEDDING_DIMENSIONS ||
    !embedding.every(value => Number.isFinite(value))
  ) {
    throw new Error(
      `Gemini returned an invalid embedding; expected ${EMBEDDING_DIMENSIONS} numerical values`
    );
  }

  return embedding;
}

async function embedDocument(text, title) {
  const normalizedText =
    typeof title === 'string' && title.trim()
      ? `${title.trim()}\n\n${text}`
      : text;

  return embedText(normalizedText, 'RETRIEVAL_DOCUMENT');
}

async function embedQuery(text) {
  return embedText(text, 'RETRIEVAL_QUERY');
}

module.exports = {
  embedDocument,
  embedQuery,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS
};
