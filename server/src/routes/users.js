const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(190),
  password: z.string().min(10).max(72),
  role: z.enum(['agent', 'customer'])
});

// Admin adds an agent or customer to THEIR OWN organization only
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const hash = await bcrypt.hash(d.password, 12);
    const [r] = await pool.execute(
      'INSERT INTO users (org_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [req.user.orgId, d.name, d.email, hash, d.role]);
    res.status(201).json({ id: r.insertId, name: d.name, email: d.email, role: d.role });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    next(err);
  }
});

router.get('/', requireRole('admin', 'agent'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role FROM users WHERE org_id = ? ORDER BY id',
      [req.user.orgId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;