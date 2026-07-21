const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
});

// POST /auth/login
router.post('/login', limiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.nombre, u.rol, u.activo,
              c.id AS cliente_id, c.nombre AS cliente_nombre, c.nit
       FROM usuarios u
       JOIN clientes c ON c.id = u.cliente_id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    const usuario = result.rows[0];

    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      {
        usuario_id: usuario.id,
        cliente_id: usuario.cliente_id,
        email: usuario.email,
        rol: usuario.rol,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      usuario: {
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        cliente: {
          id: usuario.cliente_id,
          nombre: usuario.cliente_nombre,
          nit: usuario.nit,
        },
      },
    });
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /auth/cambiar-password
router.post('/cambiar-password', require('../middleware/auth').verificarToken, async (req, res) => {
  const { password_actual, password_nuevo } = req.body;

  if (!password_actual || !password_nuevo || password_nuevo.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [req.usuario.usuario_id]
    );

    const usuario = result.rows[0];
    const valida = await bcrypt.compare(password_actual, usuario.password_hash);
    if (!valida) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const hash = await bcrypt.hash(password_nuevo, 12);
    await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
      [hash, req.usuario.usuario_id]
    );

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error cambiando contraseña:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
