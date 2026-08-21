'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronRight, Loader2, Lock } from 'lucide-react';
import SequenceBuilder from '@/components/round2/SequenceBuilder';
import QuestionStage from '@/components/round2/QuestionStage';
import { formatSeconds, type OrderItem } from '@/lib/round2/live';
import type { StoredParticipant } from '@/lib/round2/session';
import { SCHOOLS } from '@/lib/schools';
import { SCHOOL_LOGO_URL } from '@/lib/theme';

/**
 * Round 2, one question, self-paced: /round2/q/1, /round2/q/2
 *
 * A competition in its own right, with no tie to Round 1. Anyone who turns up
 * enters with their school name and student ID — requiring a Round 1 code shut
 * out exactly the students Round 2 is for.
 *
 * Every active question is open for the whole event. The student presses Start,
 * THEIR clock begins, they arrange twelve items, submit, and see 11/12 and their
 * time straight away — no quiz master releasing questions, no waiting for a
 * reveal. The question's board has already updated by the time they look.
 *
 * Q1 and Q2 are unrelated. Separate clocks, separate submissions, separate
 * boards. Nothing here reads the other question's state.
 */

interface Question {
  id: string;
  questionNumber: number;
  titleEnglish: string;
  titleSecondary: string | null;
  promptEnglish: string;
  promptSecondary: string | null;
  items: OrderItem[];
  itemCount: number;
  marks: number;
  timeLimitSec: number;
}

interface Result {
  marks: number;
  totalMarks: number;
  correctPositions: number;
  isCorrect: boolean;
  responseTimeMs: number;
  late: boolean;
}

type Phase = 'loading' | 'signin' | 'ready' | 'answering' | 'done';

