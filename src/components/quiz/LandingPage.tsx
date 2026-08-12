'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Languages, Lock, ChevronRight, ShieldCheck, Trophy, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import type { CompetitionSettings } from '@/types/database';

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
    transition: { type: 'spring', stiffness: 260, damping: 20 },
  },
};

const cardHoverScale = {
  rest: { scale: 1 },
  hover: { scale: 1.03, transition: { type: 'spring', stiffness: 400, damping: 25 } },
};

// ── Status Helpers ─────────────────────────────────────────────
function getStatusLabel(settings: CompetitionSettings): string {
  const { competitionStatus, round1Status } = settings;
  if (competitionStatus === 'completed') return 'Competition Completed';
  if (competitionStatus === 'paused') return 'Competition Paused';
  if (round1Status === 'open') return 'Round 1 — Open Now';
  if (round1Status === 'paused') return 'Round 1 — Paused';
  if (round1Status === 'closed' && settings.round2Status === 'open') return 'Round 2 — Open Now';
  if (round1Status === 'closed' && settings.round2Status === 'closed') return 'All Rounds Completed';
  if (competitionStatus === 'live') return 'Competition Live';
  if (competitionStatus === 'test') return 'Test Mode Active';
  return 'Competition Setup';
}

function getStatusColor(settings: CompetitionSettings): string {
  const { competitionStatus, round1Status } = settings;
  if (competitionStatus === 'completed') return 'bg-gray-600 text-gray-100';
  if (round1Status === 'open' || settings.round2Status === 'open') return 'bg-emerald-deep text-ivory-warm';
  if (competitionStatus === 'live') return 'bg-gold-accent text-emerald-deep';
  if (competitionStatus === 'test') return 'bg-amber-600 text-amber-50';
  return 'bg-navy-deep text-gold-light';
}

