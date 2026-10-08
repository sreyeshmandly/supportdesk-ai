const express = require('express');
const { z } = require('zod');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const STATUSES = ['open', 'pending', 'resolved', 'closed'];

// Allowed status moves. Enforced on the server, never trusted from the browser.
const transitions = {
  open: ['pending', 'resolved'],
  pending: ['open', 'resolved'],
  resolved: ['open', 'closed'],
  closed: []
};

const idParam = z.coerce.number().int().positive();

const createSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(5).max(5000)
});

const listSchema = z.object({
  status: z.enum(STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const messageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().optional().default(false)
});

const updateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  assigneeId: z.number().int().positive().nullable().optional()
}).refine(d => d.status !== undefined || d.assigneeId !== undefined,
  { message: 'Nothing to update' });

// THE tenant rule: every lookup is scoped by org_id,
// and customers can only see tickets they created.
async function findTicket(req, id) {
  let sql = 'SELECT * FROM tickets WHERE id = ? AND org_id = ?';
  const params = [id, req.user.orgId];
  if (req.user.role === 'customer') {
    sql += ' AND requester_id = ?';
    params.push(req.user.id);
  }
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
}

// Create a ticket
router.post('/', async (req, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const [r] = await pool.execute(
      `INSERT INTO tickets (org_id, requester_id, subject, body, sla_due_at)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 4 HOUR))`,
      [req.user.orgId, req.user.id, d.subject, d.body]);
    res.status(201).json({ id: r.insertId, status: 'open' });
  } catch (err) {
    next(err);
  }
});

// List tickets (paginated, optional status filter)
router.get('/', async (req, res, next) => {
  try {
    const q = listSchema.parse(req.query);
    const where = ['org_id = ?'];
    const params = [req.user.orgId];
    if (req.user.role === 'customer') {
      where.push('requester_id = ?');
      params.push(req.user.id);
    }
    if (q.status) {
      where.push('status = ?');
      params.push(q.status);
    }
    const offset = (q.page - 1) * q.limit;
    const [rows] = await pool.query(
      `SELECT id, subject, status, priority, category, requester_id,
              assignee_id, sla_due_at, created_at
       FROM tickets WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, q.limit, offset]);
    res.json({ page: q.page, limit: q.limit, tickets: rows });
  } catch (err) {
    next(err);
  }
});

// View one ticket with its messages
router.get('/:id', async (req, res, next) => {
  try {
    const id = idParam.parse(req.params.id);
    const ticket = await findTicket(req, id);
    if (!ticket) return res.status(404).json({ error: 'Not found' });

    let sql = `SELECT m.id, m.author_id, u.name AS author_name, m.body,
                      m.is_internal, m.created_at
               FROM ticket_messages m JOIN users u ON u.id = m.author_id
               WHERE m.ticket_id = ?`;
    if (req.user.role === 'customer') sql += ' AND m.is_internal = 0';
    sql += ' ORDER BY m.created_at, m.id';
    const [messages] = await pool.execute(sql, [id]);

    res.json({ ...ticket, messages });
  } catch (err) {
    next(err);
  }
});

// Add a reply or internal note
router.post('/:id/messages', async (req, res, next) => {
  try {
    const id = idParam.parse(req.params.id);
    const d = messageSchema.parse(req.body);
    if (req.user.role === 'customer' && d.isInternal) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const ticket = await findTicket(req, id);
    if (!ticket) return res.status(404).json({ error: 'Not found' });

    const [r] = await pool.execute(
      'INSERT INTO ticket_messages (ticket_id, author_id, body, is_internal) VALUES (?, ?, ?, ?)',
      [id, req.user.id, d.body, d.isInternal ? 1 : 0]);

    // First public reply from staff starts the "first response" clock
    if (req.user.role !== 'customer' && !d.isInternal && !ticket.first_response_at) {
      await pool.execute(
        'UPDATE tickets SET first_response_at = NOW() WHERE id = ? AND org_id = ?',
        [id, req.user.orgId]);
    }
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    next(err);
  }
});

// Change status and/or assignee (staff only)
router.patch('/:id', requireRole('admin', 'agent'), async (req, res, next) => {
  try {
    const id = idParam.parse(req.params.id);
    const d = updateSchema.parse(req.body);
    const ticket = await findTicket(req, id);
    if (!ticket) return res.status(404).json({ error: 'Not found' });

    const sets = [];
    const vals = [];

    if (d.status !== undefined) {
      if (!transitions[ticket.status].includes(d.status)) {
        return res.status(400).json({
          error: `Cannot move from ${ticket.status} to ${d.status}`
        });
      }
      sets.push('status = ?');
      vals.push(d.status);
    }

    if (d.assigneeId !== undefined) {
      if (d.assigneeId !== null) {
        const [u] = await pool.execute(
          "SELECT id FROM users WHERE id = ? AND org_id = ? AND role IN ('admin','agent')",
          [d.assigneeId, req.user.orgId]);
        if (!u.length) {
          return res.status(400).json({ error: 'Assignee must be staff in your organization' });
        }
      }
      sets.push('assignee_id = ?');
      vals.push(d.assigneeId);
    }

    await pool.execute(
      `UPDATE tickets SET ${sets.join(', ')} WHERE id = ? AND org_id = ?`,
      [...vals, id, req.user.orgId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;