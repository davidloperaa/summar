require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// ── CORS ──────────────────────────────────────────────────────
const origenesPermitidos = [
  process.env.FRONTEND_URL,
  'https://summar-productividad.netlify.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origenesPermitidos.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqueado para: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── MIDDLEWARES ────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limit general
app.use(rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── RUTAS ─────────────────────────────────────────────────────
app.use('/auth',          require('./routes/auth'));
app.use('/at',            require('./routes/at'));
app.use('/eg',            require('./routes/eg'));
app.use('/casos-medicos', require('./routes/casosMedicos'));
app.use('/modulos',       require('./routes/modulos'));
app.use('/ingesta',       require('./routes/ingesta'));

// Health check — para Railway / Render
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── MANEJO DE ERRORES ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── INICIO ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Summar API corriendo en puerto ${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health:  http://localhost:${PORT}/health\n`);
});
