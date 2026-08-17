'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, Users } from 'lucide-react';
import { useCountdown, useLiveRound2 } from '@/lib/round2/useLiveRound2';
import LiveLeaderboard, { type BoardEntry } from '@/components/round2/LiveLeaderboard';
import QuestionStage, { themeForQuestion } from '@/components/round2/QuestionStage';

/**
 * Round 2 projector board — the screen shown on the hall's big display.
 *
 * Read-only and unauthenticated by design: it never receives the correct
 * sequence until the quiz master reveals, so there is nothing here a student
 * could exploit by loading the URL on their phone.
 *
 * Sized to be read from the back of a hall.
 */

const TOP_N = 10;

export default function Round2DisplayPage() {
  const { live, clockOffset } = useLiveRound2(null);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const state = live?.state ?? 'idle';
  const q = live?.question ?? null;
  // The hall's accent for this question — same one the phones are showing.
  const theme = themeForQuestion(live?.currentQuestionNumber ?? 0);

  const remainingMs = useCountdown(
    live?.openedAt ?? null,
    q?.timeLimitSec ?? live?.questionSeconds ?? 0,
    clockOffset,
    state === 'open'
  );

  const pollBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/round2/live/leaderboard?limit=${TOP_N}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) {
        setBoard(json.data as BoardEntry[]);
        setTotalPlayers(json.meta?.totalParticipants ?? 0);
      }
    } catch {
      // Keep the last good frame on screen rather than flashing an error at a hall.
    }
  }, []);

  /**
   * The board is refetched when the round actually moves — a question opening,
   * locking, revealing, or advancing — rather than on a fixed 1.5s timer.
   *
   * Standings cannot change at any other moment: a question only scores once
   * the quiz master closes it. Polling a full aggregate over every participant
   * forty times a minute was paying for an answer that was identical thirty-nine
   * of those times. Reacting to the transition instead is both cheaper and
   * quicker off the mark, because the fetch fires the instant the state flips
   * rather than up to 1.5s afterwards.
   */
  useEffect(() => {
    pollBoard();
  }, [pollBoard, state, live?.currentQuestionNumber]);

  // A slow heartbeat underneath, so a board left running through a manual
  // database edit or a missed transition still comes right on its own.
  useEffect(() => {
    const t = setInterval(pollBoard, 8000);
    return () => clearInterval(t);
  }, [pollBoard]);

  return (
    <QuestionStage questionNumber={live?.currentQuestionNumber ?? 0} full>
      <main className="min-h-screen p-6 lg:p-10">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between border-b border-[#FFB000]/20 pb-5">
        <div>
          <p className="font-mono text-xs tracking-[0.4em] text-[#966700]/80 lg:text-sm">
            M.E.S. ENGLISH MEDIUM SCHOOL
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#0A0D14] lg:text-6xl">
            Round 2
          </h1>
        </div>

        <div className="flex items-end gap-8 lg:gap-14">
          <div className="text-right">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[#5B6472]/70 lg:text-xs">
              QUESTION
            </p>
            <p
              className="font-mono text-4xl font-bold tabular-nums lg:text-6xl"
              style={{ color: theme.ink }}
            >
              {String(live?.currentQuestionNumber ?? 0).padStart(2, '0')}
              <span className="text-2xl text-[#5B6472]/50 lg:text-3xl">
                /{String(live?.totalQuestions ?? 0).padStart(2, '0')}
              </span>
            </p>
          </div>

          {state === 'open' && remainingMs !== null && q ? (
            <div className="text-right">
              <p className="font-mono text-[10px] tracking-[0.3em] text-[#5B6472]/70 lg:text-xs">
                TIME
              </p>
              <p
                className={`font-mono text-4xl font-bold tabular-nums lg:text-6xl ${
                  remainingMs < 15000 ? 'text-[#B3261E]' : 'text-[#0A0D14]'
                }`}
              >
                {Math.floor(remainingMs / 1000)}
                <span className="text-2xl opacity-50 lg:text-3xl">
                  .{String(Math.floor((remainingMs % 1000) / 10)).padStart(2, '0')}
                </span>
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p className="font-mono text-[10px] tracking-[0.3em] text-[#5B6472]/70 lg:text-xs">
                STATUS
              </p>
              <p className="font-mono text-2xl font-bold tracking-tight text-[#966700] lg:text-4xl">
                {state === 'locked' ? 'CLOSED' : state === 'revealed' ? 'REVEALED' : 'STANDBY'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Countdown rule */}
      {state === 'open' && remainingMs !== null && q && (
        <div className="mb-8 h-1 w-full bg-white/60">
          <div
            className="h-full"
            data-accent={theme.name}
            style={{
              width: `${(remainingMs / (q.timeLimitSec * 1000)) * 100}%`,
              transition: 'none',
              background: `linear-gradient(90deg, ${theme.ink}, ${theme.accent})`,
            }}
          />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        {/* ── Question ─────────────────────────────────────────────── */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {state === 'idle' || !q ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex min-h-[420px] flex-col items-center justify-center text-center"
              >
                <Trophy className="mb-8 h-20 w-20 text-[#966700]/40" />
                <p className="text-4xl font-bold tracking-tight text-[#0A0D14] lg:text-5xl">
                  Standing by
                </p>
                <p className="mt-4 font-mono text-lg tabular-nums text-[#5B6472]/80">
                  {totalPlayers} participant{totalPlayers === 1 ? '' : 's'} ready
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={`q-${live?.currentQuestionNumber}-${state}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-7 border-l-2 pl-6" style={{ borderColor: theme.accent }}>
                  <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#0A0D14] lg:text-5xl">
                    {q.titleEnglish}
                  </h2>
                  <p className="mt-3 text-lg leading-relaxed text-[#5B6472] lg:text-2xl">
                    {q.promptEnglish}
                  </p>
                </div>

                {/* Before the reveal: the item set. After: the correct sequence. */}
                {state !== 'revealed' || !live?.correctOrder ? (
                  <div className="flex flex-wrap gap-2.5">
                    {q.items.map((item) => (
                      <span
                        key={item.key}
                        className="rounded-xl border border-[#2DD4BF]/45 bg-[#2DD4BF]/12 px-4 py-2.5 text-lg text-[#0A0D14] lg:text-2xl"
                      >
                        {item.en}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p className="mb-4 font-mono text-xs tracking-[0.3em] text-[#1A7D70] lg:text-sm">
                      CORRECT SEQUENCE
                    </p>
                    <ol className="grid gap-1.5 sm:grid-cols-2">
                      {live.correctOrder.map((key, i) => {
                        const item = q.items.find((it) => it.key === key);
                        return (
                          <motion.li
                            key={key}
                            initial={{ opacity: 0, x: -14 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.07, duration: 0.3 }}
                            className="flex items-center gap-3 rounded-lg border border-[#1A7D70]/30 bg-[#1A7D70]/08 px-3 py-2"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1A7D70] font-mono text-sm font-bold tabular-nums text-[#0A0D14]">
                              {i + 1}
                            </span>
                            <span className="truncate text-base text-[#0A0D14] lg:text-xl">
                              {item?.en ?? key}
                            </span>
                          </motion.li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                {/* Submission counter */}
                <div className="mt-8 flex items-center gap-3 border-t border-[#D7DAE1] pt-5">
                  <Users className="h-5 w-5 text-[#966700]/80" />
                  <span className="font-mono text-2xl font-bold tabular-nums text-[#0A0D14] lg:text-3xl">
                    {live?.answerCount ?? 0}
                    <span className="text-[#5B6472]/50">/{totalPlayers}</span>
                  </span>
                  <span className="font-mono text-xs tracking-[0.2em] text-[#5B6472]/70">
                    SUBMITTED
                  </span>
                  <div className="ml-auto h-1.5 w-40 overflow-hidden rounded-full bg-white/60">
                    <motion.div
                      className="h-full bg-[#FFB000]"
                      animate={{
                        width: `${
                          totalPlayers ? ((live?.answerCount ?? 0) / totalPlayers) * 100 : 0
                        }%`,
                      }}
                      transition={{ duration: 0.35 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Leaderboard ──────────────────────────────────────────── */}
        <div className="lg:col-span-5">
          <div className="mb-5 flex items-baseline gap-3 border-b border-[#FFB000]/20 pb-3">
            <Trophy className="h-6 w-6 text-[#966700]" />
            <h3 className="text-2xl font-bold tracking-tight text-[#0A0D14] lg:text-3xl">
              Leaderboard
            </h3>
            <span className="ml-auto font-mono text-xs tracking-[0.2em] text-[#5B6472]/70">
              TOP {TOP_N}
            </span>
          </div>

          <LiveLeaderboard entries={board} big />
        </div>
      </div>
      </main>
    </QuestionStage>
  );
}
