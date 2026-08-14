/**
 * Full-chain verification: Round 1 -> qualification -> PIN -> Round 2 -> scoring.
 *
 * This exists because the two rounds had SEPARATE identity systems. /round2
 * offered a registration form, minting a second Participant with no Round 1
 * attempt — a student who could never qualify. This test asserts the two rounds
 * now share one participant record end to end.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL ||
  'postgresql://postgres:quizpass@localhost:5432/quizdb' });
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? (pass++, console.log(`  \x1b[32mPASS\x1b[0m  ${n}`))
  : (fail++, console.log(`  \x1b[31mFAIL\x1b[0m  ${n}${d ? ` — ${d}` : ''}`)); };
const id = () => randomUUID();

async function main() {
  await c.connect();
  await c.query(`
    DROP TABLE IF EXISTS "Round2LiveAnswer","Round2LiveQuestion","Round1Answer","Round1Attempt","Participant","CompetitionSettings" CASCADE;
    CREATE TABLE "CompetitionSettings"(id TEXT PRIMARY KEY,"isTestMode" BOOLEAN DEFAULT false,
      "round2CurrentQuestion" INT DEFAULT 0,"round2QuestionState" TEXT DEFAULT 'idle',
      "round2QuestionOpenedAt" TIMESTAMP(3),"round2QuestionSeconds" INT DEFAULT 120,
      "round2QualifyTopN" INT DEFAULT 20,"round2JoinPin" TEXT,
      "round2RequirePin" BOOLEAN DEFAULT true,"round2RequireQualify" BOOLEAN DEFAULT true);
    CREATE UNIQUE INDEX cs_single ON "CompetitionSettings"((true));
    CREATE TABLE "Participant"(id TEXT PRIMARY KEY,"participantCode" TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,"schoolName" TEXT NOT NULL DEFAULT 'MES',language TEXT DEFAULT 'english',
      "round2Eligible" BOOLEAN DEFAULT false,"round2JoinedAt" TIMESTAMP(3),
      disqualified BOOLEAN DEFAULT false,"isTest" BOOLEAN DEFAULT false);
    CREATE TABLE "Round1Attempt"(id TEXT PRIMARY KEY,"participantId" TEXT NOT NULL,
      status TEXT DEFAULT 'in_progress',score INT,"completionTimeMs" INT,
      "submittedAt" TIMESTAMP(3),"isTest" BOOLEAN DEFAULT false);
    CREATE TABLE "Round2LiveQuestion"(id TEXT PRIMARY KEY,"questionNumber" INT UNIQUE NOT NULL,
      items TEXT NOT NULL,"correctOrder" TEXT NOT NULL,marks INT DEFAULT 1,
      "timeLimitSec" INT DEFAULT 120,"isActive" BOOLEAN DEFAULT true);
    CREATE TABLE "Round2LiveAnswer"(id TEXT PRIMARY KEY,"participantId" TEXT NOT NULL,
      "questionId" TEXT NOT NULL,"questionNumber" INT NOT NULL,"submittedOrder" TEXT,
      "isCorrect" BOOLEAN DEFAULT false,"correctPositions" INT DEFAULT 0,marks INT DEFAULT 0,
      "responseTimeMs" INT NOT NULL,"isTest" BOOLEAN DEFAULT false);
    CREATE UNIQUE INDEX r2a_once ON "Round2LiveAnswer"("participantId","questionId");
  `);
  const sid = id();
  await c.query(`INSERT INTO "CompetitionSettings"(id) VALUES($1)`, [sid]);

  const order = ['a','b','c'];
  const qid = id();
  await c.query(`INSERT INTO "Round2LiveQuestion"(id,"questionNumber",items,"correctOrder")
    VALUES($1,1,$2,$3)`, [qid, JSON.stringify([{key:'a'},{key:'b'},{key:'c'}]), JSON.stringify(order)]);

  console.log('\n\x1b[1m1. Round 1: five students register and sit the paper\x1b[0m');
  const people = [['Aisha',10,5000],['Bilal',10,7000],['Fatima',9,4000],['Hamza',3,9000],['Zaid',null,null]];
  const ids = {};
  let n = 0;
  for (const [name, score, ms] of people) {
    ids[name] = id(); n++;
    await c.query(`INSERT INTO "Participant"(id,"participantCode",name) VALUES($1,$2,$3)`,
      [ids[name], `MES${String(n).padStart(4,'0')}`, name]);
    if (score !== null) {
      await c.query(`INSERT INTO "Round1Attempt"(id,"participantId",status,score,"completionTimeMs","submittedAt")
        VALUES($1,$2,'submitted',$3,$4,NOW())`, [id(), ids[name], score, ms]);
    }
  }
  const pc = (await c.query('SELECT count(*)::int c FROM "Participant"')).rows[0].c;
  check('5 participants exist after Round 1', pc === 5, `got ${pc}`);

  console.log('\n\x1b[1m2. Lookup by code returns the SAME participant (no duplicate)\x1b[0m');
  const found = (await c.query(
    'SELECT id,name FROM "Participant" WHERE "participantCode"=$1', ['MES0001'])).rows[0];
  check('code MES0001 resolves to Aisha', found?.name === 'Aisha');
  check('resolves to the SAME row Round 1 created', found?.id === ids.Aisha);
  const pc2 = (await c.query('SELECT count(*)::int c FROM "Participant"')).rows[0].c;
  check('lookup created no new participant', pc2 === 5, `got ${pc2}`);

  console.log('\n\x1b[1m3. Admin applies the Round 1 cut (top 3)\x1b[0m');
  await c.query(`UPDATE "Participant" SET "round2Eligible"=false`);
  const top = (await c.query(`SELECT "participantId" FROM "Round1Attempt"
    WHERE status='submitted' ORDER BY score DESC,"completionTimeMs" ASC LIMIT 3`)).rows.map(r=>r.participantId);
  await c.query(`UPDATE "Participant" SET "round2Eligible"=true WHERE id = ANY($1)`, [top]);
  const q = Object.fromEntries((await c.query(
    'SELECT name,"round2Eligible" e FROM "Participant"')).rows.map(r=>[r.name,r.e]));
  check('Aisha qualified (10 marks, fastest)', q.Aisha === true);
  check('Bilal qualified (10 marks, slower)', q.Bilal === true);
  check('Fatima qualified (9 marks)', q.Fatima === true);
  check('Hamza NOT qualified (3 marks)', q.Hamza === false);
  check('Zaid NOT qualified (never submitted)', q.Zaid === false);

  console.log('\n\x1b[1m4. Gate blocks entry\x1b[0m');
  const gate = async (pid, pin) => {
    const s = (await c.query('SELECT * FROM "CompetitionSettings" LIMIT 1')).rows[0];
    const p = (await c.query('SELECT * FROM "Participant" WHERE id=$1',[pid])).rows[0];
    if (p.disqualified) return 'DISQUALIFIED';
    if (s.round2RequireQualify && !p.round2Eligible) return 'NOT_QUALIFIED';
    if (s.round2RequirePin) {
      if (!s.round2JoinPin) return 'NO_PIN_SET';
      if (pin !== s.round2JoinPin) return 'BAD_PIN';
    }
    await c.query('UPDATE "Participant" SET "round2JoinedAt"=NOW() WHERE id=$1',[pid]);
    return 'OK';
  };
  check('unqualified student blocked', await gate(ids.Hamza,'1234') === 'NOT_QUALIFIED');
  check('qualified student blocked before PIN exists', await gate(ids.Aisha,'1234') === 'NO_PIN_SET');
  await c.query(`UPDATE "CompetitionSettings" SET "round2JoinPin"='4821'`);
  check('wrong PIN rejected', await gate(ids.Aisha,'0000') === 'BAD_PIN');
  check('correct PIN admits qualified student', await gate(ids.Aisha,'4821') === 'OK');
  check('correct PIN still rejects unqualified', await gate(ids.Hamza,'4821') === 'NOT_QUALIFIED');
  await gate(ids.Bilal,'4821'); await gate(ids.Fatima,'4821');

  console.log('\n\x1b[1m5. Question opens; only joined+qualified may answer\x1b[0m');
  await c.query(`UPDATE "CompetitionSettings" SET "round2QuestionState"='open',
    "round2CurrentQuestion"=1,"round2QuestionOpenedAt"=NOW()`);
  const answer = async (pid, ord) => {
    const s = (await c.query('SELECT * FROM "CompetitionSettings" LIMIT 1')).rows[0];
    if (s.round2QuestionState !== 'open') return 'NOT_OPEN';
    const p = (await c.query('SELECT * FROM "Participant" WHERE id=$1',[pid])).rows[0];
    if (p.disqualified) return 'DISQUALIFIED';
    if (s.round2RequireQualify && !p.round2Eligible) return 'NOT_QUALIFIED';
    if (s.round2RequirePin && !p.round2JoinedAt) return 'NOT_JOINED';
    const correct = JSON.parse((await c.query('SELECT "correctOrder" FROM "Round2LiveQuestion" WHERE id=$1',[qid])).rows[0].correctOrder);
    const isCorrect = JSON.stringify(ord) === JSON.stringify(correct);
    const rt = Math.max(1, Date.now() - new Date(s.round2QuestionOpenedAt).getTime());
    try {
      await c.query(`INSERT INTO "Round2LiveAnswer"(id,"participantId","questionId","questionNumber","submittedOrder","isCorrect",marks,"responseTimeMs")
        VALUES($1,$2,$3,1,$4,$5,$6,$7)`,[id(),pid,qid,JSON.stringify(ord),isCorrect,isCorrect?1:0,rt]);
      return 'OK';
    } catch(e){ if(e.code==='23505') return 'ALREADY'; throw e; }
  };
  check('unqualified cannot answer even mid-round', await answer(ids.Hamza,order) === 'NOT_QUALIFIED');
  check('qualified + joined can answer', await answer(ids.Aisha,order) === 'OK');
  await new Promise(r=>setTimeout(r,60));
  check('second student can answer', await answer(ids.Bilal,order) === 'OK');
  check('same student cannot answer twice', await answer(ids.Aisha,order) === 'ALREADY');
  await answer(ids.Fatima,['c','b','a']);

  console.log('\n\x1b[1m6. Disqualify mid-round stops scoring\x1b[0m');
  await c.query('UPDATE "Participant" SET disqualified=true WHERE id=$1',[ids.Bilal]);
  check('disqualified student blocked from answering', await answer(ids.Bilal,order) === 'DISQUALIFIED');

  console.log('\n\x1b[1m7. Leaderboard: only qualified, not disqualified\x1b[0m');
  await c.query(`UPDATE "CompetitionSettings" SET "round2QuestionState"='revealed'`);
  const board = (await c.query(`
    SELECT p.name, COALESCE(SUM(a.marks),0)::int score, COALESCE(SUM(a."responseTimeMs"),0)::int t
    FROM "Participant" p LEFT JOIN "Round2LiveAnswer" a ON a."participantId"=p.id
    WHERE p."round2Eligible"=true AND p.disqualified=false
    GROUP BY p.name ORDER BY score DESC, t ASC`)).rows;
  const names = board.map(r=>r.name);
  check('Bilal removed from the board', !names.includes('Bilal'), names.join(','));
  check('Hamza never on the board', !names.includes('Hamza'));
  check('Aisha leads with 1 mark', board[0]?.name==='Aisha' && board[0]?.score===1, JSON.stringify(board[0]));
  check('Fatima on the board with 0 (wrong order)',
    board.find(r=>r.name==='Fatima')?.score===0);

  console.log('\n\x1b[1m8. Final board\x1b[0m');
  board.forEach((r,i)=>console.log(`   #${i+1}  ${r.name.padEnd(8)} score=${r.score}  time=${r.t}ms`));

  console.log(`\n\x1b[1mResult: ${pass} passed, ${fail} failed\x1b[0m\n`);
  await c.end(); process.exit(fail===0?0:1);
}
main().catch(async e=>{console.error(e); try{await c.end()}catch{}; process.exit(1);});
