#!/usr/bin/env node
/**
 * ============================================================
 * Round 1 load + leaderboard-correctness harness
 * ============================================================
 *
 * Answers two questions the hall will ask on the day:
 *
 *   1. With 30–50 students hitting Register and then Submit, does every button
 *      actually work — or do some students get an error toast?
 *   2. Is the leaderboard right? Not "does it render", but: is every submitter
 *      on it exactly once, in the correct order, with the score the server
 *      itself returned to that student?
 *
 * It drives the real HTTP API the browser drives — no database shortcuts — so a
 * pass here means the same code path the students take is the one that passed.
 * (scripts/stress-round2.mjs covers Round 2 against a local database instead;
 * this one is the over-the-wire test.)
 *
 * SAFETY
 * Refuses to run unless the competition is in test mode. Rows created in test
 * mode carry isTest=true, and the leaderboard filters on the current mode, so
 * the run cannot appear on the real board. `--i-know-this-is-live` overrides
 * that, and you almost certainly do not want it.
 *
 * USAGE
 *   node scripts/stress-test.mjs --url https://quiz-seven-omega-15.vercel.app
 *   node scripts/stress-test.mjs --users 50 --mode thundering-herd
 *   node scripts/stress-test.mjs --users 30 --mode staggered --spread 20000
 *
 * MODES
 *   thundering-herd  every student submits on the same starting gun (worst case)
 *   staggered        submissions spread randomly over --spread ms (realistic)
 *   mixed            half herd, half staggered (default)
 */

const DEFAULTS = {
  url: 'https://quiz-seven-omega-15.vercel.app',
  users: 30,
  mode: 'mixed',
  spread: 15000,
};

// ── Args ────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);

const BASE = arg('url', DEFAULTS.url).replace(/\/$/, '');
const USERS = Number(arg('users', DEFAULTS.users));
const MODE = arg('mode', DEFAULTS.mode);
const SPREAD = Number(arg('spread', DEFAULTS.spread));
const FORCE_LIVE = flag('i-know-this-is-live');

// ── Tiny reporting helpers ──────────────────────────────────────
const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};
const log = (...a) => console.log(...a);
const head = (t) => log(`\n${c.bold(c.cyan(`── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`))}`);

const failures = [];
const fail = (what, detail) => {
  failures.push({ what, detail });
  log(`  ${c.red('FAIL')}  ${what}`);
  if (detail) log(`        ${c.dim(detail)}`);
};
const pass = (what) => log(`  ${c.green('ok')}    ${what}`);

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
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
    try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
    return { ok: res.ok, status: res.status, json, text, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, status: 0, json: null, text: String(err), ms: Date.now() - t0 };
  }
}

