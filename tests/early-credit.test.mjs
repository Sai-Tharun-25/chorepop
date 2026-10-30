import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('early completion keeps Alex assigned and skips Chris exactly once, only for this chore',()=>{
 const py=String.raw`
import sqlite3,sys
c=sqlite3.connect(':memory:');c.execute('PRAGMA foreign_keys=ON');c.executescript(open(sys.argv[1]).read())
for i,n in enumerate(['Alex','Ben','Chris','David','Emma']):c.execute('INSERT INTO members VALUES(?,?,?,?)',(str(i),n,i,1))
for id in ['dishes','trash']:c.execute('INSERT INTO chores(id,title,current_member_id,turn_started_at,created_at) VALUES(?,?,?,?,?)',(id,id,'0',1,1))
c.execute('INSERT OR IGNORE INTO skip_credits VALUES(?,?,?)',('dishes','2',9))
assert c.execute('SELECT current_member_id FROM chores WHERE id="dishes"').fetchone()[0]=='0'
# A second credit cannot accumulate.
c.execute('INSERT OR IGNORE INTO skip_credits VALUES(?,?,?)',('dishes','2',10))
assert c.execute('SELECT count(*) FROM skip_credits WHERE chore_id="dishes"').fetchone()[0]==1
order=[]
for round in range(8):
 current=c.execute('SELECT current_member_id FROM chores WHERE id="dishes"').fetchone()[0]
 order.append(int(current))
 members=c.execute('SELECT id FROM members ORDER BY sort_order').fetchall()
 credited={r[0] for r in c.execute('SELECT member_id FROM skip_credits WHERE chore_id="dishes"')}
 consumed=[]; next_id=None
 for offset in range(1,len(members)+1):
  candidate=members[(int(current)+offset)%len(members)][0]
  if candidate not in credited:next_id=candidate;break
  consumed.append(candidate)
 if next_id is None:next_id=members[(int(current)+1)%len(members)][0]
 c.execute('UPDATE chores SET current_member_id=? WHERE id="dishes"',(next_id,))
 for m in consumed:c.execute('DELETE FROM skip_credits WHERE chore_id=? AND member_id=?',('dishes',m))
assert order==[0,1,3,4,0,1,2,3],order
assert c.execute('SELECT count(*) FROM skip_credits').fetchone()[0]==0
assert c.execute('SELECT current_member_id FROM chores WHERE id="trash"').fetchone()[0]=='0'
print('early rotation passed')`;
 assert.match(execFileSync('python',['-c',py,path.join(root,'schema.sql')],{encoding:'utf8'}),/passed/);
 const server=readFileSync(path.join(root,'src/index.js'),'utf8');
 assert.match(server,/earlyMatch/);
 assert.match(server,/nextUncreditedMember/);
});
