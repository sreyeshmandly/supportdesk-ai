process.env.DB_NAME = 'supportdesk_test';
process.env.JWT_SECRET = 'jest-only-secret';

const request = require('supertest');
const pool = require('../config/db');
const app = require('../app');

jest.setTimeout(30000);

const PASSWORD = 'a-long-test-password';
const auth = t => ({ Authorization: `Bearer ${t}` });

let adminA, adminB, agent, customer1, customer2, ticketId;

async function register(orgName, name, email) {
  const res = await request(app).post('/api/auth/register')
    .send({ orgName, name, email, password: PASSWORD });
  expect(res.status).toBe(201);
  return res.body;
}

async function addUser(adminToken, name, email, role) {
  const res = await request(app).post('/api/users').set(auth(adminToken))
    .send({ name, email, password: PASSWORD, role });
  expect(res.status).toBe(201);
}

async function login(email) {
  const res = await request(app).post('/api/auth/login')
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token;
}

beforeAll(async () => {
  // Safety: never wipe a database other than the test one
  const [[row]] = await pool.query('SELECT DATABASE() AS db');
  if (row.db !== 'supportdesk_test') {
    throw new Error(`Refusing to run tests on database: ${row.db}`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['ai_suggestions', 'ticket_messages', 'tickets',
                     'kb_articles', 'users', 'organizations']) {
      await conn.query(`TRUNCATE TABLE ${t}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }

  adminA = await register('Org A', 'Admin A', 'admin@orga.test');
  adminB = await register('Org B', 'Admin B', 'admin@orgb.test');
  await addUser(adminA.token, 'Agent A', 'agent@orga.test', 'agent');
  await addUser(adminA.token, 'Customer One', 'cust1@orga.test', 'customer');
  await addUser(adminA.token, 'Customer Two', 'cust2@orga.test', 'customer');
  agent = await login('agent@orga.test');
  customer1 = await login('cust1@orga.test');
  customer2 = await login('cust2@orga.test');

  const t = await request(app).post('/api/tickets').set(auth(customer1))
    .send({ subject: 'Wrong size', body: 'The shoes are too small, need a refund.' });
  expect(t.status).toBe(201);
  ticketId = t.body.id;
});

afterAll(async () => {
  await pool.end();
});

describe('tenant isolation and access rules', () => {
  test('request without a token is rejected', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
  });

  test("org B admin cannot read org A's ticket", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`).set(auth(adminB.token));
    expect(res.status).toBe(404);
  });

  test("org B's ticket list does not include org A tickets", async () => {
    const res = await request(app).get('/api/tickets').set(auth(adminB.token));
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(0);
  });

  test("org B cannot reply to org A's ticket", async () => {
    const res = await request(app).post(`/api/tickets/${ticketId}/messages`)
      .set(auth(adminB.token)).send({ body: 'I should not be able to do this' });
    expect(res.status).toBe(404);
  });

  test("org B cannot change the status of org A's ticket", async () => {
    const res = await request(app).patch(`/api/tickets/${ticketId}`)
      .set(auth(adminB.token)).send({ status: 'resolved' });
    expect(res.status).toBe(404);
  });

  test("another customer in the same org cannot read this customer's ticket", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`).set(auth(customer2));
    expect(res.status).toBe(404);
  });

  test('customers do not see internal notes', async () => {
    await request(app).post(`/api/tickets/${ticketId}/messages`)
      .set(auth(agent)).send({ body: 'Happy to help with your refund.' });
    await request(app).post(`/api/tickets/${ticketId}/messages`)
      .set(auth(agent)).send({ body: 'Internal: check the order first', isInternal: true });

    const asCustomer = await request(app).get(`/api/tickets/${ticketId}`).set(auth(customer1));
    expect(asCustomer.body.messages).toHaveLength(1);
    expect(asCustomer.body.messages.every(m => !m.is_internal)).toBe(true);

    const asAgent = await request(app).get(`/api/tickets/${ticketId}`).set(auth(agent));
    expect(asAgent.body.messages).toHaveLength(2);
  });

  test('customers cannot post internal notes', async () => {
    const res = await request(app).post(`/api/tickets/${ticketId}/messages`)
      .set(auth(customer1)).send({ body: 'sneaky note', isInternal: true });
    expect(res.status).toBe(403);
  });

  test('invalid status transition is rejected', async () => {
    const res = await request(app).patch(`/api/tickets/${ticketId}`)
      .set(auth(agent)).send({ status: 'closed' });
    expect(res.status).toBe(400);
  });

  test('a ticket cannot be assigned to a user from another org', async () => {
    const res = await request(app).patch(`/api/tickets/${ticketId}`)
      .set(auth(agent)).send({ assigneeId: adminB.user.id });
    expect(res.status).toBe(400);
  });
});