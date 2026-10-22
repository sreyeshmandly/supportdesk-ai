process.env.JWT_SECRET = 'jest-only-secret';

// These endpoint tests do not exercise database or queue operations.
jest.mock('../config/db', () => ({
  execute: jest.fn(),
  getConnection: jest.fn()
}));

jest.mock('../queues/triageQueue', () => ({
  add: jest.fn().mockResolvedValue({ id: 'test-job' }),
  close: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../ai/retrieval', () => ({
  retrieveRelevantChunks: jest.fn()
}));

jest.mock('../ai/answer', () => ({
  generateGroundedAnswer: jest.fn()
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

const {
  retrieveRelevantChunks
} = require('../ai/retrieval');

const {
  generateGroundedAnswer
} = require('../ai/answer');

const API = '/api/knowledge-base/ask';

function createToken({ userId = 101, orgId = 7, role = 'customer' } = {}) {
  return jwt.sign(
    {
      sub: userId,
      orgId,
      role
    },
    process.env.JWT_SECRET
  );
}

function auth(token) {
  return {
    Authorization: `Bearer ${token}`
  };
}

function createChunk(overrides = {}) {
  return {
    articleId: 15,
    title: 'Refund Policy',
    chunkIndex: 0,
    text: 'Customers can request a refund within 30 days.',
    similarity: 0.92,
    ...overrides
  };
}

describe('POST /api/knowledge-base/ask', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    retrieveRelevantChunks.mockResolvedValue([]);
    generateGroundedAnswer.mockResolvedValue({
      answer: 'The knowledge base does not contain enough information.',
      model: null,
      usage: null
    });

    consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('rejects requests without an authentication token', async () => {
    const response = await request(app)
      .post(API)
      .send({
        question: 'What is the refund policy?'
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');

    expect(retrieveRelevantChunks).not.toHaveBeenCalled();
    expect(generateGroundedAnswer).not.toHaveBeenCalled();
  });

  test('rejects an invalid authentication token', async () => {
    const response = await request(app)
      .post(API)
      .set(auth('invalid-token'))
      .send({
        question: 'What is the refund policy?'
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid or expired token');

    expect(retrieveRelevantChunks).not.toHaveBeenCalled();
  });

  test('rejects a question shorter than three characters', async () => {
    const response = await request(app)
      .post(API)
      .set(auth(createToken()))
      .send({
        question: 'Hi'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid input');

    expect(retrieveRelevantChunks).not.toHaveBeenCalled();
    expect(generateGroundedAnswer).not.toHaveBeenCalled();
  });

  test('returns an answer and source metadata for a valid question', async () => {
    const chunk = createChunk();

    retrieveRelevantChunks.mockResolvedValue([chunk]);

    generateGroundedAnswer.mockResolvedValue({
      answer: 'Customers can request a refund within 30 days.',
      model: 'test-gemini-model',
      usage: {
        totalTokenCount: 42
      }
    });

    const response = await request(app)
      .post(API)
      .set(auth(createToken({ orgId: 7 })))
      .send({
        question: 'What is the refund policy?'
      });

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      question: 'What is the refund policy?',
      answer: 'Customers can request a refund within 30 days.',
      sources: [
        {
          articleId: 15,
          title: 'Refund Policy',
          chunkIndex: 0,
          similarity: 0.92
        }
      ],
      model: 'test-gemini-model',
      usage: {
        totalTokenCount: 42
      }
    });

    expect(retrieveRelevantChunks).toHaveBeenCalledWith({
      orgId: 7,
      question: 'What is the refund policy?',
      topK: 5
    });

    expect(generateGroundedAnswer).toHaveBeenCalledWith({
      question: 'What is the refund policy?',
      chunks: [chunk]
    });
  });

  test('returns a safe answer when no relevant sources are found', async () => {
    retrieveRelevantChunks.mockResolvedValue([]);

    generateGroundedAnswer.mockResolvedValue({
      answer:
        'I could not find relevant information in the published knowledge base.',
      model: null,
      usage: null
    });

    const response = await request(app)
      .post(API)
      .set(auth(createToken()))
      .send({
        question: 'What is the refund policy?'
      });

    expect(response.status).toBe(200);

    expect(response.body.answer).toContain(
      'could not find relevant information'
    );

    expect(response.body.sources).toEqual([]);
    expect(response.body.model).toBeNull();
    expect(response.body.usage).toBeNull();

    expect(generateGroundedAnswer).toHaveBeenCalledWith({
      question: 'What is the refund policy?',
      chunks: []
    });
  });

  test('returns a server error when retrieval fails', async () => {
    retrieveRelevantChunks.mockRejectedValue(
      new Error('Simulated retrieval failure')
    );

    const response = await request(app)
      .post(API)
      .set(auth(createToken()))
      .send({
        question: 'What is the refund policy?'
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Server error'
    });

    expect(generateGroundedAnswer).not.toHaveBeenCalled();
  });

  test('returns a server error when answer generation fails', async () => {
    retrieveRelevantChunks.mockResolvedValue([
      createChunk()
    ]);

    generateGroundedAnswer.mockRejectedValue(
      new Error('Simulated answer generation failure')
    );

    const response = await request(app)
      .post(API)
      .set(auth(createToken()))
      .send({
        question: 'What is the refund policy?'
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: 'Server error'
    });
  });

  test('uses the authenticated organization ID for retrieval', async () => {
    const firstToken = createToken({
      userId: 101,
      orgId: 7
    });

    const secondToken = createToken({
      userId: 202,
      orgId: 22
    });

    const firstResponse = await request(app)
      .post(API)
      .set(auth(firstToken))
      .send({
        question: 'What is the refund policy?'
      });

    const secondResponse = await request(app)
      .post(API)
      .set(auth(secondToken))
      .send({
        question: 'What is the refund policy?'
      });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    expect(retrieveRelevantChunks).toHaveBeenNthCalledWith(1, {
      orgId: 7,
      question: 'What is the refund policy?',
      topK: 5
    });

    expect(retrieveRelevantChunks).toHaveBeenNthCalledWith(2, {
      orgId: 22,
      question: 'What is the refund policy?',
      topK: 5
    });
  });
});
