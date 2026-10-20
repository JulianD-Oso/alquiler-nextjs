import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

const CATEGORIAS_VALIDAS = ['gasolina', 'mantenimiento', 'seguro', 'impuestos', 'otro'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehiculo_id = searchParams.get('vehiculo_id');
    const categoria = searchParams.get('categoria');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 50;

    const condiciones = [];
    const params = [];

    if (vehiculo_id) { params.push(vehiculo_id); condiciones.push(`g.vehiculo_id = $${params.length}`); }
    if (categoria) { params.push(categoria); condiciones.push(`g.categoria = $${params.length}`); }
    if (desde) { params.push(desde); condiciones.push(`g.fecha_gasto >= $${params.length}`); }
    if (hasta) { params.push(hasta); condiciones.push(`g.fecha_gasto <= $${params.length}`); }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const limitNum = Math.max(1, Number(limit) || 50);
    const offsetNum = (Math.max(1, Number(page) || 1) - 1) * limitNum;
    params.push(limitNum, offsetNum);

    const result = await db.query(
      `SELECT g.*, v.codigo AS vehiculo_codigo, v.placa, v.marca_modelo, v.tipo AS vehiculo_tipo
       FROM gastos g
       JOIN vehiculos v ON v.id = g.vehiculo_id
       ${where}
       ORDER BY g.fecha_gasto DESC, g.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
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
    const { vehiculo_id, categoria, monto, fecha_gasto, descripcion } = body;

    if (!vehiculo_id || !categoria || monto === undefined || monto === null) {
      return NextResponse.json({ error: 'vehiculo_id, categoria y monto son obligatorios.' }, { status: 400 });
    }
    if (!CATEGORIAS_VALIDAS.includes(categoria)) {
      return NextResponse.json(
        { error: `categoria debe ser una de: ${CATEGORIAS_VALIDAS.join(', ')}.` },
        { status: 400 }
      );
    }
    if (Number(monto) <= 0) {
      return NextResponse.json({ error: 'monto debe ser mayor a 0.' }, { status: 400 });
    }

    const vehiculo = await db.query('SELECT id FROM vehiculos WHERE id = $1', [vehiculo_id]);
    if (vehiculo.rows.length === 0) {
      return NextResponse.json({ error: 'El vehículo indicado no existe.' }, { status: 404 });
    }

    const fechaFinal = fecha_gasto || new Date().toISOString().slice(0, 10);

    const result = await db.query(
      `INSERT INTO gastos (vehiculo_id, categoria, monto, fecha_gasto, descripcion)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [vehiculo_id, categoria, Number(monto), fechaFinal, descripcion || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
