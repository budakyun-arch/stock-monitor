import { pool } from '../src/db.js';

try {
  const { rows } = await pool.query('SELECT NOW() as now, current_database() as db, current_user as user, version() as version');
  console.log('✅ Supabase 연결 성공');
  console.log(rows[0]);
} catch (e) {
  console.error('❌ 연결 실패:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
