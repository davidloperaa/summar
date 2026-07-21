const express = require('express');
const { queryConCliente } = require('../db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /eg — registros con filtros opcionales
router.get('/', async (req, res) => {
  const { desde, hasta, contrato } = req.query;
  const clienteId = req.usuario.cliente_id;

  let where = ['1=1'];
  let params = [];
  let i = 1;

  if (desde)    { where.push(`fecha_inicio >= $${i++}`); params.push(desde); }
  if (hasta)    { where.push(`fecha_inicio <= $${i++}`); params.push(hasta); }
  if (contrato) { where.push(`contrato_comercial = $${i++}`); params.push(contrato); }

  try {
    const result = await queryConCliente(
      clienteId,
      `SELECT * FROM eg_enfermedades WHERE ${where.join(' AND ')} ORDER BY fecha_inicio DESC`,
      params
    );
    res.json({ total: result.rowCount, datos: result.rows });
  } catch (err) {
    console.error('Error GET /eg:', err.message);
    res.status(500).json({ error: 'Error consultando enfermedades generales' });
  }
});

// GET /eg/kpis
router.get('/kpis', async (req, res) => {
  const { desde, hasta } = req.query;
  const clienteId = req.usuario.cliente_id;

  let filtroFecha = '';
  let params = [];
  if (desde && hasta) {
    filtroFecha = `AND fecha_inicio BETWEEN $1 AND $2`;
    params = [desde, hasta];
  }

  try {
    const result = await queryConCliente(clienteId, `
      SELECT
        COUNT(*)                                                    AS total,
        COALESCE(SUM(dias_incapacidad), 0)                         AS dias_ausentismo,
        COALESCE(SUM(dias_acumulados), 0)                          AS dias_acumulados,
        COUNT(*) FILTER (WHERE genero = 'M')                       AS genero_m,
        COUNT(*) FILTER (WHERE genero = 'F')                       AS genero_f,
        json_object_agg(COALESCE(diagnostico,'Sin diagnóstico'),
          COUNT(*))                                                 AS por_diagnostico,
        json_object_agg(COALESCE(grupo_causas,'Sin grupo'),
          COUNT(*))                                                 AS por_grupo_causas,
        json_object_agg(COALESCE(codigo_diagnostico,'Sin código'),
          COUNT(*))                                                 AS por_codigo,
        json_object_agg(COALESCE(contrato_comercial,'Sin contrato'),
          COUNT(*))                                                 AS por_contrato,
        json_object_agg(COALESCE(cargo,'Sin cargo'), COUNT(*))     AS por_cargo
      FROM eg_enfermedades
      WHERE 1=1 ${filtroFecha}
    `, params);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error GET /eg/kpis:', err.message);
    res.status(500).json({ error: 'Error calculando KPIs de EG' });
  }
});

module.exports = router;
