process.env.DB_NAME = 'supportdesk_test';
process.env.JWT_SECRET = 'jest-only-secret';

jest.mock('../queues/triageQueue', () => ({
  triageQueue: {
    add: jest.fn().mockResolvedValue({ id: 'test-job' }),
  },
}));

jest.mock('../ai/embeddings', () => ({
  embedDocument: jest.fn(),
  embedQuery: jest.fn(),
  EMBEDDING_MODEL: 'test-embedding-model',
}));

const request = require('supertest');
const mysql = require('mysql2/promise');
const pool = require('../config/db');
const app = require('../app');
const { embedDocument, embedQuery } = require('../ai/embeddings');

const PASSWORD = 'a-long-test-password';
const API = '/api/knowledge-base';

let adminA;
let adminB;
let agentA;
let customerA;
let customerB;
let emailCounter = 0;

function uniqueEmail(prefix) {
  emailCounter += 1;
  return `${prefix}-${Date.now()}-${emailCounter}@example.test`;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function validEmbedding() {
  return Array(768).fill(0.1);
}

function articleContent(suffix = '') {
  return (
    'Support policy: customers can request help from the support team. ' +
    'Agents review the request, verify the account, and provide the next ' +
    'appropriate steps. Contact support if additional assistance is required. ' +
    suffix
  );
}

async function registerOrganization(orgName, prefix) {
  const email = uniqueEmail(prefix);

  const registration = await request(app)
    .post('/api/auth/register')
    .send({
      orgName,
      name: `${prefix} Admin`,
      email,
      password: PASSWORD,
    });

  expect(registration.status).toBe(201);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });

  expect(login.status).toBe(200);
  expect(login.body.token).toBeTruthy();

  return {
    token: login.body.token,
    user: registration.body.user,
    email,
  };
}

async function addOrganizationUser(admin, role, prefix) {
  const email = uniqueEmail(prefix);

  const created = await request(app)
    .post('/api/users')
    .set(auth(admin.token))
    .send({
      name: prefix,
      email,
      password: PASSWORD,
      role,
    });

  expect(created.status).toBe(201);

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });

  expect(login.status).toBe(200);
  expect(login.body.token).toBeTruthy();

  return {
    token: login.body.token,
    user: created.body.user,
    email,
  };
}

async function createArticle(admin, overrides = {}) {
  const payload = {
    title: `Support article ${Date.now()}-${Math.random()}`,
    content: articleContent(),
    ...overrides,
  };

  const response = await request(app)
    .post(API)
    .set(auth(admin.token))
    .send(payload);

  expect(response.status).toBe(201);
  expect(response.body.id).toBeTruthy();

  return {
    id: response.body.id,
    title: response.body.title,
    status: response.body.status,
    content: payload.content,
  };
}

async function publishArticle(admin, article) {
  return request(app)
    .post(`${API}/${article.id}/publish`)
    .set(auth(admin.token));
}

beforeAll(async () => {
  const [rows] = await pool.query('SELECT DATABASE() AS active_database');

  if (
    !rows[0] ||
    rows[0].active_database !== 'supportdesk_test'
  ) {
    throw new Error(
      `Database safety check failed. Expected supportdesk_test; received ${
        rows[0]?.active_database || 'unknown'
      }.`
    );
  }

  const connection = await pool.getConnection();

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of [
      'ai_suggestions',
      'ticket_messages',
      'tickets',
      'kb_article_chunks',
      'kb_articles',
      'users',
      'organizations',
    ]) {
      const [exists] = await connection.query(
        'SHOW TABLES LIKE ?',
        [table]
      );

      if (exists.length > 0) {
        await connection.query(`TRUNCATE TABLE \`${table}\``);
      }
    }
  } finally {
    try {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    } finally {
      connection.release();
    }
  }

  adminA = await registerOrganization('Knowledge Test Org A', 'admin-a');
  adminB = await registerOrganization('Knowledge Test Org B', 'admin-b');

  agentA = await addOrganizationUser(adminA, 'agent', 'agent-a');
  customerA = await addOrganizationUser(adminA, 'customer', 'customer-a');
  customerB = await addOrganizationUser(adminB, 'customer', 'customer-b');
},30000);

beforeEach(() => {
  embedDocument.mockReset();
  embedQuery.mockReset();

  embedDocument.mockResolvedValue(validEmbedding());
});

afterAll(async () => {
  await pool.end();
});

