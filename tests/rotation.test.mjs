import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('HTML shell has PWA metadata and server-side app hooks', () => {
  const html = readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /apple-mobile-web-app-title/);
  assert.match(html, /public\/app\.js|\/app\.js/);
  const manifest = JSON.parse(readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(i => i.sizes === '512x512'));
});

test('worker code contains completion CAS, next-member wraparound and hourly cron', () => {
  const server = readFileSync(path.join(root, 'src/index.js'), 'utf8');
  assert.match(server, /sort_order > \?/);
  assert.match(server, /ORDER BY sort_order LIMIT 1/);
  assert.match(server, /AND turn_started_at = \?/);
  assert.match(server, /DAY_MS = 24 \* 60 \* 60/);
  const config = readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
  assert.match(config, /crons = \["0 \* \* \* \*"\]/);
});

test('schema supports independent round-robin rotations and historical completion records', () => {
  const testCode = String.raw`
import sqlite3, sys
con=sqlite3.connect(':memory:')
con.execute('PRAGMA foreign_keys=ON')
con.executescript(open(sys.argv[1]).read())
for i,n in enumerate(['Alex','Ben','Casey','Dani','Eli']):
  con.execute('INSERT INTO members VALUES (?, ?, ?, ?)',(str(i),n,i,1))
con.execute('INSERT INTO chores (id,title,emoji,current_member_id,turn_started_at,created_at) VALUES (?,?,?,?,?,?)',('c1','Dishes','🍽️','0',1,1))
con.execute('INSERT INTO chores (id,title,emoji,current_member_id,turn_started_at,created_at) VALUES (?,?,?,?,?,?)',('c2','Trash','🗑️','2',1,1))
seen=[]
for counter in range(12):
  old=con.execute('SELECT current_member_id,turn_started_at FROM chores WHERE id=?',('c1',)).fetchone()
  seen.append(int(old[0]))
  after=con.execute('SELECT id FROM members WHERE sort_order > (SELECT sort_order FROM members WHERE id=?) ORDER BY sort_order LIMIT 1',(old[0],)).fetchone()
  if not after: after=con.execute('SELECT id FROM members ORDER BY sort_order LIMIT 1').fetchone()
  changed=con.execute('UPDATE chores SET current_member_id=?,turn_started_at=?,completed_count=completed_count+1 WHERE id=? AND current_member_id=? AND turn_started_at=? RETURNING id',(after[0],counter+100,'c1',old[0],old[1])).fetchone()
  assert changed, counter
  con.execute('INSERT INTO history (id,chore_id,chore_title,member_id,member_name,done_at) VALUES (?,?,?,?,?,?)',(str(counter),'c1','Dishes',old[0],'Alex',counter))
assert seen==[0,1,2,3,4,0,1,2,3,4,0,1],seen
assert con.execute('SELECT current_member_id FROM chores WHERE id=?',('c2',)).fetchone()[0]=='2'
assert con.execute('SELECT COUNT(*) FROM history').fetchone()[0]==12
con.execute('DELETE FROM chores WHERE id=?',('c1',))
assert con.execute('SELECT COUNT(*) FROM history WHERE chore_id IS NULL').fetchone()[0]==12
print('12 turns, cycle wraparound, independent queues and history retention verified')`;
  const output = execFileSync('python', ['-c', testCode, path.join(root,'schema.sql')], { encoding: 'utf8' });
  assert.match(output, /verified/);
});
