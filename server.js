import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  upsertPrice, getHistory, addComment, listComments, commentCountsByDate, stats,
} from './src/db.js';
import { fetchByIsin } from './src/api.js';
import { STOCKS } from './src/stocks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/overview', async (req, res) => {
  const { basDt } = req.query;
  try {
    const results = await Promise.all(STOCKS.map((s) => fetchByIsin(s.isinCd, basDt)));
    const [common, pref2B, samsung] = results;

    await Promise.all(results.filter(Boolean).map((r) => upsertPrice(r)));

    let disparity = null;
    if (common?.clpr && pref2B?.clpr) {
      disparity = ((Number(common.clpr) - Number(pref2B.clpr)) / Number(common.clpr)) * 100;
    }

    res.json({
      basDt: common?.basDt || pref2B?.basDt || basDt || null,
      common, pref2B, samsung,
      disparity,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history', async (req, res) => {
  const { srtnCd, days = 90 } = req.query;
  if (!srtnCd) return res.status(400).json({ error: 'srtnCd required' });
  try {
    const rows = await getHistory(srtnCd, Number(days));
    res.json({ srtnCd, days: Number(days), rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/disparity-history', async (req, res) => {
  const days = Number(req.query.days || 90);
  try {
    const [common, pref] = await Promise.all([getHistory('005380', days), getHistory('005387', days)]);
    const prefByDt = Object.fromEntries(pref.map((r) => [r.bas_dt, r]));
    const points = common
      .filter((c) => prefByDt[c.bas_dt])
      .map((c) => {
        const p = prefByDt[c.bas_dt];
        return {
          basDt: c.bas_dt,
          common: Number(c.clpr),
          pref: Number(p.clpr),
          disparity: ((Number(c.clpr) - Number(p.clpr)) / Number(c.clpr)) * 100,
        };
      });
    res.json({ days, points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const s = await stats();
    res.json({ total: s.total, minDate: s.min_dt, maxDate: s.max_dt, perStock: s.perStock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const DATE_RE = /^\d{8}$/;

app.get('/api/comments', async (req, res) => {
  const { basDt } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  if (basDt && !DATE_RE.test(basDt)) {
    return res.status(400).json({ error: 'basDt must be YYYYMMDD' });
  }
  try {
    const rows = await listComments({ basDt, limit });
    res.json({ basDt: basDt || null, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/comments/counts', async (req, res) => {
  try {
    const rows = await commentCountsByDate();
    res.json({ rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/comments', async (req, res) => {
  const { basDt, author, body } = req.body || {};
  if (!DATE_RE.test(basDt || '')) {
    return res.status(400).json({ error: 'basDt must be YYYYMMDD' });
  }
  const a = (author || '').trim();
  const b = (body || '').trim();
  if (a.length === 0 || a.length > 20) return res.status(400).json({ error: '작성자는 1~20자' });
  if (b.length === 0 || b.length > 500) return res.status(400).json({ error: '내용은 1~500자' });
  try {
    const { id } = await addComment({ basDt, author: a, body: b });
    res.json({ id, basDt, author: a, body: b });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Stock monitor on http://localhost:${PORT}`);
});
