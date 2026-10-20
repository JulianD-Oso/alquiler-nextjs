import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cliente = await db.query('SELECT * FROM clientes WHERE id = $1', [id]);
    if (cliente.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    }

    const conteo = await db.query(
      `SELECT COUNT(*) AS total_alquileres FROM alquileres WHERE cliente_id = $1`,
      [id]
    );

    return NextResponse.json({ ...cliente.rows[0], ...conteo.rows[0] });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nombre, identificacion, telefono, tiene_licencia, direccion } = body;

    const result = await db.query(
      `UPDATE clientes
       SET nombre = COALESCE($1, nombre),
           identificacion = COALESCE($2, identificacion),
           telefono = COALESCE($3, telefono),
           tiene_licencia = COALESCE($4, tiene_licencia),
           direccion = COALESCE($5, direccion)
       WHERE id = $6
       RETURNING *`,
      [
        nombre ? nombre.trim() : null,
        identificacion !== undefined ? identificacion : null,
        telefono !== undefined ? telefono : null,
        tiene_licencia !== undefined ? !!tiene_licencia : null,
        direccion !== undefined ? direccion : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
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
    const result = await db.query('DELETE FROM clientes WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ mensaje: 'Cliente eliminado correctamente.', id: Number(id) });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
