-- ============================================================
-- SUMMAR PRODUCTIVIDAD — Esquema de base de datos
-- PostgreSQL 14+
-- Ejecutar: psql $DATABASE_URL -f schema.sql
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CLIENTES (empresas que usan Summar)
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT NOT NULL,
  nit           TEXT UNIQUE,
  activo        BOOLEAN DEFAULT TRUE,
  creado_en     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USUARIOS (acceso al dashboard)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre        TEXT,
  rol           TEXT DEFAULT 'viewer' CHECK (rol IN ('admin','viewer')),
  activo        BOOLEAN DEFAULT TRUE,
  creado_en     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_cliente ON usuarios(cliente_id);

-- ============================================================
-- AT — ACCIDENTES DE TRABAJO
-- ============================================================
CREATE TABLE IF NOT EXISTS at_accidentes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  empresa               TEXT,
  nit                   TEXT,
  numdocumento          TEXT,
  nombres               TEXT,
  genero                CHAR(1) CHECK (genero IN ('M','F')),
  fecha_nacimiento      DATE,
  fecha_ingreso         DATE,
  cargo                 TEXT,
  contrato_comercial    TEXT,
  ciudad                TEXT,
  fecha_accidente       DATE,
  hora_accidente        TIME,
  fecha_reporte         DATE,
  extemporaneo          BOOLEAN GENERATED ALWAYS AS (
    CASE
      WHEN fecha_reporte IS NOT NULL AND fecha_accidente IS NOT NULL
        AND fecha_reporte - fecha_accidente > 2
      THEN TRUE ELSE FALSE
    END
  ) STORED,
  tipo_accidente        TEXT,
  causa                 TEXT CHECK (causa IN ('Comportamiento subestándar','Condición insegura','No clasificado')),
  mecanismo_accidente   TEXT,
  agente_causa          TEXT,
  parte_cuerpo_afectada TEXT,
  tipo_lesion           TEXT,
  dias_incapacidad      INTEGER DEFAULT 0,
  peligro               TEXT,
  estado                TEXT,
  descripcion           TEXT,
  cargado_en            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_at_cliente ON at_accidentes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_at_fecha ON at_accidentes(cliente_id, fecha_accidente);

