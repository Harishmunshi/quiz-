'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap, ChevronRight, Lock, Loader2, AlertCircle, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import type { CompetitionSettings } from '@/types/database';
import { isMuted, toggleMuted } from '@/lib/sound/effects';

// ── Animation Variants ──────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 260, damping: 20 },
  },
};

// ── Main Component ─────────────────────────────────────────────
export default function Round2Landing() {
  const navigate = useAppStore((s) => s.navigate);
  const participant = useAppStore((s) => s.participant);
  const competitionSettings = useAppStore((s) => s.competitionSettings);
  const setCompetitionSettings = useAppStore((s) => s.setCompetitionSettings);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  // Fetch competition settings
  useEffect(() => {
    let cancelled = false;
    async function fetchSettings() {
      try {
        const res = await fetch('/api/competition');
        if (!res.ok) throw new Error('Failed to fetch competition status');
        const json = await res.json();
        if (json.success && json.data && !cancelled) {
          setCompetitionSettings(json.data as CompetitionSettings);
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

  useEffect(() => {
    setMuted(isMuted());
  }, []);

  const isOpen = competitionSettings?.round2Status === 'open';
  const needsRegistration = !participant;

  function handleStart() {
    if (!isOpen) return;
    if (needsRegistration) {
      // Bounce to landing so they register first
      navigate('landing');
      return;
    }
    navigate('round2-challenge');
  }

  function handleMuteToggle() {
    const next = toggleMuted();
    setMuted(next);
  }

  return (
    <div
      className="speed-theme min-h-screen flex flex-col items-center justify-between px-4 sm:px-6 py-8 sm:py-12 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at top, #1A3050 0%, #071A2B 50%, #02060C 100%)',
        color: '#F7F2E7',
      }}
    >
      {/* Animated speed lines */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute h-px"
            style={{
              top: `${(i + 1) * 8}%`,
              left: 0,
              right: 0,
              background: 'linear-gradient(90deg, transparent 0%, #C8A951 50%, transparent 100%)',
              animation: `speedLine ${1.5 + (i % 4) * 0.5}s linear infinite`,
              animationDelay: `${(i % 5) * 0.2}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes speedLine {
          0%   { transform: translateX(-30%); opacity: 0; }
          30%  { opacity: 0.6; }
          100% { transform: translateX(30%); opacity: 0; }
        }
      `}</style>

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-3xl flex items-center justify-between"
      >
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate('landing')}
          className="text-ivory-warm/80 hover:text-gold-accent hover:bg-white/5 -ml-2"
        >
          <ArrowLeft className="size-4 mr-1" />
          <span className="text-sm font-medium">Back</span>
        </Button>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleMuteToggle}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="size-9 text-ivory-warm/70 hover:text-gold-accent hover:bg-white/5"
            title={muted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
        </div>
      </motion.div>

      {/* Center */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-3xl flex flex-col items-center gap-6 sm:gap-8 my-8 sm:my-12"
      >
        {/* School name (small, on dark bg) */}
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="text-xs sm:text-sm tracking-[0.3em] uppercase font-medium text-gold-accent/80">
            M.E.S. English Medium School
          </h2>
        </motion.div>

        {/* Round label */}
        <motion.div variants={itemVariants} className="flex items-center gap-3">
          <div className="h-px w-8 sm:w-12 bg-gold-accent/60" />
          <Badge
            className="px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm font-bold uppercase tracking-widest border-0"
            style={{ background: '#C8A951', color: '#071A2B' }}
          >
            <Zap className="size-3.5 mr-1.5 fill-current" />
            Round 02
          </Badge>
          <div className="h-px w-8 sm:w-12 bg-gold-accent/60" />
        </motion.div>

        {/* Main title — speed-energy style */}
        <motion.div variants={itemVariants} className="text-center px-2">
          <h1
            className="text-5xl sm:text-7xl md:text-8xl font-black leading-[0.95] tracking-tight"
            style={{
              background: 'linear-gradient(180deg, #F7F2E7 0%, #C8A951 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            SPEED
            <br />
            CHALLENGE
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-sm sm:text-base md:text-lg text-center max-w-md px-4"
          style={{ color: 'rgba(247, 242, 231, 0.7)' }}
        >
          Arrange 10–12 items in the correct order. Race against the clock at
          <span style={{ color: '#C8A951' }} className="font-bold">
            {' '}
            microsecond
          </span>{' '}
          precision.
        </motion.p>

        {/* Mini how-it-works */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-3 gap-2 sm:gap-4 w-full max-w-md px-2"
        >
          {[
            { n: '3', t: '2', label: 'Get Ready' },
            { n: '4', t: '1', label: 'Drag Tiles' },
            { n: '5', t: '✓', label: 'Beat the Clock' },
          ].map((step) => (
            <div
              key={step.label}
              className="flex flex-col items-center gap-1.5 p-2 sm:p-3 rounded-xl"
              style={{
                background: 'rgba(200, 169, 81, 0.08)',
                border: '1px solid rgba(200, 169, 81, 0.25)',
              }}
            >
              <span
                className="text-xl sm:text-2xl font-black"
                style={{ color: '#C8A951' }}
              >
                {step.t}
              </span>
              <span
                className="text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-center"
                style={{ color: 'rgba(247, 242, 231, 0.7)' }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Start button */}
        <motion.div variants={itemVariants} className="w-full max-w-sm pt-2 sm:pt-4">
          {loading ? (
            <Button
              type="button"
              disabled
              className="w-full h-16 sm:h-20 text-lg sm:text-2xl font-extrabold uppercase tracking-wider rounded-2xl"
              style={{ background: 'rgba(200, 169, 81, 0.3)', color: '#F7F2E7' }}
            >
              <Loader2 className="size-5 sm:size-7 animate-spin mr-2" />
              Loading…
            </Button>
          ) : !isOpen ? (
            <Button
              type="button"
              disabled
              className="w-full h-16 sm:h-20 text-lg sm:text-2xl font-extrabold uppercase tracking-wider rounded-2xl opacity-60"
              style={{ background: 'rgba(100,100,100,0.3)', color: 'rgba(247, 242, 231, 0.6)' }}
            >
              <Lock className="size-5 sm:size-7 mr-2" />
              Round 2 Locked
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleStart}
              className="group relative w-full h-16 sm:h-20 text-lg sm:text-2xl font-extrabold uppercase tracking-wider overflow-hidden rounded-2xl transition-all"
              style={{
                background: 'linear-gradient(135deg, #C8A951 0%, #E8C76A 100%)',
                color: '#071A2B',
                boxShadow: '0 10px 30px -10px rgba(200, 169, 81, 0.6), 0 0 0 2px #071A2B inset',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2 sm:gap-3">
                <Zap className="size-5 sm:size-7 fill-current" />
                <span>Start Round 2</span>
                <ChevronRight className="size-5 sm:size-7 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
          )}

          <p
            className="text-center text-xs sm:text-sm mt-3 font-medium"
            style={{ color: 'rgba(247, 242, 231, 0.55)' }}
          >
            {loading
              ? 'Checking competition status…'
              : fetchError
                ? fetchError
                : !isOpen
                  ? 'Round 2 will open when the administrator starts it'
                  : needsRegistration
                    ? 'You will be asked to register first'
                    : 'Be fast. Be accurate. May the best win.'}
          </p>
        </motion.div>

        {fetchError && !loading && (
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-2 text-sm"
            style={{ color: '#FCA5A5' }}
          >
            <AlertCircle className="size-4" />
            {fetchError}
          </motion.div>
        )}
      </motion.div>

      {/* Bottom */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="relative z-10 w-full max-w-3xl flex items-center justify-center gap-2"
        style={{ color: 'rgba(200, 169, 81, 0.4)' }}
      >
        <Sparkles className="size-3" />
        <div className="h-px w-12 sm:w-20" style={{ background: 'rgba(200, 169, 81, 0.3)' }} />
        <Sparkles className="size-3" />
        <div className="h-px w-12 sm:w-20" style={{ background: 'rgba(200, 169, 81, 0.3)' }} />
        <Sparkles className="size-3" />
      </motion.div>
    </div>
  );
}
