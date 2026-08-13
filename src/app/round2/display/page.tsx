'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, Users } from 'lucide-react';
import { formatSeconds } from '@/lib/round2/live';
import { useCountdown, useLiveRound2 } from '@/lib/round2/useLiveRound2';

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

interface Entry {
  rank: number;
  participantId: string;
  participantName: string;
  schoolName: string;
  score: number;
  correctAnswers: number;
  totalTimeMs: number;
  lastQuestionCorrect: boolean | null;
}

export default function Round2DisplayPage() {
  const { live, clockOffset } = useLiveRound2(null);
  const [board, setBoard] = useState<Entry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);

  const state = live?.state ?? 'idle';
  const q = live?.question ?? null;

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
        setBoard(json.data as Entry[]);
        setTotalPlayers(json.meta?.totalParticipants ?? 0);
      }
    } catch {
      // Keep the last good frame on screen rather than flashing an error at a hall.
    }
  }, []);

  useEffect(() => {
    pollBoard();
    const t = setInterval(pollBoard, 1500);
    return () => clearInterval(t);
  }, [pollBoard]);

  return (
    <main
      className="min-h-screen p-6 lg:p-10"
      style={{ background: 'linear-gradient(180deg, #F7F2E7 0%, #EEE3CC 100%)' }}
    >
      {/* Header */}
      <div className="mb-8 flex items-end justify-between border-b border-[#C8A951]/20 pb-5">
        <div>
          <p className="font-mono text-xs tracking-[0.4em] text-[#8A6A1C]/80 lg:text-sm">
            M.E.S. ENGLISH MEDIUM SCHOOL
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#063B2D] lg:text-6xl">
            Round 2
          </h1>
        </div>

        <div className="flex items-end gap-8 lg:gap-14">
          <div className="text-right">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[#5A6B5E]/70 lg:text-xs">
              QUESTION
            </p>
            <p className="font-mono text-4xl font-bold tabular-nums text-[#8A6A1C] lg:text-6xl">
              {String(live?.currentQuestionNumber ?? 0).padStart(2, '0')}
              <span className="text-2xl text-[#5A6B5E]/50 lg:text-3xl">
                /{String(live?.totalQuestions ?? 0).padStart(2, '0')}
              </span>
            </p>
          </div>

          {state === 'open' && remainingMs !== null && q ? (
            <div className="text-right">
              <p className="font-mono text-[10px] tracking-[0.3em] text-[#5A6B5E]/70 lg:text-xs">
                TIME
              </p>
              <p
                className={`font-mono text-4xl font-bold tabular-nums lg:text-6xl ${
                  remainingMs < 15000 ? 'text-[#B3261E]' : 'text-[#063B2D]'
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
              <p className="font-mono text-[10px] tracking-[0.3em] text-[#5A6B5E]/70 lg:text-xs">
                STATUS
              </p>
              <p className="font-mono text-2xl font-bold tracking-tight text-[#8A6A1C] lg:text-4xl">
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
            className="h-full bg-gradient-to-r from-[#C8A951] to-[#e8d18a]"
            style={{
              width: `${(remainingMs / (q.timeLimitSec * 1000)) * 100}%`,
              transition: 'none',
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
                <Trophy className="mb-8 h-20 w-20 text-[#8A6A1C]/40" />
                <p className="text-4xl font-bold tracking-tight text-[#063B2D] lg:text-5xl">
                  Standing by
                </p>
                <p className="mt-4 font-mono text-lg tabular-nums text-[#5A6B5E]/80">
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
                <div className="mb-7 border-l-2 border-[#C8A951] pl-6">
                  <h2 className="text-3xl font-bold leading-tight tracking-tight text-[#063B2D] lg:text-5xl">
                    {q.titleEnglish}
                  </h2>
                  <p className="mt-3 text-lg leading-relaxed text-[#5A6B5E] lg:text-2xl">
                    {q.promptEnglish}
                  </p>
                </div>

                {/* Before the reveal: the item set. After: the correct sequence. */}
                {state !== 'revealed' || !live?.correctOrder ? (
                  <div className="flex flex-wrap gap-2.5">
                    {q.items.map((item) => (
                      <span
                        key={item.key}
                        className="rounded-xl border border-[#D4C5A9] bg-white/60 px-4 py-2.5 text-lg text-[#063B2D]/85 lg:text-2xl"
                      >
                        {item.en}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p className="mb-4 font-mono text-xs tracking-[0.3em] text-[#0A7D52] lg:text-sm">
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
                            className="flex items-center gap-3 rounded-lg border border-[#0A7D52]/30 bg-[#0A7D52]/08 px-3 py-2"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0A7D52] font-mono text-sm font-bold tabular-nums text-[#063B2D]">
                              {i + 1}
                            </span>
                            <span className="truncate text-base text-[#063B2D] lg:text-xl">
                              {item?.en ?? key}
                            </span>
                          </motion.li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                {/* Submission counter */}
                <div className="mt-8 flex items-center gap-3 border-t border-[#D4C5A9] pt-5">
                  <Users className="h-5 w-5 text-[#8A6A1C]/80" />
                  <span className="font-mono text-2xl font-bold tabular-nums text-[#063B2D] lg:text-3xl">
                    {live?.answerCount ?? 0}
                    <span className="text-[#5A6B5E]/50">/{totalPlayers}</span>
                  </span>
                  <span className="font-mono text-xs tracking-[0.2em] text-[#5A6B5E]/70">
                    SUBMITTED
                  </span>
                  <div className="ml-auto h-1.5 w-40 overflow-hidden rounded-full bg-white/60">
                    <motion.div
                      className="h-full bg-[#C8A951]"
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
          <div className="mb-5 flex items-baseline gap-3 border-b border-[#C8A951]/20 pb-3">
            <Trophy className="h-6 w-6 text-[#8A6A1C]" />
            <h3 className="text-2xl font-bold tracking-tight text-[#063B2D] lg:text-3xl">
              Leaderboard
            </h3>
            <span className="ml-auto font-mono text-xs tracking-[0.2em] text-[#5A6B5E]/70">
              TOP {TOP_N}
            </span>
          </div>

          {board.length === 0 ? (
            <p className="py-16 text-center text-lg text-[#5A6B5E]/60">
              Standings appear after the first question closes
            </p>
          ) : (
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {board.map((e) => (
                  <motion.div
                    key={e.participantId}
                    layout
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                    className={`flex items-center gap-4 rounded-xl px-3.5 py-3 ${
                      e.rank === 1
                        ? 'bg-[#C8A951]/20 ring-1 ring-[#C8A951]/60'
                        : 'bg-white/60'
                    }`}
                  >
                    <span
                      className={`w-9 shrink-0 text-center font-mono text-2xl font-bold tabular-nums lg:text-3xl ${
                        e.rank === 1 ? 'text-[#8A6A1C]' : 'text-[#5A6B5E]/70'
                      }`}
                    >
                      {e.rank}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold text-[#063B2D] lg:text-2xl">
                        {e.participantName}
                      </p>
                      <p className="font-mono text-[11px] tabular-nums text-[#5A6B5E]/70 lg:text-xs">
                        {e.schoolName} · {formatSeconds(e.totalTimeMs)}
                      </p>
                    </div>

                    {e.lastQuestionCorrect !== null && (
                      <span
                        className={`shrink-0 text-lg ${
                          e.lastQuestionCorrect ? 'text-[#0A7D52]' : 'text-[#B3261E]/60'
                        }`}
                      >
                        {e.lastQuestionCorrect ? '✓' : '✗'}
                      </span>
                    )}

                    <span className="w-10 shrink-0 text-right font-mono text-3xl font-bold tabular-nums text-[#8A6A1C] lg:text-4xl">
                      {e.score}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
