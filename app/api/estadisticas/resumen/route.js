import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const vehiculos = await db.query(`
      SELECT
        COUNT(*) AS total_vehiculos,
        COALESCE(SUM(CASE WHEN estado = 'alquilado' THEN 1 ELSE 0 END), 0) AS vehiculos_alquilados,
        COALESCE(SUM(CASE WHEN estado = 'disponible' THEN 1 ELSE 0 END), 0) AS vehiculos_disponibles,
        COALESCE(SUM(CASE WHEN estado = 'mantenimiento' THEN 1 ELSE 0 END), 0) AS vehiculos_mantenimiento
      FROM vehiculos
    `);

    const clientes = await db.query('SELECT COUNT(*) AS total_clientes FROM clientes');

    const porCobrar = await db.query(`
      SELECT COALESCE(SUM(a.precio_total - COALESCE(p.total_pagado, 0)), 0) AS total_por_cobrar
      FROM alquileres a
      LEFT JOIN (
        SELECT alquiler_id, SUM(monto) AS total_pagado
        FROM pagos
        GROUP BY alquiler_id
      ) p ON p.alquiler_id = a.id
      WHERE a.estado = 'activo'
    `);

    return NextResponse.json({
      ...vehiculos.rows[0],
      ...clientes.rows[0],
      ...porCobrar.rows[0],
    });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
