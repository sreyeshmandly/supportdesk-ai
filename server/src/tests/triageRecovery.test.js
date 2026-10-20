jest.mock('../config/db', () => ({
  execute: jest.fn()
}));

jest.mock('../queues/triageQueue', () => ({
  add: jest.fn()
}));

const pool = require('../config/db');
const triageQueue = require('../queues/triageQueue');
const { recoverPendingTickets } = require('../workers/triageRecovery');

describe('Triage recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.execute.mockResolvedValue([[]]);
    triageQueue.add.mockResolvedValue({});
  });

  test('queues pending tickets and updates their status', async () => {
    pool.execute.mockResolvedValueOnce([[
      {
        id: 12,
        org_id: 3,
        subject: 'Refund request',
        body: 'I need a refund.'
      },
      {
        id: 13,
        org_id: 4,
        subject: 'Login issue',
        body: 'I cannot log in.'
      }
    ]]);

    const result = await recoverPendingTickets();

    expect(result).toEqual({
      scanned: 2,
      queued: 2,
      failed: 0
    });

    expect(triageQueue.add).toHaveBeenCalledTimes(2);

    expect(triageQueue.add).toHaveBeenNthCalledWith(
      1,
      'triage-ticket',
      {
        ticketId: 12,
        orgId: 3,
        subject: 'Refund request',
        body: 'I need a refund.'
      },
      expect.objectContaining({
        jobId: 'triage-12',
        attempts: 3
      })
    );

    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("SET triage_status = 'queued'"),
      [12, 3]
    );

    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining("SET triage_status = 'queued'"),
      [13, 4]
    );
  });

  test('recovered job includes the ticket body', async () => {
    pool.execute.mockResolvedValueOnce([[
      {
        id: 30,
        org_id: 7,
        subject: 'Refund request',
        body: 'The product arrived damaged.'
      }
    ]]);

    await recoverPendingTickets();

    expect(triageQueue.add).toHaveBeenCalledWith(
      'triage-ticket',
      {
        ticketId: 30,
        orgId: 7,
        subject: 'Refund request',
        body: 'The product arrived damaged.'
      },
      expect.objectContaining({
        jobId: 'triage-30',
        attempts: 3
      })
    );
  });
  test('returns zero counts when no pending tickets exist', async () => {
    const result = await recoverPendingTickets();

    expect(result).toEqual({
      scanned: 0,
      queued: 0,
      failed: 0
    });

    expect(triageQueue.add).not.toHaveBeenCalled();
  });

  test('leaves a ticket recoverable when queueing fails', async () => {
    pool.execute.mockResolvedValueOnce([[
      {
        id: 20,
        org_id: 5,
        subject: 'Payment issue',
        body: 'Payment did not complete.'
      }
    ]]);

    triageQueue.add.mockRejectedValueOnce(
      new Error('Simulated Redis failure')
    );

    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const result = await recoverPendingTickets();

      expect(result).toEqual({
        scanned: 1,
        queued: 0,
        failed: 1
      });

      expect(pool.execute).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  test('does not overwrite status when updating queued status fails', async () => {
    pool.execute
      .mockResolvedValueOnce([[
        {
          id: 21,
          org_id: 5,
          subject: 'Account issue',
          body: 'Please check my account.'
        }
      ]])
      .mockRejectedValueOnce(new Error('Simulated database failure'));

    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    try {
      const result = await recoverPendingTickets();

      expect(result).toEqual({
        scanned: 1,
        queued: 1,
        failed: 0
      });

      expect(triageQueue.add).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  test.each([0, -1, 101, 1.5, '25', null])(
    'rejects invalid recovery limit: %s',
    async (limit) => {
      await expect(
        recoverPendingTickets({ limit })
      ).rejects.toThrow(
        'Recovery limit must be an integer between 1 and 100'
      );

      expect(pool.execute).not.toHaveBeenCalled();
      expect(triageQueue.add).not.toHaveBeenCalled();
    }
  );

  test('accepts a valid custom recovery limit', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    await expect(
      recoverPendingTickets({ limit: 10 })
    ).resolves.toEqual({
      scanned: 0,
      queued: 0,
      failed: 0
    });

    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT ?'),
      [10]
    );
  });
});
