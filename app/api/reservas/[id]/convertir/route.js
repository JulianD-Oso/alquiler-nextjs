import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

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

    const vehiculo = await db.query('SELECT id, precio_dia, estado FROM vehiculos WHERE id = $1', [reserva.vehiculo_id]);
    if (vehiculo.rows.length === 0) {
      return NextResponse.json({ error: 'El vehículo de la reserva ya no existe.' }, { status: 404 });
    }

    let diasNum = parseInt(dias, 10);
    if (!Number.isInteger(diasNum) || diasNum <= 0) {
      const start = new Date(reserva.fecha_inicio);
      const end = new Date(reserva.fecha_fin);
      diasNum = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    }

    const now = new Date();
    const fechaEntrega = now.toISOString().replace('T', ' ').slice(0, 19);
    const fechaDevolucion = new Date(now.getTime() + diasNum * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

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
        vehiculo.rows[0].precio_dia,
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

    // Sincronizar estado del vehículo a 'alquilado'
    await db.query(`UPDATE vehiculos SET estado = 'alquilado' WHERE id = $1`, [reserva.vehiculo_id]);

    return NextResponse.json({
      reserva: reservaActualizada.rows[0],
      alquiler: alquilerCreado,
    });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
