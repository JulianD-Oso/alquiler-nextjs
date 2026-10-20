import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';

// Connection string de Neon
const NEON_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_x2DUqOcbnzB7@ep-dry-leaf-b4zqmvq3-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_alquiler_vehiculo_activo ON alquileres(vehiculo_id) WHERE estado = 'activo';

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

-- 8. TRIGGER SINCRONIZACION ESTADO VEHICULO
CREATE OR REPLACE FUNCTION fn_sincronizar_estado_vehiculo()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.estado = 'activo') THEN
        UPDATE vehiculos SET estado = 'alquilado' WHERE id = NEW.vehiculo_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (NEW.estado = 'activo' AND OLD.estado != 'activo') THEN
            UPDATE vehiculos SET estado = 'alquilado' WHERE id = NEW.vehiculo_id;
        ELSIF (NEW.estado = 'finalizado' AND OLD.estado != 'finalizado') THEN
            UPDATE vehiculos SET estado = 'disponible' WHERE id = NEW.vehiculo_id AND estado = 'alquilado';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sincronizar_estado_vehiculo ON alquileres;
CREATE TRIGGER trg_sincronizar_estado_vehiculo
AFTER INSERT OR UPDATE OF estado ON alquileres
FOR EACH ROW
EXECUTE FUNCTION fn_sincronizar_estado_vehiculo();
`;

async function main() {
  console.log('🚀 Iniciando migración a Neon PostgreSQL...');
  console.log(`URL: ${NEON_URL.replace(/:[^:]+@/, ':****@')}`);

  const pool = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // 1. Crear Esquema
    console.log('📐 Creando tablas, vistas e índices en Neon...');
    await pool.query(schemaPg);
    console.log('✅ Tablas y vistas verificadas en Neon.');

    // 2. Conectar a SQLite
    const { Database } = require('bun:sqlite');
    const sqlitePath = path.resolve(process.cwd(), '../alquiler-backend/data/alquiler.db');
    if (!fs.existsSync(sqlitePath)) {
      throw new Error(`No se encontró el archivo SQLite en: ${sqlitePath}`);
    }
    const sqlite = new Database(sqlitePath);
    console.log(`📂 Leyendo base de datos SQLite de origen: ${sqlitePath}`);

    // Limpiar tablas para migración limpia (idempotente)
    await pool.query('TRUNCATE gastos, pagos, alquileres, reservas, clientes, vehiculos CASCADE;');

    // 3. Migrar Clientes
    const clientes = sqlite.query('SELECT * FROM clientes ORDER BY id ASC').all();
    console.log(`👥 Migrando ${clientes.length} clientes...`);
    for (const c of clientes) {
      await pool.query(
        `INSERT INTO clientes (id, codigo, nombre, identificacion, telefono, tiene_licencia, direccion, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [c.id, c.codigo, c.nombre, c.identificacion, c.telefono, c.tiene_licencia === 1 || c.tiene_licencia === true, c.direccion, c.creado_en]
      );
    }

    // 4. Migrar Vehiculos
    const vehiculos = sqlite.query('SELECT * FROM vehiculos ORDER BY id ASC').all();
    console.log(`🚗 Migrando ${vehiculos.length} vehículos...`);
    for (const v of vehiculos) {
      await pool.query(
        `INSERT INTO vehiculos (id, codigo, tipo, marca_modelo, placa, anio, estado, observaciones, propietario_nombre, propietario_identificacion, precio_dia, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [v.id, v.codigo, v.tipo, v.marca_modelo, v.placa, v.anio, v.estado, v.observaciones, v.propietario_nombre, v.propietario_identificacion, v.precio_dia, v.creado_en]
      );
    }

    // 5. Migrar Reservas
    const reservas = sqlite.query('SELECT * FROM reservas ORDER BY id ASC').all();
    console.log(`📅 Migrando ${reservas.length} reservas...`);
    for (const r of reservas) {
      await pool.query(
        `INSERT INTO reservas (id, cliente_id, vehiculo_id, fecha_inicio, fecha_fin, monto_abono, estado, alquiler_id, observaciones, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [r.id, r.cliente_id, r.vehiculo_id, r.fecha_inicio, r.fecha_fin, r.monto_abono, r.estado, r.alquiler_id, r.observaciones, r.creado_en]
      );
    }

    // 6. Migrar Alquileres (notar que precio_total es generado automáticamente)
    const alquileres = sqlite.query('SELECT * FROM alquileres ORDER BY id ASC').all();
    console.log(`📋 Migrando ${alquileres.length} alquileres...`);
    for (const a of alquileres) {
      await pool.query(
        `INSERT INTO alquileres (id, cliente_id, vehiculo_id, fecha_entrega, fecha_devolucion_programada, fecha_devolucion_real, dias, precio_dia_aplicado, estado, firma_archivo, observaciones, origen_reserva_id, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [a.id, a.cliente_id, a.vehiculo_id, a.fecha_entrega, a.fecha_devolucion_programada, a.fecha_devolucion_real, a.dias, a.precio_dia_aplicado, a.estado, a.firma_archivo, a.observaciones, a.origen_reserva_id, a.creado_en]
      );
    }

    // 7. Migrar Pagos
    const pagos = sqlite.query('SELECT * FROM pagos ORDER BY id ASC').all();
    console.log(`💵 Migrando ${pagos.length} pagos...`);
    for (const p of pagos) {
      await pool.query(
        `INSERT INTO pagos (id, alquiler_id, monto, fecha_pago, metodo, observaciones, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, p.alquiler_id, p.monto, p.fecha_pago, p.metodo, p.observaciones, p.creado_en]
      );
    }

    // 8. Migrar Gastos
    const gastos = sqlite.query('SELECT * FROM gastos ORDER BY id ASC').all();
    console.log(`🧾 Migrando ${gastos.length} gastos...`);
    for (const g of gastos) {
      await pool.query(
        `INSERT INTO gastos (id, vehiculo_id, categoria, monto, fecha_gasto, descripcion, creado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [g.id, g.vehiculo_id, g.categoria, g.monto, g.fecha_gasto, g.descripcion, g.creado_en]
      );
    }

    // 9. Actualizar secuencias automáticas en Postgres
    console.log('🔢 Sincronizando secuencias de IDs en PostgreSQL...');
    const tablas = ['clientes', 'vehiculos', 'reservas', 'alquileres', 'pagos', 'gastos'];
    for (const t of tablas) {
      await pool.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1));`);
    }

    // 10. Actualizar .env.local
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    const envContent = `# Conexión activa a Neon PostgreSQL en la nube\nDATABASE_URL=${NEON_URL}\n`;
    fs.writeFileSync(envLocalPath, envContent, 'utf8');
    console.log(`📝 Archivo .env.local actualizado con la conexión de Neon.`);

    const envPath = path.resolve(process.cwd(), '.env');
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`📝 Archivo .env actualizado con la conexión de Neon.`);

    console.log('\n🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE A NEON!');
  } catch (err) {
    console.error('❌ Error durante la migración a Neon:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
