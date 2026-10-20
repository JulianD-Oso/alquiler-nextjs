export const fmtCOP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function estadoLabel(estado) {
  const mapa = {
    disponible: 'Disponible',
    alquilado: 'Alquilado',
    mantenimiento: 'Mantenimiento',
    fuera_de_servicio: 'Fuera de servicio',
    activa: 'Activa',
    convertida: 'Convertida',
    cancelada: 'Cancelada',
    vencida: 'Vencida',
  };
  return mapa[estado] || estado;
}

export const CATEGORIAS_GASTO_LABEL = {
  gasolina: 'Gasolina',
  mantenimiento: 'Mantenimiento',
  seguro: 'Seguro',
  impuestos: 'Impuestos',
  otro: 'Otro',
};

export const MESES_CORTO = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export function fmtFecha(val) {
  if (!val) return '—';
  try {
    const str = typeof val === 'string' ? val : (val.toISOString ? val.toISOString() : String(val));
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      const mesNombre = MESES_CORTO[parseInt(m, 10) - 1] || m;
      return `${parseInt(d, 10)} ${mesNombre}, ${y}`;
    }
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return String(val);
    return dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(val);
  }
}

export function fmtFechaHora(val) {
  if (!val) return '—';
  try {
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return String(val);
    return dt.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(val);
  }
}
