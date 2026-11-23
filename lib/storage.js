const { Pool } = require('pg');

let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw Error('Booking database required');
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 4000 });
    pool.on('error', error => console.error('Booking database connection', { code: error.code }));
  }
  return pool;
}

async function transaction(action) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { database, transaction };
