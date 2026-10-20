import db from './db';

function calcularSiguienteCodigo(codigosExistentes, prefijo) {
  const patron = new RegExp(`^${prefijo}(\\d+)$`);
  let maxNum = 0;
  for (const codigo of codigosExistentes) {
    const match = codigo.match(patron);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const siguiente = maxNum + 1;
  return `${prefijo}${String(siguiente).padStart(2, '0')}`;
}

export async function generarCodigoVehiculo(tipo) {
  const prefijo = tipo === 'moto' ? 'M' : 'CR';
  const result = await db.query(
    `SELECT codigo FROM vehiculos WHERE codigo LIKE $1`,
    [`${prefijo}%`]
  );
  return calcularSiguienteCodigo(result.rows.map(r => r.codigo), prefijo);
}

export async function generarCodigoCliente() {
  const result = await db.query(
    `SELECT codigo FROM clientes WHERE codigo LIKE 'CL%'`
  );
  return calcularSiguienteCodigo(result.rows.map(r => r.codigo), 'CL');
}