describe('Knowledge-base API', () => {
  test('rejects unauthenticated requests', async () => {
    const response = await request(app).get(API);

    expect(response.status).toBe(401);
  });

  test('allows an admin to create a draft article', async () => {
    const response = await request(app)
      .post(API)
      .set(auth(adminA.token))
      .send({
        title: 'Refund policy',
        content: articleContent(),
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.anything(),
        title: 'Refund policy',
        status: 'draft',
      })
    );
  });

  test('rejects invalid article input', async () => {
    const response = await request(app)
      .post(API)
      .set(auth(adminA.token))
      .send({
        title: 'X',
        content: 'Too short',
      });

    expect(response.status).toBe(400);
  });

  test('prevents customers from creating articles', async () => {
    const response = await request(app)
      .post(API)
      .set(auth(customerA.token))
      .send({
        title: 'Unauthorized article',
        content: articleContent(),
      });

    expect(response.status).toBe(403);
  });

  test('does not expose another organization article', async () => {
    const article = await createArticle(adminA);

    const response = await request(app)
      .get(`${API}/${article.id}`)
      .set(auth(customerB.token));

    expect(response.status).toBe(404);
  });

  test('publishes an article and persists its chunks', async () => {
    const article = await createArticle(adminA);

    const response = await publishArticle(adminA, article);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('published');
    expect(response.body.chunksIndexed).toBeGreaterThan(0);
    expect(embedDocument).toHaveBeenCalled();

    const [articles] = await pool.query(
      'SELECT status FROM kb_articles WHERE id = ? AND org_id = ?',
      [article.id, adminA.user.orgId]
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].status).toBe('published');

    const [chunks] = await pool.query(
      'SELECT id, chunk_text, embedding FROM kb_article_chunks WHERE article_id = ? AND org_id = ?',
      [article.id, adminA.user.orgId]
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].chunk_text).toBeTruthy();
    expect(chunks[0].embedding).toBeTruthy();
  });

  test('updates a published article and reindexes its content', async () => {
    const article = await createArticle(adminA);

    const published = await publishArticle(adminA, article);
    expect(published.status).toBe(200);

    embedDocument.mockClear();

    const updatedContent = articleContent(
      'Updated policy: refunds require verification.'
    );

    const response = await request(app)
      .patch(`${API}/${article.id}`)
      .set(auth(adminA.token))
      .send({ content: updatedContent });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('published');
    expect(embedDocument).toHaveBeenCalled();

    const [rows] = await pool.query(
      'SELECT content, status FROM kb_articles WHERE id = ? AND org_id = ?',
      [article.id, adminA.user.orgId]
    );

    expect(rows[0].content).toBe(updatedContent);
    expect(rows[0].status).toBe('published');
  });

  test('does not publish an article when embedding generation fails', async () => {
    const article = await createArticle(adminA);

    embedDocument.mockRejectedValueOnce(
      new Error('Simulated embedding failure')
    );

    const response = await publishArticle(adminA, article);

    expect(response.status).toBe(500);

    const [rows] = await pool.query(
      'SELECT status FROM kb_articles WHERE id = ? AND org_id = ?',
      [article.id, adminA.user.orgId]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('draft');
  });

  test('rejects a stale concurrent update with HTTP 409', async () => {
    const article = await createArticle(adminA);

    const initialPublish = await publishArticle(adminA, article);
    expect(initialPublish.status).toBe(200);

    let releaseFirstEmbedding;
    let signalFirstEmbeddingStarted;

    const embeddingStarted = new Promise((resolve) => {
      signalFirstEmbeddingStarted = resolve;
    });

    const firstEmbeddingGate = new Promise((resolve) => {
      releaseFirstEmbedding = resolve;
    });

    embedDocument.mockImplementationOnce(async () => {
      signalFirstEmbeddingStarted();
      await firstEmbeddingGate;
      return validEmbedding();
    });

    const staleUpdate = request(app)
      .patch(`${API}/${article.id}`)
      .set(auth(adminA.token))
      .send({
        content: articleContent('Stale update content.'),
    })
      .then((response) => response);

    await embeddingStarted;

    const latestContent = articleContent('Latest winning update content.');

    const winningUpdate = await request(app)
      .patch(`${API}/${article.id}`)
      .set(auth(adminA.token))
      .send({ content: latestContent });

    expect(winningUpdate.status).toBe(200);

    releaseFirstEmbedding();

    const staleResponse = await staleUpdate;

    expect(staleResponse.status).toBe(409);
    expect(staleResponse.body.error).toMatch(/article changed/i);

    const [rows] = await pool.query(
      'SELECT content FROM kb_articles WHERE id = ? AND org_id = ?',
      [article.id, adminA.user.orgId]
    );

    expect(rows[0].content).toBe(latestContent);
  });

  test('rejects publishing when the article changes during embedding', async () => {
    const article = await createArticle(adminA);

    let releaseEmbedding;
    let signalEmbeddingStarted;

    const embeddingStarted = new Promise((resolve) => {
      signalEmbeddingStarted = resolve;
    });

    const embeddingGate = new Promise((resolve) => {
      releaseEmbedding = resolve;
    });

    embedDocument.mockImplementationOnce(async () => {
      signalEmbeddingStarted();
      await embeddingGate;
      return validEmbedding();
    });

    const publishRequest = publishArticle(adminA, article);

    await embeddingStarted;

    const latestContent = articleContent('Content changed before publishing.');

    const updateResponse = await request(app)
      .patch(`${API}/${article.id}`)
      .set(auth(adminA.token))
      .send({ content: latestContent });

    expect(updateResponse.status).toBe(200);

    releaseEmbedding();

    const publishResponse = await publishRequest;

    expect(publishResponse.status).toBe(409);
    expect(publishResponse.body.error).toMatch(/article changed/i);

    const [rows] = await pool.query(
      'SELECT content, status FROM kb_articles WHERE id = ? AND org_id = ?',
      [article.id, adminA.user.orgId]
    );

    expect(rows[0].content).toBe(latestContent);
    expect(rows[0].status).toBe('draft');
  });
});
