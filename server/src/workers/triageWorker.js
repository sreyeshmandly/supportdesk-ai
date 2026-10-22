
require('dotenv').config();

const { Worker } = require('bullmq');
const pool = require('../config/db');
const { processTriageJob } = require('./triageProcessor');
const { recoverPendingTickets } = require('./triageRecovery');

const queueName = 'ticket-triage';

function createRedisConnection() {
  const requiredVariables = [
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD'
  ];

  for (const variable of requiredVariables) {
    if (!process.env[variable]) {
      throw new Error(`${variable} is missing from server/.env`);
    }
  }

  const port = Number(process.env.REDIS_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('REDIS_PORT must be a valid port number');
  }

  return {
    host: process.env.REDIS_HOST,
    port,
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null
  };
}

const worker = new Worker(
  queueName,
  processTriageJob,
  {
    connection: createRedisConnection(),
    concurrency: 2
  }
);

worker.on('completed', (job) => {
  console.log(`Triage job ${job.id} completed successfully.`);
});

worker.on('failed', (job, error) => {
  console.error(
    `Triage job ${job?.id ?? 'unknown'} failed:`,
    error.message
  );

  // Wait until BullMQ has exhausted all configured attempts.
  if (!job || job.attemptsMade < (job.opts.attempts || 1)) {
    return;
  }

  const { ticketId, orgId } = job.data || {};

  if (!Number.isInteger(ticketId) || !Number.isInteger(orgId)) {
    return;
  }

  // Do not overwrite completed or skipped tickets.
  pool.execute(
    `UPDATE tickets
     SET triage_status = 'failed'
     WHERE id = ? AND org_id = ?
       AND triage_status IN ('pending', 'queued')`,
    [ticketId, orgId]
  ).catch((dbError) => {
    console.error(
      `Could not mark triage failed for ticket ${ticketId}:`,
      dbError.message
    );
  });
});

worker.on('error', (error) => {
  console.error('Triage worker error:', error.message);
});

// Recover tickets that were saved but not successfully queued.
let recoveryRunning = false;

async function runRecovery() {
  if (recoveryRunning) {
    return;
  }

  recoveryRunning = true;

  try {
    const result = await recoverPendingTickets();

    if (result.scanned > 0) {
      console.log('Triage recovery:', result);
    }
  } catch (error) {
    console.error('Triage recovery error:', error.message);
  } finally {
    recoveryRunning = false;
  }
}

// Run once at startup.
void runRecovery();

// Retry recovery every 15 seconds.
const recoveryTimer = setInterval(() => {
  void runRecovery();
}, 15000);

recoveryTimer.unref();

worker.on('closing', () => {
  clearInterval(recoveryTimer);
});

console.log('AI ticket triage worker started.');

module.exports = worker;
