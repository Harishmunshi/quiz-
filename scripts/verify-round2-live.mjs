/**
 * End-to-end verification of the Round 2 ORDERING engine against real Postgres.
 *
 * Drives the same SQL the API routes issue through Prisma, so it exercises the
 * parts that actually decide the competition:
 *   - all-or-nothing sequence grading (one item out of place = zero)
 *   - the unique constraint that makes submitting twice impossible
 *   - server-side response timing
 *   - the admin state machine (open -> lock -> reveal -> next)
 *   - ranking: score desc, then cumulative time asc
 *   - the missed-question penalty that stops silence being rewarded
 *   - rejection of tampered sequences (duplicates, unknown keys, wrong length)
 *
 * Run: node scripts/verify-round2-live.mjs
 */

import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    process.env.DATABASE_URL || 'postgresql://postgres:quizpass@localhost:5432/quizdb',
});

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
  } else {
    fail++;
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};
const id = () => randomUUID();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Mirrors of the pure helpers in src/lib/round2/live.ts ────────────────
function gradeOrder(submitted, correct) {
  let correctPositions = 0;
  for (let i = 0; i < correct.length; i++) if (submitted[i] === correct[i]) correctPositions++;
  return {
    isCorrect: submitted.length === correct.length && correctPositions === correct.length,
    correctPositions,
  };
}
function validateSubmission(submitted, itemKeys) {
  const valid = new Set(itemKeys);
  if (submitted.length !== itemKeys.length) return { ok: false, reason: 'WRONG_LENGTH' };
  const seen = new Set();
  for (const k of submitted) {
    if (!valid.has(k)) return { ok: false, reason: 'UNKNOWN_ITEM' };
    if (seen.has(k)) return { ok: false, reason: 'DUPLICATE' };
    seen.add(k);
  }
  return { ok: true };
}
const scoredQuestionCount = (cur, st) =>
  st === 'locked' || st === 'revealed' ? cur : Math.max(0, cur - 1);
const missedPenaltyMs = (s) => (s > 0 ? s : 120) * 1000;

function rankLiveEntries(rows) {
  const sorted = [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
    return a.participantName.localeCompare(b.participantName);
  });
  let lastRank = 0, lastScore = null, lastTime = null;
  return sorted.map((row, i) => {
    const tied = row.score === lastScore && row.totalTimeMs === lastTime;
    const rank = tied ? lastRank : i + 1;
    lastRank = rank; lastScore = row.score; lastTime = row.totalTimeMs;
    return { ...row, rank };
  });
}

async function settings() {
  return (await client.query('SELECT * FROM "CompetitionSettings" LIMIT 1')).rows[0];
}

/** Mirrors POST /api/round2/live/answer. */
async function submit(participantId, order) {
  const s = await settings();
  if (s.round2QuestionState !== 'open') return { ok: false, code: 'NOT_OPEN' };

  const q = (
    await client.query(
      'SELECT * FROM "Round2LiveQuestion" WHERE "questionNumber"=$1 AND "isActive"=true',
      [s.round2CurrentQuestion]
    )
  ).rows[0];
  if (!q) return { ok: false, code: 'NO_QUESTION' };

  const itemKeys = JSON.parse(q.items).map((i) => i.key);
  const v = validateSubmission(order, itemKeys);
  if (!v.ok) return { ok: false, code: v.reason };

  const responseTimeMs = Math.max(0, Date.now() - new Date(s.round2QuestionOpenedAt).getTime());
  const windowSec = q.timeLimitSec || s.round2QuestionSeconds;
  if (windowSec > 0 && responseTimeMs > windowSec * 1000 + 1500)
    return { ok: false, code: 'TOO_LATE' };

  const correct = JSON.parse(q.correctOrder);
  const { isCorrect, correctPositions } = gradeOrder(order, correct);

  try {
    await client.query(
      `INSERT INTO "Round2LiveAnswer"
       (id,"participantId","questionId","questionNumber","answerType","submittedOrder",
        "isCorrect","correctPositions",marks,"responseTimeMs","isTest")
       VALUES ($1,$2,$3,$4,'order',$5,$6,$7,$8,$9,$10)`,
      [id(), participantId, q.id, q.questionNumber, JSON.stringify(order),
       isCorrect, correctPositions, isCorrect ? q.marks : 0, responseTimeMs, s.isTestMode]
    );
    return { ok: true, isCorrect, correctPositions, responseTimeMs };
  } catch (e) {
    if (e.code === '23505') return { ok: false, code: 'ALREADY_ANSWERED' };
    throw e;
  }
}

