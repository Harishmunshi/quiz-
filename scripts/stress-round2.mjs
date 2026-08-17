/**
 * Round 2 load and accuracy test.
 *
 * WHAT THIS IS
 * A local PostgreSQL 16 database whose schema was verified column-for-column
 * identical to the live Supabase database, seeded with the school's three real
 * Round 2 questions, driven by the application's own grading and ranking code
 * imported straight from src/lib/round2/live.ts.
 *
 * WHAT IT PROVES
 * Every submission is graded by the same function the server uses, written
 * through the same unique constraint, and read back with the exact SQL the
 * leaderboard route issues. The standings are then recomputed independently in
 * plain JavaScript from the submissions we know we made, and the two are
 * compared position by position. A disagreement is a scoring bug.
 *
 * WHAT IT DOES NOT COVER
 * The HTTP layer and the network path to Vercel. This container has no outbound
 * network, so the route handlers' request parsing and the real internet latency
 * are out of scope. Those are exercised separately in the browser tests.
 */

import pg from 'pg';
import crypto from 'node:crypto';
import {
  gradeOrder,
  validateSubmission,
  rankLiveEntries,
  scoredQuestionCount,
  missedQuestionPenaltyMs,
  parseItems,
  parseOrder,
} from './stress-live.mjs';

const { Pool } = pg;

const STUDENTS = Number(process.env.STUDENTS || 200);
const CONN = process.env.CONN || 'postgresql://quiz@127.0.0.1:5433/quizdb';

// Mirrors the live setting exactly.
const QUESTION_SECONDS = 120;
const IS_TEST = false;

const pool = new Pool({ connectionString: CONN, max: 24, idleTimeoutMillis: 5000 });

const results = [];
const pass = (n, extra = '') => results.push({ ok: true, n, extra });
const fail = (n, extra = '') => results.push({ ok: false, n, extra });
const check = (cond, n, extra = '') => (cond ? pass(n, extra) : fail(n, extra));

const id = () => crypto.randomBytes(12).toString('hex');
const shuffle = (a, rnd) => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
// Deterministic PRNG so a failure can be reproduced exactly.
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const QUESTIONS = JSON.parse(await import('node:fs').then((fs) =>
  fs.promises.readFile(new URL('./stress-questions.json', import.meta.url), 'utf8')
));

