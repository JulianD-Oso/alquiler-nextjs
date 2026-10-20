import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const body = await request.json();
    const { nombre, correo, password, rol = 'admin' } = body;

    if (!nombre || !correo || !password) {
      return NextResponse.json(
        { error: 'Todos los campos (nombre, correo y contraseña) son obligatorios.' },
        { status: 400 }
      );
    }

    const cleanNombre = String(nombre).trim();
    const cleanEmail = String(correo).trim().toLowerCase();

    if (cleanNombre.length < 2) {
      return NextResponse.json(
        { error: 'El nombre debe tener al menos 2 caracteres.' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { error: 'Por favor ingresa un correo electrónico válido.' },
        { status: 400 }
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener mínimo 6 caracteres.' },
        { status: 400 }
      );
    }

    // Verificar si ya existe el correo
    const existing = await db.query(
      'SELECT id FROM usuarios WHERE LOWER(correo) = $1 LIMIT 1',
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta registrada con este correo electrónico.' },
        { status: 409 }
      );
    }

    // Generar hash y guardar usuario
    const hashedPassword = await hashPassword(password);
    const insertRes = await db.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, correo, rol, creado_en`,
      [cleanNombre, cleanEmail, hashedPassword, rol || 'admin', true]
    );

    const newUser = insertRes.rows[0];

    const userPayload = {
      id: newUser.id,
      nombre: newUser.nombre,
      correo: newUser.correo,
      rol: newUser.rol,
    };

    const token = signToken(userPayload);

    const response = NextResponse.json(
      {
        ok: true,
        mensaje: 'Usuario registrado exitosamente',
        usuario: userPayload,
        token,
      },
      { status: 201 }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error('Error en POST /api/auth/registro:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al crear el usuario.' },
      { status: 500 }
    );
  }
}