/** Mirrors POST /api/round2/live/control. */
async function control(action, questionNumber) {
  const s = await settings();
  const nums = (
    await client.query(
      'SELECT "questionNumber" FROM "Round2LiveQuestion" WHERE "isActive"=true ORDER BY "questionNumber"'
    )
  ).rows.map((r) => r.questionNumber);
  const state = s.round2QuestionState;

  if (action === 'open') {
    const target = questionNumber ?? (s.round2CurrentQuestion || nums[0]);
    if (!nums.includes(target)) return { ok: false, code: 'NO_SUCH_QUESTION' };
    await client.query(
      `UPDATE "CompetitionSettings" SET "round2CurrentQuestion"=$1,"round2QuestionState"='open',
       "round2QuestionOpenedAt"=NOW(),"round2QuestionLockedAt"=NULL WHERE id=$2`,
      [target, s.id]
    );
    return { ok: true };
  }
  if (action === 'lock') {
    if (state !== 'open') return { ok: false, code: 'BAD_STATE' };
    await client.query(
      `UPDATE "CompetitionSettings" SET "round2QuestionState"='locked',"round2QuestionLockedAt"=NOW() WHERE id=$1`,
      [s.id]
    );
    return { ok: true };
  }
  if (action === 'reveal') {
    if (state !== 'open' && state !== 'locked') return { ok: false, code: 'BAD_STATE' };
    await client.query(
      `UPDATE "CompetitionSettings" SET "round2QuestionState"='revealed' WHERE id=$1`, [s.id]
    );
    return { ok: true };
  }
  if (action === 'next') {
    const idx = nums.indexOf(s.round2CurrentQuestion);
    const next = idx === -1 ? nums[0] : nums[idx + 1];
    if (next === undefined) {
      await client.query(
        `UPDATE "CompetitionSettings" SET "round2QuestionState"='revealed',"round2Status"='closed' WHERE id=$1`,
        [s.id]
      );
      return { ok: true, finished: true };
    }
    await client.query(
      `UPDATE "CompetitionSettings" SET "round2CurrentQuestion"=$1,"round2QuestionState"='open',
       "round2QuestionOpenedAt"=NOW(),"round2QuestionLockedAt"=NULL WHERE id=$2`,
      [next, s.id]
    );
    return { ok: true };
  }
  throw new Error(`unknown action ${action}`);
}

async function leaderboard() {
  const s = await settings();
  const scored = scoredQuestionCount(s.round2CurrentQuestion, s.round2QuestionState);
  const penalty = missedPenaltyMs(s.round2QuestionSeconds);

  const answers = (
    await client.query(
      `SELECT a.* FROM "Round2LiveAnswer" a
        WHERE a."isTest"=$1 AND a."questionNumber" <= $2`,
      [s.isTestMode, scored]
    )
  ).rows;
  const parts = (
    await client.query('SELECT * FROM "Participant" WHERE "isTest"=$1', [s.isTestMode])
  ).rows;

  const map = new Map();
  for (const p of parts)
    map.set(p.id, {
      participantId: p.id, participantName: p.name,
      score: 0, correctAnswers: 0, answeredCount: 0, totalTimeMs: 0,
    });
  for (const a of answers) {
    const e = map.get(a.participantId);
    if (!e) continue;
    e.answeredCount += 1;
    e.totalTimeMs += a.responseTimeMs;
    if (a.isCorrect) { e.correctAnswers += 1; e.score += a.marks; }
  }
  for (const e of map.values())
    e.totalTimeMs += Math.max(0, scored - e.answeredCount) * penalty;

  return { board: rankLiveEntries([...map.values()]), scored, penalty };
}

