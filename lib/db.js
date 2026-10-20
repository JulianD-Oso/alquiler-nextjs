import { Pool } from '@neondatabase/serverless';
import path from 'path';
import fs from 'fs';

let poolInstance = null;

function getSqliteDatabase() {
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.bun) {
      return require('bun:sqlite').Database;
    }
    return null;
  } catch {
    return null;
  }
}

function getDb() {
  if (poolInstance) return poolInstance;

  const databaseUrl = process.env.DATABASE_URL;

  // 1. Si hay DATABASE_URL (Neon PostgreSQL o Postgres estándar)
  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    const pgPool = new Pool({
      connectionString: databaseUrl,
    });

    poolInstance = {
      isPostgres: true,
      async query(sqlText, params = []) {
        const client = await pgPool.connect();
        try {
          const res = await client.query(sqlText, params);
          return {
            rows: res.rows || [],
            rowCount: res.rowCount || 0,
          };
        } finally {
          client.release();
        }
      },
      async connect() {
        return pgPool.connect();
      },
    };

    return poolInstance;
  }

  // 2. Si no hay DATABASE_URL, usar SQLite local
  const Database = getSqliteDatabase();
  if (!Database) {
    throw new Error('No se encontró base de datos. Configura DATABASE_URL para PostgreSQL o ejecuta con Bun para SQLite.');
  }

  // Buscar archivo SQLite existente en alquiler-backend/data/alquiler.db
  const defaultPath = path.resolve(process.cwd(), '../alquiler-backend/data/alquiler.db');
  const fallbackPath = path.resolve(process.cwd(), './data/alquiler.db');
  const dbFilePath = process.env.SQLITE_DB_PATH || (fs.existsSync(defaultPath) ? defaultPath : fallbackPath);

  const dbDir = path.dirname(dbFilePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const rawDb = new Database(dbFilePath, { create: true });
  try {
    rawDb.run('PRAGMA foreign_keys = ON;');
    rawDb.run('PRAGMA journal_mode = WAL;');
  } catch {
    // ignorar
  }

  poolInstance = {
    isPostgres: false,
    rawDb,
    async query(sqlText, params = []) {
      const trimmed = sqlText.trim();

      if ((!params || params.length === 0) && (trimmed.includes(';') || /^(BEGIN|COMMIT|ROLLBACK|PRAGMA)/i.test(trimmed))) {
        rawDb.run(trimmed);
        return { rows: [], rowCount: 0 };
      }

      const isSelectOrReturning = /^\s*(SELECT|WITH|EXPLAIN)/i.test(trimmed) || /\bRETURNING\b/i.test(trimmed);
      const safeParams = Array.isArray(params) ? params : [];

      if (isSelectOrReturning) {
        const stmt = rawDb.prepare(trimmed);
        const rows = safeParams.length > 0 ? stmt.all(safeParams) : stmt.all();
        return {
          rows: rows || [],
          rowCount: rows ? rows.length : 0,
        };
      } else {
        const stmt = rawDb.prepare(trimmed);
        const info = safeParams.length > 0 ? stmt.run(safeParams) : stmt.run();
        return {
          rows: [],
          rowCount: info && typeof info.changes === 'number' ? info.changes : 0,
          lastInsertRowid: info ? info.lastInsertRowid : undefined,
        };
      }
    },
    async connect() {
      return {
        query: (t, p) => poolInstance.query(t, p),
        release: () => {},
      };
    },
  };

  return poolInstance;
}

export default {
  query: (text, params) => getDb().query(text, params),
  connect: () => getDb().connect(),
  isPostgres: () => getDb().isPostgres,
};
