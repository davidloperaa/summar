const express = require('express');
const { queryConCliente } = require('../db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /casos-medicos
router.get('/', async (req, res) => {
  const { desde, hasta, tipo_caso, estado } = req.query;
  const clienteId = req.usuario.cliente_id;

  let where = ['1=1'];
  let params = [];
  let i = 1;

  if (desde)     { where.push(`fecha_inicio >= $${i++}`); params.push(desde); }
  if (hasta)     { where.push(`fecha_inicio <= $${i++}`); params.push(hasta); }
  if (tipo_caso) { where.push(`tipo_caso = $${i++}`); params.push(tipo_caso); }
  if (estado)    { where.push(`estado = $${i++}`); params.push(estado); }

  try {
    const result = await queryConCliente(
      clienteId,
      `SELECT * FROM casos_medicos WHERE ${where.join(' AND ')} ORDER BY fecha_inicio DESC`,
      params
    );
    res.json({ total: result.rowCount, datos: result.rows });
  } catch (err) {
    console.error('Error GET /casos-medicos:', err.message);
    res.status(500).json({ error: 'Error consultando casos médicos' });
  }
});

// GET /casos-medicos/kpis
router.get('/kpis', async (req, res) => {
  const clienteId = req.usuario.cliente_id;

  try {
    const result = await queryConCliente(clienteId, `
      SELECT
        COUNT(*)                                                    AS total,
        COUNT(*) FILTER (WHERE estado = 'Cerrado')                 AS cerrados,
        COUNT(*) FILTER (WHERE estado != 'Cerrado' OR estado IS NULL) AS abiertos,
        COUNT(*) FILTER (WHERE nivel_riesgo = 'Alto')              AS riesgo_alto,
        json_object_agg(COALESCE(estado,'Sin estado'), COUNT(*))   AS por_estado,
        json_object_agg(COALESCE(tipo_caso,'Sin tipo'), COUNT(*))  AS por_tipo_caso,
        json_object_agg(COALESCE(nivel_riesgo,'Sin nivel'),
          COUNT(*))                                                 AS por_nivel_riesgo
      FROM casos_medicos
    `);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error GET /casos-medicos/kpis:', err.message);
    res.status(500).json({ error: 'Error calculando KPIs de casos médicos' });
  }
});

module.exports = router;
