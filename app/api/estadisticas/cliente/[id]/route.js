import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const result = await db.query(
      `SELECT COUNT(*) AS total_alquileres, COALESCE(SUM(precio_total), 0) AS valor_contratado
       FROM alquileres WHERE cliente_id = $1`,
      [id]
    );

    return NextResponse.json({
      total_alquileres: Number(result.rows[0]?.total_alquileres || 0),
      valor_contratado: Number(result.rows[0]?.valor_contratado || 0),
    });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
