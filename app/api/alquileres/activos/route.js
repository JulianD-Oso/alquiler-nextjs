import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function GET() {
  try {
    const result = await db.query(`
      SELECT
        a.id, a.fecha_entrega, a.fecha_devolucion_programada, a.dias,
        a.precio_dia_aplicado, a.precio_total, a.firma_archivo, a.observaciones,
        c.id AS cliente_id, c.codigo AS cliente_codigo, c.nombre AS cliente_nombre,
        v.id AS vehiculo_id, v.codigo AS vehiculo_codigo, v.tipo AS vehiculo_tipo,
        v.marca_modelo, v.placa,
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
      WHERE a.estado = 'activo'
      ORDER BY a.fecha_entrega DESC
    `);

    return NextResponse.json(result.rows);
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
