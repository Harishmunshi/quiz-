#!/usr/bin/env node
/**
 * Round 2 concurrency test — the real HTTP path, all at once.
 *
 * Answers one question: when N students press Submit in the same instant, does
 * every answer land, and does the board rank them correctly afterwards?
 *
 * Every student is driven through the full sequence a real one takes:
 *   POST /api/participant          sign in with school + student id
 *   POST /api/round2/live/start    start their own clock
 *   POST /api/round2/live/answer   submit, released on a shared starting gun
 *
 * Test students are created with a recognisable prefix and deleted afterwards
 * by scripts/load-round2-clean.sql, so nothing is left on the real board.
 *
 *   node scripts/load-round2.mjs --users 100 --question 1
 */

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const BASE = arg('url', 'https://quiz-seven-omega-15.vercel.app').replace(/\/$/, '');
const USERS = Number(arg('users', 100));
const QUESTION = Number(arg('question', 1));
const PREFIX = arg('prefix', 'LOADTEST');

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const pct = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function post(path, body) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* HTML error page */ }
    return { status: res.status, json, text, ms: Date.now() - t0 };
  } catch (err) {
    return { status: 0, json: null, text: String(err), ms: Date.now() - t0 };
  }
}

/** Shared starting gun so "at the same time" really is simultaneous. */
function barrier() {
  let release;
  const gate = new Promise((r) => { release = r; });
  return { gate, release: () => release() };
}

const summarise = (label, results) => {
  const ok = results.filter((r) => r.json?.success);
  const bad = results.filter((r) => !r.json?.success);
  const times = results.map((r) => r.ms);
  console.log(
    `  ${label.padEnd(10)} ${ok.length}/${results.length}  ` +
    c.dim(`p50 ${pct(times, 50)}ms · p95 ${pct(times, 95)}ms · max ${Math.max(...times)}ms`)
  );
  if (bad.length) {
    const why = {};
    for (const b of bad) {
      const k = `${b.status} ${b.json?.error ?? b.text.slice(0, 60)}`;
      why[k] = (why[k] ?? 0) + 1;
    }
    for (const [k, n] of Object.entries(why)) console.log(`      ${c.red(`${n}×`)} ${k}`);
  }
  return { ok, bad };
};

async function main() {
  console.log(c.bold(`\nRound 2 · Q${QUESTION} · ${USERS} students, simultaneous submit`));
  console.log(c.dim(`${BASE}\n`));

  const stamp = Date.now().toString(36).slice(-4).toUpperCase();

  // ── Sign in ──────────────────────────────────────────────────
  const g1 = barrier();
  const signins = Array.from({ length: USERS }, async (_, i) => {
    await g1.gate;
    return post('/api/participant', {
      participantCode: `${PREFIX}-${stamp}-${String(i).padStart(3, '0')}`,
      schoolName: `Load Test School ${i % 8}`,
      language: 'english',
    });
  });
  g1.release();
  const { ok: signedIn } = summarise('sign-in', await Promise.all(signins));
  if (!signedIn.length) return;

  // ── Start ────────────────────────────────────────────────────
  const g2 = barrier();
  const starts = signedIn.map(async (r) => {
    await g2.gate;
    const res = await post('/api/round2/live/start', {
      participantId: r.json.participant.id,
      questionNumber: QUESTION,
    });
    return { pid: r.json.participant.id, res };
  });
  g2.release();
  const started = await Promise.all(starts);
  summarise('start', started.map((s) => s.res));

  const usable = started.filter((s) => s.res.json?.success);
  if (!usable.length) return;
  const q = usable[0].res.json.data.question;
  const keys = q.items.map((i) => i.key);

  // ── Submit, all on one gun ───────────────────────────────────
  const g3 = barrier();
  const submits = usable.map(async (s, i) => {
    // Rotate each student's sequence so scores differ and the ranking has
    // something real to sort.
    const order = [...keys.slice(i % keys.length), ...keys.slice(0, i % keys.length)];
    await g3.gate;
    return post('/api/round2/live/answer', {
      participantId: s.pid,
      questionId: q.id,
      submittedOrder: order,
    });
  });
  g3.release();
  const { ok: submitted } = summarise('submit', await Promise.all(submits));

  // ── Did the board record every one of them? ──────────────────
  await new Promise((r) => setTimeout(r, 1500));
  const board = await (await fetch(`${BASE}/api/round2/live/leaderboard?question=${QUESTION}`, {
    cache: 'no-store',
  })).json();
  const rows = board.data ?? [];
  const mine = rows.filter((e) => e.participantCode.startsWith(`${PREFIX}-${stamp}`));

  console.log('');
  console.log(`  board has ${mine.length} of ${submitted.length} submitted`);

  const monotonic = mine.every((e, i, a) =>
    i === 0 || a[i - 1].marks > e.marks ||
    (a[i - 1].marks === e.marks && a[i - 1].responseTimeMs <= e.responseTimeMs));

  // A shared rank is CORRECT when the students genuinely tie on marks and time,
  // which happens constantly at this scale: twelve possible scores across
  // hundreds of students, and millisecond collisions under load. Demanding
  // unique ranks reported a failure for the ranking working as designed. What
  // must hold is that everyone sharing a rank has identical marks AND time.
  const byRank = new Map();
  for (const e of mine) {
    if (!byRank.has(e.rank)) byRank.set(e.rank, []);
    byRank.get(e.rank).push(e);
  }
  const falseTies = [...byRank.values()].filter(
    (g) => new Set(g.map((e) => `${e.marks}|${e.responseTimeMs}`)).size !== 1
  ).length;

  const pass =
    submitted.length === usable.length &&
    mine.length === submitted.length &&
    monotonic &&
    falseTies === 0;

  console.log(`  ordering correct: ${monotonic ? c.green('yes') : c.red('no')}`);
  console.log(`  shared ranks are real ties: ${falseTies === 0 ? c.green('yes') : c.red(`no (${falseTies})`)}`);
  console.log('');
  console.log(pass ? c.green(c.bold('  PASS')) : c.red(c.bold('  FAIL')));
  console.log(c.dim(`\n  clean up with:  DELETE FROM "Participant" WHERE "participantCode" LIKE '${PREFIX}-%';\n`));
}

main().catch((e) => console.error(e));
