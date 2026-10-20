import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const alquileres = await db.query(
      `SELECT COUNT(*) AS total_alquileres, COALESCE(SUM(precio_total), 0) AS ingresos_contratados
       FROM alquileres WHERE vehiculo_id = $1`,
      [id]
    );

    const gastos = await db.query(
      `SELECT COALESCE(SUM(monto), 0) AS gastos_totales
       FROM gastos WHERE vehiculo_id = $1`,
      [id]
    );

    const ingresos = Number(alquileres.rows[0]?.ingresos_contratados || 0);
    const gastosTotales = Number(gastos.rows[0]?.gastos_totales || 0);

    return NextResponse.json({
      total_alquileres: Number(alquileres.rows[0]?.total_alquileres || 0),
      ingresos_contratados: ingresos,
      gastos_totales: gastosTotales,
      ganancia_neta: ingresos - gastosTotales,
    });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
