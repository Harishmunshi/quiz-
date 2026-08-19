'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Volume2,
  VolumeX,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import type { CompetitionSettings } from '@/types/database';
import { isMuted, toggleMuted } from '@/lib/sound/effects';
import { SCHOOL_LOGO_URL } from '@/lib/theme';

// ── Animation Variants ──────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 20 },
  },
};

// ── Status Helpers ─────────────────────────────────────────────
function getStatusLabel(settings: CompetitionSettings | null): string {
  if (!settings) return 'Loading…';
  const { competitionStatus, round1Status, round2Status } = settings;
  if (competitionStatus === 'completed') return 'Competition Completed';
  if (competitionStatus === 'paused') return 'Competition Paused';
  if (round1Status === 'open') return 'Round 1 — Open Now';
  if (round1Status === 'paused') return 'Round 1 — Paused';
  if (round1Status === 'closed' && round2Status === 'open') return 'Round 2 — Open Now';
  if (round1Status === 'closed' && round2Status === 'closed') return 'All Rounds Completed';
  if (competitionStatus === 'live') return 'Competition Live';
  if (competitionStatus === 'test') return 'Test Mode Active';
  return 'Competition Setup';
}

function getStatusColor(settings: CompetitionSettings | null): string {
  if (!settings) return 'bg-gray-500 text-gray-100';
  const { competitionStatus, round1Status, round2Status } = settings;
  if (round1Status === 'open' || round2Status === 'open') return 'bg-emerald-deep text-ivory-warm';
  if (competitionStatus === 'live') return 'bg-gold-accent text-emerald-deep';
  if (competitionStatus === 'test') return 'bg-amber-600 text-amber-50';
  if (competitionStatus === 'paused' || competitionStatus === 'completed') return 'bg-gray-600 text-gray-100';
  return 'bg-navy-deep text-gold-light';
}

