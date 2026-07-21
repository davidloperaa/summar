const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

// Ejecuta una query con RLS: establece el cliente_id en la sesión de PG
// para que las políticas de Row Level Security se apliquen automáticamente
async function queryConCliente(clienteId, text, params = []) {
  const client = await pool.connect();
  try {
    await client.query(`SET LOCAL app.cliente_id = '${clienteId}'`);
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

module.exports = { pool, queryConCliente };
