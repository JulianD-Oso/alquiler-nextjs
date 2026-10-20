import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function POST(request) {
  try {
    const body = await request.json();
    const { alquiler_id, monto, metodo, observaciones } = body;

    if (!alquiler_id || monto === undefined || monto === null) {
      return NextResponse.json({ error: 'alquiler_id y monto son obligatorios.' }, { status: 400 });
    }
    const montoNum = Number(monto);
    if (!(montoNum > 0)) {
      return NextResponse.json({ error: 'monto debe ser mayor a 0.' }, { status: 400 });
    }

    const result = await db.query(
      `INSERT INTO pagos (alquiler_id, monto, metodo, observaciones)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [alquiler_id, montoNum, metodo || null, observaciones || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
