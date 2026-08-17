'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap, Clock, Star, Radio } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { formatTimerDisplay } from '@/lib/timer/formatter';
import type { Round1LeaderboardEntry, Round2LeaderboardEntry } from '@/types/competition';

// ─── Constants ───────────────────────────────────────────
const MAX_DISPLAY = 15;
const POLL_INTERVAL = 3000;

// ─── Rank Color Config ───────────────────────────────────
function getRankStyle(rank: number) {
  switch (rank) {
    case 1:
      return {
        rankColor: 'text-[#966700]',
        rankBg: 'bg-[#FFB000]/15 border-[#FFB000]/40',
        rankSize: 'text-4xl md:text-5xl',
        nameWeight: 'font-bold',
        rowBorder: 'border-l-4 border-l-[#FFB000]',
      };
    case 2:
      return {
        rankColor: 'text-gray-300',
        rankBg: 'bg-gray-300/10 border-gray-300/30',
        rankSize: 'text-3xl md:text-4xl',
        nameWeight: 'font-semibold',
        rowBorder: 'border-l-4 border-l-gray-300/60',
      };
    case 3:
      return {
        rankColor: 'text-amber-600',
        rankBg: 'bg-amber-600/10 border-amber-600/30',
        rankSize: 'text-3xl md:text-4xl',
        nameWeight: 'font-semibold',
        rowBorder: 'border-l-4 border-l-amber-600/60',
      };
    default:
      return {
        rankColor: 'text-[#F4F5F7]/70',
        rankBg: 'bg-white/5 border-white/10',
        rankSize: 'text-2xl md:text-3xl',
        nameWeight: 'font-medium',
        rowBorder: 'border-l-4 border-l-transparent',
      };
  }
}

// ─── Animated Rank Number ─────────────────────────────────
function AnimatedRank({ rank, previousRank }: { rank: number; previousRank?: number }) {
  const isNew = rank === 1 && previousRank !== undefined && previousRank !== 1;
  const rankStyle = getRankStyle(rank);

  return (
    <motion.div
      key={rank}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 20 }}
      className={`${rankStyle.rankBg} border rounded-xl px-4 py-2 md:px-6 md:py-3 ${rankStyle.rankSize} ${rankStyle.rankColor} font-black tabular-nums flex items-center justify-center min-w-[5rem] ${isNew ? 'new-record' : ''}`}
    >
      #{rank}
    </motion.div>
  );
}

