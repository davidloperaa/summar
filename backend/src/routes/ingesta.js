// Ingesta de datos desde Excel
// POST /ingesta/excel — recibe el archivo, lo parsea e inserta en BD

const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { pool, queryConCliente } = require('../db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// Multer en memoria (no guarda en disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const validos = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (validos.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se aceptan archivos Excel (.xlsx, .xls)'));
    }
  },
});

// Mapeo de nombre de hoja → tabla y función de transformación
const HOJAS = {
  AT:          { tabla: 'at_accidentes',         fn: transformarAT },
  EG:          { tabla: 'eg_enfermedades',        fn: transformarEG },
  CASOS_MEDICOS: { tabla: 'casos_medicos',        fn: transformarCM },
  SINIESTRO:   { tabla: 'casos_medicos',          fn: transformarCM },
  SELECCION:   { tabla: 'seleccion',              fn: transformarGenerico },
  PERSONAL_ACTIVO: { tabla: 'personal_activo',   fn: transformarGenerico },
  ROTACION:    { tabla: 'rotacion',               fn: transformarGenerico },
  FORMACION_SST: { tabla: 'formacion_sst',        fn: transformarGenerico },
  ENTREVISTAS_RETIRO: { tabla: 'entrevistas_retiro', fn: transformarGenerico },
  TALENTO_DISCIPLINARIO: { tabla: 'talento_disciplinario', fn: transformarGenerico },
  BIENESTAR_ACTIVIDADES: { tabla: 'bienestar_actividades', fn: transformarGenerico },
};

