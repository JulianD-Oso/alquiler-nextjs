import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const result = await db.query(
      `UPDATE alquileres
       SET estado = 'finalizado', fecha_devolucion_real = $2
       WHERE id = $1 AND estado = 'activo'
       RETURNING *`,
      [id, nowIso]
    );

    if (result.rows.length === 0) {
      const existe = await db.query('SELECT id FROM alquileres WHERE id = $1', [id]);
      if (existe.rows.length === 0) {
        return NextResponse.json({ error: 'Alquiler no encontrado.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Este alquiler ya fue finalizado previamente.' }, { status: 409 });
    }

    const alquiler = result.rows[0];
    await db.query(`UPDATE vehiculos SET estado = 'disponible' WHERE id = $1`, [alquiler.vehiculo_id]);

    return NextResponse.json(alquiler);
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
