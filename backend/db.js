const { Pool } = require('pg');
require('dotenv').config();

// Create a new connection pool to the PostgreSQL database. Connection
// parameters are pulled from environment variables defined in .env.
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

// Export a helper that returns a client for queries. This helper
// centralizes error handling and ensures the pool remains intact even
// when individual connections experience issues.
async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  pool,
};