import db from '@/lib/db';

let tableInitialized = false;

/**
 * Asegura que la tabla calendario_vehiculos exista en la base de datos (PostgreSQL o SQLite).
 */
export async function ensureCalendarioTable() {
  if (tableInitialized) return;
  try {
    if (db.isPostgres()) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS calendario_vehiculos (
          id SERIAL PRIMARY KEY,
          vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
          fecha DATE NOT NULL,
          estado VARCHAR(20) NOT NULL CHECK (estado IN ('disponible', 'alquilado', 'mantenimiento')),
          observaciones TEXT,
          creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE (vehiculo_id, fecha)
        )
      `);
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_calendario_vehiculo_fecha
        ON calendario_vehiculos(vehiculo_id, fecha)
      `);
    } else {
      await db.query(`
        CREATE TABLE IF NOT EXISTS calendario_vehiculos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vehiculo_id INTEGER NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
          fecha DATE NOT NULL,
          estado TEXT NOT NULL CHECK (estado IN ('disponible', 'alquilado', 'mantenimiento')),
          observaciones TEXT,
          creado_en DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
          UNIQUE (vehiculo_id, fecha)
        )
      `);
    }
    tableInitialized = true;
  } catch (err) {
    console.error('Error asegurando tabla calendario_vehiculos:', err);
  }
}

/**
 * Convierte cualquier valor de fecha (Date, ISO string, timestamp SQL) a 'YYYY-MM-DD'.
 */
export function toDateISO(val) {
  if (!val) return '';
  if (typeof val === 'string') {
    return val.trim().slice(0, 10);
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).slice(0, 10);
}

/**
 * Genera el arreglo de fechas 'YYYY-MM-DD' entre desdeStr y hastaStr (ambos inclusive).
 */
export function generarRangoFechas(desdeStr, hastaStr) {
  const start = toDateISO(desdeStr);
  const end = toDateISO(hastaStr);
  if (!start || !end || end < start) return [];

  const fechas = [];
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);

  const cur = new Date(Date.UTC(y1, m1 - 1, d1));
  const last = new Date(Date.UTC(y2, m2 - 1, d2));

  let guard = 0;
  while (cur <= last && guard < 730) {
    fechas.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard++;
  }
  return fechas;
}

/**
 * Calcula la cantidad de días en un rango [fechaInicio, fechaFin] (mínimo 1).
 * Si el cliente entrega el 10 y devuelve el 12, o si selecciona un mismo día, cuenta los días calendario.
 */
