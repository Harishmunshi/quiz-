'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Hourglass,
  Loader2,
  Lock,
  Trophy,
  WifiOff,
  XCircle,
} from 'lucide-react';
import SequenceBuilder from '@/components/round2/SequenceBuilder';
import LiveLeaderboard, { type BoardEntry } from '@/components/round2/LiveLeaderboard';
import QuestionStage, { themeForQuestion } from '@/components/round2/QuestionStage';
import { formatSeconds } from '@/lib/round2/live';
import { useCountdown, useLiveRound2 } from '@/lib/round2/useLiveRound2';
import { loadParticipant, saveParticipant, type StoredParticipant } from '@/lib/round2/session';
import { SCHOOL_LOGO_URL } from '@/lib/theme';

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
  const [pin, setPin] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [standing, setStanding] = useState<{
    rank: number;
    score: number;
    total: number;
    totalTimeMs: number;
  } | null>(null);
  // Top of the board, shown to the student after each reveal. Same data and the
  // same component the hall's projector is running, so a student watching their
  // phone sees the identical overtake the room just reacted to.
  const [board, setBoard] = useState<BoardEntry[]>([]);

  // Which question this student is looking at. Independent of the board.
  //
  // Round 2 used to render whatever `live.question` said, so the screen followed
  // the quiz master and a student who had not finished Q1 lost access to it the
  // instant Q2 opened. The student now chooses, and the board only decides the
  // default.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setParticipant(loadParticipant());
    setCheckedStorage(true);
  }, []);

  const { live, connected, clockOffset, refresh, patch } = useLiveRound2(participant?.id);

  const questions = live?.questions ?? [];
  const state = live?.state ?? 'idle';

  // Follow the board until the student picks something, then stay put — being
  // yanked onto another question mid-drag is exactly what this change removes.
  const q = useMemo(() => {
    if (selectedId) {
      const chosen = questions.find((x) => x.id === selectedId);
      if (chosen) return chosen;
    }
    // Prefer the board's question; fall back to the first one still answerable
    // so a student who joins late lands somewhere useful rather than on a
    // finished question.
    return (
      questions.find((x) => x.questionNumber === live?.currentQuestionNumber) ??
      questions.find((x) => x.answerable) ??
      questions[questions.length - 1] ??
      null
    );
  }, [selectedId, questions, live?.currentQuestionNumber]);

  // Per-question, from the selected question's own record — not the round-wide
  // state, which describes only whatever the board is showing.
  const myAnswer = q?.myAnswer ?? null;
  const locked = Boolean(myAnswer);
  const revealed = Boolean(q?.revealedAt);
  const answerable = Boolean(q?.answerable);
  const correctOrder = q?.correctOrder ?? null;

  const remainingMs = useCountdown(
    q?.openedAt ?? null,
    q?.timeLimitSec ?? live?.questionSeconds ?? 0,
    clockOffset,
    // Only count down while the question is genuinely still open to this student.
    answerable
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
        const rows = json.data as BoardEntry[];
        setBoard(rows.slice(0, 10));
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

  const gate = live?.gate ?? null;

  const joinRound = async () => {
    if (!participant) return;
    setJoining(true);
    setJoinErr(null);
    try {
      const res = await fetch('/api/round2/live/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participant.id, pin }),
      });
      const json = await res.json();
      if (json.success) {
        setPin('');
        refresh();
      } else {
        setJoinErr(json.error ?? 'Could not join');
      }
    } catch {
      setJoinErr('Network error — try again');
    } finally {
      setJoining(false);
    }
  };

  const complete = q ? placed.length === q.itemCount : false;

  const submit = async () => {
    // Gated on THIS question being answerable, not on the round-wide state.
    // `state !== 'open'` was the client half of the bug: even after the server
    // accepted out-of-order submissions, this line still refused to send them.
    if (!participant || !q || !answerable || locked || !complete) return;
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
      // Read the body defensively. A rejection carries a real reason — "Time's
      // up", "this question is no longer on screen" — and the student needs to
      // see that reason, not a generic failure. Previously any hiccup parsing
      // the response fell through to the catch and reported a network problem,
      // which sent people to check their wifi while the server was in fact
      // telling them something specific and true.
      let json: {
        success?: boolean;
        error?: string;
        code?: string;
        data?: { submittedOrder: string[]; responseTimeMs: number };
      } | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (json?.success && json.data) {
        const answered = {
          submittedOrder: json.data.submittedOrder,
          responseTimeMs: json.data.responseTimeMs,
          isCorrect: null,
          correctPositions: null,
        };
        // Attach the answer to the question it belongs to, not to a single
        // top-level slot — with several questions in play at once, one shared
        // myAnswer would make every other question look answered too.
        patch((prev) => ({
          ...prev,
          myAnswer: prev.question?.id === q.id ? answered : prev.myAnswer,
          questions: prev.questions.map((x) =>
            x.id === q.id ? { ...x, myAnswer: answered, answerable: false } : x
          ),
        }));
        return;
      }

      // Plain-language versions of the reasons the server can refuse, so a
      // student is never left guessing why their tap did nothing.
      const BY_CODE: Record<string, string> = {
        ALREADY_REVEALED:
          'The answer to this question has already been shown, so it can no longer be submitted.',
        NOT_STARTED: 'This question has not been started yet.',
        ALREADY_ANSWERED: 'You have already answered this question.',
        DISQUALIFIED: 'You have been removed from this round.',
        NOT_QUALIFIED: 'You are not in Round 2.',
        NOT_JOINED: 'Enter the PIN shown on screen to join the round first.',
        INVALID_SEQUENCE: 'That sequence was not accepted — place every item once.',
      };

      setSubmitError(
        (json?.code && BY_CODE[json.code]) ||
          json?.error ||
          `Your answer was not saved (error ${res.status}). Try again.`
      );
      // Pull fresh state so the screen stops offering a submission the server
      // will refuse again.
      refresh();
    } catch (error) {
      // Only a genuine transport failure reaches here — the request never got
      // a response at all.
      console.error('Round 2 submission failed:', error);
      setSubmitError('Could not reach the server — your answer was not saved. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayOrder = useMemo(
    () => (locked ? (myAnswer?.submittedOrder ?? []) : placed),
    [locked, myAnswer?.submittedOrder, placed]
  );

  // ── Gates ───────────────────────────────────────────────────────────
  if (!checkedStorage) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#966700]" />
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

  // A blocked student used to fall through to the generic "waiting" screen and
  // sit there forever with no idea why. Each reason now has its own door.
  if (gate?.blocked === 'DISQUALIFIED') {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <XCircle className="mb-6 h-14 w-14 text-[#B3261E]" />
          <h2 className="text-2xl font-bold tracking-tight text-[#0A0D14]">
            Removed from this round
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#5B6472]">
            The quiz master has removed you from Round 2. Please speak to them if
            you think this is a mistake.
          </p>
        </div>
      </Shell>
    );
  }

  if (gate?.blocked === 'NOT_QUALIFIED') {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Trophy className="mb-6 h-14 w-14 text-[#966700]/50" />
          <h2 className="text-2xl font-bold tracking-tight text-[#0A0D14]">
            Not in Round 2
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#5B6472]">
            Round 2 is for the top scorers from Round 1. If the quiz master has
            not announced the cut yet, keep this page open — it updates on its own.
          </p>
          <p className="mt-6 font-mono text-xs text-[#5B6472]/70">
            {participant.name} · {participant.participantCode}
          </p>
        </div>
      </Shell>
    );
  }

  if (gate?.blocked === 'NEEDS_PIN') {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              joinRound();
            }}
            className="w-full max-w-sm text-center"
          >
            <Lock className="mx-auto mb-5 h-12 w-12 text-[#966700]" />
            <h2 className="text-2xl font-bold tracking-tight text-[#0A0D14]">
              You&apos;re in Round 2
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#5B6472]">
              Enter the 4-digit code shown on the screen at the front of the hall.
            </p>

            {joinErr && (
              <p className="mt-5 rounded-xl border border-[#B3261E]/40 bg-[#B3261E]/08 px-3.5 py-2.5 text-sm text-[#B3261E]">
                {joinErr}
              </p>
            )}

            {!live?.pinIsSet && (
              <p className="mt-5 rounded-xl border border-[#FFB000]/50 bg-[#FFB000]/15 px-3.5 py-2.5 text-sm text-[#7C5A00]">
                The quiz master has not shown the code yet. Keep this page open.
              </p>
            )}

            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000"
              className="my-6 w-full rounded-xl border border-[#D7DAE1] bg-white/80 px-3.5 py-4 text-center font-mono text-3xl tracking-[0.4em] text-[#0A0D14] outline-none focus:border-[#FFB000]"
            />

            <button
              type="submit"
              disabled={joining || pin.length !== 4}
              className="flex w-full items-center justify-center rounded-xl bg-[#0A0D14] py-4 text-base font-bold text-[#F4F5F7] transition-colors hover:bg-[#1C2230] disabled:opacity-45"
            >
              {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Join the round'}
            </button>

            <p className="mt-5 font-mono text-xs text-[#5B6472]/70">
              {participant.name} · {participant.participantCode}
            </p>
          </form>
        </div>
      </Shell>
    );
  }

  return (
    <Shell questionNumber={live?.currentQuestionNumber ?? 0} exit={false}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#FFB000]/20 bg-[#F4F5F7]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {/* Always available now. Leaving no longer forfeits anything: the
              question stays answerable until its answer is revealed, so hiding
              the only way out was costing students more than it protected. */}
          <a
            href="/"
            aria-label="Back to the main site"
            className="flex shrink-0 items-center justify-center rounded-xl border border-[#FFB000]/35 bg-white/70 p-2 text-[#0A0D14] transition-colors hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#0A0D14]">
              {participant.name}
            </p>
            <p className="truncate text-[11px] text-[#5B6472]/80">
              {participant.schoolName} · {participant.participantCode}
            </p>
          </div>

          {!connected && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#FFB000]/20 px-2.5 py-1 text-[11px] font-semibold text-[#966700]">
              <WifiOff className="h-3 w-3" /> Reconnecting
            </span>
          )}

          <span className="shrink-0 rounded-full border border-[#FFB000]/30 px-3 py-1 font-mono text-xs tabular-nums text-[#966700]">
            {live && live.currentQuestionNumber > 0
              ? `${live.currentQuestionNumber} / ${live.totalQuestions}`
              : 'ROUND 2'}
          </span>
        </div>

        {/* Question switcher. This is the visible half of "any question, any
            time": one chip per started question, showing at a glance which are
            answered, which are still open to this student, and which are done.
            Tapping one loads it — including going back to Q1 while Q2 is up. */}
        {questions.length > 0 && (
          <div className="mx-auto flex max-w-2xl gap-1.5 overflow-x-auto px-4 pb-2.5">
            {questions.map((item) => {
              const isCurrent = item.id === q?.id;
              const done = Boolean(item.myAnswer);
              const shut = Boolean(item.revealedAt);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  aria-current={isCurrent}
                  title={
                    done
                      ? `Question ${item.questionNumber} — answered`
                      : shut
                        ? `Question ${item.questionNumber} — closed, you did not answer`
                        : `Question ${item.questionNumber} — open, tap to answer`
                  }
                  className={[
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all',
                    isCurrent
                      ? 'border-[#0A0D14] bg-[#0A0D14] text-[#F4F5F7]'
                      : done
                        ? 'border-[#1A7D70]/45 bg-[#1A7D70]/12 text-[#1A7D70]'
                        : shut
                          ? 'border-[#D7DAE1] bg-white/50 text-[#5B6472]/60'
                          : 'border-[#FFB000]/60 bg-[#FFB000]/15 text-[#7C5A00]',
                  ].join(' ')}
                >
                  Q{item.questionNumber}
                  {done ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : shut ? (
                    <XCircle className="h-3 w-3" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Hairline countdown — the only motion in the header */}
        {answerable && remainingMs !== null && q && (
          <div className="h-[3px] w-full bg-white/60">
            <div
              className="h-full bg-gradient-to-r from-[#FFB000] to-[#FFE66D]"
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
          {/* Only when there is genuinely nothing to work on. Previously this
              also swallowed `state === 'idle'`, so a student with an unanswered
              open question was shown "waiting" and could not reach it. */}
          {!q && (
            <Fade key="idle">
              <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <motion.div
                  animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="mb-7 rounded-full border border-[#FFB000]/25 p-6"
                >
                  <Hourglass className="h-10 w-10 text-[#966700]" />
                </motion.div>
                <h2 className="text-2xl font-bold tracking-tight text-[#0A0D14]">
                  You&apos;re in
                </h2>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#5B6472]">
                  Keep this page open. The next question appears the moment the
                  quiz master releases it.
                </p>
              </div>
            </Fade>
          )}

          {/* ── Answering ───────────────────────────────────────────── */}
          {/* Driven by this question being answerable, or already answered but
              not yet revealed — so a student who has locked in still sees their
              sequence rather than being thrown to a "closed" screen because the
              board moved on. */}
          {q && !revealed && (
            <Fade key={`open-${q.id}`}>
              {/* Timer */}
              {remainingMs !== null && (
                <div className="mb-6 flex items-baseline justify-between">
                  <span
                    className={`font-mono text-4xl font-bold tabular-nums tracking-tight ${
                      remainingMs < 15000 ? 'text-[#B3261E]' : 'text-[#966700]'
                    }`}
                  >
                    {Math.floor(remainingMs / 1000)}
                    <span className="text-xl opacity-60">
                      .{String(Math.floor((remainingMs % 1000) / 10)).padStart(2, '0')}
                    </span>
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#5B6472]/70">
                    {q.answerCount ?? 0} submitted
                  </span>
                </div>
              )}

              <QuestionHead q={q} />

              {/* The countdown having run out no longer blocks anything — say so,
                  rather than leaving a student to discover it by tapping. */}
              {remainingMs === 0 && !locked && (
                <p className="mb-5 rounded-xl border border-[#FFB000]/50 bg-[#FFB000]/12 px-4 py-3 text-sm text-[#7C5A00]">
                  The time for this question has run out, but you can still submit
                  it until the answer is shown. Your recorded time will be longer,
                  which only matters if scores are tied.
                </p>
              )}

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
                <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-[#FFB000]/20 bg-[#F4F5F7]/90 px-4 py-4 backdrop-blur-md">
                  <button
                    onClick={submit}
                    disabled={!complete || submitting}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all ${
                      complete
                        ? 'bg-[#FFB000] text-[#0A0D14] active:scale-[0.98] hover:bg-[#FFC33D]'
                        : 'cursor-not-allowed bg-white/60 text-[#5B6472]/70'
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
                  <p className="mt-2 text-center text-[11px] text-[#5B6472]/70">
                    You get one submission. It cannot be changed.
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[#FFB000]/40 bg-[#FFB000]/10 px-4 py-4 text-sm font-semibold text-[#966700]"
                >
                  <Lock className="h-4 w-4" />
                  Locked in at {formatSeconds(myAnswer!.responseTimeMs)}
                </motion.div>
              )}

              {/* Nudge towards anything else still outstanding, so a student who
                  has just locked in knows there is more they can do rather than
                  sitting on a finished question waiting to be told. */}
              {locked && (live?.answerableCount ?? 0) > 0 && (
                <p className="mt-4 text-center text-xs text-[#5B6472]">
                  You still have {live!.answerableCount} question
                  {live!.answerableCount === 1 ? '' : 's'} you can answer — tap it
                  above.
                </p>
              )}
            </Fade>
          )}

          {/* ── Revealed ────────────────────────────────────────────── */}
          {/* This question's own reveal. The round-wide state describes only the
              question the board is showing, so keying off it meant selecting a
              finished Q1 while Q2 was open rendered nothing at all. */}
          {q && revealed && (
            <Fade key={`revealed-${q.id}`}>
              {myAnswer ? (
                <motion.div
                  initial={{ scale: 0.94, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
                  className={`mb-6 flex flex-col items-center rounded-2xl border p-6 text-center ${
                    myAnswer.isCorrect
                      ? 'border-[#1A7D70]/50 bg-[#1A7D70]/10'
                      : 'border-[#B3261E]/35 bg-[#B3261E]/07'
                  }`}
                >
                  {myAnswer.isCorrect ? (
                    <CheckCircle2 className="mb-3 h-11 w-11 text-[#1A7D70]" />
                  ) : (
                    <XCircle className="mb-3 h-11 w-11 text-[#B3261E]" />
                  )}
                  <p className="text-2xl font-bold tracking-tight text-[#0A0D14]">
                    {myAnswer.isCorrect ? 'Perfect sequence' : 'Not quite'}
                  </p>
                  <p className="mt-2 font-mono text-xs tabular-nums text-[#5B6472]">
                    {myAnswer.correctPositions ?? 0} / {q.itemCount} in place ·{' '}
                    {formatSeconds(myAnswer.responseTimeMs)}
                  </p>
                </motion.div>
              ) : (
                <div className="mb-6 rounded-2xl border border-[#D7DAE1] bg-white/60 p-6 text-center">
                  <p className="text-base font-semibold text-[#5B6472]">
                    No answer recorded
                  </p>
                </div>
              )}

              {/* Their sequence, diffed against the key */}
              {myAnswer && correctOrder && (
                <div className="mb-6">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#5B6472]/80">
                    Your answer
                  </h3>
                  <SequenceBuilder
                    items={q.items}
                    placed={myAnswer.submittedOrder}
                    onChange={() => {}}
                    disabled
                    correctOrder={correctOrder}
                  />
                </div>
              )}

              {correctOrder && (
                <div className="mb-6 rounded-2xl border border-[#1A7D70]/35 bg-[#1A7D70]/08 p-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1A7D70]">
                    Correct sequence
                  </h3>
                  <ol className="space-y-1">
                    {correctOrder.map((key, i) => {
                      const item = q.items.find((it) => it.key === key);
                      return (
                        <li key={key} className="flex items-baseline gap-3">
                          <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-[#1A7D70]/70">
                            {i + 1}
                          </span>
                          <span className="text-sm text-[#0A0D14]">
                            {item?.en ?? key}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {standing && (
                <div className="rounded-2xl border border-[#FFB000]/25 bg-white/60 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-[#966700]" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#966700]">
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

              {board.length > 0 && (
                <div className="mt-6 rounded-2xl border border-[#FFB000]/25 bg-white/55 p-4">
                  <div className="mb-3 flex items-baseline gap-2">
                    <Trophy className="h-4 w-4 text-[#966700]" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#966700]">
                      Leaderboard
                    </p>
                    <span className="ml-auto font-mono text-[10px] tracking-[0.2em] text-[#5B6472]/70">
                      TOP {board.length}
                    </span>
                  </div>
                  <LiveLeaderboard entries={board} highlightId={participant?.id ?? null} />
                </div>
              )}

              <p className="mt-6 text-center text-xs text-[#5B6472]/70">
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

/**
 * The page frame. `questionNumber` drives the per-question backdrop, so the
 * student's phone shifts to the same accent the projector is showing.
 */
function Shell({
  children,
  questionNumber = 0,
  exit = true,
}: {
  children: React.ReactNode;
  questionNumber?: number;
  /** The live question view draws its own header link, so it opts out. */
  exit?: boolean;
}) {
  return (
    <QuestionStage questionNumber={questionNumber} full>
      <main className="flex min-h-screen flex-col">
        {exit && (
          <a
            href="/"
            className="absolute left-4 top-4 z-40 flex items-center gap-1.5 rounded-xl border border-[#FFB000]/35 bg-white/70 px-2.5 py-1.5 text-sm font-semibold text-[#0A0D14] transition-colors hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Main site
          </a>
        )}
        {children}
      </main>
    </QuestionStage>
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

/**
 * The question's own rule and label take the accent of that question's stage,
 * so the header, the backdrop and the projector all agree. It is the small
 * detail that makes each question feel like its own moment rather than the
 * same screen with different words in it.
 */
function QuestionHead({
  q,
}: {
  q: { questionNumber: number; titleEnglish: string; titleSecondary: string | null; promptEnglish: string; promptSecondary: string | null };
}) {
  const theme = themeForQuestion(q.questionNumber);
  return (
    <div className="mb-6 border-l-2 pl-4" style={{ borderColor: theme.accent }}>
      <p
        className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.28em]"
        style={{ color: theme.ink }}
      >
        Question {String(q.questionNumber).padStart(2, '0')}
      </p>
      <h2 className="text-xl font-bold leading-snug tracking-tight text-[#0A0D14]">
        {q.titleEnglish}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#5B6472]">{q.promptEnglish}</p>
      {q.promptSecondary && (
        <p className="mt-1.5 text-sm leading-relaxed text-[#5B6472]/80">
          {q.promptSecondary}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#5B6472]/70">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#966700]">{value}</p>
      <p className="text-[10px] text-[#5B6472]/60">{sub}</p>
    </div>
  );
}

function JoinForm({ onJoined }: { onJoined: (p: StoredParticipant) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  /**
   * Round 2 does NOT register anyone. It identifies a student who already sat
   * Round 1, by their participant code.
   *
   * This is the fix for the two-identity-systems bug: /round2 used to show a
   * registration form, which created a brand new Participant with no Round 1
   * attempt — a student who could never qualify no matter what the admin did.
   */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await fetch('/api/participant/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();

      if (!json.success) {
        setErr(
          json.code === 'NOT_FOUND'
            ? 'That code was not found. Check it against your Round 1 screen.'
            : (json.error ?? 'Could not find you')
        );
        return;
      }

      const d = json.data;
      if (d.disqualified) {
        setErr('You have been removed from this round. Speak to the quiz master.');
        return;
      }
      if (!d.completedRound1) {
        setInfo('We found you, but no submitted Round 1 paper is on record yet.');
      }

      onJoined({
        id: d.participant.id,
        participantCode: d.participant.participantCode,
        name: d.participant.name,
        schoolName: d.participant.schoolName,
        language: d.participant.language === 'gujarati' ? 'gujarati' : 'english',
      });
    } catch (error) {
      // Not necessarily the network. This catch also swallows any exception
      // thrown while reading the response, and reporting that as a connection
      // problem sends people to check their wifi over a code fault. Log the
      // real cause so it is visible in the console during an event.
      console.error('Round 2 sign-in failed:', error);
      setErr('Could not sign you in. Try again \u2014 if it keeps failing, tell the quiz master.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SCHOOL_LOGO_URL} alt="" className="mb-4 h-20 w-20 object-contain" />
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#966700]">
            Round 02
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#0A0D14]">
            Enter your code
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5B6472]">
            Use the participant code from Round 1 so we continue with your score.
          </p>
        </div>

        {err && (
          <p className="mb-4 rounded-xl border border-[#B3261E]/40 bg-[#B3261E]/08 px-3.5 py-2.5 text-sm text-[#B3261E]">
            {err}
          </p>
        )}
        {info && (
          <p className="mb-4 rounded-xl border border-[#FFB000]/50 bg-[#FFB000]/15 px-3.5 py-2.5 text-sm text-[#7C5A00]">
            {info}
          </p>
        )}

        <Label>Participant code</Label>
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="MES0001"
          autoCapitalize="characters"
          autoComplete="off"
          className="mb-6 w-full rounded-xl border border-[#D7DAE1] bg-white/80 px-3.5 py-3 text-center font-mono text-xl tracking-[0.2em] text-[#0A0D14] outline-none transition-colors placeholder:text-[#5B6472]/40 focus:border-[#FFB000]"
        />

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center rounded-xl bg-[#0A0D14] py-4 text-base font-bold text-[#F4F5F7] transition-colors hover:bg-[#1C2230] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continue'}
        </button>

        <p className="mt-4 text-center text-xs leading-relaxed text-[#5B6472]/80">
          Round 2 is only for students who sat Round 1. If you have not done
          Round 1 yet, go back to the home page and start there.
        </p>
      </form>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5B6472]/80">
      {children}
    </span>
  );
}
