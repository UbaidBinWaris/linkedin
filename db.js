const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.pg_username,
  host: 'localhost',
  database: process.env.pg_database,
  password: process.env.pg_password,
  port: 5432,
});

const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS linkedin_accounts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        session_data JSONB,
        session_status VARCHAR(50) DEFAULT 'unknown',
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database initialized: linkedin_accounts table ready.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  initializeDatabase,
};
