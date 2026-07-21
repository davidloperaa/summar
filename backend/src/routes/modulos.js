// Endpoints genéricos para los módulos con estructura JSONB:
// seleccion, personal_activo, rotacion, formacion_sst,
// entrevistas_retiro, talento_disciplinario, bienestar_actividades

const express = require('express');
const { queryConCliente } = require('../db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

const TABLAS_PERMITIDAS = new Set([
  'seleccion',
  'personal_activo',
  'rotacion',
  'formacion_sst',
  'entrevistas_retiro',
  'talento_disciplinario',
  'bienestar_actividades',
]);

// GET /modulos/:tabla
router.get('/:tabla', async (req, res) => {
  const { tabla } = req.params;

  if (!TABLAS_PERMITIDAS.has(tabla)) {
    return res.status(404).json({ error: 'Módulo no encontrado' });
  }

  try {
    const result = await queryConCliente(
      req.usuario.cliente_id,
      `SELECT id, datos, cargado_en FROM ${tabla} ORDER BY cargado_en DESC`
    );
    res.json({ total: result.rowCount, datos: result.rows.map(r => r.datos) });
  } catch (err) {
    console.error(`Error GET /modulos/${tabla}:`, err.message);
    res.status(500).json({ error: 'Error consultando módulo' });
  }
});

module.exports = router;
