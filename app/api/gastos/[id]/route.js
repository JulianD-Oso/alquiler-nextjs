import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const result = await db.query(
      `SELECT g.*, v.codigo AS vehiculo_codigo, v.placa, v.marca_modelo
       FROM gastos g JOIN vehiculos v ON v.id = g.vehiculo_id
       WHERE g.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Gasto no encontrado.' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const result = await db.query('DELETE FROM gastos WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Gasto no encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ mensaje: 'Gasto eliminado correctamente.', id: Number(id) });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