async function get(path) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* ignore */ }
    return { ok: res.ok, status: res.status, json, text, ms: Date.now() - t0 };
  } catch (err) {
    return { ok: false, status: 0, json: null, text: String(err), ms: Date.now() - t0 };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A starting gun. Every student waits on the same promise, so `thundering-herd`
 * really is simultaneous rather than "as fast as the loop can dispatch".
 */
function barrier() {
  let release;
  const gate = new Promise((r) => { release = r; });
  return { gate, release: () => release() };
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  log(c.bold(`\nRound 1 load + leaderboard correctness`));
  log(c.dim(`target ${BASE}`));
  log(c.dim(`${USERS} students · mode ${MODE}${MODE !== 'thundering-herd' ? ` · spread ${SPREAD}ms` : ''}`));

  // ── Preflight ────────────────────────────────────────────────
  head('Preflight');

  const settingsRes = await get('/api/competition');
  if (!settingsRes.json?.success) {
    fail('competition settings readable', `HTTP ${settingsRes.status} — ${settingsRes.text.slice(0, 200)}`);
    return finish();
  }
  const settings = settingsRes.json.data;
  pass(`settings readable (${settingsRes.ms}ms)`);

  if (!settings.isTestMode && !FORCE_LIVE) {
    log(`\n  ${c.red('REFUSING TO RUN')}`);
    log(`  The competition is ${c.bold('not in test mode')}, so this run would create`);
    log(`  ${USERS} real participants and ${USERS} real attempts on the live leaderboard.`);
    log(`\n  Turn on Test Mode in the admin panel (Admin → Settings) and re-run.`);
    log(`  Rows created in test mode are tagged isTest=true and never appear on`);
    log(`  the real board.\n`);
    process.exitCode = 2;
    return;
  }
  if (!settings.isTestMode) {
    log(`  ${c.yellow('WARNING')} running against LIVE data because --i-know-this-is-live was passed`);
  } else {
    pass('test mode is on — this run is isolated from the real leaderboard');
  }

  if (settings.round1Status !== 'open') {
    fail('Round 1 is open', `round1Status is "${settings.round1Status}" — students cannot start`);
    return finish();
  }
  pass('Round 1 is open');

  const qRes = await get('/api/round1/questions');
  const questions = qRes.json?.data ?? [];
  if (!questions.length) {
    fail('questions available', `HTTP ${qRes.status}, ${questions.length} returned`);
    return finish();
  }
  pass(`${questions.length} questions available (${qRes.ms}ms)`);

  // Baseline: whoever is already on the board must still be there, unchanged,
  // when we finish. A load test that quietly corrupts existing rows is worse
  // than one that fails.
  const beforeRes = await get('/api/leaderboard/round1');
  const before = beforeRes.json?.data ?? [];
  pass(`${before.length} entries on the board before we start`);

  // ── Phase 1: registration ────────────────────────────────────
  head(`Phase 1 — ${USERS} students tap Register at once`);

  const stamp = Date.now().toString(36).slice(-5);
  const gate1 = barrier();
  const regTimes = [];

  // Build every request first, THEN fire the gun, THEN await. Releasing after
  // the await would deadlock: nothing would ever be waiting to be released.
  const regPending = Array.from({ length: USERS }, async (_, i) => {
    await gate1.gate;
    const r = await post('/api/participant', {
      name: `LoadTest ${stamp}-${String(i + 1).padStart(3, '0')}`,
      schoolName: 'Load Test School',
      language: i % 2 === 0 ? 'english' : 'gujarati',
    });
    regTimes.push(r.ms);
    return { i, r };
  });
  gate1.release();
  const registrations = await Promise.all(regPending);

  const regOk = registrations.filter((x) => x.r.json?.success);
  const regBad = registrations.filter((x) => !x.r.json?.success);

  log(`  registered ${regOk.length}/${USERS}   ` +
      c.dim(`p50 ${pct(regTimes, 50)}ms · p95 ${pct(regTimes, 95)}ms · max ${Math.max(...regTimes)}ms`));

  if (regBad.length) {
    const reasons = {};
    for (const b of regBad) {
      const key = `${b.r.status} ${b.r.json?.error ?? b.r.text.slice(0, 80)}`;
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
    fail(`every Register button worked (${regBad.length} failed)`,
         Object.entries(reasons).map(([k, n]) => `${n}× ${k}`).join('  |  '));
  } else {
    pass('every Register button worked');
  }

  const codes = regOk.map((x) => x.r.json.participant.participantCode);
  const dupCodes = codes.filter((v, i) => codes.indexOf(v) !== i);
  if (dupCodes.length) {
    fail('participant codes are unique', `duplicates: ${[...new Set(dupCodes)].join(', ')}`);
  } else {
    pass(`participant codes unique (${codes.length} issued)`);
  }

  if (!regOk.length) return finish();

  // ── Phase 2: start attempts ──────────────────────────────────
  head('Phase 2 — starting attempts');

  const gate2 = barrier();
  const startPending = regOk.map(async ({ r }) => {
    const p = r.json.participant;
    await gate2.gate;
    const s = await post('/api/round1/start', { participantId: p.id });
    return { participant: p, attemptId: s.json?.data?.attemptId ?? null, res: s };
  });
  gate2.release();
  const students = await Promise.all(startPending);

  const started = students.filter((s) => s.attemptId);
  if (started.length !== students.length) {
    const bad = students.filter((s) => !s.attemptId)[0];
    fail(`every attempt started (${started.length}/${students.length})`,
         `e.g. HTTP ${bad.res.status} — ${bad.res.json?.error ?? bad.res.text.slice(0, 120)}`);
  } else {
    pass(`all ${started.length} attempts started`);
  }
  if (!started.length) return finish();

  // ── Phase 3: submissions ─────────────────────────────────────
  // Give each student a deterministic answer sheet so the score we expect is
  // known before the server computes it. Student i answers correctly for the
  // first `i % (n+1)` questions and guesses "A" on the rest.
  const answerFor = (idx) =>
    questions.map((q, qi) => ({
      questionId: q.id,
      selectedOption: qi < (idx % (questions.length + 1)) ? q.correctOption : 'A',
    }));

  head(`Phase 3 — ${started.length} submissions (${MODE})`);

  const gate3 = barrier();
  const submitTimes = [];
  const anomalies = [];

  // Watch the board while submissions land. This is the part that catches a
  // leaderboard that is briefly *wrong* rather than merely stale: a score that
  // appears and then changes, or a rank order that is not self-consistent.
  let watching = true;
  const seenScores = new Map(); // participantId -> first score observed
  const watcher = (async () => {
    while (watching) {
      const snap = await get('/api/leaderboard/round1');
      const rows = snap.json?.data ?? [];

      for (const row of rows) {
        const prev = seenScores.get(row.participantId);
        if (prev === undefined) {
          seenScores.set(row.participantId, row.score);
        } else if (prev !== row.score) {
          anomalies.push(
            `${row.participantName} showed score ${prev} and later ${row.score} — ` +
            `a published score changed after the fact`);
          seenScores.set(row.participantId, row.score);
        }
      }

      // The board must always be internally sorted, at every instant.
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1], b = rows[i];
        const ordered =
          a.score > b.score ||
          (a.score === b.score && a.completionTimeMs < b.completionTimeMs) ||
          (a.score === b.score && a.completionTimeMs === b.completionTimeMs &&
            new Date(a.submittedAt) <= new Date(b.submittedAt));
        if (!ordered) {
          anomalies.push(
            `mid-run ordering broke: rank ${a.rank} (${a.score}pts/${a.completionTimeMs}ms) ` +
            `placed above rank ${b.rank} (${b.score}pts/${b.completionTimeMs}ms)`);
        }
      }
      await sleep(700);
    }
  })();

  const submitPending = started.map(async (s, i) => {
    const herd =
      MODE === 'thundering-herd' ? true :
      MODE === 'staggered' ? false :
      i % 2 === 0; // mixed

    await gate3.gate;
    // Staggered students wait a random slice of the window after the gun; herd
    // students go straight through, so their POSTs are genuinely simultaneous.
    if (!herd) await sleep(Math.floor(Math.random() * SPREAD));

    const res = await post('/api/round1/submit', {
      attemptId: s.attemptId,
      answers: answerFor(i),
    });
    submitTimes.push(res.ms);
    return { ...s, idx: i, res };
  });
  gate3.release();
  const results = await Promise.all(submitPending);

  await sleep(1500);          // let the last write settle
  watching = false;
  await watcher;

  const subOk = results.filter((r) => r.res.json?.success);
  const subBad = results.filter((r) => !r.res.json?.success);

  log(`  submitted ${subOk.length}/${results.length}   ` +
      c.dim(`p50 ${pct(submitTimes, 50)}ms · p95 ${pct(submitTimes, 95)}ms · max ${Math.max(...submitTimes)}ms`));

  if (subBad.length) {
    const reasons = {};
    for (const b of subBad) {
      const key = `${b.res.status} ${b.res.json?.error ?? b.res.text.slice(0, 80)}`;
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
    fail(`every Submit button worked (${subBad.length} failed)`,
         Object.entries(reasons).map(([k, n]) => `${n}× ${k}`).join('  |  '));
  } else {
    pass('every Submit button worked');
  }

  const slow = submitTimes.filter((t) => t > 15000).length;
  if (slow) fail(`no submission hit the 15s function cap (${slow} did)`,
                 'vercel.json sets maxDuration 15 — anything past that is killed mid-write');
  else pass('no submission hit the 15s function cap');

  // ── Phase 4: is the board actually right? ────────────────────
  head('Phase 4 — leaderboard correctness');

  await sleep(1000);
  const afterRes = await get('/api/leaderboard/round1');
  const board = afterRes.json?.data ?? [];
  if (!afterRes.json?.success) {
    fail('leaderboard readable after the run', `HTTP ${afterRes.status}`);
    return finish();
  }
  pass(`leaderboard readable (${afterRes.ms}ms, ${board.length} entries)`);

  const byId = new Map(board.map((e) => [e.participantId, e]));

  // 4a. everyone who got a success back is on the board, exactly once
  const missing = subOk.filter((r) => !byId.has(r.participant.id));
  if (missing.length) {
    fail(`every successful submitter is on the board (${missing.length} missing)`,
         missing.slice(0, 5).map((m) => m.participant.participantCode).join(', '));
  } else {
    pass(`all ${subOk.length} successful submitters are on the board`);
  }

  const idCounts = {};
  for (const e of board) idCounts[e.participantId] = (idCounts[e.participantId] ?? 0) + 1;
  const dupes = Object.entries(idCounts).filter(([, n]) => n > 1);
  if (dupes.length) fail(`nobody is listed twice (${dupes.length} duplicated)`);
  else pass('nobody is listed twice');

  // 4b. the score on the board is the score the server told the student
  let mismatched = 0;
  for (const r of subOk) {
    const row = byId.get(r.participant.id);
    if (!row) continue;
    if (row.score !== r.res.json.score) {
      mismatched++;
      if (mismatched <= 3) {
        fail(`score matches what ${r.participant.participantCode} was shown`,
             `submit returned ${r.res.json.score}, board shows ${row.score}`);
      }
    }
  }
  if (!mismatched) pass('every score on the board matches the receipt the student got');
  else if (mismatched > 3) log(`        ${c.dim(`…and ${mismatched - 3} more`)}`);

  // 4c. ranks are 1..N with no gaps or repeats
  const ranks = board.map((e) => e.rank);
  const expectRanks = Array.from({ length: board.length }, (_, i) => i + 1);
  if (JSON.stringify(ranks) !== JSON.stringify(expectRanks)) {
    fail('ranks run 1..N with no gaps or ties',
         `got ${ranks.slice(0, 12).join(',')}${ranks.length > 12 ? '…' : ''}`);
  } else {
    pass(`ranks run 1..${board.length} cleanly`);
  }

  // 4d. the published order obeys the documented tie-break rule
  //     score desc → completion time asc → submitted time asc
  const resorted = [...board].sort((a, b) =>
    b.score - a.score ||
    a.completionTimeMs - b.completionTimeMs ||
    new Date(a.submittedAt) - new Date(b.submittedAt));
  const orderWrong = resorted.findIndex((e, i) => e.participantId !== board[i].participantId);
  if (orderWrong !== -1) {
    const got = board[orderWrong], want = resorted[orderWrong];
    fail('order follows score desc → time asc → submitted asc',
         `at rank ${orderWrong + 1}: board has ${got.participantName} ` +
         `(${got.score}pts/${got.completionTimeMs}ms), rule wants ${want.participantName} ` +
         `(${want.score}pts/${want.completionTimeMs}ms)`);
  } else {
    pass('order follows score desc → time asc → submitted asc');
  }

  // 4e. nobody landed with a null/zero score they did not earn
  const zeroed = subOk.filter((r) => {
    const row = byId.get(r.participant.id);
    return row && r.res.json.score > 0 && (row.score ?? 0) === 0;
  });
  if (zeroed.length) fail(`no scored student is showing 0 (${zeroed.length} are)`);
  else pass('no scored student is showing 0');

  // 4f. mid-run observations
  if (anomalies.length) {
    const unique = [...new Set(anomalies)];
    fail(`the board stayed correct while submissions landed (${unique.length} anomalies)`,
         unique.slice(0, 5).join('\n        '));
  } else {
    pass('the board stayed correct at every poll while submissions landed');
  }

  // 4g. pre-existing entries survived untouched
  const brokenBefore = before.filter((b) => {
    const now = byId.get(b.participantId);
    return !now || now.score !== b.score || now.completionTimeMs !== b.completionTimeMs;
  });
  if (brokenBefore.length) {
    fail(`entries that were already on the board are unchanged (${brokenBefore.length} changed)`);
  } else {
    pass('entries that were already on the board are unchanged');
  }

  finish();
}

function finish() {
  head('Result');
  if (!failures.length) {
    log(`  ${c.green(c.bold('PASS'))} — every check held.\n`);
    process.exitCode = 0;
  } else {
    log(`  ${c.red(c.bold(`${failures.length} check${failures.length === 1 ? '' : 's'} failed`))}\n`);
    for (const f of failures) log(`   · ${f.what}${f.detail ? `\n     ${c.dim(f.detail)}` : ''}`);
    log('');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  log(`\n${c.red('harness crashed')}: ${err?.stack ?? err}\n`);
  process.exitCode = 1;
});
