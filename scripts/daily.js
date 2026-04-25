import { fetchByIsin } from '../src/api.js';
import { upsertPrice, pool } from '../src/db.js';
import { STOCKS } from '../src/stocks.js';

// Compute most recent past trading day in KST.
// API provides T-1 data after market close (~16:00 KST).
const now = new Date();
const kst = new Date(now.getTime() + 9 * 3600 * 1000);
// Yesterday in KST as YYYYMMDD
const target = new Date(kst.getTime() - 24 * 3600 * 1000);
const yyyy = target.getUTCFullYear();
const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
const dd = String(target.getUTCDate()).padStart(2, '0');
const basDt = process.argv[2] || `${yyyy}${mm}${dd}`;

console.log(`Daily collect for ${basDt} (${STOCKS.length} stocks)`);

let saved = 0;
let missing = 0;
for (const s of STOCKS) {
  const row = await fetchByIsin(s.isinCd, basDt);
  if (row) {
    await upsertPrice(row);
    console.log(`  ✅ ${s.itmsNm} ${row.clpr}`);
    saved++;
  } else {
    console.log(`  ⚠️  ${s.itmsNm} no data (holiday or weekend?)`);
    missing++;
  }
}

console.log(`\nDone: ${saved} saved, ${missing} missing`);
await pool.end();

// Don't fail the workflow on weekends/holidays — just log.
process.exit(0);