// ── Main Component ─────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useAppStore((s) => s.navigate);
  const participant = useAppStore((s) => s.participant);
  const selectedLanguage = useAppStore((s) => s.selectedLanguage);
  const setSelectedLanguage = useAppStore((s) => s.setSelectedLanguage);
  const competitionSettings = useAppStore((s) => s.competitionSettings);
  const setCompetitionSettings = useAppStore((s) => s.setCompetitionSettings);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    return () => { cancelled = true; };
  }, [setCompetitionSettings]);

  // Handlers
  function handleEnglishClick() {
    setSelectedLanguage('english');
    navigate('register');
  }

  function handleGujaratiClick() {
    setSelectedLanguage('gujarati');
    navigate('register');
  }

  function handleAdminClick() {
    navigate('admin-login');
  }

  const isRound2Open = competitionSettings?.round2Status === 'open';
  const statusLabel = competitionSettings ? getStatusLabel(competitionSettings) : 'Loading...';
  const statusColor = competitionSettings ? getStatusColor(competitionSettings) : 'bg-gray-500 text-gray-100';

  return (
    <div className="islamic-pattern min-h-screen flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-3xl flex flex-col items-center gap-6 sm:gap-8"
      >
        {/* ── Decorative Top Sparkles ── */}
        <motion.div variants={itemVariants} className="flex items-center gap-2 text-gold-accent">
          <Sparkles className="size-5 sm:size-6" />
          <div className="h-px w-8 sm:w-12 bg-gold-accent/50" />
          <Sparkles className="size-5 sm:size-6" />
        </motion.div>

        {/* ── School Name ── */}
        <motion.div variants={itemVariants} className="text-center">
          <h2 className="text-sm sm:text-base tracking-[0.2em] uppercase font-medium text-gold-accent">
            M.E.S. English Medium School
          </h2>
        </motion.div>

        {/* ── Main Title ── */}
        <motion.div variants={itemVariants} className="text-center px-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-emerald-deep leading-tight tracking-tight">
            ISLAMIC QUIZ
            <br />
            <span className="text-emerald-mid">COMPETITION</span>
          </h1>
        </motion.div>

        {/* ── Subtitle ── */}
        <motion.p
          variants={itemVariants}
          className="text-base sm:text-lg text-navy-deep/70 font-medium text-center"
        >
          Test Your Knowledge of Islam
        </motion.p>

        {/* ── Status Banner ── */}
        <motion.div variants={itemVariants}>
          {loading ? (
            <Badge className={`${statusColor} px-4 py-1.5 text-xs sm:text-sm font-semibold animate-pulse`}>
              Loading status…
            </Badge>
          ) : fetchError ? (
            <Badge className="bg-red-700 text-red-50 px-4 py-1.5 text-xs sm:text-sm font-semibold">
              ⚠ {fetchError}
            </Badge>
          ) : (
            <Badge className={`${statusColor} px-4 py-1.5 text-xs sm:text-sm font-semibold`}>
              <ShieldCheck className="size-3.5 mr-1.5" />
              {statusLabel}
            </Badge>
          )}
        </motion.div>

        {/* ── Quiz Entry Cards ── */}
        <motion.div
          variants={itemVariants}
          className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-2"
        >
          {/* English Quiz Card */}
          <motion.div
            variants={cardHoverScale}
            initial="rest"
            whileHover="hover"
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className="group cursor-pointer overflow-hidden border-gold-accent/30 gold-glow transition-shadow hover:shadow-lg bg-white"
              onClick={handleEnglishClick}
            >
              <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 relative">
                {/* Emerald gradient accent at top */}
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-deep via-emerald-mid to-emerald-light" />

                <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-deep to-emerald-mid text-ivory-warm shadow-md">
                  <BookOpen className="size-8 sm:size-10" />
                </div>

                <div className="text-center space-y-1.5">
                  <h3 className="text-lg sm:text-xl font-bold text-emerald-deep">
                    ENGLISH QUIZ
                  </h3>
                  <p className="text-sm text-navy-deep/60 font-medium">
                    Answer questions about Islam in English
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-emerald-deep font-semibold text-sm group-hover:translate-x-1 transition-transform">
                  Begin Quiz <ChevronRight className="size-4" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Gujarati Quiz Card */}
          <motion.div
            variants={cardHoverScale}
            initial="rest"
            whileHover="hover"
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className="group cursor-pointer overflow-hidden border-gold-accent/30 gold-glow transition-shadow hover:shadow-lg bg-white"
              onClick={handleGujaratiClick}
            >
              <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4 relative">
                {/* Navy gradient accent at top */}
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-navy-deep via-navy-mid to-navy-deep/70" />

                <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-navy-deep to-navy-mid text-gold-accent shadow-md">
                  <Languages className="size-8 sm:size-10" />
                </div>

                <div className="text-center space-y-1.5">
                  <h3 className="text-lg sm:text-xl font-bold text-navy-deep">
                    ગુજરાતી ક્વિઝ
                  </h3>
                  <p className="text-sm text-navy-deep/60 font-medium">
                    ઇસ્લામ વિશે ગુજરાતીમાં પ્રશ્નોના જવાબો આપો
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-navy-deep font-semibold text-sm group-hover:translate-x-1 transition-transform">
                  ક્વિઝ શરૂ કરો <ChevronRight className="size-4" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* ── Round 2 Speed Challenge Card ── */}
        <motion.div variants={itemVariants} className="w-full max-w-md">
          <Card
            className={`overflow-hidden border ${
              isRound2Open
                ? 'border-gold-accent/40 gold-glow cursor-pointer hover:shadow-lg'
                : 'border-border/60 opacity-70 cursor-not-allowed'
            }`}
            onClick={() => {
              if (!isRound2Open) return;
              if (participant) {
                navigate('round2-challenge');
              } else {
                setSelectedLanguage(selectedLanguage || 'english');
                navigate('register');
              }
            }}
          >
            <CardContent className="p-4 sm:p-6 flex items-center gap-4">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 ${
                  isRound2Open
                    ? 'bg-gradient-to-br from-navy-deep to-navy-mid text-gold-accent'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {isRound2Open ? (
                  <Trophy className="size-6" />
                ) : (
                  <Lock className="size-6" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm sm:text-base text-navy-deep">
                  Round 2: Speed Challenge
                </h4>
                <p className="text-xs sm:text-sm text-navy-deep/50 truncate">
                  {isRound2Open
                    ? 'Arrange items in the correct order — Race against the clock!'
                    : 'This round is currently locked. Complete Round 1 first.'}
                </p>
              </div>
              {isRound2Open && (
                <ChevronRight className="size-5 text-gold-accent flex-shrink-0" />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Decorative Bottom Sparkles ── */}
        <motion.div variants={itemVariants} className="flex items-center gap-2 text-gold-accent/60">
          <Sparkles className="size-4" />
          <div className="h-px w-12 bg-gold-accent/40" />
          <Sparkles className="size-4" />
          <div className="h-px w-12 bg-gold-accent/40" />
          <Sparkles className="size-4" />
        </motion.div>

        {/* ── Admin Login Link ── */}
        <motion.div variants={itemVariants}>
          <button
            type="button"
            onClick={handleAdminClick}
            className="text-xs sm:text-sm text-navy-deep/40 hover:text-gold-accent transition-colors font-medium underline underline-offset-4 decoration-navy-deep/20 hover:decoration-gold-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Admin Login
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
