const express = require('express');
const { queryConCliente } = require('../db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /at — todos los registros del cliente con filtros opcionales
router.get('/', async (req, res) => {
  const { desde, hasta, contrato, estado } = req.query;
  const clienteId = req.usuario.cliente_id;

  let where = ['1=1'];
  let params = [];
  let i = 1;

  if (desde)    { where.push(`fecha_accidente >= $${i++}`); params.push(desde); }
  if (hasta)    { where.push(`fecha_accidente <= $${i++}`); params.push(hasta); }
  if (contrato) { where.push(`contrato_comercial = $${i++}`); params.push(contrato); }
  if (estado)   { where.push(`estado = $${i++}`); params.push(estado); }

  try {
    const result = await queryConCliente(
      clienteId,
      `SELECT * FROM at_accidentes WHERE ${where.join(' AND ')} ORDER BY fecha_accidente DESC`,
      params
    );
    res.json({ total: result.rowCount, datos: result.rows });
  } catch (err) {
    console.error('Error GET /at:', err.message);
    res.status(500).json({ error: 'Error consultando accidentes de trabajo' });
  }
});

// GET /at/kpis — indicadores agregados para el dashboard
router.get('/kpis', async (req, res) => {
  const { desde, hasta } = req.query;
  const clienteId = req.usuario.cliente_id;

  let filtroFecha = '';
  let params = [];
  if (desde && hasta) {
    filtroFecha = `AND fecha_accidente BETWEEN $1 AND $2`;
    params = [desde, hasta];
  }

  try {
    const result = await queryConCliente(clienteId, `
      SELECT
        COUNT(*)                                                    AS total,
        COALESCE(SUM(dias_incapacidad), 0)                         AS dias_ausentismo,
        COUNT(*) FILTER (WHERE extemporaneo = TRUE)                AS extemporaneos,
        COUNT(*) FILTER (WHERE genero = 'M')                       AS genero_m,
        COUNT(*) FILTER (WHERE genero = 'F')                       AS genero_f,
        json_object_agg(COALESCE(causa,'No clasificado'),
          COUNT(*)) FILTER (WHERE causa IS NOT NULL)               AS por_causa,
        json_object_agg(COALESCE(contrato_comercial,'Sin contrato'),
          COUNT(*))                                                 AS por_contrato,
        json_object_agg(COALESCE(peligro,'Otro'), COUNT(*))        AS por_peligro,
        json_object_agg(COALESCE(tipo_lesion,'Otro'), COUNT(*))    AS por_lesion,
        json_object_agg(COALESCE(mecanismo_accidente,'Otro'),
          COUNT(*))                                                 AS por_mecanismo,
        json_object_agg(COALESCE(parte_cuerpo_afectada,'Otro'),
          COUNT(*))                                                 AS por_cuerpo,
        json_object_agg(COALESCE(cargo,'Sin cargo'), COUNT(*))     AS por_cargo
      FROM at_accidentes
      WHERE 1=1 ${filtroFecha}
    `, params);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error GET /at/kpis:', err.message);
    res.status(500).json({ error: 'Error calculando KPIs de AT' });
  }
});

module.exports = router;
