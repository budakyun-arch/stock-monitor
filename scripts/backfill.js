import { fetchRange } from '../src/api.js';
import { upsertPriceMany, stats, pool } from '../src/db.js';
import { STOCKS } from '../src/stocks.js';

const DEFAULT_BEGIN = '20200102';
const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
const DEFAULT_END = `${yyyy}${mm}${dd}`;

const [, , argBegin, argEnd] = process.argv;
const begin = argBegin || DEFAULT_BEGIN;
const end = argEnd || DEFAULT_END;

console.log(`Backfill ${begin} → ${end} for ${STOCKS.length} stocks`);

for (const s of STOCKS) {
  const t0 = Date.now();
  process.stdout.write(`  [${s.itmsNm}] fetching… `);
  const rows = await fetchRange(s.isinCd, begin, end);
  await upsertPriceMany(rows);
  console.log(`${rows.length} rows in ${Date.now() - t0}ms`);
}

const s = await stats();
console.log(`\nDB total: ${s.total} rows, ${s.min_dt} → ${s.max_dt}`);

await pool.end();
