import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  try {
    const tokenCookie = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = tokenCookie || bearerToken;

    if (!token) {
      return NextResponse.json({ ok: false, usuario: null }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.id) {
      return NextResponse.json({ ok: false, usuario: null }, { status: 401 });
    }

    // Verificar en la base de datos si sigue activo
    const res = await db.query(
      'SELECT id, nombre, correo, rol, activo FROM usuarios WHERE id = $1 LIMIT 1',
      [payload.id]
    );

    if (res.rows.length === 0 || !res.rows[0].activo) {
      return NextResponse.json({ ok: false, usuario: null }, { status: 401 });
    }

    const user = res.rows[0];

    return NextResponse.json({
      ok: true,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
      },
    });
  } catch (error) {
    console.error('Error en GET /api/auth/me:', error);
    return NextResponse.json({ ok: false, usuario: null }, { status: 500 });
  }
}
