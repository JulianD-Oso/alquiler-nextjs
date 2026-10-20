import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { generarCodigoCliente } from '@/lib/codigos';
import { handleApiError } from '@/lib/errors';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    let sql = 'SELECT * FROM clientes';
    const params = [];
    if (q) {
      params.push(`%${q.trim()}%`);
      sql += ' WHERE LOWER(nombre) LIKE LOWER($1) OR LOWER(identificacion) LIKE LOWER($1) OR LOWER(codigo) LIKE LOWER($1)';
    }
    sql += ' ORDER BY codigo ASC';

    const result = await db.query(sql, params);
    return NextResponse.json(result.rows);
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { nombre, identificacion, telefono, tiene_licencia, direccion } = body;

    if (!nombre) {
      return NextResponse.json({ error: 'nombre es obligatorio.' }, { status: 400 });
    }

    const MAX_INTENTOS = 5;
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const codigo = await generarCodigoCliente();
      try {
        const result = await db.query(
          `INSERT INTO clientes (codigo, nombre, identificacion, telefono, tiene_licencia, direccion)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING *`,
          [
            codigo,
            nombre.trim(),
            identificacion || null,
            telefono || null,
            tiene_licencia === undefined ? null : !!tiene_licencia,
            direccion || null,
          ]
        );
        return NextResponse.json(result.rows[0], { status: 201 });
      } catch (err) {
        if (
          (err.code === '23505' && err.constraint && err.constraint.includes('codigo')) ||
          (err.message && err.message.includes('clientes.codigo'))
        ) {
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json({ error: 'No se pudo generar un código único para el cliente tras varios intentos.' }, { status: 500 });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
