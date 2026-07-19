import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Managed Postgres hosts (Render, Railway, Fly, etc.) require TLS. Enable it
// in production, or whenever DATABASE_SSL is set, but keep it off for local
// Docker Postgres which doesn't speak SSL. DATABASE_SSL overrides either way.
const useSSL =
  process.env.DATABASE_SSL !== undefined
    ? ['1', 'true', 'require'].includes(process.env.DATABASE_SSL.toLowerCase())
    : process.env.NODE_ENV === 'production';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://fieldbook:fieldbook@localhost:5432/fieldbook',
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

export const query = (text, params) => pool.query(text, params);

export async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}
