'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Lock,
  Trophy,
  Users,
} from 'lucide-react';
import QuestionStage from '@/components/round2/QuestionStage';
import { loadParticipant, saveParticipant, type StoredParticipant } from '@/lib/round2/session';
import { SCHOOL_LOGO_URL } from '@/lib/theme';

/**
 * A landing page of its own for each Round 2 question: /round2/q/1, /round2/q/2
 *
 * WHY THESE EXIST SEPARATELY
 * Round 2 is run as separate contests — Q1 has its own winner and its own board,
 * Q2 has its own. One shared /round2 door could not express that: it showed
 * whatever the quiz master happened to have open, so there was no address to put
 * on the projector for "Question 1" and no way to send a student straight to it.
 *
 * Each page carries its own branding, its own sign-in, its own live status and a
 * link to its own standings.
 *
 * WHAT IT DOES NOT DO
 * It does not answer the question — /round2 does that, and this hands over to it.
 * Round 2 releases one question at a time, so a student can only answer Q1 while
 * the quiz master is holding Q1 open. This page says plainly which of those
 * states the question is in rather than letting them find out by tapping.
 */

interface LiveState {
  state: 'idle' | 'open' | 'locked' | 'revealed';
  currentQuestionNumber: number;
  totalQuestions: number;
  question: { questionNumber: number; titleEnglish: string; itemCount: number } | null;
  answerCount: number;
}

interface RosterMeta {
  total: number;
  joined: number;
  schools: string[];
}