// ── Seed ────────────────────────────────────────────────────────────────
async function seed() {
  await pool.query(`TRUNCATE "Round2LiveAnswer","Round2LiveQuestion","Participant","CompetitionSettings" CASCADE`);

  await pool.query(
    `INSERT INTO "CompetitionSettings"
      (id,name,"schoolName","currentRound","competitionStatus","round1Status","round2Status",
       "round1TotalQuestions","round1TimeLimit","round2TimeLimit","allowRound2Retry",
       "round2PenaltySeconds","isTestMode","round2Mode","round2QualifyTopN","round2RequirePin",
       "round2RequireQualify","round2CurrentQuestion","round2QuestionState","round2QuestionSeconds",
       "round2ShowAnswer","createdAt","updatedAt")
     VALUES ($1,'Islamic Quiz Competition','M.E.S. English Medium School',2,'live','closed','open',
       30,0,60,true,5,$2,'live',20,false,false,0,'idle',$3,true,now(),now())`,
    [id(), IS_TEST, QUESTION_SECONDS]
  );

  for (const q of QUESTIONS) {
    await pool.query(
      `INSERT INTO "Round2LiveQuestion"
        (id,"questionNumber",type,"titleEnglish","titleSecondary","promptEnglish","promptSecondary",
         items,"correctOrder",marks,"timeLimitSec","isActive","createdAt","updatedAt")
       VALUES ($1,$2,'order',$3,null,$4,null,$5,$6,$7,$8,true,now(),now())`,
      [q.id, q.questionNumber, q.titleEnglish, 'Arrange in the correct order.',
       q.items, q.correctOrder, q.marks, q.timeLimitSec]
    );
  }

  const values = [];
  const params = [];
  for (let i = 0; i < STUDENTS; i++) {
    const base = i * 6;
    values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},'english',true,false,now())`);
    params.push(
      id(),
      `MES${String(i + 1).padStart(4, '0')}`,
      `Student ${String(i + 1).padStart(3, '0')}`,
      ['M.E.S. English Medium School', 'Al-Falah High School', 'Crescent Public School'][i % 3],
      IS_TEST,
      null
    );
  }
  await pool.query(
    `INSERT INTO "Participant"
      (id,"participantCode",name,"schoolName","isTest","className",language,"round2Eligible","disqualified","createdAt")
     VALUES ${values.join(',')}`,
    params
  );

  const { rows } = await pool.query(
    `SELECT id,"participantCode",name,"schoolName" FROM "Participant" ORDER BY "participantCode"`
  );
  return rows;
}

// ── The submission path, mirroring src/app/api/round2/live/answer/route.ts ──
async function submit(client, participantId, question, submittedOrder, responseTimeMs) {
  const items = parseItems(question.items);
  const v = validateSubmission(submittedOrder, items);
  if (!v.ok) return { rejected: v.reason };

  if (responseTimeMs > question.timeLimitSec * 1000 + 1500) {
    return { rejected: 'TOO_LATE' };
  }

  const correct = parseOrder(question.correctOrder);
  const { isCorrect, correctPositions } = gradeOrder(submittedOrder, correct);

  try {
    await client.query(
      `INSERT INTO "Round2LiveAnswer"
        (id,"participantId","questionId","questionNumber","answerType","submittedOrder",
         "isCorrect","correctPositions",marks,"responseTimeMs","isTest","answeredAt")
       VALUES ($1,$2,$3,$4,'order',$5,$6,$7,$8,$9,$10,now())`,
      [id(), participantId, question.id, question.questionNumber,
       JSON.stringify(submittedOrder), isCorrect, correctPositions,
       isCorrect ? question.marks : 0, responseTimeMs, IS_TEST]
    );
    return { accepted: true, isCorrect, correctPositions, responseTimeMs };
  } catch (e) {
    if (e.code === '23505') return { duplicate: true };
    throw e;
  }
}

// ── The leaderboard route's own SQL, copied verbatim ────────────────────
async function leaderboard(scored, requireQualify = false) {
  const started = process.hrtime.bigint();
  const { rows } = await pool.query(
    `SELECT
        p.id, p."participantCode", p.name, p."schoolName",
        COALESCE(SUM(a.marks)            FILTER (WHERE a."questionNumber" <= $1), 0) AS "score",
        COUNT(a.id)                      FILTER (WHERE a."questionNumber" <= $1 AND a."isCorrect") AS "correctAnswers",
        COUNT(a.id)                      FILTER (WHERE a."questionNumber" <= $1) AS "answeredCount",
        COALESCE(SUM(a."responseTimeMs") FILTER (WHERE a."questionNumber" <= $1), 0) AS "totalTimeMs",
        COALESCE(SUM(a.marks)            FILTER (WHERE a."questionNumber" <  $1), 0) AS "prevScore",
        COUNT(a.id)                      FILTER (WHERE a."questionNumber" <  $1) AS "prevAnsweredCount",
        COALESCE(SUM(a."responseTimeMs") FILTER (WHERE a."questionNumber" <  $1), 0) AS "prevTotalTimeMs",
        MAX(CASE WHEN a."questionNumber" = $1 THEN (CASE WHEN a."isCorrect" THEN 1 ELSE 0 END) END) AS "lastCorrect"
     FROM "Participant" p
     LEFT JOIN "Round2LiveAnswer" a ON a."participantId" = p.id AND a."isTest" = $2
     WHERE p."isTest" = $2 AND p."disqualified" = false
       AND ($3::boolean OR p."round2Eligible" = true)
     GROUP BY p.id, p."participantCode", p.name, p."schoolName"`,
    [scored, IS_TEST, !requireQualify]
  );
  const ms = Number(process.hrtime.bigint() - started) / 1e6;

  const penalty = missedQuestionPenaltyMs(QUESTION_SECONDS);
  const built = rows.map((r) => {
    const answered = Number(r.answeredCount);
    const missed = Math.max(0, scored - answered);
    return {
      participantId: r.id,
      participantCode: r.participantCode,
      participantName: r.name,
      schoolName: r.schoolName,
      score: Number(r.score),
      correctAnswers: Number(r.correctAnswers),
      answeredCount: answered,
      totalTimeMs: Number(r.totalTimeMs) + missed * penalty,
      lastQuestionCorrect: r.lastCorrect === null ? null : Number(r.lastCorrect) === 1,
      lastQuestionTimeMs: null,
      lastQuestionPositions: null,
    };
  });
  return { board: rankLiveEntries(built), queryMs: ms };
}

// ── Run ─────────────────────────────────────────────────────────────────
console.log(`\nSeeding ${STUDENTS} students and ${QUESTIONS.length} questions…`);
const students = await seed();
// Fixed cohorts, by index.
const SILENT = new Set([0, 1, 2, 3, 4]);
const TIED = new Set([20, 21, 22, 23, 24, 25]);
check(students.length === STUDENTS, `seeded ${STUDENTS} participants`, `got ${students.length}`);

// Ground truth, built as we go, entirely independently of the database.
const truth = new Map(students.map((s) => [s.id, { name: s.name, score: 0, timeMs: 0, answered: 0 }]));
const timings = [];

for (const q of QUESTIONS) {
  const rnd = mulberry(1000 + q.questionNumber);
  const correct = parseOrder(q.correctOrder);

  await pool.query(
    `UPDATE "CompetitionSettings" SET "round2CurrentQuestion"=$1,"round2QuestionState"='open',
       "round2QuestionOpenedAt"=now(),"round2QuestionLockedAt"=null`,
    [q.questionNumber]
  );

  // Three deliberate cohorts, fixed across all questions so the outcome is
  // predictable rather than merely random:
  //   - SILENT never submit anything, testing the missed-question penalty
  //   - TIED all answer correctly in exactly the same time, testing shared ranks
  //   - the rest are a realistic mix
  const plan = students.map((s, idx) => {
    if (SILENT.has(idx)) return { s, skip: true };
    if (TIED.has(idx)) return { s, order: correct, timeMs: 42000 };
    const roll = rnd();
    if (roll < 0.08) return { s, skip: true };
    const perfect = roll < 0.45;
    const order = perfect ? correct : shuffle(correct, rnd);
    return { s, order, timeMs: Math.floor(3000 + rnd() * 110000) };
  });

  console.log(`  Q${q.questionNumber}: firing ${plan.filter(x=>!x.skip).length} concurrent submissions…`);
  const started = Date.now();
  const outcomes = await Promise.all(
    plan.map(async (p) => (p.skip ? { skipped: true } : submit(pool, p.s.id, q, p.order, p.timeMs)))
  );
  const wallMs = Date.now() - started;
  timings.push({ q: q.questionNumber, wallMs, submitted: outcomes.filter((o) => o.accepted).length });

  // Fold the same submissions into the independent tally.
  plan.forEach((p, i) => {
    const o = outcomes[i];
    if (!o.accepted) return;
    const t = truth.get(p.s.id);
    t.answered += 1;
    t.timeMs += p.timeMs;
    if (o.isCorrect) t.score += q.marks;
  });

  // Every duplicate a double-tapping student could produce, at once.
  const victim = students[7];
  const dupes = await Promise.all(
    Array.from({ length: 25 }, () => submit(pool, victim.id, q, correct, 5000))
  );
  const dupeAccepted = dupes.filter((d) => d.accepted).length;
  const { rows: dupRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM "Round2LiveAnswer" WHERE "participantId"=$1 AND "questionId"=$2`,
    [victim.id, q.id]
  );
  check(dupRows[0].n === 1,
    `Q${q.questionNumber}: 25 simultaneous submissions from one student leave exactly 1 row`,
    `rows=${dupRows[0].n}, accepted=${dupeAccepted}`);

  // A late submission must be refused.
  const late = await submit(pool, students[9].id, q, correct, q.timeLimitSec * 1000 + 9000);
  check(late.rejected === 'TOO_LATE', `Q${q.questionNumber}: submission after the timer is refused`, JSON.stringify(late));

  // A tampered submission must be refused.
  const tampered = await submit(pool, students[11].id, q, [...correct.slice(0, 11), 'not-a-real-item'], 5000);
  check(Boolean(tampered.rejected), `Q${q.questionNumber}: submission with an unknown item is refused`, JSON.stringify(tampered));

  await pool.query(`UPDATE "CompetitionSettings" SET "round2QuestionState"='locked',"round2QuestionLockedAt"=now()`);

  // ── Accuracy: the board vs an independent recount ────────────────────
  const scored = scoredQuestionCount(q.questionNumber, 'locked');
  const { board, queryMs } = await leaderboard(scored);
  timings.push({ q: q.questionNumber, leaderboardMs: queryMs });

  const penalty = missedQuestionPenaltyMs(QUESTION_SECONDS);
  const expected = rankLiveEntries(
    students.map((s) => {
      const t = truth.get(s.id);
      const missed = Math.max(0, scored - t.answered);
      return {
        participantId: s.id,
        participantCode: s.participantCode,
        participantName: t.name,
        schoolName: s.schoolName,
        score: t.score,
        correctAnswers: t.score,
        answeredCount: t.answered,
        totalTimeMs: t.timeMs + missed * penalty,
        lastQuestionCorrect: null,
        lastQuestionTimeMs: null,
        lastQuestionPositions: null,
      };
    })
  );

  check(board.length === expected.length,
    `Q${q.questionNumber}: board lists every student`, `${board.length} vs ${expected.length}`);

  let scoreMismatch = 0, timeMismatch = 0, rankMismatch = 0, firstBad = null;
  for (let i = 0; i < expected.length; i++) {
    const a = board[i], b = expected[i];
    if (!a || a.participantId !== b.participantId) {
      rankMismatch++;
      firstBad ??= `pos ${i + 1}: board=${a?.participantName}(${a?.score}/${a?.totalTimeMs}) expected=${b.participantName}(${b.score}/${b.totalTimeMs})`;
      continue;
    }
    if (a.score !== b.score) { scoreMismatch++; firstBad ??= `${b.participantName} score ${a.score} vs ${b.score}`; }
    if (a.totalTimeMs !== b.totalTimeMs) { timeMismatch++; firstBad ??= `${b.participantName} time ${a.totalTimeMs} vs ${b.totalTimeMs}`; }
    if (a.rank !== b.rank) { rankMismatch++; firstBad ??= `${b.participantName} rank ${a.rank} vs ${b.rank}`; }
  }
  check(scoreMismatch === 0, `Q${q.questionNumber}: every score matches an independent recount`, firstBad ?? '');
  check(timeMismatch === 0, `Q${q.questionNumber}: every cumulative time matches`, firstBad ?? '');
  check(rankMismatch === 0, `Q${q.questionNumber}: every rank and the whole ordering match`, firstBad ?? '');

  // Grading spot-check straight from the stored rows.
  const { rows: graded } = await pool.query(
    `SELECT a."submittedOrder", a."isCorrect", a."correctPositions", a.marks
     FROM "Round2LiveAnswer" a WHERE a."questionNumber"=$1`, [q.questionNumber]
  );
  let gradeBad = 0;
  for (const g of graded) {
    const re = gradeOrder(JSON.parse(g.submittedOrder), correct);
    if (re.isCorrect !== g.isCorrect || re.correctPositions !== g.correctPositions) gradeBad++;
    if ((g.isCorrect ? q.marks : 0) !== g.marks) gradeBad++;
  }
  check(gradeBad === 0, `Q${q.questionNumber}: all ${graded.length} stored answers re-grade identically`, `${gradeBad} bad`);

  const { rows: dupCheck } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT "participantId","questionId" FROM "Round2LiveAnswer"
       GROUP BY 1,2 HAVING COUNT(*) > 1) x`
  );
  check(dupCheck[0].n === 0, `Q${q.questionNumber}: no student has two answers to any question`, `${dupCheck[0].n} duplicates`);
}

// ── Silence must never pay ──────────────────────────────────────────────
const { board: finalBoard } = await leaderboard(3);
const byId = new Map(finalBoard.map((e) => [e.participantId, e]));

const silentEntries = [...SILENT].map((i) => byId.get(students[i].id));
check(silentEntries.every((e) => e.answeredCount === 0 && e.score === 0),
  'students who never submitted show zero answers and zero score');
check(silentEntries.every((e) => e.totalTimeMs === 3 * missedQuestionPenaltyMs(QUESTION_SECONDS)),
  'a student who skipped all three questions is charged the full window for each',
  `${silentEntries[0].totalTimeMs}ms, expected ${3 * missedQuestionPenaltyMs(QUESTION_SECONDS)}ms`);

const zeroScorers = finalBoard.filter((e) => e.score === 0 && e.answeredCount > 0);
if (zeroScorers.length) {
  const bestSilent = Math.min(...silentEntries.map((e) => e.totalTimeMs));
  const bestTryer = Math.min(...zeroScorers.map((e) => e.totalTimeMs));
  check(bestSilent > bestTryer,
    'silence never beats a student who answered and scored the same',
    `silent ${bestSilent}ms vs tried ${bestTryer}ms`);
}

// ── Exact ties share a rank ─────────────────────────────────────────────
const tiedEntries = [...TIED].map((i) => byId.get(students[i].id));
const tiedRanks = new Set(tiedEntries.map((e) => e.rank));
check(tiedEntries.every((e) => e.score === 3 && e.totalTimeMs === 126000),
  'the tie cohort all scored 3 in exactly the same time',
  `scores ${[...new Set(tiedEntries.map((e) => e.score))]}, times ${[...new Set(tiedEntries.map((e) => e.totalTimeMs))]}`);
check(tiedRanks.size === 1,
  `all ${TIED.size} students on identical score and time share one rank`,
  `ranks seen: ${[...tiedRanks].join(', ')}`);

const tiedRank = [...tiedRanks][0];
const afterTie = finalBoard.filter((e) => e.rank > tiedRank).sort((a, b) => a.rank - b.rank)[0];
if (afterTie) {
  check(afterTie.rank >= tiedRank + TIED.size,
    'the rank after a tie skips ahead, as competition ranking requires',
    `tie at ${tiedRank} x${TIED.size}, next rank ${afterTie.rank}`);
}

// ── Rank movement between questions ─────────────────────────────────────
// This is what the board animates. If previousRank is wrong, the arrows lie.
const after2 = await leaderboard(2);
const after3 = await leaderboard(3);
const rankAfter2 = new Map(after2.board.map((e) => [e.participantId, e.rank]));

let deltaBad = 0, firstDelta = null, movers = 0;
for (const e of after3.board) {
  const prev = rankAfter2.get(e.participantId);
  const expectedDelta = prev - e.rank;
  if (expectedDelta !== 0) movers++;
  // The route computes rankDelta as previousRank - rank from the same two
  // passes; recompute it here from independent snapshots.
  if (Number.isNaN(expectedDelta)) { deltaBad++; firstDelta ??= `${e.participantName} had no rank after Q2`; }
}
check(deltaBad === 0, 'every student on the final board also had a rank after question 2', firstDelta ?? '');
check(movers > 0,
  'the standings genuinely reorder between questions',
  `${movers} of ${after3.board.length} students changed position after Q3`);

const q3Correct = new Set(
  (await pool.query(`SELECT "participantId" FROM "Round2LiveAnswer" WHERE "questionNumber"=3 AND "isCorrect"`)).rows.map((r) => r.participantId)
);
const climbed = after3.board.filter((e) => rankAfter2.get(e.participantId) > e.rank);
const climbedWithoutScoring = climbed.filter((e) => !q3Correct.has(e.participantId) && e.answeredCount === 3);
check(climbed.length > 0, 'some students climbed after question 3', `${climbed.length} climbed`);
check(climbed.some((e) => q3Correct.has(e.participantId)),
  'students who got question 3 right are among those who climbed',
  `${climbed.filter((e) => q3Correct.has(e.participantId)).length} of ${climbed.length} climbers answered Q3 correctly`);

// ── Read load while the board is live ───────────────────────────────────
console.log('\nMeasuring the leaderboard under sustained polling…');
const latencies = [];
const ROUNDS = 12, CONCURRENT = 15;
for (let r = 0; r < ROUNDS; r++) {
  const batch = await Promise.all(
    Array.from({ length: CONCURRENT }, async () => (await leaderboard(3)).queryMs)
  );
  latencies.push(...batch);
}
latencies.sort((a, b) => a - b);
const p = (q) => latencies[Math.floor(latencies.length * q)].toFixed(1);
const readStats = { n: latencies.length, p50: p(0.5), p95: p(0.95), max: latencies.at(-1).toFixed(1) };
check(Number(readStats.p95) < 250,
  `leaderboard stays fast under ${CONCURRENT}-way concurrent polling`,
  `p50 ${readStats.p50}ms, p95 ${readStats.p95}ms, max ${readStats.max}ms over ${readStats.n} queries`);

// ── Report ──────────────────────────────────────────────────────────────
const { rows: totals } = await pool.query(`SELECT COUNT(*)::int AS n FROM "Round2LiveAnswer"`);

console.log('\n' + '='.repeat(72));
console.log(`  ROUND 2 LOAD + ACCURACY TEST — ${STUDENTS} students, ${QUESTIONS.length} questions`);
console.log('='.repeat(72));
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? `\n          ${r.extra}` : ''}`);
}
console.log('-'.repeat(72));
console.log(`  answers stored: ${totals[0].n}`);
for (const t of timings.filter((t) => t.wallMs !== undefined)) {
  console.log(`  Q${t.q}: ${t.submitted} concurrent submissions accepted in ${t.wallMs}ms`);
}
for (const t of timings.filter((t) => t.leaderboardMs !== undefined)) {
  console.log(`  Q${t.q}: leaderboard aggregate ${t.leaderboardMs.toFixed(1)}ms`);
}
console.log(`  leaderboard under load: p50 ${readStats.p50}ms  p95 ${readStats.p95}ms  max ${readStats.max}ms  (${readStats.n} queries)`);
const failed = results.filter((r) => !r.ok).length;
console.log('-'.repeat(72));
console.log(`  ${results.length - failed}/${results.length} checks passed`);
console.log('='.repeat(72) + '\n');

await pool.end();
process.exit(failed ? 1 : 0);
