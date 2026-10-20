import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado') || 'activa';
    const cliente_id = searchParams.get('cliente_id');
    const vehiculo_id = searchParams.get('vehiculo_id');

    // Actualiza reservas vencidas
    const today = new Date().toISOString().slice(0, 10);
    await db.query(
      `UPDATE reservas SET estado = 'vencida' WHERE estado = 'activa' AND fecha_fin < $1`,
      [today]
    );

    const condiciones = [];
    const params = [];

    if (estado && estado !== 'todas') {
      params.push(estado);
      condiciones.push(`r.estado = $${params.length}`);
    }
    if (cliente_id) {
      params.push(cliente_id);
      condiciones.push(`r.cliente_id = $${params.length}`);
    }
    if (vehiculo_id) {
      params.push(vehiculo_id);
      condiciones.push(`r.vehiculo_id = $${params.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT r.*, c.codigo AS cliente_codigo, c.nombre AS cliente_nombre,
              v.codigo AS vehiculo_codigo, v.placa, v.marca_modelo, v.tipo AS vehiculo_tipo,
              v.precio_dia
       FROM reservas r
       JOIN clientes c ON c.id = r.cliente_id
       JOIN vehiculos v ON v.id = r.vehiculo_id
       ${where}
       ORDER BY r.fecha_inicio ASC`,
      params
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { cliente_id, vehiculo_id, fecha_inicio, fecha_fin, monto_abono, observaciones } = body;

    if (!cliente_id || !vehiculo_id || !fecha_inicio || !fecha_fin || monto_abono === undefined || monto_abono === null) {
      return NextResponse.json(
        { error: 'cliente_id, vehiculo_id, fecha_inicio, fecha_fin y monto_abono son obligatorios.' },
        { status: 400 }
      );
    }
    if (Number(monto_abono) <= 0) {
      return NextResponse.json({ error: 'monto_abono debe ser mayor a 0.' }, { status: 400 });
    }
    if (new Date(fecha_fin) < new Date(fecha_inicio)) {
      return NextResponse.json({ error: 'fecha_fin no puede ser anterior a fecha_inicio.' }, { status: 400 });
    }

    const vehiculo = await db.query('SELECT id FROM vehiculos WHERE id = $1', [vehiculo_id]);
    if (vehiculo.rows.length === 0) {
      return NextResponse.json({ error: 'Vehículo no encontrado.' }, { status: 404 });
    }
    const cliente = await db.query('SELECT id FROM clientes WHERE id = $1', [cliente_id]);
    if (cliente.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    }

    // Verificar si hay solapamiento de fechas con otra reserva activa
    const solapadas = await db.query(
      `SELECT id FROM reservas
       WHERE vehiculo_id = $1 AND estado = 'activa'
         AND fecha_inicio <= $3 AND fecha_fin >= $2`,
      [vehiculo_id, fecha_inicio, fecha_fin]
    );
    if (solapadas.rows.length > 0) {
      return NextResponse.json(
        { error: 'Ese vehículo ya tiene una reserva activa que se solapa con esas fechas.' },
        { status: 409 }
      );
    }

    const result = await db.query(
      `INSERT INTO reservas (cliente_id, vehiculo_id, fecha_inicio, fecha_fin, monto_abono, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [cliente_id, vehiculo_id, fecha_inicio, fecha_fin, Number(monto_abono), observaciones || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