-- ============================================================
-- EG — ENFERMEDADES GENERALES
-- ============================================================
CREATE TABLE IF NOT EXISTS eg_enfermedades (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  empresa             TEXT,
  nit                 TEXT,
  numdocumento        TEXT,
  nombres             TEXT,
  genero              CHAR(1) CHECK (genero IN ('M','F')),
  fecha_nacimiento    DATE,
  fecha_ingreso       DATE,
  cargo               TEXT,
  contrato_comercial  TEXT,
  ciudad              TEXT,
  fecha_inicio        DATE,
  fecha_fin           DATE,
  dias_incapacidad    INTEGER DEFAULT 0,
  dias_acumulados     INTEGER DEFAULT 0,
  codigo_diagnostico  TEXT,
  letra               TEXT,
  diagnostico         TEXT,
  grupo_diagnostico   TEXT,
  grupo_causas        TEXT,
  tipo_incapacidad    TEXT,
  edad                INTEGER,
  cargado_en          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eg_cliente ON eg_enfermedades(cliente_id);
CREATE INDEX IF NOT EXISTS idx_eg_fecha ON eg_enfermedades(cliente_id, fecha_inicio);

-- ============================================================
-- CASOS MÉDICOS (Siniestros + Fueros de Salud)
-- ============================================================
CREATE TABLE IF NOT EXISTS casos_medicos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  empresa               TEXT,
  nit                   TEXT,
  numdocumento          TEXT,
  nombres               TEXT,
  cargo                 TEXT,
  contrato_comercial    TEXT,
  tipo_caso             TEXT,
  fecha_inicio          DATE,
  fecha_fin             DATE,
  tipo_siniestro        TEXT,
  tipo_fuero            TEXT,
  estado                TEXT,
  calificacion          TEXT,
  porcentaje_perdida    NUMERIC(5,2),
  entidad_calificadora  TEXT,
  nivel_riesgo          TEXT,
  estado_gestion        TEXT,
  observaciones         TEXT,
  cargado_en            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_cliente ON casos_medicos(cliente_id);

-- ============================================================
-- MÓDULOS ADICIONALES (estructura flexible con JSONB)
-- Permite agregar columnas sin cambiar el esquema
-- ============================================================
CREATE TABLE IF NOT EXISTS seleccion (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  datos       JSONB NOT NULL,
  cargado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_activo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  datos       JSONB NOT NULL,
  cargado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rotacion (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  datos       JSONB NOT NULL,
  cargado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS formacion_sst (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  datos       JSONB NOT NULL,
  cargado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entrevistas_retiro (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  datos       JSONB NOT NULL,
  cargado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS talento_disciplinario (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  datos       JSONB NOT NULL,
  cargado_en  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bienestar_actividades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  datos       JSONB NOT NULL,
  cargado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para módulos JSONB
CREATE INDEX IF NOT EXISTS idx_seleccion_cliente ON seleccion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_personal_cliente ON personal_activo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_rotacion_cliente ON rotacion(cliente_id);
CREATE INDEX IF NOT EXISTS idx_formacion_cliente ON formacion_sst(cliente_id);
CREATE INDEX IF NOT EXISTS idx_entrevistas_cliente ON entrevistas_retiro(cliente_id);
CREATE INDEX IF NOT EXISTS idx_talento_cliente ON talento_disciplinario(cliente_id);
CREATE INDEX IF NOT EXISTS idx_bienestar_cliente ON bienestar_actividades(cliente_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Garantiza que cada cliente solo acceda a sus propios datos
-- ============================================================
ALTER TABLE at_accidentes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE eg_enfermedades      ENABLE ROW LEVEL SECURITY;
ALTER TABLE casos_medicos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE seleccion            ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_activo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotacion             ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacion_sst        ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrevistas_retiro   ENABLE ROW LEVEL SECURITY;
ALTER TABLE talento_disciplinario ENABLE ROW LEVEL SECURITY;
ALTER TABLE bienestar_actividades ENABLE ROW LEVEL SECURITY;

-- Política: la app pasa el cliente_id como parámetro de sesión
CREATE POLICY at_por_cliente        ON at_accidentes        USING (cliente_id = current_setting('app.cliente_id')::UUID);
CREATE POLICY eg_por_cliente        ON eg_enfermedades      USING (cliente_id = current_setting('app.cliente_id')::UUID);
CREATE POLICY cm_por_cliente        ON casos_medicos        USING (cliente_id = current_setting('app.cliente_id')::UUID);
CREATE POLICY sel_por_cliente       ON seleccion            USING (cliente_id = current_setting('app.cliente_id')::UUID);
CREATE POLICY pa_por_cliente        ON personal_activo      USING (cliente_id = current_setting('app.cliente_id')::UUID);
CREATE POLICY rot_por_cliente       ON rotacion             USING (cliente_id = current_setting('app.cliente_id')::UUID);
CREATE POLICY form_por_cliente      ON formacion_sst        USING (cliente_id = current_setting('app.cliente_id')::UUID);
CREATE POLICY entr_por_cliente      ON entrevistas_retiro   USING (cliente_id = current_setting('app.cliente_id')::UUID);
CREATE POLICY tal_por_cliente       ON talento_disciplinario USING (cliente_id = current_setting('app.cliente_id')::UUID);
CREATE POLICY bien_por_cliente      ON bienestar_actividades USING (cliente_id = current_setting('app.cliente_id')::UUID);

-- ============================================================
-- USUARIO ADMIN INICIAL (cambiar contraseña en producción)
-- Contraseña por defecto: Summar2024!
-- ============================================================
INSERT INTO clientes (id, nombre, nit)
VALUES ('00000000-0000-0000-0000-000000000001', 'Summar Demo', '900000000')
ON CONFLICT DO NOTHING;

INSERT INTO usuarios (cliente_id, email, password_hash, nombre, rol)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@summar.co',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5udem',
  'Administrador',
  'admin'
) ON CONFLICT DO NOTHING;
