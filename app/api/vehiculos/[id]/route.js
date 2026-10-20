import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

const ESTADOS_MANUALES = ['disponible', 'mantenimiento', 'fuera_de_servicio'];

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const result = await db.query('SELECT * FROM vehiculos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Vehículo no encontrado.' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      marca_modelo,
      placa,
      anio,
      estado,
      observaciones,
      propietario_nombre,
      propietario_identificacion,
      precio_dia,
    } = body;

    const actual = await db.query('SELECT * FROM vehiculos WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      return NextResponse.json({ error: 'Vehículo no encontrado.' }, { status: 404 });
    }

    if (estado !== undefined && estado !== actual.rows[0].estado) {
      if (actual.rows[0].estado === 'alquilado') {
        return NextResponse.json(
          { error: "No puedes cambiar manualmente el estado de un vehículo alquilado. Finaliza su alquiler en 'Alquileres'." },
          { status: 409 }
        );
      }
      if (!ESTADOS_MANUALES.includes(estado)) {
        return NextResponse.json(
          { error: `Estado inválido. Los estados manuales permitidos son: ${ESTADOS_MANUALES.join(', ')}.` },
          { status: 400 }
        );
      }
    }

    const result = await db.query(
      `UPDATE vehiculos
       SET marca_modelo = COALESCE($1, marca_modelo),
           placa = COALESCE($2, placa),
           anio = COALESCE($3, anio),
           estado = COALESCE($4, estado),
           observaciones = COALESCE($5, observaciones),
           propietario_nombre = COALESCE($6, propietario_nombre),
           propietario_identificacion = COALESCE($7, propietario_identificacion),
           precio_dia = COALESCE($8, precio_dia)
       WHERE id = $9
       RETURNING *`,
      [
        marca_modelo ? marca_modelo.trim() : null,
        placa ? placa.trim().toUpperCase() : null,
        anio !== undefined ? anio : null,
        estado || null,
        observaciones !== undefined ? observaciones : null,
        propietario_nombre !== undefined ? propietario_nombre : null,
        propietario_identificacion !== undefined ? propietario_identificacion : null,
        precio_dia !== undefined ? Number(precio_dia) : null,
        id,
      ]
    );

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const result = await db.query('DELETE FROM vehiculos WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Vehículo no encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ mensaje: 'Vehículo eliminado correctamente.', id: Number(id) });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
