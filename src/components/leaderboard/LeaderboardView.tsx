'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Trophy,
  Clock,
  Star,
  BookOpen,
  Zap,
  WifiOff,
  Loader2,
  RefreshCw,
  Users,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/store';
import { formatCompletionTime, formatTimerMicroseconds } from '@/lib/timer/formatter';
import type { Round1LeaderboardEntry, Round2LeaderboardEntry } from '@/types/competition';

// ── Animation Variants ──────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.012, delayChildren: 0 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
  exit: {
    opacity: 0,
    x: 16,
    transition: { duration: 0.2 },
  },
};

const emptyVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 200, damping: 20 },
  },
};

// ── Rank Badge Component ────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold-accent text-emerald-deep font-bold text-sm shadow-md">
        <Star className="w-3 h-3 fill-current" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#C0C0C0] text-emerald-deep font-bold text-sm">
        {rank}
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#CD7F32] text-white font-bold text-sm">
        {rank}
      </div>
    );
  }
  return (
    <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground font-semibold text-sm">
      {rank}
    </div>
  );
}

// ── Realtime Status Indicator ───────────────────────────────────
function RealtimeIndicator({
  status,
  lastUpdated,
  onRefresh,
}: {
  status: 'connected' | 'disconnected' | 'reconnecting';
  lastUpdated: Date | null;
  onRefresh: () => void;
}) {
  if (status === 'connected') {
    return (
      <div className="flex items-center gap-2">
        <motion.div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
          </span>
          <span className="text-[10px] sm:text-xs font-bold text-emerald-700 tracking-wider">LIVE</span>
        </motion.div>
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          className="size-7 text-muted-foreground hover:text-emerald-deep"
          title="Refresh now"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>
    );
  }

  if (status === 'reconnecting') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
        <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
        <span className="text-[10px] sm:text-xs font-bold text-amber-700 tracking-wider">
          RECONNECTING…
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200">
      <WifiOff className="w-3 h-3 text-gray-500" />
      <span className="text-[10px] sm:text-xs font-bold text-gray-500 tracking-wider">OFFLINE</span>
    </div>
  );
}

// ── Empty State Component ───────────────────────────────────────
function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 px-4"
      variants={emptyVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Trophy className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2 tracking-wide">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs">{message}</p>
    </motion.div>
  );
}

// ── Live Progress Strip ─────────────────────────────────────────
function LiveProgressStrip({
  total,
  submitted,
  round,
}: {
  total: number;
  submitted: number;
  round: 1 | 2;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((submitted / total) * 100)) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-deep/5 border border-emerald-deep/15"
    >
      <div className="flex items-center gap-1.5 text-emerald-deep">
        <Users className="size-4" />
        <span className="text-xs sm:text-sm font-bold">
          {submitted}
          <span className="text-muted-foreground font-medium"> / {total || '—'}</span>
        </span>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          submitted Round {round}
        </span>
      </div>
      <div className="flex-1 h-2 rounded-full bg-emerald-deep/10 overflow-hidden">
        <motion.div
          className="h-full bg-emerald-deep"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring' as const, stiffness: 100, damping: 20 }}
        />
      </div>
      <span className="text-xs font-bold text-emerald-deep tabular-nums w-10 text-right">
        {pct}%
      </span>
    </motion.div>
  );
}

