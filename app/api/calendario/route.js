import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import {
  ensureCalendarioTable,
  obtenerOcupacionVehiculo,
  generarRangoFechas,
  toDateISO,
  sincronizarEstadoVehiculoHoy,
} from '@/lib/calendarioDb';

const ESTADOS_VALIDOS = ['disponible', 'alquilado', 'mantenimiento'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehiculo_id = searchParams.get('vehiculo_id');

    if (!vehiculo_id) {
      return NextResponse.json({ error: 'vehiculo_id es obligatorio.' }, { status: 400 });
    }

    const data = await obtenerOcupacionVehiculo(vehiculo_id);
    if (!data) {
      return NextResponse.json({ error: 'Vehículo no encontrado.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request) {
  try {
    await ensureCalendarioTable();
    const body = await request.json();
    const {
      vehiculo_id,
      fecha,
      fecha_inicio,
      fecha_fin,
      estado,
      observaciones,
      modo = 'dia', // 'dia' | 'vehiculo'
    } = body;

    if (!vehiculo_id || !estado) {
      return NextResponse.json(
        { error: 'vehiculo_id y estado son obligatorios.' },
        { status: 400 }
      );
    }

    if (!ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json(
        { error: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}.` },
        { status: 400 }
      );
    }

    const info = await obtenerOcupacionVehiculo(vehiculo_id);
    if (!info) {
      return NextResponse.json({ error: 'Vehículo no encontrado.' }, { status: 404 });
    }

    // Modo cambio de estado general del vehículo
    if (modo === 'vehiculo') {
      if (estado === 'disponible' && info.alquileres_activos.length > 0) {
        return NextResponse.json(
          {
            error:
              'Este vehículo tiene un contrato de alquiler activo. Finaliza el alquiler en la lista para liberarlo a Disponible.',
          },
          { status: 409 }
        );
      }
      await db.query('UPDATE vehiculos SET estado = $1 WHERE id = $2', [estado, vehiculo_id]);
      const actualizado = await obtenerOcupacionVehiculo(vehiculo_id);
      return NextResponse.json(actualizado);
    }

    // Modo por día o rango de fechas en el calendario
    const desde = toDateISO(fecha_inicio || fecha);
    const hasta = toDateISO(fecha_fin || fecha_inicio || fecha);
    const fechas = generarRangoFechas(desde, hasta);

    if (fechas.length === 0) {
      return NextResponse.json(
        { error: 'Debes indicar una fecha o rango de fechas válido (fecha_inicio <= fecha_fin).' },
        { status: 400 }
      );
    }

    // Validar que no se intente pisar un alquiler activo por contrato al poner disponible o mantenimiento
    for (const f of fechas) {
      const ocupacionDia = info.dias_ocupados[f];
      if (ocupacionDia && ocupacionDia.origen === 'alquiler' && estado !== 'alquilado') {
        return NextResponse.json(
          {
            error: `El día ${f} pertenece a un alquiler activo (${ocupacionDia.cliente_nombre}). Finaliza primero ese alquiler para liberar la fecha.`,
          },
          { status: 409 }
        );
      }
    }

    for (const f of fechas) {
      if (estado === 'disponible') {
        await db.query(
          'DELETE FROM calendario_vehiculos WHERE vehiculo_id = $1 AND fecha = $2',
          [vehiculo_id, f]
        );
      } else {
        await db.query(
          `INSERT INTO calendario_vehiculos (vehiculo_id, fecha, estado, observaciones)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (vehiculo_id, fecha)
           DO UPDATE SET estado = EXCLUDED.estado, observaciones = EXCLUDED.observaciones`,
          [vehiculo_id, f, estado, observaciones || null]
        );
      }
    }

    await sincronizarEstadoVehiculoHoy(vehiculo_id);
    const actualizado = await obtenerOcupacionVehiculo(vehiculo_id);
    return NextResponse.json(actualizado);
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}

