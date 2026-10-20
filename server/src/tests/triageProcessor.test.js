
jest.mock('../config/db', () => ({
  execute: jest.fn(),
  getConnection: jest.fn()
}));

jest.mock('../ai/triage', () => ({
  triageTicket: jest.fn()
}));

const pool = require('../config/db');
const { triageTicket } = require('../ai/triage');
const { processTriageJob } = require('../workers/triageProcessor');

describe('AI triage processor', () => {
  const job = {
    data: {
      ticketId: 12,
      orgId: 3,
      subject: 'Refund request',
      body: 'I need a refund for my order.'
    }
  };

  const result = {
    category: 'refund',
    priority: 'medium',
    sentiment: 'frustrated',
    confidence: 0.95,
    model: 'gpt-4.1-mini',
    usage: { total_tokens: 100 }
  };

  let connection;

  beforeEach(() => {
    jest.clearAllMocks();

    connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValue(connection);

    // The ticket exists, but no triage suggestion exists yet.
    pool.execute
      .mockResolvedValueOnce([[{ id: 12 }]])
      .mockResolvedValueOnce([[]]);

    // The ticket exists while locked, and no suggestion exists.
    connection.execute
      .mockResolvedValueOnce([[{ id: 12 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValue([{}]);

    triageTicket.mockResolvedValue(result);
  });

  test('saves AI results for a ticket in the specified organization', async () => {
    const output = await processTriageJob(job);

    expect(output).toMatchObject({
      ticketId: 12,
      orgId: 3,
      category: 'refund',
      priority: 'medium'
    });

    expect(triageTicket).toHaveBeenCalledWith({
      subject: 'Refund request',
      body: 'I need a refund for my order.'
    });

    // The AI call must happen after both locked database checks.
    expect(triageTicket.mock.invocationCallOrder[0]).toBeGreaterThan(
      connection.execute.mock.invocationCallOrder[0]
    );

    expect(triageTicket.mock.invocationCallOrder[0]).toBeGreaterThan(
      connection.execute.mock.invocationCallOrder[1]
    );

    expect(connection.execute).toHaveBeenCalledWith(
    `UPDATE tickets
    SET category = ?, priority = ?, triage_status = 'completed'
    WHERE id = ? AND org_id = ?`,
    ['refund', 'medium', 12, 3]
    );

    const insertCall = connection.execute.mock.calls.find(
      ([sql]) =>
        typeof sql === 'string' &&
        sql.includes('INSERT INTO ai_suggestions')
    );

    expect(insertCall).toBeDefined();
    expect(insertCall[1][0]).toBe(12);
    expect(insertCall[1][1]).toBe('gpt-4.1-mini');

    expect(JSON.parse(insertCall[1][2])).toMatchObject({
      category: 'refund',
      priority: 'medium',
      sentiment: 'frustrated'
    });

    expect(insertCall[1][3]).toBe(0.95);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test('does not call AI when the ticket is not in the specified organization', async () => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValueOnce([[]]);

    await expect(processTriageJob(job)).rejects.toThrow(
      'Ticket does not exist in the specified organization'
    );

    expect(triageTicket).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('rejects an invalid organization ID', async () => {
    const invalidJob = {
      data: { ...job.data, orgId: 0 }
    };

    await expect(processTriageJob(invalidJob)).rejects.toThrow(
      'Job must contain a valid orgId'
    );

    expect(pool.execute).not.toHaveBeenCalled();
    expect(triageTicket).not.toHaveBeenCalled();
  });

  test('skips AI when a triage suggestion already exists', async () => {
    pool.execute.mockReset();

    pool.execute
      .mockResolvedValueOnce([[{ id: 12 }]])
      .mockResolvedValueOnce([[{ id: 99 }]]);

    const output = await processTriageJob(job);

    expect(output).toMatchObject({
      ticketId: 12,
      orgId: 3,
      skipped: true,
      reason: 'triage_already_exists'
    });

    expect(triageTicket).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('rolls back when saving AI results fails', async () => {
    connection.execute
      .mockReset()
      .mockResolvedValueOnce([[{ id: 12 }]])
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error('Simulated database error'));

    await expect(processTriageJob(job)).rejects.toThrow(
      'Simulated database error'
    );

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });
});
