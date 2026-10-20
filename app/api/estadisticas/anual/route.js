import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const anio = searchParams.get('anio');

    if (!anio) {
      return NextResponse.json({ error: 'anio es obligatorio.' }, { status: 400 });
    }

    const anioNum = parseInt(anio, 10);
    const startIso = `${anioNum}-01-01`;
    const endIso = `${anioNum + 1}-01-01`;

    const alquileres = await db.query(
      `SELECT fecha_entrega, precio_total
       FROM alquileres
       WHERE fecha_entrega >= $1 AND fecha_entrega < $2`,
      [startIso, endIso]
    );

    const gastos = await db.query(
      `SELECT fecha_gasto, monto
       FROM gastos
       WHERE fecha_gasto >= $1 AND fecha_gasto < $2`,
      [startIso, endIso]
    );

    // Agrupar por mes (1..12)
    const porMes = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      cantidad: 0,
      valor_contratado: 0,
    }));

    const gastosPorMes = Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      total: 0,
    }));

    let totalAlquileres = 0;
    let valorContratadoTotal = 0;
    for (const a of alquileres.rows) {
      const d = new Date(a.fecha_entrega);
      const m = d.getMonth(); // 0..11
      if (m >= 0 && m < 12) {
        porMes[m].cantidad += 1;
        porMes[m].valor_contratado += Number(a.precio_total || 0);
        totalAlquileres += 1;
        valorContratadoTotal += Number(a.precio_total || 0);
      }
    }

    let gastosTotales = 0;
    for (const g of gastos.rows) {
      const d = new Date(g.fecha_gasto);
      const m = d.getMonth();
      if (m >= 0 && m < 12) {
        gastosPorMes[m].total += Number(g.monto || 0);
        gastosTotales += Number(g.monto || 0);
      }
    }

    return NextResponse.json({
      anio: anioNum,
      total: {
        total_alquileres: totalAlquileres,
        valor_contratado: valorContratadoTotal,
        gastos_totales: gastosTotales,
      },
      por_mes: porMes,
      gastos_por_mes: gastosPorMes,
    });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
