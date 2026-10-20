
const pool = require('../config/db');
const triageQueue = require('../queues/triageQueue');

const DEFAULT_BATCH_SIZE = 25;

async function recoverPendingTickets({ limit = DEFAULT_BATCH_SIZE } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Recovery limit must be an integer between 1 and 100');
  }

  const [tickets] = await pool.execute(
    `SELECT id, org_id, subject, body
     FROM tickets
     WHERE triage_status = 'pending'
     ORDER BY id ASC
     LIMIT ?`,
    [limit]
  );

  let queued = 0;
  let failed = 0;

  for (const ticket of tickets) {
    try {
      await triageQueue.add(
        'triage-ticket',
        {
          ticketId: ticket.id,
          orgId: ticket.org_id,
          subject: ticket.subject,
          body: ticket.body,
        },
        {
          jobId: `triage-${ticket.id}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: 100,
          removeOnFail: 500
        }
      );

      queued += 1;

      // Do not overwrite "completed" if the worker finishes first.
      try {
        await pool.execute(
          `UPDATE tickets
           SET triage_status = 'queued'
           WHERE id = ? AND org_id = ? AND triage_status = 'pending'`,
          [ticket.id, ticket.org_id]
        );
      } catch (statusError) {
        console.error(
          `Could not update triage status for ticket ${ticket.id}:`,
          statusError.message
        );
      }
    } catch (queueError) {
      failed += 1;

      // Leave the ticket pending so a later recovery pass can retry it.
      console.error(
        `Could not recover triage for ticket ${ticket.id}:`,
        queueError.message
      );
    }
  }

  return {
    scanned: tickets.length,
    queued,
    failed
  };
}

module.exports = { recoverPendingTickets };
