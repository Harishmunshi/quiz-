'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronUp, Crown, Medal, Minus } from 'lucide-react';
import { formatSeconds } from '@/lib/round2/live';

/**
 * The live leaderboard.
 *
 * The whole emotional payload of a live round is watching someone overtake
 * someone else, so that is the one thing this component is built around:
 *
 *   - Rows are `layout` animated. When the order changes, rows physically slide
 *     past each other with spring damping rather than snapping. The eye follows
 *     a name up the board, which is what makes a hall react.
 *   - A climb is announced twice — an arrow with the number of places gained,
 *     and a brief gold wash across the row that decays. Movement you can catch
 *     from the back of a room even if you looked away for a second.
 *   - Gold, silver and bronze are real materials, not just colours: each medal
 *     has its own gradient and ring so the top three read instantly at distance.
 *
 * Numbers use `tabular-nums` throughout. Proportional digits shift width as
 * scores tick, which makes a settling board look like it is still moving.
 */

export interface BoardEntry {
  rank: number;
  participantId: string;
  participantName: string;
  /** Unique; the name is not. This is what distinguishes two same-named students. */
  participantCode: string;
  schoolName: string;
  score: number;
  correctAnswers: number;
  totalTimeMs: number;
  lastQuestionCorrect: boolean | null;
  previousRank?: number | null;
  rankDelta?: number | null;
}

const MEDALS: Record<number, { ring: string; chip: string; label: string }> = {
  1: {
    ring: 'ring-2 ring-[#FFB000] shadow-[0_4px_24px_-4px_rgba(200,169,81,0.55)]',
    chip: 'bg-gradient-to-br from-[#FFE66D] via-[#FFB000] to-[#966700] text-[#3B2E08]',
    label: 'Gold',
  },
  2: {
    ring: 'ring-1 ring-[#A9B0B8]',
    chip: 'bg-gradient-to-br from-[#E8ECEF] via-[#B9C1C8] to-[#8A939B] text-[#2B3137]',
    label: 'Silver',
  },
  3: {
    ring: 'ring-1 ring-[#C08A5A]',
    chip: 'bg-gradient-to-br from-[#E9C199] via-[#C08A5A] to-[#8C6036] text-[#3A2413]',
    label: 'Bronze',
  },
};