export default function Round2QuestionPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = use(params);
  const questionNumber = Number(n);

  const [participant, setParticipant] = useState<StoredParticipant | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [question, setQuestion] = useState<Question | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Round 2 deliberately remembers NOBODY.
  //
  // A whole school shares one or two phones here. Storing the signed-in student
  // meant the second student to pick up that phone landed already signed in as
  // the first — same id, same school — and their result was written against
  // somebody else's ID. Identity lives in React state only, so it dies with the
  // page and every arrival gets the form.
  //
  // Anything a previous student (or Round 1) left in storage is cleared on
  // sight, otherwise a stale entry from before this change would still leak in.
  useEffect(() => {
    try {
      window.localStorage.removeItem('mes-quiz-participant');
    } catch {
      /* private mode — nothing to clear */
    }
    setPhase('signin');
  }, []);

  // ── The clock ────────────────────────────────────────────────────
  // Counts UP from this student's own start, corrected for device clock drift.
  // Scoring is always recomputed server-side; this is only what they see.
  useEffect(() => {
    if (phase !== 'answering' || !startedAt) return;
    const began = new Date(startedAt).getTime();
    const tick = () => setElapsedMs(Math.max(0, Date.now() + clockOffset - began));
    tick();
    const t = setInterval(tick, 100);
    return () => clearInterval(t);
  }, [phase, startedAt, clockOffset]);

  const begin = useCallback(async () => {
    if (!participant) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/round2/live/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: participant.id, questionNumber }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Could not open this question');
        return;
      }
      const d = json.data;
      setClockOffset(new Date(d.serverNow).getTime() - Date.now());
      setQuestion(d.question as Question);

      if (d.alreadyAnswered && d.myAnswer) {
        setResult({
          marks: d.myAnswer.marks,
          totalMarks: d.question.marks,
          correctPositions: d.myAnswer.correctPositions,
          isCorrect: d.myAnswer.isCorrect,
          responseTimeMs: d.myAnswer.responseTimeMs,
          late: false,
        });
        setPhase('done');
        return;
      }
      setStartedAt(d.startedAt);
      setPhase('answering');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }, [participant, questionNumber]);

  const complete = question ? placed.length === question.itemCount : false;

  /** Pad an unfinished sequence so it is still a valid permutation. */
  const fullOrder = useCallback(
    (from: string[]) => {
      if (!question) return from;
      const used = new Set(from);
      return [...from, ...question.items.map((i) => i.key).filter((k) => !used.has(k))];
    },
    [question]
  );

  const submit = useCallback(
    async (order?: string[]) => {
      if (!participant || !question || busy) return;
      if (!order && !complete) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/round2/live/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: participant.id,
            questionId: question.id,
            submittedOrder: fullOrder(order ?? placed),
          }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error ?? 'Your answer was not saved. Try again.');
          return;
        }
        setResult({
          marks: json.data.marks,
          totalMarks: json.data.totalMarks ?? question.marks,
          correctPositions: json.data.correctPositions,
          isCorrect: json.data.isCorrect,
          responseTimeMs: json.data.responseTimeMs,
          late: Boolean(json.data.late),
        });
        setPhase('done');
      } catch {
        setError('Could not reach the server — your answer was not saved.');
      } finally {
        setBusy(false);
      }
    },
    [participant, question, placed, complete, busy, fullOrder]
  );

  // Send whatever they have when the limit runs out, rather than losing it.
  // Fires a little before the deadline so the request is in flight in time.
  const autoFired = useRef(false);
  const limitMs = (question?.timeLimitSec ?? 0) * 1000;
  useEffect(() => {
    if (phase !== 'answering' || autoFired.current || limitMs <= 0) return;
    if (elapsedMs < limitMs - 1500) return;
    if (placed.length === 0) return;
    autoFired.current = true;
    void submit(placed);
  }, [elapsedMs, limitMs, phase, placed, submit]);

  const remainingMs = limitMs > 0 ? Math.max(0, limitMs - elapsedMs) : null;
  const valid = Number.isFinite(questionNumber) && questionNumber > 0;

  const heading = useMemo(
    () => `Question ${String(questionNumber).padStart(2, '0')}`,
    [questionNumber]
  );

  return (
    <QuestionStage questionNumber={valid ? questionNumber : 0} full>
      <main className="flex min-h-screen flex-col">

        <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
          {!valid ? (
            <Msg>That is not a valid question number.</Msg>
          ) : phase === 'loading' ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-[#966700]" />
            </div>
          ) : phase === 'signin' ? (
            <>
              <Brand heading={heading} />
              <div className="mx-auto max-w-sm">
                <SignIn
                  onSignedIn={(p) => {
                    // Kept in memory only — never written to storage.
                    setParticipant(p);
                    setPhase('ready');
                  }}
                />
              </div>
            </>
          ) : phase === 'ready' ? (
            <>
              <Brand heading={heading} />
              <div className="mx-auto max-w-sm">
                {participant && (
                  <Who
                    p={participant}
                    onSwitch={() => {
                      setParticipant(null);
                      setError(null);
                      setPhase('signin');
                    }}
                  />
                )}
                {error && <Msg tone="error">{error}</Msg>}
                <button
                  onClick={begin}
                  disabled={busy}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFB000] py-4 text-base font-bold text-[#0A0D14] transition-all hover:bg-[#FFC33D] active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      Start {heading}
                      <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </button>
                <p className="mt-2 text-center text-[11px] text-[#5B6472]/80">
                  Your timer starts when you press Start.
                </p>
              </div>
            </>
          ) : phase === 'answering' && question ? (
            <>
              <div className="mb-5 flex items-baseline justify-between">
                <span
                  className={`font-mono text-4xl font-bold tabular-nums tracking-tight ${
                    remainingMs !== null && remainingMs < 15000
                      ? 'text-[#B3261E]'
                      : 'text-[#966700]'
                  }`}
                >
                  {Math.floor((remainingMs ?? elapsedMs) / 1000)}
                  <span className="text-xl opacity-60">
                    .{String(Math.floor(((remainingMs ?? elapsedMs) % 1000) / 10)).padStart(2, '0')}
                  </span>
                </span>
                <span className="font-mono text-xs text-[#5B6472]/70">
                  {placed.length} / {question.itemCount} placed
                </span>
              </div>

              <div className="mb-5 border-l-2 border-[#FFB000] pl-4">
                <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.28em] text-[#966700]">
                  {heading}
                </p>
                <h2 className="text-xl font-bold leading-snug text-[#0A0D14]">
                  {question.titleEnglish}
                </h2>
                <p className="mt-2 text-sm text-[#5B6472]">{question.promptEnglish}</p>
                {question.promptSecondary && (
                  <p className="mt-1.5 text-sm text-[#5B6472]/80">{question.promptSecondary}</p>
                )}
              </div>

              <SequenceBuilder
                items={question.items}
                placed={placed}
                onChange={setPlaced}
                disabled={busy}
              />

              {error && <Msg tone="error">{error}</Msg>}

              <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-[#FFB000]/20 bg-[#F4F5F7]/90 px-4 py-4 backdrop-blur-md">
                <button
                  onClick={() => submit()}
                  disabled={!complete || busy}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all ${
                    complete
                      ? 'bg-[#FFB000] text-[#0A0D14] hover:bg-[#FFC33D] active:scale-[0.98]'
                      : 'cursor-not-allowed bg-white/60 text-[#5B6472]/70'
                  }`}
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : complete ? (
                    <>
                      <Lock className="h-4 w-4" />
                      Submit my answer
                    </>
                  ) : (
                    `Place all ${question.itemCount} items`
                  )}
                </button>
                <p className="mt-2 text-center text-[11px] text-[#5B6472]/70">
                  One submission. If time runs out, whatever you have placed is sent
                  automatically.
                </p>
              </div>
            </>
          ) : phase === 'done' && result ? (
            <>
              <Brand heading={heading} />
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
                className="mx-auto max-w-sm rounded-2xl border border-[#FFB000]/45 bg-white/70 p-6 text-center"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#966700]">
                  Your score
                </p>
                <p className="mt-2 font-mono text-5xl font-black tabular-nums text-[#0A0D14]">
                  {result.marks}
                  <span className="text-2xl text-[#5B6472]/70">/{result.totalMarks}</span>
                </p>
                <p className="mt-2 font-mono text-sm tabular-nums text-[#5B6472]">
                  {formatSeconds(result.responseTimeMs)}
                </p>
                {result.late && (
                  <p className="mt-3 text-xs leading-relaxed text-[#7C5A00]">
                    This came in after the time limit, so it scores zero. It is still on
                    record.
                  </p>
                )}
                <p className="mt-4 text-xs leading-relaxed text-[#5B6472]">
                  {result.correctPositions} of {result.totalMarks} items were in the
                  right position.
                </p>
              </motion.div>
              {/* Nothing to press. The student sees their score and that is the
                  end of the screen.

                  There is deliberately no standings link and no handover
                  button: standings are the quiz master's to show on the
                  projector, and the page already remembers nobody, so simply
                  reopening the link gives the next student a blank form. A
                  button telling students to pass the phone on was answering a
                  question nobody asked. */}
              <p className="mx-auto mt-5 max-w-sm text-center text-[11px] leading-relaxed text-[#5B6472]/80">
                Your answer is recorded. You can close this page.
              </p>
            </>
          ) : (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-[#966700]" />
            </div>
          )}
        </div>
      </main>
    </QuestionStage>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────

function Brand({ heading }: { heading: string }) {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SCHOOL_LOGO_URL} alt="" className="mb-3 h-14 w-14 object-contain" />
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#966700]">
        Round 02 · {heading}
      </p>
      <h1 className="mt-1.5 text-3xl font-black leading-[0.95] tracking-tight text-[#0A0D14] sm:text-4xl">
        TARTIB-E<br />
        <span className="text-[#966700]">WAQIYAAT</span>
      </h1>
      <p className="mt-1.5 text-[11px] uppercase tracking-[0.3em] text-[#5B6472]/80">
        तरतीब-ए-वाक़िआत
      </p>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-[#5B6472]">
        Arrange 12 events in the correct order. Every item in its right place earns{' '}
        <span className="font-bold text-[#966700]">1 mark out of 12</span>.
      </p>
    </div>
  );
}

function Who({ p, onSwitch }: { p: StoredParticipant; onSwitch: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[#FFB000]/30 bg-white/60 px-3.5 py-3">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1A7D70]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#0A0D14]">{p.schoolName}</p>
        <p className="truncate font-mono text-[11px] text-[#5B6472]/80">{p.participantCode}</p>
      </div>
      {/* Correcting your own typo before the clock starts. A wrong ID would
          put the result on somebody else's row, and this is the last moment it
          can be fixed. */}
      <button
        type="button"
        onClick={onSwitch}
        className="shrink-0 rounded-lg border border-[#D7DAE1] bg-white/70 px-2.5 py-1.5 text-[11px] font-bold text-[#5B6472] transition-colors hover:bg-white"
      >
        Change
      </button>
    </div>
  );
}

function Msg({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'error' }) {
  return (
    <p
      className={
        tone === 'error'
          ? 'mt-4 rounded-xl border border-[#B3261E]/40 bg-[#B3261E]/08 px-3.5 py-2.5 text-sm text-[#B3261E]'
          : 'mt-4 rounded-xl border border-[#D7DAE1] bg-white/60 px-3.5 py-2.5 text-center text-sm text-[#5B6472]'
      }
    >
      {children}
    </p>
  );
}

/**
 * Round 2 entry: school name and student ID, and you are in.
 *
 * Deliberately NOT a Round 1 lookup. Round 2 is a separate competition with a
 * different set of students, so requiring a code issued during Round 1 shut out
 * exactly the people it is for. Anyone who turns up can enter.
 *
 * The ID doubles as the sign-in: typing an ID already on record resumes that
 * student rather than creating a second one, so a reload, a flat battery or a
 * borrowed phone puts them back where they were with their clock intact.
 */
function SignIn({ onSignedIn }: { onSignedIn: (p: StoredParticipant) => void }) {
  const [studentId, setStudentId] = useState('');
  // Only the SCHOOL is remembered, never the student. Everyone queueing on a
  // shared phone is from the same school, so this saves retyping it twenty
  // times, and it is visible and editable if the next person is not.
  const [school, setSchool] = useState('');

  useEffect(() => {
    try {
      setSchool(window.localStorage.getItem('mes-round2-school') ?? '');
    } catch {
      /* private mode */
    }
  }, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (studentId.trim().length < 3 || school.trim().length < 2) {
      setErr('Enter your school name and your student ID.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/participant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantCode: studentId.trim(),
          schoolName: school.trim(),
          language: 'english',
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setErr(json.error ?? 'Could not sign you in.');
        return;
      }
      try {
        window.localStorage.setItem('mes-round2-school', school.trim());
      } catch {
        /* private mode — they just retype it */
      }
      const p = json.participant;
      onSignedIn({
        id: p.id,
        participantCode: p.participantCode,
        name: p.name,
        schoolName: p.schoolName,
        language: p.language === 'gujarati' ? 'gujarati' : 'english',
      });
    } catch (error) {
      console.error('Round 2 sign-in failed:', error);
      setErr('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      {err && <Msg tone="error">{err}</Msg>}

      <span className="mb-1.5 mt-3 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5B6472]/80">
        Student ID
      </span>
      <input
        required
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        placeholder="e.g. M.E.S.B S-1"
        autoCapitalize="characters"
        autoComplete="off"
        className="mb-4 w-full rounded-xl border border-[#D7DAE1] bg-white/80 px-3.5 py-3 text-center font-mono text-xl tracking-[0.2em] text-[#0A0D14] outline-none focus:border-[#FFB000]"
      />

      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5B6472]/80">
        School
      </span>
      {/* Picked, not typed. Free text produced one school under six different
          spellings on the projector, and several students typed their own name
          into it. "Other" keeps the door open for a school nobody listed. */}
      <select
        value={SCHOOLS.some((s) => s.name === school) || school === '' ? school : '__other'}
        onChange={(e) => setSchool(e.target.value === '__other' ? ' ' : e.target.value)}
        className="mb-3 w-full rounded-xl border border-[#D7DAE1] bg-white/80 px-3.5 py-3 text-base text-[#0A0D14] outline-none focus:border-[#FFB000]"
      >
        <option value="">Choose your school…</option>
        {SCHOOLS.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name}
          </option>
        ))}
        <option value="__other">Other — not listed</option>
      </select>

      {!SCHOOLS.some((s) => s.name === school) && school !== '' && (
        <input
          required
          value={school.trim()}
          onChange={(e) => setSchool(e.target.value)}
          placeholder="Type your school name"
          autoComplete="organization"
          className="mb-4 w-full rounded-xl border border-[#D7DAE1] bg-white/80 px-3.5 py-3 text-center text-base text-[#0A0D14] outline-none focus:border-[#FFB000]"
        />
      )}

      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center rounded-xl bg-[#0A0D14] py-4 text-base font-bold text-[#F4F5F7] hover:bg-[#1C2230] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Submit'}
      </button>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-[#5B6472]/80">
        Round 2 is open to everyone — you do not need to have sat Round 1. Use the
        same student ID if you come back, so your result stays with you.
      </p>
    </form>
  );
}
