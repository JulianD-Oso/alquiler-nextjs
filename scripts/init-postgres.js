import { Pool } from 'pg';

const schemaPg = `
-- 1. VEHICULOS
CREATE TABLE IF NOT EXISTS vehiculos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('moto', 'carro')),
    marca_modelo VARCHAR(120) NOT NULL,
    placa VARCHAR(20) NOT NULL UNIQUE,
    anio INTEGER,
    estado VARCHAR(20) NOT NULL DEFAULT 'disponible'
        CHECK (estado IN ('disponible', 'alquilado', 'mantenimiento', 'fuera_de_servicio')),
    observaciones TEXT,
    propietario_nombre VARCHAR(120),
    propietario_identificacion VARCHAR(40),
    precio_dia NUMERIC(12, 2) NOT NULL CHECK (precio_dia > 0),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehiculos_placa ON vehiculos(placa);
CREATE INDEX IF NOT EXISTS idx_vehiculos_estado ON vehiculos(estado);

-- 2. CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(120) NOT NULL,
    identificacion VARCHAR(40),
    telefono VARCHAR(40),
    tiene_licencia BOOLEAN,
    direccion TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_identificacion_unica
ON clientes(identificacion)
WHERE identificacion IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre);

-- 3. RESERVAS
CREATE TABLE IF NOT EXISTS reservas (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    monto_abono NUMERIC(12, 2) NOT NULL CHECK (monto_abono > 0),
    estado VARCHAR(20) NOT NULL DEFAULT 'activa'
        CHECK (estado IN ('activa', 'convertida', 'cancelada', 'vencida')),
    alquiler_id INTEGER,
    observaciones TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_reservas_fechas CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_reservas_vehiculo ON reservas(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas(estado);

-- 4. ALQUILERES
CREATE TABLE IF NOT EXISTS alquileres (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    fecha_entrega TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_devolucion_programada TIMESTAMP NOT NULL,
    fecha_devolucion_real TIMESTAMP,
    dias INTEGER NOT NULL CHECK (dias > 0),
    precio_dia_aplicado NUMERIC(12, 2) NOT NULL CHECK (precio_dia_aplicado > 0),
    precio_total NUMERIC(12, 2) GENERATED ALWAYS AS (dias * precio_dia_aplicado) STORED,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado')),
    firma_archivo TEXT,
    observaciones TEXT,
    origen_reserva_id INTEGER REFERENCES reservas(id),
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alquileres_cliente ON alquileres(cliente_id);
CREATE INDEX IF NOT EXISTS idx_alquileres_vehiculo ON alquileres(vehiculo_id);
CREATE INDEX IF NOT EXISTS idx_alquileres_estado ON alquileres(estado);

-- 5. PAGOS
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    alquiler_id INTEGER NOT NULL REFERENCES alquileres(id) ON DELETE CASCADE,
    monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    fecha_pago TIMESTAMP NOT NULL DEFAULT NOW(),
    metodo VARCHAR(40),
    observaciones TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pagos_alquiler ON pagos(alquiler_id);

-- 6. GASTOS
CREATE TABLE IF NOT EXISTS gastos (
    id SERIAL PRIMARY KEY,
    vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
    categoria VARCHAR(40) NOT NULL
        CHECK (categoria IN ('gasolina', 'mantenimiento', 'seguro', 'impuestos', 'otro')),
    monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    fecha_gasto DATE NOT NULL DEFAULT CURRENT_DATE,
    descripcion TEXT,
    creado_en TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_vehiculo ON gastos(vehiculo_id);

-- 7. VISTA SALDO
CREATE OR REPLACE VIEW alquileres_saldo AS
SELECT
    a.id AS alquiler_id,
    a.precio_total,
    COALESCE(SUM(p.monto), 0) AS total_pagado,
    (a.precio_total - COALESCE(SUM(p.monto), 0)) AS saldo_pendiente
FROM alquileres a
LEFT JOIN pagos p ON p.alquiler_id = a.id
GROUP BY a.id, a.precio_total;
`;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Error: Se requiere la variable de entorno DATABASE_URL.');
    console.error('Ejemplo: DATABASE_URL="postgres://usuario:pass@ep-xyz.neon.tech/neondb" bun scripts/init-postgres.js');
    process.exit(1);
  }

  const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

  try {
    console.log('🔄 Conectando a la base de datos PostgreSQL en la nube...');
    await pool.query(schemaPg);
    console.log('✅ Esquema creado exitosamente en PostgreSQL (tablas, índices y vistas).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error ejecutando el esquema:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
