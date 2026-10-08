const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
});

// Used so login takes similar time whether or not the email exists
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const email = z.string().trim().toLowerCase().email().max(190);

const registerSchema = z.object({
  orgName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(100),
  email,
  password: z.string().min(10).max(72)
});

const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72)
});

function signToken(user) {
  return jwt.sign(
    { orgId: user.orgId, role: user.role },
    process.env.JWT_SECRET,
    { subject: String(user.id), expiresIn: '1h' }
  );
}

router.post('/register', authLimiter, async (req, res, next) => {
  let conn;
  try {
    const data = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(data.password, 12);

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [org] = await conn.execute(
      'INSERT INTO organizations (name) VALUES (?)', [data.orgName]);
    const [result] = await conn.execute(
      'INSERT INTO users (org_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [org.insertId, data.name, data.email, hash, 'admin']);
    await conn.commit();

    const user = { id: result.insertId, orgId: org.insertId, role: 'admin' };
    res.status(201).json({
      token: signToken(user),
      user: { id: user.id, orgId: user.orgId, name: data.name, email: data.email, role: 'admin' }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const [rows] = await pool.execute(
      'SELECT id, org_id, name, email, password_hash, role FROM users WHERE email = ?',
      [data.email]);
    const row = rows[0];

    const ok = await bcrypt.compare(data.password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = { id: row.id, orgId: row.org_id, role: row.role };
    res.json({
      token: signToken(user),
      user: { id: row.id, orgId: row.org_id, name: row.name, email: row.email, role: row.role }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, org_id, name, email, role FROM users WHERE id = ? AND org_id = ?',
      [req.user.id, req.user.orgId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;