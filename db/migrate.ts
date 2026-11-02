import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

async function runMigrations() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('FATAL: Neither DIRECT_URL nor DATABASE_URL is set in environment.');
    process.exit(1);
  }

  const isDirect = Boolean(process.env.DIRECT_URL);
  console.log(`Connecting to Neon PostgreSQL using ${isDirect ? 'DIRECT_URL (unpooled)' : 'DATABASE_URL'}...`);

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  console.log('Connected to Neon PostgreSQL for migrations.');

  try {
    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch applied migrations
    const { rows: appliedRows } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.version));

    // 3. Read migration directory
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let countApplied = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[Migration] Already applied: ${file}`);
        continue;
      }

      console.log(`[Migration] Applying: ${file}...`);
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query(
          'INSERT INTO schema_migrations (version, applied_at) VALUES ($1, NOW())',
          [file]
        );
        await client.query('COMMIT');
        console.log(`[Migration] Successfully applied: ${file}`);
        countApplied++;
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`[Migration] Failed on file ${file}:`, err.message || err);
        throw err;
      }
    }

    console.log(`[Migration] Completed. ${countApplied} new migration(s) applied.`);

    // 4. Verify all tables in public schema
    const { rows: tables } = await client.query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('Active Database Tables:');
    tables.forEach((t) => console.log(`  - ${t.table_name}`));

    // 5. Verify indexes
    const { rows: indexes } = await client.query<{ indexname: string; tablename: string }>(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);

    console.log(`Verified ${indexes.length} indexes in public schema.`);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration runner failed:', err);
  process.exit(1);
});