export default function LiveLeaderboard({
  entries,
  big = false,
  highlightId = null,
}: {
  entries: BoardEntry[];
  /** Projector sizing. */
  big?: boolean;
  /** Ring this row — used on the student page to find yourself. */
  highlightId?: string | null;
}) {
  if (entries.length === 0) {
    return (
      <p className={`py-12 text-center text-[#5B6472]/70 ${big ? 'text-xl' : 'text-sm'}`}>
        Standings appear once the first question closes
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      <AnimatePresence initial={false}>
        {entries.map((e) => {
          const medal = MEDALS[e.rank];
          const climbed = (e.rankDelta ?? 0) > 0;
          const dropped = (e.rankDelta ?? 0) < 0;
          const isMe = highlightId === e.participantId;

          return (
            <motion.li
              key={e.participantId}
              layout
              layoutId={e.participantId}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{
                layout: { type: 'spring' as const, stiffness: 260, damping: 26 },
                default: { duration: 0.25 },
              }}
              className={[
                'relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3',
                big ? 'py-3 lg:gap-4 lg:px-4 lg:py-3.5' : 'py-3',
                medal
                  ? `border-transparent bg-white/85 ${medal.ring}`
                  : 'border-[#D7DAE1] bg-white/65',
                isMe && !medal ? 'ring-2 ring-[#0A0D14]/40' : '',
              ].join(' ')}
            >
              {/* A climb washes gold across the row, then fades. Catches the eye
                  even if you were looking elsewhere when the order changed. */}
              {climbed && (
                <motion.span
                  key={`wash-${e.rank}-${e.score}`}
                  initial={{ x: '-100%', opacity: 0.85 }}
                  animate={{ x: '100%', opacity: 0 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                  className="pointer-events-none absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-[#FFB000]/35 to-transparent"
                />
              )}

              {/* Rank / medal */}
              <span
                className={[
                  'relative flex shrink-0 items-center justify-center rounded-xl font-mono font-bold tabular-nums',
                  big ? 'h-11 w-11 text-xl lg:h-14 lg:w-14 lg:text-2xl' : 'h-10 w-10 text-base',
                  medal ? medal.chip : 'bg-[#E9EBEF] text-[#5B6472]',
                ].join(' ')}
              >
                {e.rank === 1 ? (
                  <Crown className={big ? 'h-7 w-7 lg:h-8 lg:w-8' : 'h-5 w-5'} />
                ) : medal ? (
                  <Medal className={big ? 'h-6 w-6 lg:h-7 lg:w-7' : 'h-4 w-4'} />
                ) : (
                  e.rank
                )}
                {/* Silver and bronze carry their number — the two medals read
                    alike at a glance. Inset rather than hung off the corner:
                    the row clips its overflow to contain the gold wash, which
                    was shaving the badge. */}
                {medal && e.rank !== 1 && (
                  <span className="absolute bottom-0.5 right-0.5 rounded-md bg-white/95 px-1 font-mono text-[10px] font-bold leading-tight text-[#5B6472] shadow-sm">
                    {e.rank}
                  </span>
                )}
              </span>

              {/* Name + school */}
              <div className="min-w-0 flex-1">
                <p
                  className={[
                    'truncate font-bold tracking-tight text-[#0A0D14]',
                    big ? 'text-lg lg:text-2xl' : 'text-base',
                  ].join(' ')}
                >
                  {e.participantName}
                </p>
                <p
                  className={[
                    'truncate text-[#5B6472]',
                    big ? 'text-sm lg:text-base' : 'text-[11px]',
                  ].join(' ')}
                >
                  {/* Code first, then school. Students genuinely share names —
                      three "Harish Munshi" rows on the hall screen with nothing
                      to separate them is not a readable result. */}
                  <span className="font-mono tracking-wide">{e.participantCode}</span>
                  {e.schoolName ? ` · ${e.schoolName}` : ''}
                </p>
              </div>

              {/* Movement since the previous question */}
              <span
                className={[
                  'flex shrink-0 items-center gap-0.5 font-mono font-bold tabular-nums',
                  big ? 'text-base lg:text-xl' : 'text-xs',
                  climbed ? 'text-[#1A7D70]' : dropped ? 'text-[#B3261E]/70' : 'text-[#5B6472]/35',
                ].join(' ')}
                title={
                  climbed
                    ? `Up ${e.rankDelta} place${e.rankDelta === 1 ? '' : 's'}`
                    : dropped
                      ? `Down ${Math.abs(e.rankDelta!)}`
                      : 'No change'
                }
              >
                {climbed ? (
                  <motion.span
                    key={`up-${e.rank}`}
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring' as const, stiffness: 400, damping: 18 }}
                    className="flex items-center"
                  >
                    <ChevronUp className={big ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
                    {e.rankDelta}
                  </motion.span>
                ) : dropped ? (
                  <span className="flex items-center">
                    <ChevronUp
                      className={`rotate-180 ${big ? 'h-5 w-5' : 'h-3.5 w-3.5'}`}
                    />
                    {Math.abs(e.rankDelta!)}
                  </span>
                ) : (
                  <Minus className={big ? 'h-4 w-4' : 'h-3 w-3'} />
                )}
              </span>

              {/* Verdict on the question just closed */}
              {e.lastQuestionCorrect !== null && (
                <span
                  className={[
                    'shrink-0 font-bold',
                    big ? 'text-2xl lg:text-3xl' : 'text-base',
                    e.lastQuestionCorrect ? 'text-[#1A7D70]' : 'text-[#B3261E]/45',
                  ].join(' ')}
                >
                  {e.lastQuestionCorrect ? '✓' : '✗'}
                </span>
              )}

              {/* Score + cumulative time */}
              <div className="shrink-0 text-right">
                <p
                  className={[
                    'font-mono font-bold tabular-nums text-[#0A0D14]',
                    big ? 'text-2xl lg:text-4xl' : 'text-xl',
                  ].join(' ')}
                >
                  {e.score}
                </p>
                <p
                  className={[
                    'font-mono tabular-nums text-[#5B6472]/70',
                    big ? 'text-xs lg:text-sm' : 'text-[10px]',
                  ].join(' ')}
                >
                  {formatSeconds(e.totalTimeMs)}
                </p>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}
