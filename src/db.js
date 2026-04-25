import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL missing in .env');
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function q(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

function toNumOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const UPSERT_SQL = `
  INSERT INTO prices (
    bas_dt, srtn_cd, isin_cd, itms_nm, mrkt_ctg,
    clpr, vs, flt_rt, mkp, hipr, lopr, trqu, tr_prc, lstg_st_cnt, mrkt_tot_amt
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
  ON CONFLICT (bas_dt, srtn_cd) DO UPDATE SET
    clpr = EXCLUDED.clpr,
    vs = EXCLUDED.vs,
    flt_rt = EXCLUDED.flt_rt,
    mkp = EXCLUDED.mkp,
    hipr = EXCLUDED.hipr,
    lopr = EXCLUDED.lopr,
    trqu = EXCLUDED.trqu,
    tr_prc = EXCLUDED.tr_prc,
    lstg_st_cnt = EXCLUDED.lstg_st_cnt,
    mrkt_tot_amt = EXCLUDED.mrkt_tot_amt,
    fetched_at = NOW()
`;

export async function upsertPrice(row) {
  await q(UPSERT_SQL, [
    row.basDt, row.srtnCd, row.isinCd, row.itmsNm, row.mrktCtg,
    toNumOrNull(row.clpr), toNumOrNull(row.vs), toNumOrNull(row.fltRt),
    toNumOrNull(row.mkp), toNumOrNull(row.hipr), toNumOrNull(row.lopr),
    toNumOrNull(row.trqu), toNumOrNull(row.trPrc),
    toNumOrNull(row.lstgStCnt), toNumOrNull(row.mrktTotAmt),
  ]);
}

export async function upsertPriceMany(rows) {
  if (!rows.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await client.query(UPSERT_SQL, [
        row.basDt, row.srtnCd, row.isinCd, row.itmsNm, row.mrktCtg,
        toNumOrNull(row.clpr), toNumOrNull(row.vs), toNumOrNull(row.fltRt),
        toNumOrNull(row.mkp), toNumOrNull(row.hipr), toNumOrNull(row.lopr),
        toNumOrNull(row.trqu), toNumOrNull(row.trPrc),
        toNumOrNull(row.lstgStCnt), toNumOrNull(row.mrktTotAmt),
      ]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getHistory(srtnCd, days = 90) {
  const { rows } = await q(
    `SELECT bas_dt, srtn_cd, itms_nm, clpr, vs, flt_rt, mkp, hipr, lopr, trqu
     FROM prices
     WHERE srtn_cd = $1
     ORDER BY bas_dt DESC
     LIMIT $2`,
    [srtnCd, days]
  );
  return rows.reverse();
}

export async function addComment({ basDt, author, body }) {
  const { rows } = await q(
    `INSERT INTO comments (bas_dt, author, body) VALUES ($1,$2,$3) RETURNING id`,
    [basDt, author, body]
  );
  return { id: rows[0].id };
}

export async function listComments({ basDt, limit = 50 }) {
  if (basDt) {
    const { rows } = await q(
      `SELECT id, bas_dt, author, body, created_at
       FROM comments WHERE bas_dt = $1
       ORDER BY created_at DESC LIMIT $2`,
      [basDt, limit]
    );
    return rows;
  }
  const { rows } = await q(
    `SELECT id, bas_dt, author, body, created_at
     FROM comments ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function commentCountsByDate() {
  const { rows } = await q(
    `SELECT bas_dt, COUNT(*)::int AS n FROM comments GROUP BY bas_dt ORDER BY bas_dt DESC`
  );
  return rows;
}

export async function stats() {
  const { rows: totals } = await q(
    `SELECT COUNT(*)::int AS total, MIN(bas_dt) AS min_dt, MAX(bas_dt) AS max_dt FROM prices`
  );
  const { rows: perStock } = await q(
    `SELECT srtn_cd, itms_nm, COUNT(*)::int AS n FROM prices GROUP BY srtn_cd, itms_nm ORDER BY srtn_cd`
  );
  return { ...totals[0], perStock };
}
