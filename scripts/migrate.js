import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

for (const f of files) {
  const sql = await fs.readFile(path.join(MIGRATIONS_DIR, f), 'utf8');
  process.stdout.write(`Applying ${f}… `);
  await pool.query(sql);
  console.log('✅');
}

const { rows } = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' ORDER BY table_name
`);
console.log('\nTables in public schema:', rows.map((r) => r.table_name).join(', '));

await pool.end();
