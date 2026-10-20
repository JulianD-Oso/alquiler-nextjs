import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyPassword, signToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { correo, password } = body;

    if (!correo || !password) {
      return NextResponse.json(
        { error: 'Por favor ingresa tu correo y contraseña.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(correo).trim().toLowerCase();
    const result = await db.query(
      'SELECT id, nombre, correo, password_hash, rol, activo FROM usuarios WHERE LOWER(correo) = $1 LIMIT 1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'El correo o la contraseña son incorrectos.' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    if (!user.activo) {
      return NextResponse.json(
        { error: 'Tu cuenta ha sido desactivada. Comunícate con el administrador.' },
        { status: 403 }
      );
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'El correo o la contraseña son incorrectos.' },
        { status: 401 }
      );
    }

    const userPayload = {
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
    };

    const token = signToken(userPayload);

    const response = NextResponse.json({
      ok: true,
      mensaje: 'Inicio de sesión exitoso',
      usuario: userPayload,
      token,
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    return response;
  } catch (error) {
    console.error('Error en POST /api/auth/login:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar el inicio de sesión.' },
      { status: 500 }
    );
  }
}
