import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { saveSignatureFile } from '@/lib/storage';
import {
  toDateISO,
  calcularDiasEntreFechas,
  verificarDisponibilidadFechas,
  sincronizarEstadoVehiculoHoy,
} from '@/lib/calendarioDb';

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
    let cliente_id, vehiculo_id, dias, fecha_entrega_input, fecha_devolucion_input, observaciones, firmaFile;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      cliente_id = formData.get('cliente_id');
      vehiculo_id = formData.get('vehiculo_id');
      dias = formData.get('dias');
      fecha_entrega_input = formData.get('fecha_entrega') || formData.get('fecha_inicio');
      fecha_devolucion_input = formData.get('fecha_devolucion_programada') || formData.get('fecha_fin');
      observaciones = formData.get('observaciones');
      firmaFile = formData.get('firma');
    } else {
      const body = await request.json();
      cliente_id = body.cliente_id;
      vehiculo_id = body.vehiculo_id;
      dias = body.dias;
      fecha_entrega_input = body.fecha_entrega || body.fecha_inicio;
      fecha_devolucion_input = body.fecha_devolucion_programada || body.fecha_fin;
      observaciones = body.observaciones;
    }

    if (!cliente_id || !vehiculo_id) {
      return NextResponse.json(
        { error: 'cliente_id y vehiculo_id son obligatorios.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const hoyISO = toDateISO(now);
    const fechaInicioISO = fecha_entrega_input ? toDateISO(fecha_entrega_input) : hoyISO;

    let diasNum = dias !== undefined && dias !== null && dias !== '' ? parseInt(dias, 10) : null;
    let fechaFinISO = fecha_devolucion_input ? toDateISO(fecha_devolucion_input) : null;

    if (fechaFinISO) {
      if (fechaFinISO < fechaInicioISO) {
        return NextResponse.json(
          { error: 'La fecha de devolución no puede ser anterior a la fecha de entrega.' },
          { status: 400 }
        );
      }
      if (!Number.isInteger(diasNum) || diasNum <= 0) {
        diasNum = calcularDiasEntreFechas(fechaInicioISO, fechaFinISO);
      }
    } else {
      if (!Number.isInteger(diasNum) || diasNum <= 0) {
        return NextResponse.json(
          { error: 'Debes indicar los días o el rango de fechas del alquiler.' },
          { status: 400 }
        );
      }
      const [y, m, d] = fechaInicioISO.split('-').map(Number);
      const finDate = new Date(Date.UTC(y, m - 1, d + diasNum));
      fechaFinISO = finDate.toISOString().slice(0, 10);
    }

    const cliente = await db.query('SELECT id FROM clientes WHERE id = $1', [cliente_id]);
    if (cliente.rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
    }

    // Validar disponibilidad del vehículo por fechas en el calendario (evita duplicar días alquilados)
    const disp = await verificarDisponibilidadFechas(vehiculo_id, fechaInicioISO, fechaFinISO);
    if (!disp.disponible) {
      return NextResponse.json(
        { error: disp.error, conflictos: disp.conflictos },
        { status: disp.status || 409 }
      );
    }

    let firmaUrl = null;
    if (firmaFile && typeof firmaFile === 'object' && firmaFile.size > 0) {
      firmaUrl = await saveSignatureFile(firmaFile, `firma-${Date.now()}.png`);
    }

    const horaActual = now.toISOString().slice(11, 19);
    const fechaEntrega = `${fechaInicioISO} ${horaActual}`;
    const fechaDevolucion = `${fechaFinISO} ${horaActual}`;

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
        disp.vehiculo.precio_dia,
        firmaUrl,
        observaciones || null,
      ]
    );

    // Sincronizar estado general del vehículo
    await sincronizarEstadoVehiculoHoy(vehiculo_id);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    const { status, error } = handleApiError(err);
    return NextResponse.json({ error }, { status });
  }
}
