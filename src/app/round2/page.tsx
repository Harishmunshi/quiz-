'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Hourglass,
  Loader2,
  Lock,
  Trophy,
  WifiOff,
  XCircle,
} from 'lucide-react';
import SequenceBuilder from '@/components/round2/SequenceBuilder';
import { formatSeconds } from '@/lib/round2/live';
import { useCountdown, useLiveRound2 } from '@/lib/round2/useLiveRound2';
import { loadParticipant, saveParticipant, type StoredParticipant } from '@/lib/round2/session';
import { SCHOOL_LOGO_URL, SCHOOL_NAME_DEFAULT } from '@/lib/theme';

/**
 * Round 2 — student screen. Its own page, its own URL, independent of the
 * Round 1 single-page flow, so students can be sent straight to /round2.
 *
 * Everything visible here is driven by the quiz master. The page polls
 * adaptively (see useLiveRound2) and locks optimistically on submit so the
 * student never waits on a round trip to know their answer landed.
 */

export default function Round2Page() {
  const [participant, setParticipant] = useState<StoredParticipant | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [placed, setPlaced] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [standing, setStanding] = useState<{
    rank: number;
    score: number;
    total: number;
    totalTimeMs: number;
  } | null>(null);

  useEffect(() => {
    setParticipant(loadParticipant());
    setCheckedStorage(true);
  }, []);

  const { live, connected, clockOffset, refresh, patch } = useLiveRound2(participant?.id);

  const q = live?.question ?? null;
  const state = live?.state ?? 'idle';
  const locked = Boolean(live?.myAnswer);

  const remainingMs = useCountdown(
    live?.openedAt ?? null,
    q?.timeLimitSec ?? live?.questionSeconds ?? 0,
    clockOffset,
    state === 'open'
  );

  // Clear the working sequence whenever a different question comes on screen.
  useEffect(() => {
    setPlaced([]);
    setSubmitError(null);
  }, [q?.id]);

  // After a reveal, show where the student landed.
  useEffect(() => {
    if (!participant?.id || state !== 'revealed') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/round2/live/leaderboard', { cache: 'no-store' });
        const json = await res.json();
        if (!json.success || cancelled) return;
        const rows = json.data as Array<{
          participantId: string;
          rank: number;
          score: number;
          totalTimeMs: number;
        }>;
        const mine = rows.find((r) => r.participantId === participant.id);
        if (mine) {
          setStanding({
            rank: mine.rank,
            score: mine.score,
            totalTimeMs: mine.totalTimeMs,
            total: rows.length,
          });
        }
      } catch {
        /* standing is a nice-to-have; never block the round on it */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [participant?.id, state, live?.currentQuestionNumber]);

  const complete = q ? placed.length === q.itemCount : false;

  const submit = async () => {
    if (!participant || !q || state !== 'open' || locked || !complete) return;
    setSubmitting(true);
    setSubmitError(null);

    // Optimistic lock: the UI commits the moment the tap lands. If the server
    // rejects it we roll back below — but the common path feels instantaneous.
    try {
      const res = await fetch('/api/round2/live/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: participant.id,
          questionId: q.id,
          submittedOrder: placed,
        }),
      });
      const json = await res.json();
      if (json.success) {
        patch((prev) => ({
          ...prev,
          myAnswer: {
            submittedOrder: json.data.submittedOrder,
            responseTimeMs: json.data.responseTimeMs,
            isCorrect: null,
            correctPositions: null,
          },
        }));
      } else {
        setSubmitError(json.error ?? 'Could not record your answer');
        refresh();
      }
    } catch {
      setSubmitError('Network error — your answer was not saved. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayOrder = useMemo(
    () => (locked ? (live?.myAnswer?.submittedOrder ?? []) : placed),
    [locked, live?.myAnswer?.submittedOrder, placed]
  );

  // ── Gates ───────────────────────────────────────────────────────────
  if (!checkedStorage) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#8A6A1C]" />
        </div>
      </Shell>
    );
  }

  if (!participant) {
    return (
      <Shell>
        <JoinForm
          onJoined={(p) => {
            saveParticipant(p);
            setParticipant(p);
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#C8A951]/20 bg-[#F7F2E7]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#063B2D]">
              {participant.name}
            </p>
            <p className="truncate text-[11px] text-[#5A6B5E]/80">
              {participant.schoolName} · {participant.participantCode}
            </p>
          </div>

          {!connected && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#C8A951]/20 px-2.5 py-1 text-[11px] font-semibold text-[#8A6A1C]">
              <WifiOff className="h-3 w-3" /> Reconnecting
            </span>
          )}

          <span className="shrink-0 rounded-full border border-[#C8A951]/30 px-3 py-1 font-mono text-xs tabular-nums text-[#8A6A1C]">
            {live && live.currentQuestionNumber > 0
              ? `${live.currentQuestionNumber} / ${live.totalQuestions}`
              : 'ROUND 2'}
          </span>
        </div>

        {/* Hairline countdown — the only motion in the header */}
        {state === 'open' && remainingMs !== null && q && (
          <div className="h-[3px] w-full bg-white/60">
            <div
              className="h-full bg-gradient-to-r from-[#C8A951] to-[#e8d18a]"
              style={{
                width: `${(remainingMs / (q.timeLimitSec * 1000)) * 100}%`,
                transition: 'none',
              }}
            />
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ── Waiting ─────────────────────────────────────────────── */}
          {(state === 'idle' || !q) && (
            <Fade key="idle">
              <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <motion.div
                  animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="mb-7 rounded-full border border-[#C8A951]/25 p-6"
                >
                  <Hourglass className="h-10 w-10 text-[#8A6A1C]" />
                </motion.div>
                <h2 className="text-2xl font-bold tracking-tight text-[#063B2D]">
                  You&apos;re in
                </h2>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#5A6B5E]">
                  Keep this page open. The next question appears the moment the
                  quiz master releases it.
                </p>
              </div>
            </Fade>
          )}

          {/* ── Question open ───────────────────────────────────────── */}
          {state === 'open' && q && (
            <Fade key={`open-${q.id}`}>
              {/* Timer */}
              {remainingMs !== null && (
                <div className="mb-6 flex items-baseline justify-between">
                  <span
                    className={`font-mono text-4xl font-bold tabular-nums tracking-tight ${
                      remainingMs < 15000 ? 'text-[#B3261E]' : 'text-[#8A6A1C]'
                    }`}
                  >
                    {Math.floor(remainingMs / 1000)}
                    <span className="text-xl opacity-60">
                      .{String(Math.floor((remainingMs % 1000) / 10)).padStart(2, '0')}
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#5A6B5E]/70">
                    {live?.answerCount ?? 0} submitted
                  </span>
                </div>
              )}

              <QuestionHead q={q} />

              <SequenceBuilder
                items={q.items}
                placed={displayOrder}
                onChange={setPlaced}
                disabled={locked}
              />

              {submitError && (
                <p className="mt-5 rounded-xl border border-[#B3261E]/40 bg-[#B3261E]/08 px-4 py-3 text-sm text-[#B3261E]">
                  {submitError}
                </p>
              )}

              {/* Submit bar */}
              {!locked ? (
                <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-[#C8A951]/20 bg-[#F7F2E7]/90 px-4 py-4 backdrop-blur-md">
                  <button
                    onClick={submit}
                    disabled={!complete || submitting}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all ${
                      complete
                        ? 'bg-[#C8A951] text-[#063B2D] active:scale-[0.98] hover:bg-[#d9bd6b]'
                        : 'cursor-not-allowed bg-white/60 text-[#5A6B5E]/70'
                    }`}
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : complete ? (
                      <>
                        <Lock className="h-4 w-4" />
                        Lock in my answer
                      </>
                    ) : (
                      `Place all ${q.itemCount} items`
                    )}
                  </button>
                  <p className="mt-2 text-center text-[11px] text-[#5A6B5E]/70">
                    You get one submission. It cannot be changed.
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[#C8A951]/40 bg-[#C8A951]/10 px-4 py-4 text-sm font-semibold text-[#8A6A1C]"
                >
                  <Lock className="h-4 w-4" />
                  Locked in at {formatSeconds(live!.myAnswer!.responseTimeMs)}
                </motion.div>
              )}
            </Fade>
          )}

          {/* ── Locked ──────────────────────────────────────────────── */}
          {state === 'locked' && q && (
            <Fade key="locked">
              <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <motion.div
                  animate={{ rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="mb-7 rounded-full border border-[#C8A951]/25 p-6"
                >
                  <Lock className="h-10 w-10 text-[#8A6A1C]" />
                </motion.div>
                <h2 className="text-2xl font-bold tracking-tight text-[#063B2D]">
                  Submissions closed
                </h2>
                <p className="mt-3 text-sm text-[#5A6B5E]">
                  {locked
                    ? `Your answer is in — ${formatSeconds(live!.myAnswer!.responseTimeMs)}`
                    : 'You did not submit this one.'}
                </p>
                <p className="mt-1 text-xs text-[#5A6B5E]/70">Waiting for the reveal…</p>
              </div>
            </Fade>
          )}

          {/* ── Revealed ────────────────────────────────────────────── */}
          {state === 'revealed' && q && (
            <Fade key={`revealed-${q.id}`}>
              {live?.myAnswer ? (
                <motion.div
                  initial={{ scale: 0.94, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`mb-6 flex flex-col items-center rounded-2xl border p-6 text-center ${
                    live.myAnswer.isCorrect
                      ? 'border-[#0A7D52]/50 bg-[#0A7D52]/10'
                      : 'border-[#B3261E]/35 bg-[#B3261E]/07'
                  }`}
                >
                  {live.myAnswer.isCorrect ? (
                    <CheckCircle2 className="mb-3 h-11 w-11 text-[#0A7D52]" />
                  ) : (
                    <XCircle className="mb-3 h-11 w-11 text-[#B3261E]" />
                  )}
                  <p className="text-2xl font-bold tracking-tight text-[#063B2D]">
                    {live.myAnswer.isCorrect ? 'Perfect sequence' : 'Not quite'}
                  </p>
                  <p className="mt-2 font-mono text-xs tabular-nums text-[#5A6B5E]">
                    {live.myAnswer.correctPositions ?? 0} / {q.itemCount} in place ·{' '}
                    {formatSeconds(live.myAnswer.responseTimeMs)}
                  </p>
                </motion.div>
              ) : (
                <div className="mb-6 rounded-2xl border border-[#D4C5A9] bg-white/60 p-6 text-center">
                  <p className="text-base font-semibold text-[#5A6B5E]">
                    No answer recorded
                  </p>
                </div>
              )}

              {/* Their sequence, diffed against the key */}
              {live?.myAnswer && live.correctOrder && (
                <div className="mb-6">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5A6B5E]/80">
                    Your answer
                  </h3>
                  <SequenceBuilder
                    items={q.items}
                    placed={live.myAnswer.submittedOrder}
                    onChange={() => {}}
                    disabled
                    correctOrder={live.correctOrder}
                  />
                </div>
              )}

              {live?.correctOrder && (
                <div className="mb-6 rounded-2xl border border-[#0A7D52]/35 bg-[#0A7D52]/08 p-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0A7D52]">
                    Correct sequence
                  </h3>
                  <ol className="space-y-1">
                    {live.correctOrder.map((key, i) => {
                      const item = q.items.find((it) => it.key === key);
                      return (
                        <li key={key} className="flex items-baseline gap-3">
                          <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-[#0A7D52]/70">
                            {i + 1}
                          </span>
                          <span className="text-sm text-[#063B2D]">
                            {item?.en ?? key}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {standing && (
                <div className="rounded-2xl border border-[#C8A951]/25 bg-white/60 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-[#8A6A1C]" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8A6A1C]">
                      Your position
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <Stat label="Rank" value={`#${standing.rank}`} sub={`of ${standing.total}`} />
                    <Stat label="Score" value={String(standing.score)} sub="marks" />
                    <Stat
                      label="Time"
                      value={formatSeconds(standing.totalTimeMs)}
                      sub="cumulative"
                    />
                  </div>
                </div>
              )}

              <p className="mt-6 text-center text-xs text-[#5A6B5E]/70">
                Waiting for the next question…
              </p>
            </Fade>
          )}
        </AnimatePresence>
      </div>
    </Shell>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-screen flex-col"
      style={{ background: 'linear-gradient(180deg, #F7F2E7 0%, #EEE3CC 100%)' }}
    >
      {children}
    </main>
  );
}

function Fade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function QuestionHead({
  q,
}: {
  q: { questionNumber: number; titleEnglish: string; titleSecondary: string | null; promptEnglish: string; promptSecondary: string | null };
}) {
  return (
    <div className="mb-6 border-l-2 border-[#C8A951] pl-4">
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.28em] text-[#8A6A1C]/80">
        Question {String(q.questionNumber).padStart(2, '0')}
      </p>
      <h2 className="text-xl font-bold leading-snug tracking-tight text-[#063B2D]">
        {q.titleEnglish}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#5A6B5E]">{q.promptEnglish}</p>
      {q.promptSecondary && (
        <p className="mt-1.5 text-sm leading-relaxed text-[#5A6B5E]/80">
          {q.promptSecondary}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#5A6B5E]/70">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#8A6A1C]">{value}</p>
      <p className="text-[10px] text-[#5A6B5E]/60">{sub}</p>
    </div>
  );
}

function JoinForm({ onJoined }: { onJoined: (p: StoredParticipant) => void }) {
  const [name, setName] = useState('');
  const [schoolName, setSchoolName] = useState(SCHOOL_NAME_DEFAULT);
  const [language, setLanguage] = useState<'english' | 'gujarati'>('english');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schoolName, language }),
      });
      const json = await res.json();
      if (json.success) {
        onJoined({
          id: json.participant.id,
          participantCode: json.participant.participantCode,
          name: json.participant.name,
          schoolName: json.participant.schoolName ?? schoolName,
          language,
        });
      } else {
        setErr(json.error ?? 'Could not join');
      }
    } catch {
      setErr('Network error \u2014 check your connection and try again');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full rounded-xl border border-[#D4C5A9] bg-white/80 px-3.5 py-3 text-[#063B2D] outline-none transition-colors placeholder:text-[#5A6B5E]/50 focus:border-[#C8A951]';

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SCHOOL_LOGO_URL} alt="" className="mb-4 h-20 w-20 object-contain" />
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#8A6A1C]">
            Round 02
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#063B2D]">
            Take your seat
          </h1>
        </div>

        {err && (
          <p className="mb-4 rounded-xl border border-[#B3261E]/40 bg-[#B3261E]/08 px-3.5 py-2.5 text-sm text-[#B3261E]">
            {err}
          </p>
        )}

        <Label>Your name</Label>
        <input
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${field} mb-4`}
          placeholder="Full name"
        />

        <Label>School name</Label>
        <input
          required
          minLength={2}
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          className={`${field} mb-4`}
          placeholder="Your school"
        />

        <Label>Language</Label>
        <div className="mb-6 grid grid-cols-2 gap-2">
          {(['english', 'gujarati'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                language === l
                  ? 'border-[#C8A951] bg-[#C8A951]/20 text-[#063B2D]'
                  : 'border-[#D4C5A9] bg-white/60 text-[#5A6B5E]'
              }`}
            >
              {l === 'english' ? 'English' : '\u0939\u093f\u0902\u0926\u0940'}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center rounded-xl bg-[#063B2D] py-4 text-base font-bold text-[#F7F2E7] transition-colors hover:bg-[#0A5E3F] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enter Round 2'}
        </button>
      </form>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5A6B5E]/80">
      {children}
    </span>
  );
}
