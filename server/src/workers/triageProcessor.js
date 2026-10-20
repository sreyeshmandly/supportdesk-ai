const pool = require('../config/db');
const { triageTicket } = require('../ai/triage');

async function processTriageJob(job) {
  const { ticketId, orgId, subject, body } = job.data;

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    throw new Error('Job must contain a valid ticketId');
  }

  if (!Number.isInteger(orgId) || orgId <= 0) {
    throw new Error('Job must contain a valid orgId');
  }

  if (typeof subject !== 'string' || typeof body !== 'string') {
    throw new Error('Job must contain a ticket subject and body');
  }

  // Verify that the ticket belongs to the specified organization.
  const [tickets] = await pool.execute(
    'SELECT id FROM tickets WHERE id = ? AND org_id = ?',
    [ticketId, orgId]
  );

  if (tickets.length === 0) {
    throw new Error('Ticket does not exist in the specified organization');
  }

  // Avoid repeating AI work when a triage suggestion is already saved.
  const [existingSuggestions] = await pool.execute(
    `SELECT id
     FROM ai_suggestions
     WHERE ticket_id = ? AND type = 'triage'
     LIMIT 1`,
    [ticketId]
  );

  if (existingSuggestions.length > 0) {
    console.log(
      `Skipping AI triage for ticket ${ticketId}: suggestion already exists.`
    );
  await pool.execute(
  `UPDATE tickets
   SET triage_status = 'completed'
   WHERE id = ? AND org_id = ?`,
  [ticketId, orgId]
);

    return {
      ticketId,
      orgId,
      skipped: true,
      reason: 'triage_already_exists'
    };
  }

  console.log(`Processing AI triage for ticket ${ticketId}`);

  // Acquire a connection. The ticket row is locked before the AI call
  // below so concurrent jobs for this ticket cannot both call the AI.
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Recheck the ticket while holding a row lock.
    const [lockedTickets] = await connection.execute(
      'SELECT id FROM tickets WHERE id = ? AND org_id = ? FOR UPDATE',
      [ticketId, orgId]
    );

    if (lockedTickets.length === 0) {
      throw new Error(
        'Ticket no longer exists in the specified organization'
      );
    }

    // Recheck for an existing suggestion inside the transaction.
    const [lockedSuggestions] = await connection.execute(
      `SELECT id
       FROM ai_suggestions
       WHERE ticket_id = ? AND type = 'triage'
       LIMIT 1`,
      [ticketId]
    );

    if (lockedSuggestions.length > 0) {
      await connection.execute(
        `UPDATE tickets
         SET triage_status = 'completed'
         WHERE id = ? AND org_id = ?`,
        [ticketId, orgId]
      );

      await connection.commit();

      console.log(
        `Skipping duplicate AI triage result for ticket ${ticketId}.`
      );

      return {
        ticketId,
        orgId,
        skipped: true,
        reason: 'triage_already_exists'
      };
    }

    // Run AI only after acquiring the ticket row lock and confirming
    // no other job has already saved a triage suggestion.
    const result = await triageTicket({ subject, body });

    await connection.execute(
    `UPDATE tickets
    SET category = ?, priority = ?, triage_status = 'completed'
    WHERE id = ? AND org_id = ?`,
    [result.category, result.priority, ticketId, orgId]
  );
    const payload = {
      category: result.category,
      priority: result.priority,
      sentiment: result.sentiment,
      confidence: result.confidence,
      model: result.model,
      usage: result.usage
    };

    await connection.execute(
      `INSERT INTO ai_suggestions
        (ticket_id, type, source, payload, confidence)
       VALUES (?, 'triage', ?, ?, ?)`,
      [
        ticketId,
        String(result.model || 'openai').slice(0, 40),
        JSON.stringify(payload),
        result.confidence
      ]
    );

    await connection.commit();

    console.log(`AI triage saved for ticket ${ticketId}`);

    return {
      ticketId,
      orgId,
      category: result.category,
      priority: result.priority,
      sentiment: result.sentiment,
      confidence: result.confidence
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { processTriageJob };
