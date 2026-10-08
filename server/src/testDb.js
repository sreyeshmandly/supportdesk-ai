const pool = require('./config/db');

(async () => {
  try {
    const [rows] = await pool.query('SELECT VERSION() AS version, DATABASE() AS db');
    console.log('Connected:', rows[0]);
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await pool.end();
  }
})();