export function calcularDiasEntreFechas(fechaInicioStr, fechaFinStr) {
  const start = toDateISO(fechaInicioStr);
  const end = toDateISO(fechaFinStr);
  if (!start || !end) return 1;
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const diffDays = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Obtiene toda la disponibilidad y ocupación de un vehículo para un rango de fechas o mes.
 */
export async function obtenerOcupacionVehiculo(vehiculoId) {
  await ensureCalendarioTable();

  const [vehRes, alqRes, resRes, calRes] = await Promise.all([
    db.query('SELECT id, codigo, tipo, marca_modelo, placa, estado, precio_dia FROM vehiculos WHERE id = $1', [vehiculoId]),
    db.query(
      `SELECT a.id, a.fecha_entrega, a.fecha_devolucion_programada, a.dias, a.estado,
              c.nombre AS cliente_nombre, c.codigo AS cliente_codigo
       FROM alquileres a
       JOIN clientes c ON c.id = a.cliente_id
       WHERE a.vehiculo_id = $1 AND a.estado = 'activo'
       ORDER BY a.fecha_entrega ASC`,
      [vehiculoId]
    ),
    db.query(
      `SELECT r.id, r.fecha_inicio, r.fecha_fin, r.estado, r.monto_abono,
              c.nombre AS cliente_nombre, c.codigo AS cliente_codigo
       FROM reservas r
       JOIN clientes c ON c.id = r.cliente_id
       WHERE r.vehiculo_id = $1 AND r.estado = 'activa'
       ORDER BY r.fecha_inicio ASC`,
      [vehiculoId]
    ),
    db.query(
      `SELECT id, fecha, estado, observaciones
       FROM calendario_vehiculos
       WHERE vehiculo_id = $1
       ORDER BY fecha ASC`,
      [vehiculoId]
    ),
  ]);

  const vehiculo = vehRes.rows[0] || null;
  if (!vehiculo) return null;

  // Construir mapa por fecha YYYY-MM-DD
  const diasMapa = {};

  // 1. Reservas activas
  for (const r of resRes.rows) {
    const fInicio = toDateISO(r.fecha_inicio);
    const fFin = toDateISO(r.fecha_fin);
    const dias = generarRangoFechas(fInicio, fFin);
    for (const f of dias) {
      diasMapa[f] = {
        fecha: f,
        estado: 'reservado',
        origen: 'reserva',
        referencia_id: r.id,
        cliente_nombre: r.cliente_nombre,
        detalle: `Reservado por ${r.cliente_nombre} (${fInicio} al ${fFin})`,
      };
    }
  }

  // 2. Alquileres activos (tienen prioridad visual sobre reservas)
  for (const a of alqRes.rows) {
    const fInicio = toDateISO(a.fecha_entrega);
    const fFin = toDateISO(a.fecha_devolucion_programada);
    const dias = generarRangoFechas(fInicio, fFin);
    for (const f of dias) {
      diasMapa[f] = {
        fecha: f,
        estado: 'alquilado',
        origen: 'alquiler',
        referencia_id: a.id,
        cliente_nombre: a.cliente_nombre,
        detalle: `Alquilado a ${a.cliente_nombre} (${fInicio} al ${fFin})`,
      };
    }
  }

  // 3. Estados manuales en calendario_vehiculos (mantenimiento, alquilado o disponible explícito)
  for (const c of calRes.rows) {
    const f = toDateISO(c.fecha);
    if (c.estado === 'disponible') {
      // Solo libera si no es un contrato de alquiler activo obligatorio, o si fue un bloqueo manual
      if (!diasMapa[f] || diasMapa[f].origen === 'manual') {
        delete diasMapa[f];
      }
    } else {
      diasMapa[f] = {
        fecha: f,
        estado: c.estado, // 'alquilado' | 'mantenimiento'
        origen: 'manual',
        referencia_id: c.id,
        observaciones: c.observaciones || null,
        detalle:
          c.estado === 'mantenimiento'
            ? `En mantenimiento${c.observaciones ? ': ' + c.observaciones : ''}`
            : `Marcado como alquilado${c.observaciones ? ': ' + c.observaciones : ''}`,
      };
    }
  }

  return {
    vehiculo,
    alquileres_activos: alqRes.rows.map((a) => ({
      ...a,
      fecha_inicio_iso: toDateISO(a.fecha_entrega),
      fecha_fin_iso: toDateISO(a.fecha_devolucion_programada),
    })),
    reservas_activas: resRes.rows.map((r) => ({
      ...r,
      fecha_inicio_iso: toDateISO(r.fecha_inicio),
      fecha_fin_iso: toDateISO(r.fecha_fin),
    })),
    bloqueos_manuales: calRes.rows.map((c) => ({
      ...c,
      fecha_iso: toDateISO(c.fecha),
    })),
    dias_ocupados: diasMapa,
  };
}

/**
 * Verifica si un vehículo está disponible en todas las fechas dentro de [fechaInicioStr, fechaFinStr].
 */
export async function verificarDisponibilidadFechas(
  vehiculoId,
  fechaInicioStr,
  fechaFinStr,
  { excluirReservaId = null, excluirAlquilerId = null } = {}
) {
  const info = await obtenerOcupacionVehiculo(vehiculoId);
  if (!info) {
    return { disponible: false, status: 404, error: 'Vehículo no encontrado.', conflictos: [] };
  }

  const { vehiculo, alquileres_activos, reservas_activas, bloqueos_manuales } = info;

  if (vehiculo.estado === 'fuera_de_servicio') {
    return {
      disponible: false,
      status: 409,
      error: 'El vehículo está fuera de servicio y no puede alquilarse.',
      conflictos: [],
    };
  }

  if (vehiculo.estado === 'mantenimiento') {
    return {
      disponible: false,
      status: 409,
      error: 'El vehículo se encuentra actualmente en estado de Mantenimiento. Cámbialo a Disponible para poder alquilarlo.',
      conflictos: [],
    };
  }

  const fInicio = toDateISO(fechaInicioStr);
  const fFin = toDateISO(fechaFinStr);
  const rangoSolicitado = generarRangoFechas(fInicio, fFin);

  if (rangoSolicitado.length === 0) {
    return {
      disponible: false,
      status: 400,
      error: 'El rango de fechas seleccionado no es válido.',
      conflictos: [],
    };
  }

  const conflictos = [];

  // 1. Revisar solapamiento con alquileres activos
  for (const a of alquileres_activos) {
    if (excluirAlquilerId && Number(a.id) === Number(excluirAlquilerId)) continue;
    if (a.fecha_inicio_iso <= fFin && a.fecha_fin_iso >= fInicio) {
      const diasSolapados = rangoSolicitado.filter((d) => d >= a.fecha_inicio_iso && d <= a.fecha_fin_iso);
      conflictos.push({
        tipo: 'alquilado',
        fechas: diasSolapados,
        mensaje: `Ocupado por alquiler activo de ${a.cliente_nombre} (${a.fecha_inicio_iso} al ${a.fecha_fin_iso})`,
      });
    }
  }

  // 2. Revisar solapamiento con reservas activas
  for (const r of reservas_activas) {
    if (excluirReservaId && Number(r.id) === Number(excluirReservaId)) continue;
    if (r.fecha_inicio_iso <= fFin && r.fecha_fin_iso >= fInicio) {
      const diasSolapados = rangoSolicitado.filter((d) => d >= r.fecha_inicio_iso && d <= r.fecha_fin_iso);
      conflictos.push({
        tipo: 'reservado',
        fechas: diasSolapados,
        mensaje: `Reservado por ${r.cliente_nombre} (${r.fecha_inicio_iso} al ${r.fecha_fin_iso})`,
      });
    }
  }

  // 3. Revisar días marcados manualmente en calendario_vehiculos como 'mantenimiento' o 'alquilado'
  const diasManualesOcupados = bloqueos_manuales.filter(
    (b) => (b.estado === 'mantenimiento' || b.estado === 'alquilado') && b.fecha_iso >= fInicio && b.fecha_iso <= fFin
  );
  if (diasManualesOcupados.length > 0) {
    const porEstado = {};
    for (const b of diasManualesOcupados) {
      porEstado[b.estado] = porEstado[b.estado] || [];
      porEstado[b.estado].push(b.fecha_iso);
    }
    if (porEstado.mantenimiento) {
      conflictos.push({
        tipo: 'mantenimiento',
        fechas: porEstado.mantenimiento,
        mensaje: `Días en mantenimiento en el calendario: ${porEstado.mantenimiento.join(', ')}`,
      });
    }
    if (porEstado.alquilado) {
      conflictos.push({
        tipo: 'alquilado',
        fechas: porEstado.alquilado,
        mensaje: `Días ya marcados como alquilados en el calendario: ${porEstado.alquilado.join(', ')}`,
      });
    }
  }

  if (conflictos.length > 0) {
    const detalleMsg = conflictos.map((c) => c.mensaje).join(' | ');
    return {
      disponible: false,
      status: 409,
      error: `No se pueden duplicar días ocupados para este vehículo. ${detalleMsg}.`,
      conflictos,
    };
  }

  return { disponible: true, status: 200, conflictos: [], vehiculo };
}

/**
 * Sincroniza el estado general del vehículo (tabla vehiculos) según si hoy está ocupado
 * por un alquiler activo o bloqueo en calendario_vehiculos.
 */
export async function sincronizarEstadoVehiculoHoy(vehiculoId) {
  await ensureCalendarioTable();
  const hoy = toDateISO(new Date());

  const vehRes = await db.query('SELECT id, estado FROM vehiculos WHERE id = $1', [vehiculoId]);
  if (vehRes.rows.length === 0) return null;
  const estadoActual = vehRes.rows[0].estado;

  if (estadoActual === 'fuera_de_servicio') return estadoActual;

  // Verificar bloqueo manual hoy
  const calHoy = await db.query(
    'SELECT estado FROM calendario_vehiculos WHERE vehiculo_id = $1 AND fecha = $2',
    [vehiculoId, hoy]
  );
  if (calHoy.rows.length > 0) {
    const estHoy = calHoy.rows[0].estado;
    if (estHoy === 'mantenimiento' || estHoy === 'alquilado') {
      await db.query('UPDATE vehiculos SET estado = $1 WHERE id = $2', [estHoy, vehiculoId]);
      return estHoy;
    }
  }

  // Verificar si hay un alquiler activo que cubra hoy (o cualquier alquiler activo vigente)
  const alqActivos = await db.query(
    `SELECT id, fecha_entrega, fecha_devolucion_programada
     FROM alquileres
     WHERE vehiculo_id = $1 AND estado = 'activo'`,
    [vehiculoId]
  );

  const ocupadoHoyPorAlquiler = alqActivos.rows.some((a) => {
    const ini = toDateISO(a.fecha_entrega);
    const fin = toDateISO(a.fecha_devolucion_programada);
    return hoy >= ini && hoy <= fin;
  });

  if (ocupadoHoyPorAlquiler || alqActivos.rows.length > 0) {
    await db.query(`UPDATE vehiculos SET estado = 'alquilado' WHERE id = $1`, [vehiculoId]);
    return 'alquilado';
  }

  if (estadoActual === 'alquilado') {
    await db.query(`UPDATE vehiculos SET estado = 'disponible' WHERE id = $1`, [vehiculoId]);
    return 'disponible';
  }

  return estadoActual;
}

