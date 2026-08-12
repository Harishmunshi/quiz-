'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Clock, Star, BookOpen, Zap, WifiOff, Loader2 } from 'lucide-react';
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
import { formatCompletionTime, formatTimerDisplay } from '@/lib/timer/formatter';
import type { Round1LeaderboardEntry, Round2LeaderboardEntry } from '@/types/competition';

// ── Animation Variants ──────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
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
    transition: { type: 'spring', stiffness: 200, damping: 20 },
  },
};

// ── Rank Badge Component ────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gold-accent text-emerald-deep font-bold text-sm shadow-md">
        <Star className="w-4 h-4 fill-current" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#C0C0C0] text-emerald-deep font-bold text-sm">
        {rank}
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#CD7F32] text-white font-bold text-sm">
        {rank}
      </div>
    );
  }
  return (
    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground font-semibold text-sm">
      {rank}
    </div>
  );
}

// ── Realtime Status Indicator ───────────────────────────────────
function RealtimeIndicator() {
  const realtimeStatus = useAppStore((s) => s.realtimeStatus);

  if (realtimeStatus === 'connected') {
    return (
      <motion.div
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
        </span>
        <span className="text-xs font-semibold text-emerald-700 tracking-wide">LIVE</span>
      </motion.div>
    );
  }

  if (realtimeStatus === 'reconnecting') {
    return (
      <motion.div
        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
        <span className="text-xs font-semibold text-amber-700 tracking-wide">RECONNECTING...</span>
      </motion.div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
      <WifiOff className="w-3 h-3 text-gray-500" />
      <span className="text-xs font-medium text-gray-500 tracking-wide">OFFLINE</span>
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

// ── Round 1 Table ───────────────────────────────────────────────
function Round1Table({ entries }: { entries: Round1LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="NO RESULTS YET"
        message="Waiting for participants to complete Round 1. Results will appear here in real-time."
      />
    );
  }

  return (
    <div className="max-h-[480px] overflow-y-auto custom-scrollbar rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-emerald-deep hover:bg-emerald-deep">
            <TableHead className="text-ivory-warm font-semibold text-center w-16">Rank</TableHead>
            <TableHead className="text-ivory-warm font-semibold">Name</TableHead>
            <TableHead className="text-ivory-warm font-semibold text-center hidden sm:table-cell">Class</TableHead>
            <TableHead className="text-ivory-warm font-semibold text-center">Score</TableHead>
            <TableHead className="text-ivory-warm font-semibold text-right hidden md:table-cell">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence mode="popLayout">
            {entries.map((entry) => (
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
                <TableCell className="text-center py-3">
                  <RankBadge rank={entry.rank} />
                </TableCell>
                <TableCell className="font-semibold text-foreground py-3">
                  <div className="flex flex-col">
                    <span className={entry.rank === 1 ? 'text-gold-accent' : ''}>
                      {entry.participantName}
                    </span>
                    <span className="text-xs text-muted-foreground sm:hidden">
                      {entry.className} · {entry.division}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground hidden sm:table-cell py-3">
                  {entry.className}
                </TableCell>
                <TableCell className="text-center font-bold py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm ${
                      entry.rank === 1
                        ? 'bg-gold-accent text-emerald-deep'
                        : 'bg-emerald-deep/10 text-emerald-deep'
                    }`}
                  >
                    {entry.correctAnswers}/{entry.totalQuestions}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground hidden md:table-cell py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatCompletionTime(entry.completionTimeMs)}
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
}

// ── Round 2 Table ───────────────────────────────────────────────
function Round2Table({ entries }: { entries: Round2LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="NO RESULTS YET"
        message="Waiting for participants to complete Round 2. The fastest correct order wins!"
      />
    );
  }

  return (
    <div className="max-h-[480px] overflow-y-auto custom-scrollbar rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-navy-deep hover:bg-navy-deep">
            <TableHead className="text-gold-light font-semibold text-center w-16">Rank</TableHead>
            <TableHead className="text-gold-light font-semibold">Name</TableHead>
            <TableHead className="text-gold-light font-semibold text-center hidden sm:table-cell">Class</TableHead>
            <TableHead className="text-gold-light font-semibold text-right">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence mode="popLayout">
            {entries.map((entry) => (
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
                <TableCell className="text-center py-3">
                  <RankBadge rank={entry.rank} />
                </TableCell>
                <TableCell className="font-semibold text-foreground py-3">
                  <div className="flex flex-col">
                    <span className={entry.rank === 1 ? 'text-gold-accent' : ''}>
                      {entry.participantName}
                    </span>
                    <span className="text-xs text-muted-foreground sm:hidden">
                      {entry.className} · {entry.division}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-muted-foreground hidden sm:table-cell py-3">
                  {entry.className}
                </TableCell>
                <TableCell className="text-right font-mono font-bold py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm ${
                      entry.rank === 1
                        ? 'bg-gold-accent text-emerald-deep'
                        : 'bg-navy-deep/10 text-navy-deep'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {formatTimerDisplay(entry.finalTimeMs)}
                  </span>
                </TableCell>
              </motion.tr>
            ))}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────
interface LeaderboardViewProps {
  round: 1 | 2;
}

export default function LeaderboardView({ round: initialRound }: LeaderboardViewProps) {
  const [activeTab, setActiveTab] = useState<string>(`round${initialRound}`);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const round1Leaderboard = useAppStore((s) => s.round1Leaderboard);
  const round2Leaderboard = useAppStore((s) => s.round2Leaderboard);
  const setRound1Leaderboard = useAppStore((s) => s.setRound1Leaderboard);
  const setRound2Leaderboard = useAppStore((s) => s.setRound2Leaderboard);
  const navigate = useAppStore((s) => s.navigate);

  // Fetch leaderboard data
  const fetchData = useCallback(async () => {
    try {
      const [r1Res, r2Res] = await Promise.all([
        fetch('/api/leaderboard/round1'),
        fetch('/api/leaderboard/round2'),
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

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leaderboard data');
    } finally {
      setLoading(false);
    }
  }, [setRound1Leaderboard, setRound2Leaderboard]);

  // Fetch on mount and every 5 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleBack = () => {
    navigate('landing');
  };

  return (
    <div className="min-h-screen islamic-pattern">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
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

          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Leaderboard
            </h1>
            <RealtimeIndicator />
          </div>

          <div className="w-20" /> {/* Spacer for centering */}
        </motion.div>

        {/* Leaderboard Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        >
          <Card className="border-border/60 shadow-lg overflow-hidden">
            <CardHeader className="pb-3 px-4 sm:px-6 pt-5 sm:pt-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Trophy className="w-5 h-5 text-gold-accent" />
                  Competition Rankings
                </CardTitle>
                <Badge variant="outline" className="text-xs border-gold-accent/40 text-gold-accent bg-gold-accent/5">
                  {round1Leaderboard.length + round2Leaderboard.length > 0
                    ? `R1: ${round1Leaderboard.length} · R2: ${round2Leaderboard.length}`
                    : 'No entries'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-5 sm:pb-6">
              {error ? (
                <div className="flex flex-col items-center py-10 text-destructive">
                  <p className="font-medium">Failed to load leaderboard</p>
                  <p className="text-sm mt-1 text-muted-foreground">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchData}
                    className="mt-4"
                  >
                    Retry
                  </Button>
                </div>
              ) : loading && round1Leaderboard.length === 0 && round2Leaderboard.length === 0 ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-gold-accent animate-spin" />
                </div>
              ) : (
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
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
                    <motion.div
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <Round2Table entries={round2Leaderboard} />
                    </motion.div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Auto-refresh indicator */}
        <motion.p
          className="text-center text-xs text-muted-foreground mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Auto-refreshes every 5 seconds
        </motion.p>
      </div>
    </div>
  );
}