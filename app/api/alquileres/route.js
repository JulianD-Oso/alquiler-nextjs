import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { saveSignatureFile } from '@/lib/storage';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const cliente_id = searchParams.get('cliente_id');
    const vehiculo_id = searchParams.get('vehiculo_id');
    const estado = searchParams.get('estado');
    const desde = searchParams.get('desde');
    const hasta = searchParams.get('hasta');
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 20;

    const condiciones = [];
    const params = [];

    if (cliente_id) { params.push(cliente_id); condiciones.push(`a.cliente_id = $${params.length}`); }
    if (vehiculo_id) { params.push(vehiculo_id); condiciones.push(`a.vehiculo_id = $${params.length}`); }
    if (estado) { params.push(estado); condiciones.push(`a.estado = $${params.length}`); }
    if (desde) { params.push(desde); condiciones.push(`a.fecha_entrega >= $${params.length}`); }
    if (hasta) { params.push(hasta); condiciones.push(`a.fecha_entrega <= $${params.length}`); }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const limitNum = Math.max(1, Number(limit) || 20);
    const offsetNum = (Math.max(1, Number(page) || 1) - 1) * limitNum;
    params.push(limitNum, offsetNum);

    const result = await db.query(
      `SELECT
        a.id, a.fecha_entrega, a.fecha_devolucion_programada, a.fecha_devolucion_real,
        a.dias, a.precio_total, a.estado, a.firma_archivo,
        c.nombre AS cliente_nombre, v.codigo AS vehiculo_codigo, v.placa
      FROM alquileres a
      JOIN clientes c ON c.id = a.cliente_id
      JOIN vehiculos v ON v.id = a.vehiculo_id
      ${where}
      ORDER BY a.fecha_entrega DESC
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
    const contentType = request.headers.get('content-type') || '';
    let cliente_id, vehiculo_id, dias, observaciones, firmaFile;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      cliente_id = formData.get('cliente_id');
      vehiculo_id = formData.get('vehiculo_id');
      dias = formData.get('dias');
      observaciones = formData.get('observaciones');
      firmaFile = formData.get('firma');
    } else {
      const body = await request.json();
      cliente_id = body.cliente_id;
      vehiculo_id = body.vehiculo_id;
      dias = body.dias;
      observaciones = body.observaciones;
    }

    if (!cliente_id || !vehiculo_id || dias === undefined || dias === null) {
      return NextResponse.json(
        { error: 'cliente_id, vehiculo_id y dias son obligatorios.' },
        { status: 400 }
      );
    }
    const diasNum = parseInt(dias, 10);
    if (!Number.isInteger(diasNum) || diasNum <= 0) {
      return NextResponse.json(
        { error: 'dias debe ser un número entero mayor a 0.' },
        { status: 400 }
      );
    }

    const vehiculo = await db.query('SELECT id, precio_dia, estado FROM vehiculos WHERE id = $1', [vehiculo_id]);
    if (vehiculo.rows.length === 0) {
      return NextResponse.json({ error: 'Vehículo no encontrado.' }, { status: 404 });
    }
    if (vehiculo.rows[0].estado !== 'disponible') {
      return NextResponse.json(
        { error: `El vehículo no está disponible para alquilarse (estado actual: ${vehiculo.rows[0].estado}).` },
        { status: 409 }
      );
    }

    const cliente = await db.query('SELECT id FROM clientes WHERE id = $1', [cliente_id]);
    if (cliente.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    }

    let firmaUrl = null;
    if (firmaFile && typeof firmaFile === 'object' && firmaFile.size > 0) {
      firmaUrl = await saveSignatureFile(firmaFile, `firma-${Date.now()}.png`);
    }

    const now = new Date();
    const fechaEntrega = now.toISOString().replace('T', ' ').slice(0, 19);
    const fechaDevolucion = new Date(now.getTime() + diasNum * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    const result = await db.query(
      `INSERT INTO alquileres
         (cliente_id, vehiculo_id, fecha_entrega, fecha_devolucion_programada, dias, precio_dia_aplicado, firma_archivo, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        cliente_id,
        vehiculo_id,
        fechaEntrega,
        fechaDevolucion,
        diasNum,
        vehiculo.rows[0].precio_dia,
        firmaUrl,
        observaciones || null,
      ]
    );

    // Asegurar sincronización del vehículo a 'alquilado'
    await db.query(`UPDATE vehiculos SET estado = 'alquilado' WHERE id = $1`, [vehiculo_id]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
