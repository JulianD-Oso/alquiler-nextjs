import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { generarCodigoVehiculo } from '@/lib/codigos';
import { handleApiError } from '@/lib/errors';

const TIPOS_VALIDOS = ['moto', 'carro'];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const estado = searchParams.get('estado');
    const q = searchParams.get('q');

    const condiciones = [];
    const params = [];

    if (tipo) {
      params.push(tipo);
      condiciones.push(`tipo = $${params.length}`);
    }
    if (estado) {
      params.push(estado);
      condiciones.push(`estado = $${params.length}`);
    }
    if (q) {
      params.push(`%${q.trim()}%`);
      const pIdx = params.length;
      condiciones.push(`(codigo LIKE $${pIdx} OR marca_modelo LIKE $${pIdx} OR placa LIKE $${pIdx})`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT * FROM vehiculos ${where} ORDER BY codigo ASC`,
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
    const {
      tipo,
      marca_modelo,
      placa,
      anio,
      observaciones,
      propietario_nombre,
      propietario_identificacion,
      precio_dia,
    } = body;

    if (!tipo || !marca_modelo || !placa || precio_dia === undefined || precio_dia === null) {
      return NextResponse.json(
        { error: 'tipo, marca_modelo, placa y precio_dia son obligatorios.' },
        { status: 400 }
      );
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return NextResponse.json({ error: "tipo debe ser 'moto' o 'carro'." }, { status: 400 });
    }
    if (Number(precio_dia) <= 0) {
      return NextResponse.json({ error: 'precio_dia debe ser mayor a 0.' }, { status: 400 });
    }

    const MAX_INTENTOS = 5;
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const codigo = await generarCodigoVehiculo(tipo);
      try {
        const result = await db.query(
          `INSERT INTO vehiculos
             (codigo, tipo, marca_modelo, placa, anio, observaciones, propietario_nombre, propietario_identificacion, precio_dia)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING *`,
          [
            codigo,
            tipo,
            marca_modelo.trim(),
            placa.trim().toUpperCase(),
            anio || null,
            observaciones || null,
            propietario_nombre || null,
            propietario_identificacion || null,
            Number(precio_dia),
          ]
        );
        return NextResponse.json(result.rows[0], { status: 201 });
      } catch (err) {
        if (
          (err.code === '23505' && err.constraint && err.constraint.includes('codigo')) ||
          (err.message && err.message.includes('vehiculos.codigo'))
        ) {
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json({ error: 'No se pudo generar un código único para el vehículo.' }, { status: 500 });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