// ─── Round 1 Row ─────────────────────────────────────────
function Round1Row({
  entry,
  previousEntryId,
}: {
  entry: Round1LeaderboardEntry;
  previousEntryId?: string;
}) {
  const style = getRankStyle(entry.rank);
  const isNewFirst = entry.rank === 1 && previousEntryId && previousEntryId !== entry.participantId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`flex items-center gap-4 md:gap-6 px-4 md:px-8 py-3 md:py-4 rounded-xl ${style.rowBorder} ${entry.rank <= 3 ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'} transition-colors ${isNewFirst ? 'new-record' : ''}`}
    >
      <AnimatedRank rank={entry.rank} />
      <div className="flex-1 min-w-0">
        <h3 className={`text-2xl md:text-3xl text-[#F4F5F7] ${style.nameWeight} truncate`}>
          {entry.participantName}
        </h3>
        {/* Was `className — division`. Both columns became nullable when school
            name replaced them at registration, so on every recent participant
            this line rendered as a lone em dash. The code is what the hall
            actually needs anyway: it is the only thing separating two students
            who share a name. */}
        <p className="text-sm md:text-base text-[#F4F5F7]/50 mt-0.5">
          <span className="font-mono tracking-wide">{entry.participantCode}</span>
          {entry.schoolName ? ` · ${entry.schoolName}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-4 md:gap-6 shrink-0">
        <div className="text-center">
          <p className="text-xs md:text-sm text-[#F4F5F7]/40 uppercase tracking-wider">Score</p>
          <p className="text-2xl md:text-4xl font-black text-[#966700] tabular-nums">
            {entry.score}<span className="text-lg md:text-xl text-[#F4F5F7]/40">/{entry.totalQuestions}</span>
          </p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="text-xs md:text-sm text-[#F4F5F7]/40 uppercase tracking-wider">Time</p>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#F4F5F7]/40" />
            <p className="text-xl md:text-2xl font-bold text-[#F4F5F7]/80 tabular-nums">
              {formatTimerDisplay(entry.completionTimeMs)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Round 2 Row ─────────────────────────────────────────
function Round2Row({
  entry,
  previousEntryId,
}: {
  entry: Round2LeaderboardEntry;
  previousEntryId?: string;
}) {
  const style = getRankStyle(entry.rank);
  const isNewFirst = entry.rank === 1 && previousEntryId && previousEntryId !== entry.participantId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`flex items-center gap-4 md:gap-6 px-4 md:px-8 py-3 md:py-4 rounded-xl ${style.rowBorder} ${entry.rank <= 3 ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'} transition-colors ${isNewFirst ? 'new-record' : ''}`}
    >
      <AnimatedRank rank={entry.rank} />
      <div className="flex-1 min-w-0">
        <h3 className={`text-2xl md:text-3xl text-[#F4F5F7] ${style.nameWeight} truncate`}>
          {entry.participantName}
        </h3>
        {/* Was `className — division`. Both columns became nullable when school
            name replaced them at registration, so on every recent participant
            this line rendered as a lone em dash. The code is what the hall
            actually needs anyway: it is the only thing separating two students
            who share a name. */}
        <p className="text-sm md:text-base text-[#F4F5F7]/50 mt-0.5">
          <span className="font-mono tracking-wide">{entry.participantCode}</span>
          {entry.schoolName ? ` · ${entry.schoolName}` : ''}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs md:text-sm text-[#F4F5F7]/40 uppercase tracking-wider">Time</p>
        <p className="text-3xl md:text-4xl font-black text-[#966700] timer-glow tabular-nums">
          {formatTimerDisplay(entry.finalTimeMs)}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Live Dot ────────────────────────────────────────────
function LiveIndicator() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3 md:h-4 md:w-4">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
          animate={{ scale: [1, 2.2, 1], opacity: [0.75, 0, 0.75] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="relative inline-flex rounded-full h-3 w-3 md:h-4 md:w-4 bg-emerald-400" />
      </span>
      <span className="text-emerald-400 font-bold text-sm md:text-base tracking-widest uppercase">Live</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function DisplayLeaderboard() {
  const [activeRound, setActiveRound] = useState<1 | 2>(1);
  const [round1Data, setRound1Data] = useState<Round1LeaderboardEntry[]>([]);
  const [round2Data, setRound2Data] = useState<Round2LeaderboardEntry[]>([]);
  const [prevFirstPlace, setPrevFirstPlace] = useState<{ r1?: string; r2?: string }>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prevFirstRef = useRef<{ r1?: string; r2?: string }>({});

  const setRound1Leaderboard = useAppStore((s) => s.setRound1Leaderboard);
  const setRound2Leaderboard = useAppStore((s) => s.setRound2Leaderboard);

  const fetchLeaderboards = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [r1Res, r2Res] = await Promise.all([
        fetch('/api/leaderboard/round1'),
        fetch('/api/leaderboard/round2'),
      ]);

      if (r1Res.ok) {
        const r1Json = await r1Res.json();
        if (r1Json.success && Array.isArray(r1Json.data)) {
          const entries = r1Json.data.slice(0, MAX_DISPLAY);
          setRound1Data(entries);
          setRound1Leaderboard(entries);
        }
      }

      if (r2Res.ok) {
        const r2Json = await r2Res.json();
        if (r2Json.success && Array.isArray(r2Json.data)) {
          const entries = r2Json.data.slice(0, MAX_DISPLAY);
          setRound2Data(entries);
          setRound2Leaderboard(entries);
        }
      }
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [setRound1Leaderboard, setRound2Leaderboard]);

  // Track previous first place IDs for animation
  useEffect(() => {
    if (round1Data.length > 0 && round1Data[0]?.participantId !== prevFirstRef.current.r1) {
      setPrevFirstPlace((p) => ({ ...p, r1: prevFirstRef.current.r1 }));
      prevFirstRef.current.r1 = round1Data[0]?.participantId;
    }
    if (round2Data.length > 0 && round2Data[0]?.participantId !== prevFirstRef.current.r2) {
      setPrevFirstPlace((p) => ({ ...p, r2: prevFirstRef.current.r2 }));
      prevFirstRef.current.r2 = round2Data[0]?.participantId;
    }
  }, [round1Data, round2Data]);

  // Fetch on mount + interval
  useEffect(() => {
    fetchLeaderboards();
    const interval = setInterval(fetchLeaderboards, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLeaderboards]);

  const displayedData = activeRound === 1 ? round1Data : round2Data;

  return (
    <div
      className="min-h-screen w-full flex flex-col relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #0A0D14 0%, #0A0D14 100%)',
      }}
    >
      {/* Subtle decorative overlay pattern */}
      <div className="absolute inset-0 islamic-pattern opacity-30 pointer-events-none" />

      {/* ─── Header ──────────────────────────────────── */}
      <header className="relative z-10 text-center pt-6 pb-4 md:pt-10 md:pb-6 px-4">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-xl md:text-3xl lg:text-4xl font-black tracking-widest"
          style={{ color: '#966700' }}
        >
          M.E.S. ENGLISH MEDIUM SCHOOL
        </motion.h1>
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-lg md:text-2xl lg:text-3xl font-bold text-white mt-2 tracking-wide"
        >
          ISLAMIC QUIZ COMPETITION
        </motion.h2>

        {/* Round Tabs + Live Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center justify-center gap-4 md:gap-8 mt-5 md:mt-8"
        >
          <button
            onClick={() => setActiveRound(1)}
            className={`group flex items-center gap-2 md:gap-3 px-5 py-2.5 md:px-8 md:py-3 rounded-xl text-base md:text-xl lg:text-2xl font-bold tracking-wide transition-all duration-300 ${
              activeRound === 1
                ? 'bg-[#FFB000]/20 text-[#966700] border-2 border-[#FFB000]/60 shadow-[0_0_30px_rgba(200,169,81,0.15)]'
                : 'bg-white/5 text-white/50 border-2 border-white/10 hover:bg-white/10 hover:text-white/70'
            }`}
          >
            <Trophy className={`w-5 h-5 md:w-6 md:h-6 ${activeRound === 1 ? 'text-[#966700]' : 'text-white/40'}`} />
            ROUND 01 — KNOWLEDGE
          </button>

          <button
            onClick={() => setActiveRound(2)}
            className={`group flex items-center gap-2 md:gap-3 px-5 py-2.5 md:px-8 md:py-3 rounded-xl text-base md:text-xl lg:text-2xl font-bold tracking-wide transition-all duration-300 ${
              activeRound === 2
                ? 'bg-[#FFB000]/20 text-[#966700] border-2 border-[#FFB000]/60 shadow-[0_0_30px_rgba(200,169,81,0.15)]'
                : 'bg-white/5 text-white/50 border-2 border-white/10 hover:bg-white/10 hover:text-white/70'
            }`}
          >
            <Zap className={`w-5 h-5 md:w-6 md:h-6 ${activeRound === 2 ? 'text-[#966700]' : 'text-white/40'}`} />
            ROUND 02 — SPEED
          </button>

          <LiveIndicator />
        </motion.div>
      </header>

      {/* ─── Leaderboard Content ──────────────────────── */}
      <main className="relative z-10 flex-1 px-4 md:px-12 lg:px-20 pb-8 md:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRound}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="max-w-6xl mx-auto"
          >
            {displayedData.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 md:py-32"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 md:w-28 md:h-28 rounded-full bg-white/5 mb-6">
                  <Star className="w-10 h-10 md:w-14 md:h-14 text-[#966700]/40" />
                </div>
                <p className="text-2xl md:text-4xl font-bold text-white/30 tracking-wide">
                  AWAITING RESULTS
                </p>
                <p className="text-base md:text-xl text-white/20 mt-3">
                  Leaderboard will appear here once submissions begin
                </p>
              </motion.div>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {/* Column headers (desktop) */}
                <div className="hidden md:flex items-center gap-6 px-8 py-2 text-xs text-[#F4F5F7]/30 uppercase tracking-widest font-medium">
                  <div className="w-28 text-center">Rank</div>
                  <div className="flex-1">Participant</div>
                  {activeRound === 1 && (
                    <>
                      <div className="w-36 text-center">Score</div>
                      <div className="w-40 text-center">Time</div>
                    </>
                  )}
                  {activeRound === 2 && <div className="w-48 text-right">Time</div>}
                </div>

                <AnimatePresence>
                  {displayedData.map((entry) => {
                    const isFirst = entry.rank === 1;
                    const prevFirstId = activeRound === 1 ? prevFirstPlace.r1 : prevFirstPlace.r2;

                    if (activeRound === 1) {
                      return (
                        <Round1Row
                          key={entry.participantId}
                          entry={entry}
                          previousEntryId={isFirst ? prevFirstId : undefined}
                        />
                      );
                    } else {
                      return (
                        <Round2Row
                          key={entry.participantId}
                          entry={entry}
                          previousEntryId={isFirst ? prevFirstId : undefined}
                        />
                      );
                    }
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Refresh indicator */}
        <motion.div
          className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-20"
          animate={{ opacity: isRefreshing ? 1 : 0.3 }}
        >
          <Radio className={`w-5 h-5 md:w-6 md:h-6 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} style={{ animationDuration: '1s' }} />
        </motion.div>
      </main>

      {/* ─── Footer ──────────────────────────────────── */}
      <footer className="relative z-10 text-center py-3 md:py-5">
        <p className="text-xs md:text-sm text-white/20 tracking-wider">
          M.E.S. English Medium School • Islamic Quiz Competition
        </p>
      </footer>
    </div>
  );
}
