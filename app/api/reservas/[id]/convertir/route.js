import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import {
  toDateISO,
  calcularDiasEntreFechas,
  verificarDisponibilidadFechas,
  sincronizarEstadoVehiculoHoy,
} from '@/lib/calendarioDb';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    let dias = null;
    try {
      const body = await request.json();
      dias = body.dias;
    } catch {
      // sin body
    }

    const reservaResult = await db.query('SELECT * FROM reservas WHERE id = $1', [id]);
    if (reservaResult.rows.length === 0) {
      return NextResponse.json({ error: 'Reserva no encontrada.' }, { status: 404 });
    }
    const reserva = reservaResult.rows[0];
    if (reserva.estado !== 'activa' && reserva.estado !== 'vencida') {
      return NextResponse.json({ error: 'Esta reserva ya fue convertida o cancelada.' }, { status: 409 });
    }

    const fInicio = toDateISO(reserva.fecha_inicio);
    const fFin = toDateISO(reserva.fecha_fin);

    // Verificar que el vehículo esté disponible en esas fechas (excluyendo esta misma reserva)
    const disp = await verificarDisponibilidadFechas(reserva.vehiculo_id, fInicio, fFin, {
      excluirReservaId: reserva.id,
    });
    if (!disp.disponible) {
      return NextResponse.json(
        { error: disp.error, conflictos: disp.conflictos },
        { status: disp.status || 409 }
      );
    }

    let diasNum = parseInt(dias, 10);
    if (!Number.isInteger(diasNum) || diasNum <= 0) {
      diasNum = calcularDiasEntreFechas(fInicio, fFin);
    }

    const now = new Date();
    const horaActual = now.toISOString().slice(11, 19);
    const fechaEntrega = `${fInicio} ${horaActual}`;
    const fechaDevolucion = `${fFin} ${horaActual}`;

    // Crear el alquiler
    const alquiler = await db.query(
      `INSERT INTO alquileres
         (cliente_id, vehiculo_id, fecha_entrega, fecha_devolucion_programada, dias, precio_dia_aplicado, observaciones, origen_reserva_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        reserva.cliente_id,
        reserva.vehiculo_id,
        fechaEntrega,
        fechaDevolucion,
        diasNum,
        disp.vehiculo.precio_dia,
        `Convertido desde la reserva #${reserva.id}.`,
        reserva.id,
      ]
    );
    const alquilerCreado = alquiler.rows[0];

    // Registrar el abono como primer pago
    await db.query(
      `INSERT INTO pagos (alquiler_id, monto, metodo, observaciones)
       VALUES ($1, $2, 'abono reserva', $3)`,
      [alquilerCreado.id, reserva.monto_abono, `Abono de la reserva #${reserva.id}.`]
    );

    // Actualizar la reserva a convertida
    const reservaActualizada = await db.query(
      `UPDATE reservas SET estado = 'convertida', alquiler_id = $1 WHERE id = $2 RETURNING *`,
      [alquilerCreado.id, id]
    );

    // Sincronizar estado del vehículo
    await sincronizarEstadoVehiculoHoy(reserva.vehiculo_id);

    return NextResponse.json({
      reserva: reservaActualizada.rows[0],
      alquiler: alquilerCreado,
    });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
