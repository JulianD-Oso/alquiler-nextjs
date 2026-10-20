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
