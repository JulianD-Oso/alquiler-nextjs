import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_x2DUqOcbnzB7@ep-dry-leaf-b4zqmvq3-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function main() {
  console.log('🚀 Creando tabla de usuarios en Neon PostgreSQL...');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // 1. Crear tabla usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(120) NOT NULL,
        correo VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(30) NOT NULL DEFAULT 'admin',
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        creado_en TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo);
    `);
    console.log('✅ Tabla `usuarios` creada o verificada.');

    // 2. Verificar si existe el usuario inicial
    const checkRes = await pool.query('SELECT count(*) FROM usuarios');
    const count = parseInt(checkRes.rows[0].count, 10);

    if (count === 0) {
      const defaultEmail = 'admin@rentacarjc.com';
      const defaultPassword = 'admin123456';
      const hash = await bcrypt.hash(defaultPassword, 10);

      await pool.query(
        `INSERT INTO usuarios (nombre, correo, password_hash, rol, activo)
         VALUES ($1, $2, $3, $4, $5)`,
        ['Administrador JC', defaultEmail, hash, 'admin', true]
      );
      console.log(`👤 Usuario inicial creado con éxito:`);
      console.log(`   - Correo: ${defaultEmail}`);
      console.log(`   - Contraseña: ${defaultPassword}`);
    } else {
      console.log(`ℹ️ Ya existen ${count} usuario(s) en la base de datos.`);
    }

    console.log('🎉 Migración de usuarios completada con éxito.');
  } catch (err) {
    console.error('❌ Error configurando usuarios:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
