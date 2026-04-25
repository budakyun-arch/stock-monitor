import { db } from '../src/db.js';

const before = db.prepare('SELECT COUNT(*) as n FROM comments').get().n;
const rows = db.prepare('SELECT id, author, body FROM comments').all();
console.log(`Before: ${before} rows`);
for (const r of rows) console.log(`  id=${r.id} author=${JSON.stringify(r.author)}`);

db.exec('DELETE FROM comments');
db.exec("DELETE FROM sqlite_sequence WHERE name='comments'");

const after = db.prepare('SELECT COUNT(*) as n FROM comments').get().n;
console.log(`After:  ${after} rows`);
db.close();
