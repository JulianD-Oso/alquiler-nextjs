import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes');
    const anio = searchParams.get('anio');

    if (!mes || !anio) {
      return NextResponse.json({ error: 'mes y anio son obligatorios.' }, { status: 400 });
    }

    const mesNum = parseInt(mes, 10);
    const anioNum = parseInt(anio, 10);

    const startIso = `${anioNum}-${String(mesNum).padStart(2, '0')}-01`;
    let endIso;
    if (mesNum === 12) {
      endIso = `${anioNum + 1}-01-01`;
    } else {
      endIso = `${anioNum}-${String(mesNum + 1).padStart(2, '0')}-01`;
    }

    const alquileres = await db.query(
      `SELECT COUNT(*) AS total_alquileres, COALESCE(SUM(precio_total), 0) AS valor_contratado
       FROM alquileres
       WHERE fecha_entrega >= $1 AND fecha_entrega < $2`,
      [startIso, endIso]
    );

    const cobrado = await db.query(
      `SELECT COALESCE(SUM(monto), 0) AS ingresos_cobrados
       FROM pagos
       WHERE fecha_pago >= $1 AND fecha_pago < $2`,
      [startIso, endIso]
    );

    const porTipo = await db.query(
      `SELECT v.tipo, COUNT(*) AS cantidad, COALESCE(SUM(a.precio_total), 0) AS valor_contratado
       FROM alquileres a
       JOIN vehiculos v ON v.id = a.vehiculo_id
       WHERE a.fecha_entrega >= $1 AND a.fecha_entrega < $2
       GROUP BY v.tipo`,
      [startIso, endIso]
    );

    const gastosRes = await db.query(
      `SELECT categoria, COALESCE(SUM(monto), 0) AS total
       FROM gastos
       WHERE fecha_gasto >= $1 AND fecha_gasto < $2
       GROUP BY categoria`,
      [startIso, endIso]
    );

    const gastosTotales = gastosRes.rows.reduce((sum, g) => sum + Number(g.total), 0);
    const valorContratado = Number(alquileres.rows[0]?.valor_contratado || 0);
    const ingresosCobrados = Number(cobrado.rows[0]?.ingresos_cobrados || 0);

    return NextResponse.json({
      periodo: { anio: anioNum, mes: mesNum },
      resumen: {
        total_alquileres: Number(alquileres.rows[0]?.total_alquileres || 0),
        valor_contratado: valorContratado,
        ingresos_cobrados: ingresosCobrados,
        gastos_totales: gastosTotales,
        ganancia_neta: valorContratado - gastosTotales,
      },
      por_tipo: porTipo.rows,
      gastos_por_categoria: gastosRes.rows,
    });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