// ── Class Filter Component ──────────────────────────────────────
function ClassFilter<T extends { className: string; division: string }>({
  entries,
  onFilterChange,
}: {
  entries: T[];
  onFilterChange: (filtered: T[]) => void;
}) {
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => set.add(`${e.className} - ${e.division}`));
    return Array.from(set).sort();
  }, [entries]);

  const [selected, setSelected] = useState<string>('all');

  useEffect(() => {
    if (selected === 'all') {
      onFilterChange(entries);
    } else {
      const [cls, div] = selected.split(' - ');
      onFilterChange(entries.filter((e) => e.className === cls && e.division === div));
    }
  }, [selected, entries, onFilterChange]);

  if (classOptions.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Filter className="size-3.5 text-muted-foreground" />
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="text-xs sm:text-sm h-8 px-2 rounded-md border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-deep/30"
        aria-label="Filter by class and division"
      >
        <option value="all">All classes</option>
        {classOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Round 1 Table ───────────────────────────────────────────────
function Round1Table({ entries }: { entries: Round1LeaderboardEntry[] }) {
  const [filtered, setFiltered] = useState(entries);

  // Sync when upstream entries change
  useEffect(() => {
    setFiltered(entries);
  }, [entries]);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="NO RESULTS YET"
        message="Waiting for participants to complete Round 1. Results will appear here in real-time."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <ClassFilter entries={entries} onFilterChange={setFiltered} />
        {filtered.length !== entries.length && (
          <Badge variant="secondary" className="text-xs">
            Showing {filtered.length} of {entries.length}
          </Badge>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title="NO MATCHES"
          message="No results in the selected class yet."
        />
      ) : (
        <div className="max-h-[480px] overflow-y-auto custom-scrollbar rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-emerald-deep hover:bg-emerald-deep">
                <TableHead className="text-ivory-warm font-semibold text-center w-16">Rank</TableHead>
                <TableHead className="text-ivory-warm font-semibold">School</TableHead>
                <TableHead className="text-ivory-warm font-semibold text-center hidden sm:table-cell">Student</TableHead>
                <TableHead className="text-ivory-warm font-semibold text-center">Score</TableHead>
                <TableHead className="text-ivory-warm font-semibold text-right hidden md:table-cell">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filtered.map((entry) => (
                  <motion.tr
                    key={entry.participantId}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    className={`rank-enter border-b transition-colors ${
                      entry.rank === 1
                        ? 'bg-gradient-to-r from-gold-accent/20 via-gold-accent/10 to-transparent'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <TableCell className="text-center py-1.5">
                      <RankBadge rank={entry.rank} />
                    </TableCell>
                    <TableCell className="font-semibold text-foreground py-1.5">
                      {/* School leads, code underneath in small type. This is an
                          inter-school competition, and several students share a
                          name — the code is what tells them apart. */}
                      <div className="flex flex-col">
                        <span
                          className={`text-[13px] leading-tight ${entry.rank === 1 ? 'text-gold-accent' : ''}`}
                        >
                          {entry.schoolName || entry.participantName}
                        </span>
                        <span className="font-mono text-[10px] leading-tight tracking-wide text-muted-foreground">
                          {entry.participantCode}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground hidden sm:table-cell py-1.5">
                      {entry.participantName}
                    </TableCell>
                    <TableCell className="text-center font-bold py-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${
                          entry.rank === 1
                            ? 'bg-gold-accent text-emerald-deep'
                            : 'bg-emerald-deep/10 text-emerald-deep'
                        }`}
                      >
                        {entry.correctAnswers}/{entry.totalQuestions}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground hidden md:table-cell py-1.5">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {formatCompletionTime(entry.completionTimeMs)}
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Round 2 Table ───────────────────────────────────────────────
function Round2Table({ entries }: { entries: Round2LeaderboardEntry[] }) {
  const [filtered, setFiltered] = useState(entries);

  useEffect(() => {
    setFiltered(entries);
  }, [entries]);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="NO RESULTS YET"
        message="Waiting for participants to complete Round 2. The fastest correct order wins!"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <ClassFilter entries={entries} onFilterChange={setFiltered} />
        {filtered.length !== entries.length && (
          <Badge variant="secondary" className="text-xs">
            Showing {filtered.length} of {entries.length}
          </Badge>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title="NO MATCHES"
          message="No results in the selected class yet."
        />
      ) : (
        <div className="max-h-[480px] overflow-y-auto custom-scrollbar rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-navy-deep hover:bg-navy-deep">
                <TableHead className="text-gold-light font-semibold text-center w-16">Rank</TableHead>
                <TableHead className="text-gold-light font-semibold">School</TableHead>
                <TableHead className="text-gold-light font-semibold text-center hidden sm:table-cell">Student</TableHead>
                <TableHead className="text-gold-light font-semibold text-right">Time (μs)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filtered.map((entry) => (
                  <motion.tr
                    key={entry.participantId}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                    className={`rank-enter border-b transition-colors ${
                      entry.rank === 1
                        ? 'bg-gradient-to-r from-gold-accent/20 via-gold-accent/10 to-transparent'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <TableCell className="text-center py-1.5">
                      <RankBadge rank={entry.rank} />
                    </TableCell>
                    <TableCell className="font-semibold text-foreground py-1.5">
                      {/* School leads, code underneath in small type. This is an
                          inter-school competition, and several students share a
                          name — the code is what tells them apart. */}
                      <div className="flex flex-col">
                        <span
                          className={`text-[13px] leading-tight ${entry.rank === 1 ? 'text-gold-accent' : ''}`}
                        >
                          {entry.schoolName || entry.participantName}
                        </span>
                        <span className="font-mono text-[10px] leading-tight tracking-wide text-muted-foreground">
                          {entry.participantCode}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground hidden sm:table-cell py-1.5">
                      {entry.participantName}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold py-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs tabular-nums ${
                          entry.rank === 1
                            ? 'bg-gold-accent text-emerald-deep'
                            : 'bg-navy-deep/10 text-navy-deep'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {formatTimerMicroseconds(entry.finalTimeMs)}
                      </span>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────
interface LeaderboardViewProps {
  round: 1 | 2;
  /**
   * What Back does. Defaults to the in-page router used at `/`.
   *
   * `/leaderboard` renders this same component on its own URL, where the store's
   * navigate() would swap a view nobody is looking at and leave the address bar
   * where it was — a Back button that visibly does nothing.
   */
  onBack?: () => void;
}

interface Stats {
  totalParticipants: number;
  round1Submitted: number;
  round2Submitted: number;
}

const BASE_POLL_MS = 4000;
const MAX_POLL_MS = 30000;

export default function LeaderboardView({ round: initialRound, onBack }: LeaderboardViewProps) {
  const [activeTab, setActiveTab] = useState<string>(`round${initialRound}`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalParticipants: 0,
    round1Submitted: 0,
    round2Submitted: 0,
  });

  const round1Leaderboard = useAppStore((s) => s.round1Leaderboard);
  const round2Leaderboard = useAppStore((s) => s.round2Leaderboard);
  const setRound1Leaderboard = useAppStore((s) => s.setRound1Leaderboard);
  const setRound2Leaderboard = useAppStore((s) => s.setRound2Leaderboard);
  const setRealtimeStatus = useAppStore((s) => s.setRealtimeStatus);
  const realtimeStatus = useAppStore((s) => s.realtimeStatus);
  const navigate = useAppStore((s) => s.navigate);

  // ── Fetch both leaderboards + stats in one go ─────────────────
  const fetchData = useCallback(async () => {
    try {
      const [r1Res, r2Res, statsRes] = await Promise.all([
        fetch('/api/leaderboard/round1'),
        fetch('/api/leaderboard/round2'),
        fetch('/api/competition/stats'),
      ]);

      if (r1Res.ok) {
        const r1Json = await r1Res.json();
        if (r1Json.success && Array.isArray(r1Json.data)) {
          setRound1Leaderboard(r1Json.data as Round1LeaderboardEntry[]);
        }
      }

      if (r2Res.ok) {
        const r2Json = await r2Res.json();
        if (r2Json.success && Array.isArray(r2Json.data)) {
          setRound2Leaderboard(r2Json.data as Round2LeaderboardEntry[]);
        }
      }

      if (statsRes.ok) {
        const sJson = await statsRes.json();
        if (sJson.success && sJson.data) {
          setStats(sJson.data as Stats);
        }
      }

      setError(null);
      setLastUpdated(new Date());
      setRealtimeStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard data');
      setRealtimeStatus('reconnecting');
    } finally {
      setLoading(false);
    }
  }, [setRound1Leaderboard, setRound2Leaderboard, setRealtimeStatus]);

  // ── Polling loop with exponential backoff on error ─────────────
  useEffect(() => {
    let cancelled = false;
    let pollDelay = BASE_POLL_MS;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const loop = async () => {
      if (cancelled) return;
      await fetchData();
      if (cancelled) return;
      // Reset delay on success, grow on error
      pollDelay = error ? Math.min(MAX_POLL_MS, pollDelay * 1.5) : BASE_POLL_MS;
      timer = setTimeout(loop, pollDelay);
    };

    loop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [fetchData, error]);

  const handleBack = () => {
    if (onBack) onBack();
    else navigate('landing');
  };

  const handleManualRefresh = () => {
    void fetchData();
  };

  const submittedCount = activeTab === 'round1' ? stats.round1Submitted : stats.round2Submitted;
  const currentRound = activeTab === 'round1' ? 1 : 2;

  return (
    <div className="min-h-screen islamic-pattern">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="gap-2 border-border hover:bg-emerald-deep hover:text-ivory-warm hover:border-emerald-deep transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Leaderboard
            </h1>
            <RealtimeIndicator
              status={realtimeStatus}
              lastUpdated={lastUpdated}
              onRefresh={handleManualRefresh}
            />
          </div>

          <div className="w-7 sm:w-9" /> {/* Spacer for centering */}
        </motion.div>

        {/* Live progress strip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <LiveProgressStrip
            total={stats.totalParticipants}
            submitted={submittedCount}
            round={currentRound as 1 | 2}
          />
        </motion.div>

        {/* Leaderboard Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="border-border/60 shadow-lg overflow-hidden">
            <CardHeader className="pb-3 px-4 sm:px-6 pt-5 sm:pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Trophy className="w-5 h-5 text-gold-accent" />
                  Competition Rankings
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-xs border-gold-accent/40 text-gold-accent bg-gold-accent/5"
                >
                  R1: {round1Leaderboard.length} · R2: {round2Leaderboard.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-5 sm:pb-6">
              {error && round1Leaderboard.length === 0 && round2Leaderboard.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-destructive">
                  <p className="font-medium">Failed to load leaderboard</p>
                  <p className="text-sm mt-1 text-muted-foreground">{error}</p>
                  <Button variant="outline" size="sm" onClick={handleManualRefresh} className="mt-4">
                    Retry
                  </Button>
                </div>
              ) : loading && round1Leaderboard.length === 0 && round2Leaderboard.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-gold-accent animate-spin" />
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full grid grid-cols-2 mb-4 bg-muted/50">
                    <TabsTrigger
                      value="round1"
                      className="gap-1.5 data-[state=active]:bg-emerald-deep data-[state=active]:text-ivory-warm transition-all"
                    >
                      <BookOpen className="w-4 h-4" />
                      Round 1 — Knowledge
                    </TabsTrigger>
                    <TabsTrigger
                      value="round2"
                      className="gap-1.5 data-[state=active]:bg-navy-deep data-[state=active]:text-gold-light transition-all"
                    >
                      <Zap className="w-4 h-4" />
                      Round 2 — Speed
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="round1" className="mt-0">
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <Round1Table entries={round1Leaderboard} />
                    </motion.div>
                  </TabsContent>

                  <TabsContent value="round2" className="mt-0">
                    {/* Round 2 is scored per question, and this tab cannot show
                        that. It reads /api/leaderboard/round2, which queries the
                        retired Round2Attempt table from the old self-paced
                        challenge — the live round writes to Round2LiveAnswer
                        instead, so this table was silently always empty.

                        Rather than invent a combined total nobody competes for,
                        it points at the two real boards. Q1 and Q2 are separate
                        contests with separate winners. */}
                    <div className="py-10 px-4 text-center">
                      <Trophy className="mx-auto mb-4 h-10 w-10 text-gold-accent/50" />
                      <h3 className="text-lg font-bold text-foreground">
                        Round 2 is scored per question
                      </h3>
                      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                        Question 1 and Question 2 are separate contests, each with
                        its own standings out of 12.
                      </p>
                      <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
                        <a
                          href="/round2/board?q=1"
                          className="w-full rounded-xl bg-emerald-deep px-5 py-2.5 text-sm font-bold text-ivory-warm transition-colors hover:bg-emerald-deep/90 sm:w-auto"
                        >
                          Question 1 standings →
                        </a>
                        <a
                          href="/round2/board?q=2"
                          className="w-full rounded-xl bg-emerald-deep px-5 py-2.5 text-sm font-bold text-ivory-warm transition-colors hover:bg-emerald-deep/90 sm:w-auto"
                        >
                          Question 2 standings →
                        </a>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer hint */}
        <motion.p
          className="text-center text-xs text-muted-foreground mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Auto-refreshes every {BASE_POLL_MS / 1000}s · ranking is computed server-side
        </motion.p>
      </div>
    </div>
  );
}
