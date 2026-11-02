import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn('[Database] WARNING: DATABASE_URL is not set. Database features will be unavailable.');
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[Database Pool Error]:', err.message || err);
});

export async function query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production' && duration > 200) {
    console.log(`[Database Slow Query] (${duration}ms): ${text.slice(0, 80)}...`);
  }
  return res;
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const res = await query('SELECT version()');
    return { ok: true, version: res.rows[0]?.version };
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }
}
