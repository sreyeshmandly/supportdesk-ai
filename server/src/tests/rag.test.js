jest.mock('../config/db', () => ({
  execute: jest.fn()
}));

jest.mock('../ai/embeddings', () => ({
  embedQuery: jest.fn()
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn()
}));

const pool = require('../config/db');
const { embedQuery } = require('../ai/embeddings');
const { GoogleGenAI } = require('@google/genai');

const {
  retrieveRelevantChunks,
  cosineSimilarity,
  parseEmbedding
} = require('../ai/retrieval');

const {
  generateGroundedAnswer
} = require('../ai/answer');

function vector(value) {
  const result = Array(768).fill(0);
  result[0] = value;
  return result;
}

describe('RAG retrieval helpers', () => {
  test('cosine similarity is 1 for identical vectors', () => {
    expect(
      cosineSimilarity(vector(1), vector(1))
    ).toBeCloseTo(1);
  });

  test('cosine similarity is 0 for a zero vector', () => {
    expect(
      cosineSimilarity(Array(768).fill(0), vector(1))
    ).toBe(0);
  });

  test('parses a JSON embedding', () => {
    expect(
      parseEmbedding(JSON.stringify(vector(1)))
    ).toHaveLength(768);
  });

  test('rejects an invalid embedding', () => {
    expect(parseEmbedding('not-json')).toBeNull();
    expect(parseEmbedding([1, 2, 3])).toBeNull();
  });
});

describe('RAG retrieval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    embedQuery.mockResolvedValue(vector(1));
  });

  test('retrieves only published chunks for the requested organization', async () => {
    pool.execute.mockResolvedValue([
      [
        {
          article_id: 10,
          chunk_index: 0,
          chunk_text: 'The refund period is 30 days.',
          embedding: JSON.stringify(vector(1)),
          title: 'Refund Policy'
        }
      ]
    ]);

    const result = await retrieveRelevantChunks({
      orgId: 7,
      question: 'What is the refund period?'
    });

    expect(embedQuery).toHaveBeenCalledWith(
      'What is the refund period?'
    );

    const [sql, params] = pool.execute.mock.calls[0];

    expect(sql).toContain('c.org_id = ?');
    expect(sql).toContain('a.org_id = ?');
    expect(sql).toContain("a.status = 'published'");
    expect(params).toEqual([7, 7, 500]);

    expect(result).toHaveLength(1);
    expect(result[0].articleId).toBe(10);
    expect(result[0].title).toBe('Refund Policy');
    expect(result[0].similarity).toBeCloseTo(1);
  });

  test("scopes retrieval to the requested organization and published articles", async () => {
    pool.execute.mockResolvedValue([[]]);

    const result = await retrieveRelevantChunks({
      orgId: 7,
      question: "What is the private policy?"
    });

    expect(result).toEqual([]);

    const [sql, params] = pool.execute.mock.calls[0];

    expect(sql).toContain("WHERE c.org_id = ?");
    expect(sql).toContain("AND a.org_id = ?");
    expect(sql).toContain("AND a.status = 'published'");
    expect(sql).toContain("AND a.org_id = c.org_id");
    expect(params).toEqual([7, 7, expect.any(Number)]);
  });

  test('ignores malformed database embeddings', async () => {
    pool.execute.mockResolvedValue([
      [
        {
          article_id: 12,
          chunk_index: 0,
          chunk_text: 'Malformed embedding.',
          embedding: 'not-json',
          title: 'Invalid Article'
        },
        {
          article_id: 13,
          chunk_index: 0,
          chunk_text: 'Wrong embedding dimensions.',
          embedding: JSON.stringify([1, 2, 3]),
          title: 'Invalid Dimensions'
        }
      ]
    ]);

    const result = await retrieveRelevantChunks({
      orgId: 7,
      question: 'What does the article say?'
    });

    expect(result).toEqual([]);
  });

  test('returns no matches when the query embedding is a zero vector', async () => {
    embedQuery.mockResolvedValue(Array(768).fill(0));

    pool.execute.mockResolvedValue([
      [
        {
          article_id: 14,
          chunk_index: 0,
          chunk_text: 'A published policy.',
          embedding: JSON.stringify(vector(1)),
          title: 'Published Policy'
        }
      ]
    ]);

    const result = await retrieveRelevantChunks({
      orgId: 7,
      question: 'What does the policy say?'
    });

    expect(result).toEqual([]);
  });

  test('returns no more than the requested topK chunks', async () => {
    pool.execute.mockResolvedValue([
      [
        {
          article_id: 15,
          chunk_index: 0,
          chunk_text: 'Policy chunk one.',
          embedding: JSON.stringify(vector(1)),
          title: 'Policy One'
        },
        {
          article_id: 16,
          chunk_index: 0,
          chunk_text: 'Policy chunk two.',
          embedding: JSON.stringify(vector(1)),
          title: 'Policy Two'
        },
        {
          article_id: 17,
          chunk_index: 0,
          chunk_text: 'Policy chunk three.',
          embedding: JSON.stringify(vector(1)),
          title: 'Policy Three'
        }
      ]
    ]);

    const result = await retrieveRelevantChunks({
      orgId: 7,
      question: 'What does the policy say?',
      topK: 2
    });

    expect(result).toHaveLength(2);
  });
  test('does not return irrelevant chunks', async () => {
    pool.execute.mockResolvedValue([
      [
        {
          article_id: 11,
          chunk_index: 0,
          chunk_text: 'Unrelated information.',
          embedding: JSON.stringify(vector(-1)),
          title: 'Other Article'
        }
      ]
    ]);

    const result = await retrieveRelevantChunks({
      orgId: 7,
      question: 'How do refunds work?'
    });

    expect(result).toEqual([]);
  });

  test('rejects an invalid organization ID', async () => {
    await expect(
      retrieveRelevantChunks({
        orgId: null,
        question: 'What is the refund policy?'
      })
    ).rejects.toThrow('Organization ID is required');

    expect(embedQuery).not.toHaveBeenCalled();
    expect(pool.execute).not.toHaveBeenCalled();
  });

  test('rejects an invalid topK value', async () => {
    await expect(
      retrieveRelevantChunks({
        orgId: 7,
        question: 'What is the refund policy?',
        topK: 100
      })
    ).rejects.toThrow(
      'topK must be an integer between 1 and 10'
    );
  });
});

describe('Grounded answer generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_API_KEY;
  });

  test('returns a safe response when no relevant chunks exist', async () => {
    const result = await generateGroundedAnswer({
      question: 'What is the refund policy?',
      chunks: []
    });

    expect(result.answer).toContain(
      'could not find relevant information'
    );
    expect(result.model).toBeNull();
    expect(GoogleGenAI).not.toHaveBeenCalled();
  });

  test('rejects an empty question', async () => {
    await expect(
      generateGroundedAnswer({
        question: ' ',
        chunks: []
      })
    ).rejects.toThrow(
      'Question must be a non-empty string'
    );
  });

  test('rejects invalid chunks input', async () => {
    await expect(
      generateGroundedAnswer({
        question: 'What is the refund policy?',
        chunks: null
      })
    ).rejects.toThrow(
      'Retrieved chunks must be an array'
    );
  });
});
