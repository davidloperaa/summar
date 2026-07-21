// Script de migración: crea todas las tablas en la BD
// Uso: node src/migrate.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('Ejecutando schema.sql...');
    await client.query(sql);
    console.log('✓ Migración completada. Tablas creadas correctamente.');
    console.log('\nUsuario inicial:');
    console.log('  Email:      admin@summar.co');
    console.log('  Contraseña: Summar2024!');
    console.log('\nCAMBIA LA CONTRASEÑA antes de poner en producción.');
  } catch (err) {
    console.error('✗ Error en migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
