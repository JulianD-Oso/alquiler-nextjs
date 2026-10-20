import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const alquiler = await db.query(
      `SELECT
        a.*, c.nombre AS cliente_nombre, c.codigo AS cliente_codigo,
        v.codigo AS vehiculo_codigo, v.marca_modelo, v.placa,
        COALESCE(pagos_resumen.total_pagado, 0) AS total_pagado,
        (a.precio_total - COALESCE(pagos_resumen.total_pagado, 0)) AS saldo_pendiente
      FROM alquileres a
      JOIN clientes c ON c.id = a.cliente_id
      JOIN vehiculos v ON v.id = a.vehiculo_id
      LEFT JOIN (
        SELECT alquiler_id, SUM(monto) AS total_pagado
        FROM pagos
        GROUP BY alquiler_id
      ) pagos_resumen ON pagos_resumen.alquiler_id = a.id
      WHERE a.id = $1`,
      [id]
    );

    if (alquiler.rows.length === 0) {
      return NextResponse.json({ error: 'Alquiler no encontrado.' }, { status: 404 });
    }

    const pagos = await db.query(
      'SELECT * FROM pagos WHERE alquiler_id = $1 ORDER BY fecha_pago ASC',
      [id]
    );

    return NextResponse.json({
      ...alquiler.rows[0],
      pagos: pagos.rows,
    });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
