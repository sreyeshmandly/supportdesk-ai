require('dotenv').config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is missing in server/.env');
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Invalid input',
      details: err.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
    });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

module.exports = app;