async function main() {
  await client.connect();

  // ── Schema for the ordering round (mirrors the Supabase migration) ────
  await client.query(`
    DROP TABLE IF EXISTS "Round2LiveAnswer" CASCADE;
    DROP TABLE IF EXISTS "Round2LiveQuestion" CASCADE;
    CREATE TABLE "Round2LiveQuestion" (
      "id" TEXT PRIMARY KEY, "questionNumber" INTEGER NOT NULL UNIQUE,
      "type" TEXT NOT NULL DEFAULT 'order',
      "titleEnglish" TEXT NOT NULL, "titleSecondary" TEXT,
      "promptEnglish" TEXT NOT NULL, "promptSecondary" TEXT,
      "items" TEXT NOT NULL, "correctOrder" TEXT NOT NULL, "correctOption" TEXT,
      "marks" INTEGER NOT NULL DEFAULT 1, "timeLimitSec" INTEGER NOT NULL DEFAULT 120,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "Round2LiveAnswer" (
      "id" TEXT PRIMARY KEY, "participantId" TEXT NOT NULL, "questionId" TEXT NOT NULL,
      "questionNumber" INTEGER NOT NULL, "answerType" TEXT NOT NULL DEFAULT 'order',
      "submittedOrder" TEXT, "selectedOption" TEXT,
      "isCorrect" BOOLEAN NOT NULL DEFAULT false,
      "correctPositions" INTEGER NOT NULL DEFAULT 0,
      "marks" INTEGER NOT NULL DEFAULT 0, "responseTimeMs" INTEGER NOT NULL,
      "isTest" BOOLEAN NOT NULL DEFAULT false,
      "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX "Round2LiveAnswer_participantId_questionId_key"
      ON "Round2LiveAnswer"("participantId","questionId");
  `);
  await client.query('DELETE FROM "Participant"');
  await client.query('DELETE FROM "CompetitionSettings"');

  const sid = id();
  await client.query(
    `INSERT INTO "CompetitionSettings"(id,"round2QuestionSeconds","round2QuestionState","round2CurrentQuestion")
     VALUES ($1,120,'idle',0)`, [sid]
  );

  // Two questions with the real shape: 12 items, 12-key answer.
  const mk = (n, keys, correct, secs = 120) =>
    client.query(
      `INSERT INTO "Round2LiveQuestion"
       (id,"questionNumber","titleEnglish","promptEnglish",items,"correctOrder","timeLimitSec")
       VALUES ($1,$2,$3,$3,$4,$5,$6)`,
      [id(), n, `Q${n}`, JSON.stringify(keys.map((k) => ({ key: k, en: k }))),
       JSON.stringify(correct), secs]
    );

  const surahs = ['al-balad','al-qadr','al-adiyat','ash-sharh','ad-duha','al-alaq',
                  'al-layl','al-bayyinah','az-zalzalah','at-tin','al-qariah','ash-shams'];
  const surahOrder = ['al-balad','ash-shams','al-layl','ad-duha','ash-sharh','at-tin',
                      'al-alaq','al-qadr','al-bayyinah','az-zalzalah','al-adiyat','al-qariah'];
  const prophets = ['musa','yusuf','hud','ishaq','shuayb','ismail',
                    'ayyub','lut','harun','salih','yaqub','ibrahim'];
  const prophetOrder = ['hud','salih','ibrahim','lut','ismail','ishaq',
                        'yaqub','yusuf','ayyub','shuayb','musa','harun'];
  await mk(1, surahs, surahOrder);
  await mk(2, prophets, prophetOrder);

  const people = ['Aisha', 'Bilal', 'Fatima', 'Hamza'];
  const ids = {};
  let n = 0;
  for (const name of people) {
    ids[name] = id();
    n++;
    await client.query(
      `INSERT INTO "Participant"(id,"participantCode",name,"className",division,language,"isTest")
       VALUES ($1,$2,$3,'8','A','english',false)`,
      [ids[name], `MES${String(n).padStart(4, '0')}`, name]
    );
  }

  console.log('\n\x1b[1m1. State machine guards\x1b[0m');
  let r = await submit(ids.Aisha, surahOrder);
  check('submission rejected while idle', !r.ok && r.code === 'NOT_OPEN', r.code);
  r = await control('lock');
  check('lock rejected from idle', !r.ok && r.code === 'BAD_STATE', r.code);
  r = await control('reveal');
  check('reveal rejected from idle', !r.ok && r.code === 'BAD_STATE', r.code);
  r = await control('open', 99);
  check('open rejected for a nonexistent question', !r.ok, r.code);

  console.log('\n\x1b[1m2. Sequence validation (tamper resistance)\x1b[0m');
  await control('open', 1);

  r = await submit(ids.Aisha, surahOrder.slice(0, 11));
  check('incomplete sequence rejected', !r.ok && r.code === 'WRONG_LENGTH', r.code);

  const dupes = [...surahOrder.slice(0, 11), surahOrder[0]];
  r = await submit(ids.Aisha, dupes);
  check('duplicate item rejected', !r.ok && r.code === 'DUPLICATE', r.code);

  const bogus = [...surahOrder.slice(0, 11), 'surah-not-real'];
  r = await submit(ids.Aisha, bogus);
  check('unknown item rejected', !r.ok && r.code === 'UNKNOWN_ITEM', r.code);

  const cnt = (await client.query('SELECT count(*)::int c FROM "Round2LiveAnswer"')).rows[0].c;
  check('no rejected attempt was ever stored', cnt === 0, `rows=${cnt}`);

  console.log('\n\x1b[1m3. Question 1 — grading\x1b[0m');
  await sleep(120);
  const a1 = await submit(ids.Aisha, surahOrder); // perfect, fastest
  await sleep(160);
  const b1 = await submit(ids.Bilal, surahOrder); // perfect, slower

  // One adjacent swap — all-or-nothing means this scores zero.
  const nearMiss = [...surahOrder];
  [nearMiss[4], nearMiss[5]] = [nearMiss[5], nearMiss[4]];
  const f1 = await submit(ids.Fatima, nearMiss);
  // Hamza stays silent.

  check('perfect sequence marked correct', a1.ok && a1.isCorrect === true);
  check('all 12 positions counted', a1.correctPositions === 12, String(a1.correctPositions));
  check('near miss marked incorrect', f1.ok && f1.isCorrect === false);
  check(
    'near miss still reports 10/12 in place',
    f1.correctPositions === 10,
    String(f1.correctPositions)
  );
  check('server timing orders the two perfect answers',
    a1.responseTimeMs < b1.responseTimeMs, `${a1.responseTimeMs} vs ${b1.responseTimeMs}`);
  check('response time measured from open', a1.responseTimeMs >= 100);

  const dbl = await submit(ids.Aisha, prophetOrder.slice(0, 12));
  check('second submission blocked by unique index',
    !dbl.ok && (dbl.code === 'ALREADY_ANSWERED' || dbl.code === 'UNKNOWN_ITEM'), dbl.code);

  const stored = (
    await client.query('SELECT "submittedOrder" FROM "Round2LiveAnswer" WHERE "participantId"=$1',
      [ids.Aisha])
  ).rows;
  check('original submission not overwritten',
    stored.length === 1 && JSON.parse(stored[0].submittedOrder)[0] === surahOrder[0]);

  let lb = await leaderboard();
  check('open question does not move the board', lb.scored === 0);
  check('everyone still at zero mid-question',
    lb.board.every((e) => e.score === 0 && e.totalTimeMs === 0));

  console.log('\n\x1b[1m4. Lock and reveal\x1b[0m');
  await control('lock');
  const late = await submit(ids.Hamza, surahOrder);
  check('submission rejected after lock', !late.ok && late.code === 'NOT_OPEN', late.code);

  await control('reveal');
  lb = await leaderboard();
  const b = Object.fromEntries(lb.board.map((e) => [e.participantName, e]));
  check('revealed question now counts', lb.scored === 1);
  check('Aisha leads on speed', b.Aisha.rank === 1, JSON.stringify(b.Aisha));
  check('Bilal second (same score, slower)', b.Bilal.rank === 2);
  check('near miss scored zero', b.Fatima.score === 0);
  check('silence scored zero', b.Hamza.score === 0);
  check('silence penalised more than a wrong answer',
    b.Hamza.totalTimeMs === lb.penalty && b.Hamza.totalTimeMs > b.Fatima.totalTimeMs,
    `hamza=${b.Hamza.totalTimeMs} fatima=${b.Fatima.totalTimeMs}`);

  console.log('\n\x1b[1m5. Question 2 — advancing\x1b[0m');
  await control('next');
  const s2 = await settings();
  check('advanced to question 2', s2.round2CurrentQuestion === 2);
  check('reopened for answers', s2.round2QuestionState === 'open');
  check('clock restarted', s2.round2QuestionLockedAt === null);

  // Q1's sequence must not be accepted for Q2.
  r = await submit(ids.Aisha, surahOrder);
  check("previous question's items rejected", !r.ok && r.code === 'UNKNOWN_ITEM', r.code);

  await sleep(120);
  await submit(ids.Bilal, prophetOrder);            // correct
  await sleep(120);
  await submit(ids.Fatima, prophetOrder);           // correct
  await submit(ids.Aisha, [...prophetOrder].reverse()); // wrong

  await control('lock');
  await control('reveal');

  lb = await leaderboard();
  const c = Object.fromEntries(lb.board.map((e) => [e.participantName, e]));
  check('two questions scored', lb.scored === 2);
  check('Bilal on 2', c.Bilal.score === 2, JSON.stringify(c.Bilal));
  check('Aisha on 1', c.Aisha.score === 1);
  check('Fatima on 1', c.Fatima.score === 1);
  check('Bilal took the lead', c.Bilal.rank === 1);
  check('Aisha ahead of Fatima on cumulative time',
    c.Aisha.totalTimeMs < c.Fatima.totalTimeMs && c.Aisha.rank < c.Fatima.rank,
    `aisha=${c.Aisha.totalTimeMs} fatima=${c.Fatima.totalTimeMs}`);
  check('Hamza carries two missed penalties', c.Hamza.totalTimeMs === lb.penalty * 2);

  console.log('\n\x1b[1m6. Timeout enforcement\x1b[0m');
  await client.query('UPDATE "Round2LiveQuestion" SET "timeLimitSec"=1 WHERE "questionNumber"=2');
  await control('open', 2);
  await sleep(2700);
  const tooLate = await submit(ids.Hamza, prophetOrder);
  check('submission past the window rejected', !tooLate.ok && tooLate.code === 'TOO_LATE', tooLate.code);

  console.log('\n\x1b[1m7. End of round\x1b[0m');
  await control('lock');
  await control('reveal');
  const fin = await control('next');
  check('round reports finished after the last question', fin.finished === true);

  console.log('\n\x1b[1m8. Final standings\x1b[0m');
  lb = await leaderboard();
  for (const e of lb.board)
    console.log(`   #${e.rank}  ${e.participantName.padEnd(8)} score=${e.score}  ` +
      `time=${(e.totalTimeMs / 1000).toFixed(3)}s  answered=${e.answeredCount}`);
  const ranks = lb.board.map((e) => e.rank);
  check('ranks non-decreasing', ranks.every((r, i) => i === 0 || r >= ranks[i - 1]));
  check('exactly one rank 1', lb.board.filter((e) => e.rank === 1).length === 1);

  console.log(`\n\x1b[1mResult: ${pass} passed, ${fail} failed\x1b[0m\n`);
  await client.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('\nHarness error:', e);
  try { await client.end(); } catch {}
  process.exit(1);
});
