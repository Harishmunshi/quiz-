# Round 2 stress and accuracy test — results

**39 of 39 checks passed, at 200 students and again at 500.**

---

## How this was tested

I could not point load at your live site — this container has no outbound network,
so I cannot make a single request to Vercel. Instead I rebuilt the competition here:

- **PostgreSQL 16 running locally**, with your `supabase/migrations` applied. I then
  compared its schema column-for-column against your live Supabase database:
  **71 columns across the four Round 2 tables, identical, zero differences.**
- **Your three real Round 2 questions** — Order of the Surahs, Events in the life of the
  Prophet ﷺ, Order of the Prophets — pulled from your live database, with their real
  twelve items and real answer keys.
- **Your own code doing the work.** `gradeOrder`, `validateSubmission`, `rankLiveEntries`,
  `scoredQuestionCount` and `missedQuestionPenaltyMs` are imported straight from
  `src/lib/round2/live.ts`. The leaderboard query is the `$queryRaw` from
  `src/app/api/round2/live/leaderboard/route.ts`, copied verbatim.

**Accuracy is checked by disagreement.** As each submission is made, the harness keeps
its own tally in plain JavaScript — who scored what, in what time — knowing nothing about
the database. After each question it recomputes the entire standings from that tally and
compares against what the SQL returns, **student by student, position by position**. If
the two ever disagreed on a score, a cumulative time, or a rank, the test would fail.
They never did.

## What was thrown at it

Per question, all at once:

| | 200 students | 500 students |
|---|---|---|
| Simultaneous submissions | 183, 181, 179 | 463, 451, 457 |
| Accepted in | 104ms, 106ms, 91ms | 190ms, 195ms, 143ms |
| Leaderboard aggregate | 8.0ms, 2.4ms, 3.6ms | 7.9ms, 3.4ms, 4.7ms |
| Total answers stored | 545 | 1,371 |

Plus, on every question: 25 submissions fired from **one** student simultaneously, a
submission after the timer expired, and a hand-tampered submission containing an item
that doesn't exist in the question.

## What passed

**Nothing is lost or double-counted.**
- Every one of the 25 simultaneous submissions from a single student left **exactly one
  row**. The unique index holds under a genuine race — a student double-tapping, or a
  flaky phone retrying, cannot submit twice.
- No student ended up with two answers to any question, across all 1,371 rows.
- Every stored answer re-graded identically when checked a second time, and the marks
  stored matched the correctness flag in every case.

**Scoring and ranking are exact.**
- Every score matched the independent recount, on all three questions, at both scales.
- Every cumulative time matched.
- The **entire ordering** matched — not just the top ten, all 500 positions.

**The rules hold at the edges.**
- Submissions after the timer are refused (`TOO_LATE`).
- Submissions containing an item that isn't part of the question are refused before
  grading — a crafted request can't score.
- A student who skipped all three questions is charged the full 120-second window for
  each, and **never** finishes ahead of a student who answered and scored the same.
  Silence does not pay.

**Ties behave properly.**
- Six students with an identical score *and* an identical time all shared one rank.
- The next student down skipped ahead by six places, which is correct competition
  ranking — you get 1st, 1st, 1st, then 4th, not 1st, 1st, 1st, 2nd.

**The board actually moves.**
- Standings genuinely reorder between questions, and every student on the final board had
  a rank after question 2 to move *from* — so the movement arrows have something real to
  measure against.
- Students who got question 3 right are among those who climbed. The arrows point the
  right way.

## Speed

Under 15-way concurrent polling — the projector, the admin panel and a room of phones all
reading at once — **180 leaderboard queries** measured:

| | 200 students | 500 students |
|---|---|---|
| Median | 12.5ms | 26.1ms |
| 95th percentile | 36.8ms | 43.8ms |
| Worst | 48.1ms | 65.0ms |

Going from 200 students to 500 roughly doubled the median and left the worst case at 65ms.
That is comfortable headroom.

## What this does not tell you

I want to be clear about the limits, because a test that oversells itself is worse than
no test.

1. **The HTTP layer is not covered here.** Request parsing, admin-token checks and the
   Next.js plumbing were tested separately in a real browser (13 navigation cases, 6
   sequence-builder cases, 6 admin-control cases), not in this run.
2. **The network to Vercel is not covered.** These numbers are a database on the same
   machine. Real timings will be dominated by the round trip from Vercel's functions to
   Supabase — which is exactly what the Tokyo region change in `vercel.json` addresses,
   and which is still undeployed.
3. **Serverless behaviour is not covered.** Cold starts and Vercel's connection pooling
   under a real burst can only be measured against the live site.

## The one test only you can run

Get three or four phones on the school wifi, join Round 2, and have everyone submit at
the same moment. That exercises the three things above, and takes five minutes.

If you do that after deploying, and it holds, you can walk into the hall confident.
