const MENSAJES_CONSTRAINT = {
  vehiculos_placa_key: 'Ya existe un vehículo con esa placa.',
  vehiculos_codigo_key: 'Ya existe un vehículo con ese código.',
  clientes_codigo_key: 'Ya existe un cliente con ese código.',
  idx_clientes_identificacion_unica: 'Ya existe un cliente registrado con esa identificación.',
  idx_alquiler_vehiculo_activo: 'Ese vehículo ya tiene un alquiler activo en este momento.',
  chk_vehiculos_codigo_mayus: 'El código del vehículo debe ir en mayúsculas.',
  chk_vehiculos_placa_mayus: 'La placa debe ir en mayúsculas.',
  chk_clientes_codigo_mayus: 'El código del cliente debe ir en mayúsculas.',
  chk_alquileres_devolucion_prog: 'La fecha de devolución programada no puede ser anterior a la de entrega.',
  chk_alquileres_devolucion_real: 'La fecha de devolución real no puede ser anterior a la de entrega.',
  'vehiculos.placa': 'Ya existe un vehículo con esa placa.',
  'vehiculos.codigo': 'Ya existe un vehículo con ese código.',
  'clientes.codigo': 'Ya existe un cliente con ese código.',
  'clientes.identificacion': 'Ya existe un cliente registrado con esa identificación.',
  'alquileres.vehiculo_id': 'Ese vehículo ya tiene un alquiler activo en este momento.',
};

export function handleApiError(err) {
  if (!err) return { status: 500, error: 'Ocurrió un error inesperado.' };

  if (err.code === 'SQLITE_CONSTRAINT_TRIGGER' || err.code === 'P0001') {
    return { status: 409, error: err.message };
  }

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === '23505' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
    for (const [key, msg] of Object.entries(MENSAJES_CONSTRAINT)) {
      if (err.message && err.message.includes(key)) {
        return { status: 409, error: msg };
      }
      if (err.constraint && err.constraint === key) {
        return { status: 409, error: msg };
      }
    }
    return { status: 409, error: 'Ya existe un registro con ese valor único.' };
  }

  if (err.code === 'SQLITE_CONSTRAINT_CHECK' || err.code === '23514' || (err.message && err.message.includes('CHECK constraint failed'))) {
    for (const [key, msg] of Object.entries(MENSAJES_CONSTRAINT)) {
      if (err.message && err.message.includes(key)) {
        return { status: 400, error: msg };
      }
      if (err.constraint && err.constraint === key) {
        return { status: 400, error: msg };
      }
    }
    return { status: 400, error: 'Uno de los valores enviados no cumple una regla de validación.' };
  }

  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || err.code === '23503' || (err.message && err.message.includes('FOREIGN KEY constraint failed'))) {
    return {
      status: 409,
      error: 'La operación hace referencia a un registro que no existe, o intenta eliminar un registro que tiene datos relacionados.',
    };
  }

  if (err.code === '23P01') {
    return { status: 409, error: 'Ese vehículo ya tiene una reserva activa que se solapa con esas fechas.' };
  }

  console.error(err);
  return { status: 500, error: err.message || 'Error interno del servidor.' };
}
