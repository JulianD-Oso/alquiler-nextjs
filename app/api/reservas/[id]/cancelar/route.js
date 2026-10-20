import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    let observaciones = null;
    try {
      const body = await request.json();
      observaciones = body.observaciones;
    } catch {
      // sin body
    }

    const result = await db.query(
      `UPDATE reservas SET estado = 'cancelada', observaciones = COALESCE($1, observaciones)
       WHERE id = $2 AND estado IN ('activa', 'vencida')
       RETURNING *`,
      [observaciones || null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'La reserva no existe o ya fue convertida/cancelada.' }, { status: 409 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
