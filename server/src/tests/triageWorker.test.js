jest.mock('bullmq', () => ({
  Worker: jest.fn()
}));

jest.mock('../config/db', () => ({
  execute: jest.fn()
}));

jest.mock('../workers/triageProcessor', () => ({
  processTriageJob: jest.fn()
}));

jest.mock('../workers/triageRecovery', () => ({
  recoverPendingTickets: jest.fn().mockResolvedValue({
    scanned: 0,
    queued: 0,
    failed: 0
  })
}));

const { EventEmitter } = require('events');
const { Worker } = require('bullmq');
const pool = require('../config/db');
const { recoverPendingTickets } = require('../workers/triageRecovery');

let worker;
let workerInstance;
let originalRedisEnv;

beforeAll(() => {
  originalRedisEnv = {
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD
  };

  // The mocked worker does not connect to Redis.
  // These values only satisfy the worker configuration validation.
  process.env.REDIS_HOST = '127.0.0.1';
  process.env.REDIS_PORT = '6379';
  process.env.REDIS_PASSWORD = 'jest-test-password';

  Worker.mockImplementation(() => {
    workerInstance = new EventEmitter();
    return workerInstance;
  });

  jest.isolateModules(() => {
    worker = require('../workers/triageWorker');
  });
});

afterAll(() => {
  if (workerInstance) {
    workerInstance.emit('closing');
  }

  for (const [key, value] of Object.entries(originalRedisEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

beforeEach(() => {
  jest.clearAllMocks();

  pool.execute.mockResolvedValue([{}]);

  recoverPendingTickets.mockResolvedValue({
    scanned: 0,
    queued: 0,
    failed: 0
  });
});

describe('AI triage worker failure handling', () => {
  test('does not mark a ticket failed while retry attempts remain', () => {
    const job = {
      id: 'triage-12',
      data: {
        ticketId: 12,
        orgId: 3
      },
      attemptsMade: 1,
      opts: {
        attempts: 3
      }
    };

    workerInstance.emit('failed', job, new Error('Temporary AI failure'));

    expect(pool.execute).not.toHaveBeenCalled();
  });

  test('marks the correct organization ticket failed after retries are exhausted', () => {
    const job = {
      id: 'triage-12',
      data: {
        ticketId: 12,
        orgId: 3
      },
      attemptsMade: 3,
      opts: {
        attempts: 3
      }
    };

    workerInstance.emit('failed', job, new Error('AI processing failed'));

    expect(pool.execute).toHaveBeenCalledWith(
      expect.stringContaining(
        "SET triage_status = 'failed'"
      ),
      [12, 3]
    );

    const [sql] = pool.execute.mock.calls[0];

    expect(sql).toContain('WHERE id = ? AND org_id = ?');
    expect(sql).toContain(
      "AND triage_status IN ('pending', 'queued')"
    );
  });

  test('does not update the database when job identifiers are invalid', () => {
    const job = {
      id: 'triage-invalid',
      data: {
        ticketId: 12,
        orgId: '3'
      },
      attemptsMade: 3,
      opts: {
        attempts: 3
      }
    };

    workerInstance.emit('failed', job, new Error('Invalid job'));

    expect(pool.execute).not.toHaveBeenCalled();
  });

  test('logs a database error when marking a ticket failed fails', async () => {
    const databaseError = new Error('Simulated database failure');
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    pool.execute.mockRejectedValueOnce(databaseError);

    const job = {
      id: 'triage-15',
      data: {
        ticketId: 15,
        orgId: 4
      },
      attemptsMade: 3,
      opts: {
        attempts: 3
      }
    };

    try {
      workerInstance.emit(
        'failed',
        job,
        new Error('Final processing failure')
      );

      // Allow the asynchronous database rejection handler to run.
      await new Promise((resolve) => setImmediate(resolve));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Could not mark triage failed for ticket 15:',
        'Simulated database failure'
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  test('clears the recovery timer when the worker closes', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    try {
      workerInstance.emit('closing');

      expect(clearIntervalSpy).toHaveBeenCalled();
    } finally {
      clearIntervalSpy.mockRestore();
    }
  });
});