// POST /ingesta/excel
router.post('/excel', upload.single('archivo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }

  const clienteId = req.usuario.cliente_id;
  const { modo = 'reemplazar' } = req.body; // 'reemplazar' | 'acumular'
  const reporte = {};

  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });

    for (const nombreHoja of wb.SheetNames) {
      const clave = nombreHoja.toUpperCase().replace(/\s+/g, '_');
      const config = HOJAS[clave];
      if (!config) continue;

      const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], { defval: '' });
      if (filas.length === 0) { reporte[nombreHoja] = { cargados: 0, omitidos: 0 }; continue; }

      const registros = filas.map(f => config.fn(f, clienteId)).filter(Boolean);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL app.cliente_id = '${clienteId}'`);

        if (modo === 'reemplazar') {
          await client.query(
            `DELETE FROM ${config.tabla} WHERE cliente_id = $1`,
            [clienteId]
          );
        }

        let cargados = 0;
        for (const reg of registros) {
          try {
            await insertarRegistro(client, config.tabla, reg);
            cargados++;
          } catch (e) {
            // Registro individual con error: continúa con los demás
          }
        }

        await client.query('COMMIT');
        reporte[nombreHoja] = { cargados, omitidos: registros.length - cargados };
      } catch (err) {
        await client.query('ROLLBACK');
        reporte[nombreHoja] = { error: err.message };
      } finally {
        client.release();
      }
    }

    res.json({ ok: true, reporte });
  } catch (err) {
    console.error('Error procesando Excel:', err.message);
    res.status(500).json({ error: 'Error procesando el archivo Excel', detalle: err.message });
  }
});

// GET /ingesta/estado — última carga por módulo
router.get('/estado', async (req, res) => {
  const clienteId = req.usuario.cliente_id;
  try {
    const tablas = [
      'at_accidentes', 'eg_enfermedades', 'casos_medicos',
      'seleccion', 'personal_activo', 'rotacion',
      'formacion_sst', 'entrevistas_retiro', 'talento_disciplinario', 'bienestar_actividades',
    ];

    const estado = {};
    for (const tabla of tablas) {
      const r = await queryConCliente(
        clienteId,
        `SELECT COUNT(*) AS total, MAX(cargado_en) AS ultima_carga FROM ${tabla}`
      );
      estado[tabla] = r.rows[0];
    }
    res.json(estado);
  } catch (err) {
    console.error('Error GET /ingesta/estado:', err.message);
    res.status(500).json({ error: 'Error consultando estado de carga' });
  }
});

// ============================================================
// FUNCIONES DE TRANSFORMACIÓN
// Cada una convierte una fila del Excel al formato de la tabla
// ============================================================

function transformarAT(fila, clienteId) {
  const f = normalizar(fila);
  return {
    cliente_id:            clienteId,
    empresa:               f['Empresa'] || f['empresa'],
    nit:                   f['NIT'] || f['nit'],
    numdocumento:          f['Numdocumento'] || f['numdocumento'],
    nombres:               f['Nombres'] || f['nombres'],
    genero:                (f['Genero'] || f['genero'] || '').toUpperCase().charAt(0) || null,
    fecha_nacimiento:      parseFecha(f['FechaNacimiento'] || f['fecha_nacimiento']),
    fecha_ingreso:         parseFecha(f['FechaIngreso'] || f['fecha_ingreso']),
    cargo:                 f['Cargo'] || f['cargo'],
    contrato_comercial:    f['ContratoComercial'] || f['contrato_comercial'] || f['Sucursal'],
    ciudad:                f['Ciudad'] || f['ciudad'],
    fecha_accidente:       parseFecha(f['FechaAccidente'] || f['fecha_accidente']),
    hora_accidente:        f['HoraAccidente'] || f['hora_accidente'] || null,
    fecha_reporte:         parseFecha(f['FechaReporte'] || f['fecha_reporte']),
    tipo_accidente:        f['TipoAccidente'] || f['tipo_accidente'],
    causa:                 f['CAUSA'] || f['causa'],
    mecanismo_accidente:   f['MecanismoAccidente'] || f['mecanismo_accidente'],
    agente_causa:          f['AgenteCausa'] || f['agente_causa'],
    parte_cuerpo_afectada: f['ParteCuerpoAfectada'] || f['parte_cuerpo_afectada'],
    tipo_lesion:           f['TipoLesion'] || f['tipo_lesion'],
    dias_incapacidad:      parseInt(f['DiasIncapacidad'] || f['dias_incapacidad']) || 0,
    peligro:               f['Peligro'] || f['peligro'],
    estado:                f['Estado'] || f['estado'],
    descripcion:           f['Descripcion'] || f['descripcion'],
  };
}

function transformarEG(fila, clienteId) {
  const f = normalizar(fila);
  return {
    cliente_id:         clienteId,
    empresa:            f['Empresa'] || f['empresa'],
    nit:                f['NIT'] || f['nit'],
    numdocumento:       f['Numdocumento'] || f['numdocumento'],
    nombres:            f['Nombres'] || f['nombres'],
    genero:             (f['Genero'] || f['genero'] || '').toUpperCase().charAt(0) || null,
    fecha_nacimiento:   parseFecha(f['FechaNacimiento'] || f['fecha_nacimiento']),
    fecha_ingreso:      parseFecha(f['FechaIngreso'] || f['fecha_ingreso']),
    cargo:              f['Cargo'] || f['cargo'],
    contrato_comercial: f['ContratoComercial'] || f['contrato_comercial'] || f['Sucursal'],
    ciudad:             f['Ciudad'] || f['ciudad'],
    fecha_inicio:       parseFecha(f['FechaInicio'] || f['fecha_inicio']),
    fecha_fin:          parseFecha(f['FechaFin'] || f['fecha_fin']),
    dias_incapacidad:   parseInt(f['DiasIncapacidad'] || f['dias_incapacidad']) || 0,
    dias_acumulados:    parseInt(f['DiasAcumulados'] || f['dias_acumulados']) || 0,
    codigo_diagnostico: f['CodigoDiagnostico'] || f['codigo_diagnostico'],
    letra:              f['Letra'] || f['letra'],
    diagnostico:        f['Diagnostico'] || f['diagnostico'],
    grupo_diagnostico:  f['GrupoDiagnostico'] || f['grupo_diagnostico'],
    grupo_causas:       f['GrupoCausas'] || f['grupo_causas'],
    tipo_incapacidad:   f['TipoIncapacidad'] || f['tipo_incapacidad'],
    edad:               parseInt(f['Edad'] || f['edad']) || null,
  };
}

function transformarCM(fila, clienteId) {
  const f = normalizar(fila);
  return {
    cliente_id:           clienteId,
    empresa:              f['Empresa'] || f['empresa'],
    nit:                  f['NIT'] || f['nit'],
    numdocumento:         f['Numdocumento'] || f['numdocumento'],
    nombres:              f['Nombres'] || f['nombres'],
    cargo:                f['Cargo'] || f['cargo'],
    contrato_comercial:   f['ContratoComercial'] || f['contrato_comercial'],
    tipo_caso:            f['TipoCaso'] || f['tipo_caso'],
    fecha_inicio:         parseFecha(f['FechaInicio'] || f['fecha_inicio']),
    fecha_fin:            parseFecha(f['FechaFin'] || f['fecha_fin']),
    tipo_siniestro:       f['TipoSiniestro'] || f['tipo_siniestro'],
    tipo_fuero:           f['TipoFuero'] || f['tipo_fuero'],
    estado:               f['Estado'] || f['estado'],
    calificacion:         f['Calificacion'] || f['calificacion'],
    porcentaje_perdida:   parseFloat(f['PorcentajePerdida'] || f['porcentaje_perdida']) || null,
    entidad_calificadora: f['EntidadCalificadora'] || f['entidad_calificadora'],
    nivel_riesgo:         f['NivelRiesgo'] || f['nivel_riesgo'],
    estado_gestion:       f['EstadoGestion'] || f['estado_gestion'],
    observaciones:        f['Observaciones'] || f['observaciones'],
  };
}

function transformarGenerico(fila, clienteId) {
  return { cliente_id: clienteId, datos: fila };
}

// ============================================================
// HELPERS
// ============================================================

function normalizar(fila) {
  // Elimina espacios en blanco en los valores de texto
  const result = {};
  for (const [k, v] of Object.entries(fila)) {
    result[k] = typeof v === 'string' ? v.trim() : v;
  }
  return result;
}

function parseFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

async function insertarRegistro(client, tabla, reg) {
  if (tabla === 'seleccion' || tabla === 'personal_activo' || tabla === 'rotacion' ||
      tabla === 'formacion_sst' || tabla === 'entrevistas_retiro' ||
      tabla === 'talento_disciplinario' || tabla === 'bienestar_actividades') {
    await client.query(
      `INSERT INTO ${tabla} (cliente_id, datos) VALUES ($1, $2)`,
      [reg.cliente_id, reg.datos]
    );
    return;
  }

  const campos = Object.keys(reg).filter(k => k !== 'cliente_id' && reg[k] !== null && reg[k] !== '');
  const cols = ['cliente_id', ...campos].join(', ');
  const vals = ['$1', ...campos.map((_, i) => `$${i + 2}`)].join(', ');
  const values = [reg.cliente_id, ...campos.map(k => reg[k])];

  await client.query(`INSERT INTO ${tabla} (${cols}) VALUES (${vals})`, values);
}

module.exports = router;
