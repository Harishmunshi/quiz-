'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, Trophy } from 'lucide-react';
import { formatSeconds } from '@/lib/round2/live';
import { SCHOOL_LOGO_URL } from '@/lib/theme';
import { SECTIONS, type SectionId } from '@/lib/sections';

/**
 * Per-question Round 2 standings: /round2/board
 *
 * Round 2 is run as separate contests — Q1 has a winner and Q2 has a winner —
 * so this shows one question at a time rather than a total. The cumulative board
 * still exists on the projector; this is the one you put up between questions.
 *
 *   /round2/board        opens on Q1
 *   /round2/board?q=2    opens on Q2
 *
 * Public and read-only. Polls every 3s; nothing here can write.
 */

interface Row {
  rank: number;
  participantId: string;
  participantCode: string;
  participantName: string;
  schoolName: string;
  isCorrect: boolean;
  correctPositions: number;
  responseTimeMs: number;
  marks: number;
}

interface Meta {
  questionNumber: number;
  questionTitle: string;
  answered: number;
  correct: number;
}

const POLL_MS = 3000;

export default function Round2BoardPage() {
  const [q, setQ] = useState(1);
  const [section, setSection] = useState<SectionId | 'all'>('all');
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [available, setAvailable] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Honour ?q= on first paint without needing a Suspense boundary.
  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get('q'));
    if (Number.isFinite(n) && n > 0) setQ(n);
  }, []);

  // Which questions are in play. Reads the live state rather than assuming
  // 1..3, so the emergency question appears here only once it is released.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/round2/live/state', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled || !json.success) return;
        const total = json.data.totalQuestions ?? 0;
        setAvailable(Array.from({ length: total }, (_, i) => i + 1));
      } catch {
        /* the board still works with whatever ?q= was asked for */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    try {
      const qs = `question=${q}${section === 'all' ? '' : `&section=${section}`}`;
      const res = await fetch(`/api/round2/live/leaderboard?${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Could not load the standings');
        setRows([]);
        setMeta(null);
        return;
      }
      setRows(json.data as Row[]);
      setMeta(json.meta as Meta);
      setError(null);
    } catch {
      setError('Could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [q, section]);

  useEffect(() => {
    setLoading(true);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <main className="min-h-screen bg-[#F4F5F7]">
      <header className="sticky top-0 z-20 border-b border-[#FFB000]/25 bg-[#F4F5F7]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <a
            href="/"
            aria-label="Back to the main site"
            className="flex shrink-0 items-center justify-center rounded-xl border border-[#FFB000]/35 bg-white/70 p-2 text-[#0A0D14] transition-colors hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </a>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SCHOOL_LOGO_URL} alt="" className="h-8 w-8 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#966700]">
              Tartib-e-Waqiyaat
            </p>
            <p className="truncate text-sm font-bold text-[#0A0D14]">
              {meta ? `Q${meta.questionNumber} — ${meta.questionTitle}` : 'Round 2 standings'}
            </p>
          </div>
          {meta && (
            <span className="shrink-0 rounded-full border border-[#FFB000]/30 px-3 py-1 font-mono text-xs tabular-nums text-[#966700]">
              {meta.answered} answered
            </span>
          )}
        </div>

        {/* Age group. Juniors and seniors are separate competitions, so the
            board shows one at a time rather than a mixed ranking. */}
        <div className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-4 pb-2">
          {([{ id: 'all', label: 'All' }, ...SECTIONS] as const).map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSection(sec.id as SectionId | 'all')}
              aria-current={sec.id === section}
              className={[
                'shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition-all',
                sec.id === section
                  ? 'border-[#966700] bg-[#FFB000]/20 text-[#7C5A00]'
                  : 'border-[#D7DAE1] bg-white/60 text-[#5B6472] hover:bg-white',
              ].join(' ')}
            >
              {'boardTitle' in sec ? sec.boardTitle.replace(' Leaderboard', '') : sec.label}
            </button>
          ))}
        </div>

        {/* One tab per question in play. Each is its own contest. */}
        {available.length > 1 && (
          <div className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-4 pb-2.5">
            {available.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQ(n)}
                aria-current={n === q}
                className={[
                  'shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition-all',
                  n === q
                    ? 'border-[#0A0D14] bg-[#0A0D14] text-[#F4F5F7]'
                    : 'border-[#D7DAE1] bg-white/60 text-[#5B6472] hover:bg-white',
                ].join(' ')}
              >
                Question {n}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#966700]" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-[#B3261E]/40 bg-[#B3261E]/08 px-4 py-3 text-sm text-[#B3261E]">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <Trophy className="mb-5 h-12 w-12 text-[#966700]/40" />
            <h2 className="text-xl font-bold text-[#0A0D14]">No answers yet</h2>
            <p className="mt-2 max-w-xs text-sm text-[#5B6472]">
              Standings appear here as students lock in their sequences.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#FFB000]/25 bg-white/70">
            <AnimatePresence initial={false}>
              {rows.map((r) => (
                <motion.div
                  key={r.participantId}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 border-b border-[#D7DAE1]/60 px-4 py-3 last:border-b-0"
                >
                  <span
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      r.rank === 1
                        ? 'bg-[#FFB000] text-[#3B2E08]'
                        : r.rank === 2
                          ? 'bg-[#C0C0C0] text-[#0A0D14]'
                          : r.rank === 3
                            ? 'bg-[#CD7F32] text-white'
                            : 'bg-[#EDEFF3] text-[#5B6472]',
                    ].join(' ')}
                  >
                    {r.rank}
                  </span>

                  {/* School first, code small beneath — the code is what tells
                      two students from the same school apart. */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#0A0D14]">
                      {r.schoolName || r.participantName}
                    </p>
                    <p className="truncate font-mono text-[11px] tracking-wide text-[#5B6472]/80">
                      {r.participantCode}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-mono text-base font-bold tabular-nums text-[#966700]">
                      {r.marks}
                      <span className="text-xs text-[#5B6472]/70">/12</span>
                    </p>
                    <p className="font-mono text-[10px] tabular-nums text-[#5B6472]/70">
                      {formatSeconds(r.responseTimeMs)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <p className="mt-5 text-center text-[11px] text-[#5B6472]/70">
          1 mark for every item placed in its correct position · updates every 3s
        </p>
      </div>
    </main>
  );
}