// ── Main Component ─────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useAppStore((s) => s.navigate);
  const competitionSettings = useAppStore((s) => s.competitionSettings);
  const setCompetitionSettings = useAppStore((s) => s.setCompetitionSettings);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  // Fetch competition settings on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchSettings() {
      try {
        const res = await fetch('/api/competition');
        if (!res.ok) throw new Error('Failed to fetch competition data');
        const json = await res.json();
        if (json.success && json.data && !cancelled) {
          setCompetitionSettings(json.data);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Unable to load competition data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSettings();
    return () => {
      cancelled = true;
    };
  }, [setCompetitionSettings]);

  // Initialize mute state from localStorage
  useEffect(() => {
    setMuted(isMuted());
  }, []);

  const round1Open = competitionSettings?.round1Status === 'open';
  // Read from settings rather than hardcoding: the paper grew from 10 to 30 and
  // the landing copy silently kept advertising 10.
  const questionCount = competitionSettings?.round1TotalQuestions ?? 30;
  const statusLabel = getStatusLabel(competitionSettings);
  const statusColor = getStatusColor(competitionSettings);

  function handleRoundOne() {
    navigate('register');
  }

  function handleAdminClick() {
    navigate('admin-login');
  }

  function handleMuteToggle() {
    const next = toggleMuted();
    setMuted(next);
  }

  return (
    <div
      className="islamic-pattern min-h-screen flex flex-col items-center justify-between px-4 sm:px-6 py-8 sm:py-12 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #F4F5F7 0%, #E9EBEF 100%)' }}
    >
      {/* Decorative corner geometry */}
      <div className="pointer-events-none absolute top-0 left-0 w-40 h-40 sm:w-56 sm:h-56 opacity-30">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <polygon points="0,0 200,0 0,200" fill="#2DD4BF" opacity="0.55" />
          <polygon points="0,0 120,0 0,120" fill="#FFB000" opacity="0.75" />
        </svg>
      </div>
      <div className="pointer-events-none absolute bottom-0 right-0 w-40 h-40 sm:w-56 sm:h-56 opacity-30 rotate-180">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <polygon points="0,0 200,0 0,200" fill="#2DD4BF" opacity="0.55" />
          <polygon points="0,0 120,0 0,120" fill="#FFB000" opacity="0.75" />
        </svg>
      </div>

      {/* Top utility bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-3xl flex items-center justify-between"
      >
        <Badge
          className={`${statusColor} px-3 py-1 text-xs sm:text-sm font-semibold flex items-center gap-1.5`}
        >
          {loading ? (
            <>
              <span className="size-1.5 rounded-full bg-current animate-pulse" />
              Loading…
            </>
          ) : fetchError ? (
            <>
              <AlertCircle className="size-3.5" />
              {fetchError}
            </>
          ) : (
            <>
              <ShieldCheck className="size-3.5" />
              {statusLabel}
            </>
          )}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleMuteToggle}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="size-9 text-navy-deep/70 hover:text-emerald-deep"
            title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAdminClick}
            aria-label="Admin login"
            className="size-9 text-navy-deep/70 hover:text-emerald-deep"
            title="Admin login"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </motion.div>

      {/* Center content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-3xl flex flex-col items-center gap-6 sm:gap-8 my-8 sm:my-12"
      >
        {/* School crest */}
        <motion.div variants={itemVariants}>
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gold-accent/30 blur-2xl scale-110" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SCHOOL_LOGO_URL}
              alt="M.E.S. English Medium School crest"
              className="relative w-24 h-24 sm:w-32 sm:h-32 object-contain drop-shadow-2xl"
            />
          </div>
        </motion.div>

        {/* School name */}
        <motion.div variants={itemVariants} className="text-center space-y-1">
          <h2 className="text-base sm:text-xl md:text-2xl tracking-[0.25em] sm:tracking-[0.35em] uppercase font-bold text-emerald-deep">
            M.E.S. English Medium School
          </h2>
          <div className="flex items-center justify-center gap-2 text-gold-accent">
            <div className="h-px w-6 sm:w-10 bg-gold-accent/60" />
            <Sparkles className="size-3 sm:size-4" />
            <div className="h-px w-6 sm:w-10 bg-gold-accent/60" />
          </div>
        </motion.div>

        {/* Main title.
            "MINBAR" takes the gold, the way "QUIZ" did — the accent line is what
            makes the three-line stack read as one name rather than three words. */}
        <motion.div variants={itemVariants} className="text-center px-2">
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight">
            <span className="block text-emerald-deep">MIND</span>
            <span className="block text-emerald-deep">OVER</span>
            <span className="block text-gold-accent" style={{ textShadow: '0 2px 0 rgba(6,59,45,0.15)' }}>
              MINBAR
            </span>
          </h1>
        </motion.div>

        {/* Subtitle — now names the event rather than describing it, since the
            title alone no longer says what this is. */}
        <motion.p
          variants={itemVariants}
          className="text-sm sm:text-base md:text-lg text-navy-deep/75 font-semibold text-center max-w-md px-4 uppercase tracking-[0.18em]"
        >
          Inter-School Islamic Quiz Competition
        </motion.p>

        {/* Round 1 button (the only CTA) */}
        <motion.div variants={itemVariants} className="w-full max-w-sm pt-2 sm:pt-4">
          <Button
            type="button"
            onClick={handleRoundOne}
            disabled={!round1Open && !loading && !fetchError}
            className="group relative w-full h-16 sm:h-20 text-lg sm:text-2xl font-extrabold uppercase tracking-wider overflow-hidden rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: '#FFB000',
              color: '#0A0D14',
              boxShadow: '0 12px 32px -12px rgba(255, 176, 0, 0.75)',
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2 sm:gap-3">
              <span>Round 1</span>
              <ChevronRight className="size-5 sm:size-7 transition-transform group-hover:translate-x-1" />
            </span>
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: '#FFC33D' }}
            />
          </Button>
          <p className="text-center text-xs sm:text-sm text-navy-deep/60 mt-3 font-medium">
            {round1Open
              ? `${questionCount} questions · both English and हिंदी`
              : 'Round 1 will open when the administrator starts the competition'}
          </p>
        </motion.div>

        {/* Secondary destinations.
            The leaderboard used to be reachable only from the admin dashboard
            or by knowing the #/round1-leaderboard hash, so to a student it did
            not exist. Both of these are real URLs, so they survive a refresh
            and can be shared or opened on the projector directly. */}
        <motion.div variants={itemVariants} className="flex flex-col items-center gap-2 mt-2 sm:flex-row sm:gap-5">
          <a
            href="/round2"
            className="text-xs sm:text-sm text-navy-deep/50 hover:text-gold-accent transition-colors font-medium underline underline-offset-4 decoration-navy-deep/20 hover:decoration-gold-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Round 2 — Live Round →
          </a>
          <a
            href="/leaderboard"
            className="text-xs sm:text-sm text-navy-deep/50 hover:text-gold-accent transition-colors font-medium underline underline-offset-4 decoration-navy-deep/20 hover:decoration-gold-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Leaderboard →
          </a>
        </motion.div>
      </motion.div>

      {/* Bottom footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="relative z-10 w-full max-w-3xl flex items-center justify-center gap-2 text-gold-accent/50"
      >
        <Sparkles className="size-3" />
        <div className="h-px w-12 sm:w-20 bg-gold-accent/30" />
        <Sparkles className="size-3" />
        <div className="h-px w-12 sm:w-20 bg-gold-accent/30" />
        <Sparkles className="size-3" />
      </motion.div>
    </div>
  );
}