export default function Round2QuestionLanding({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = use(params);
  const questionNumber = Number(n);

  const [participant, setParticipant] = useState<StoredParticipant | null>(null);
  const [checked, setChecked] = useState(false);
  const [live, setLive] = useState<LiveState | null>(null);
  const [roster, setRoster] = useState<RosterMeta | null>(null);

  useEffect(() => {
    setParticipant(loadParticipant());
    setChecked(true);
  }, []);

  const poll = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        fetch('/api/round2/live/state', { cache: 'no-store' }).then((x) => x.json()),
        fetch('/api/round2/live/roster', { cache: 'no-store' }).then((x) => x.json()),
      ]);
      if (s?.success) setLive(s.data as LiveState);
      if (r?.success) setRoster(r.meta as RosterMeta);
    } catch {
      /* the page is still usable without live status */
    }
  }, []);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [poll]);

  const isLive = live?.currentQuestionNumber === questionNumber && live?.state === 'open';
  const isFinished =
    live != null &&
    (live.currentQuestionNumber > questionNumber ||
      (live.currentQuestionNumber === questionNumber &&
        (live.state === 'locked' || live.state === 'revealed')));

  const valid = Number.isFinite(questionNumber) && questionNumber > 0;

  return (
    <QuestionStage questionNumber={valid ? questionNumber : 0} full>
      <main className="flex min-h-screen flex-col">
        <a
          href="/"
          className="absolute left-4 top-4 z-40 flex items-center gap-1.5 rounded-xl border border-[#FFB000]/35 bg-white/70 px-2.5 py-1.5 text-sm font-semibold text-[#0A0D14] transition-colors hover:bg-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Main site
        </a>

        <div className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="w-full max-w-sm">
            {/* ── Branding ─────────────────────────────────────────── */}
            <div className="mb-7 flex flex-col items-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SCHOOL_LOGO_URL} alt="" className="mb-4 h-16 w-16 object-contain" />
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#966700]">
                Round 02 · Question {String(questionNumber).padStart(2, '0')}
              </p>
              <h1 className="mt-2 text-4xl font-black leading-[0.95] tracking-tight text-[#0A0D14] sm:text-5xl">
                TARTIB-E
                <br />
                <span className="text-[#966700]">WAQIYAAT</span>
              </h1>
              <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[#5B6472]/80">
                तरतीब-ए-वाक़िआत
              </p>

              {live?.question && live.question.questionNumber === questionNumber && (
                <p className="mt-4 text-base font-bold text-[#0A0D14]">
                  {live.question.titleEnglish}
                </p>
              )}

              <p className="mt-3 text-sm leading-relaxed text-[#5B6472]">
                Arrange 12 events in the correct order. Every item in its right
                place earns{' '}
                <span className="font-bold text-[#966700]">1 mark out of 12</span>.
              </p>
            </div>

            {!valid ? (
              <p className="rounded-xl border border-[#B3261E]/40 bg-[#B3261E]/08 px-4 py-3 text-center text-sm text-[#B3261E]">
                That is not a valid question number.
              </p>
            ) : !checked ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-[#966700]" />
              </div>
            ) : !participant ? (
              <SignIn onSignedIn={(p) => { saveParticipant(p); setParticipant(p); }} />
            ) : (
              <>
                {/* Who you are */}
                <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-[#FFB000]/30 bg-white/60 px-3.5 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1A7D70]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#0A0D14]">
                      {participant.schoolName}
                    </p>
                    <p className="truncate font-mono text-[11px] text-[#5B6472]/80">
                      {participant.participantCode}
                    </p>
                  </div>
                </div>

                {/* Live status for THIS question */}
                <StatusPanel
                  questionNumber={questionNumber}
                  isLive={isLive}
                  isFinished={isFinished}
                  live={live}
                />
              </>
            )}

            {/* Who is in the room. The leaderboard only shows a student once
                they have answered, so before the first question it is empty and
                the hall is a guess. */}
            {roster && (
              <div className="mt-6 rounded-xl border border-[#FFB000]/25 bg-white/50 px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-[#966700]" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#966700]">
                    In the room
                  </p>
                  <span className="ml-auto font-mono text-xs tabular-nums text-[#0A0D14]">
                    {roster.joined} / {roster.total}
                  </span>
                </div>
                {roster.schools.length > 0 && (
                  <p className="mt-1.5 truncate text-[11px] text-[#5B6472]/80">
                    {roster.schools.join(' · ')}
                  </p>
                )}
              </div>
            )}

            <a
              href={`/round2/board?q=${questionNumber}`}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[#FFB000]/35 bg-white/60 py-3 text-sm font-bold text-[#0A0D14] transition-colors hover:bg-white"
            >
              <Trophy className="h-4 w-4 text-[#966700]" />
              Question {questionNumber} standings
            </a>
          </div>
        </div>
      </main>
    </QuestionStage>
  );
}

/** What this question is doing right now, and the way in if there is one. */
function StatusPanel({
  questionNumber,
  isLive,
  isFinished,
  live,
}: {
  questionNumber: number;
  isLive: boolean;
  isFinished: boolean;
  live: LiveState | null;
}) {
  if (isLive) {
    return (
      <motion.a
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        href="/round2"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFB000] py-4 text-base font-bold text-[#0A0D14] transition-all hover:bg-[#FFC33D] active:scale-[0.98]"
      >
        Answer Question {questionNumber}
        <ChevronRight className="h-5 w-5" />
      </motion.a>
    );
  }

  if (isFinished) {
    return (
      <div className="rounded-xl border border-[#D7DAE1] bg-white/60 px-4 py-5 text-center">
        <Lock className="mx-auto mb-2 h-6 w-6 text-[#5B6472]/60" />
        <p className="text-sm font-bold text-[#0A0D14]">
          Question {questionNumber} is closed
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-[#5B6472]">
          Submissions for this question have finished. Check the standings below.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#FFB000]/45 bg-[#FFB000]/12 px-4 py-5 text-center">
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        className="mx-auto mb-2 w-fit"
      >
        <Loader2 className="h-6 w-6 text-[#966700]" />
      </motion.div>
      <p className="text-sm font-bold text-[#0A0D14]">
        Waiting for Question {questionNumber}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-[#5B6472]">
        {live && live.currentQuestionNumber > 0
          ? `The quiz master is on Question ${live.currentQuestionNumber}. Keep this page open — it updates on its own.`
          : 'Round 2 has not started yet. Keep this page open — it updates on its own.'}
      </p>
    </div>
  );
}

/**
 * Sign-in by Round 1 code. Identical contract to the one on /round2, and it
 * writes the same localStorage key, so signing in here means the student is
 * already signed in when they hand over to the answering screen.
 */
function SignIn({ onSignedIn }: { onSignedIn: (p: StoredParticipant) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
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
      onSignedIn({
        id: d.participant.id,
        participantCode: d.participant.participantCode,
        name: d.participant.name,
        schoolName: d.participant.schoolName,
        language: d.participant.language === 'gujarati' ? 'gujarati' : 'english',
      });
    } catch (error) {
      console.error('Round 2 sign-in failed:', error);
      setErr('Could not sign you in. Tell the quiz master if it keeps failing.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      {err && (
        <p className="mb-4 rounded-xl border border-[#B3261E]/40 bg-[#B3261E]/08 px-3.5 py-2.5 text-sm text-[#B3261E]">
          {err}
        </p>
      )}
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5B6472]/80">
        Student code
      </span>
      <input
        required
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="MES0001"
        autoCapitalize="characters"
        autoComplete="off"
        className="mb-4 w-full rounded-xl border border-[#D7DAE1] bg-white/80 px-3.5 py-3 text-center font-mono text-xl tracking-[0.2em] text-[#0A0D14] outline-none transition-colors placeholder:text-[#5B6472]/40 focus:border-[#FFB000]"
      />
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center rounded-xl bg-[#0A0D14] py-4 text-base font-bold text-[#F4F5F7] transition-colors hover:bg-[#1C2230] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign in'}
      </button>
    </form>
  );
}
