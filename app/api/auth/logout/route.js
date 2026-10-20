import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    ok: true,
    mensaje: 'Sesión cerrada correctamente',
  });

  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
