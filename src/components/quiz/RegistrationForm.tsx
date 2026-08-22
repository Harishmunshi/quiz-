'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  UserCircle,
  AlertCircle,
  CheckCircle2,
  Languages,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { SECTIONS, type SectionId } from '@/lib/sections';
import { saveParticipant } from '@/lib/round2/session';
import { registerParticipantSchema } from '@/lib/validation/schemas';

// ── Animation Variants ──────────────────────────────────────────
const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.97,
    transition: { duration: 0.2 },
  },
};

const fieldVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.15 + i * 0.08, type: 'spring' as const, stiffness: 260, damping: 20 },
  }),
};

// ── Types ──────────────────────────────────────────────────────
interface FieldError {
  participantCode?: string;
  schoolName?: string;
  section?: string;
  name?: string;
}

// ── Main Component ─────────────────────────────────────────────
export default function RegistrationForm() {
  const navigate = useAppStore((s) => s.navigate);
  const selectedLanguage = useAppStore((s) => s.selectedLanguage);
  const setSelectedLanguage = useAppStore((s) => s.setSelectedLanguage);
  const setParticipant = useAppStore((s) => s.setParticipant);
  const competitionSettings = useAppStore((s) => s.competitionSettings);

  // Form state
  const [participantCode, setParticipantCode] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [section, setSection] = useState<SectionId | ''>('');
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Round 1 availability check
  const round1Status = competitionSettings?.round1Status;
  const isRound1Available = round1Status === 'open';

  const isGujarati = selectedLanguage === 'gujarati';
  const title = isGujarati ? 'Register — हिंदी क्विज़' : 'Register — English Quiz';

  // Validate fields with Zod
  function validateFields(): boolean {
    const result = registerParticipantSchema.safeParse({
      participantCode,
      schoolName,
      section: section || undefined,
      language: selectedLanguage,
    });
    if (!section) {
      setFieldErrors((prev) => ({ ...prev, section: 'Choose your class group' }));
      return false;
    }

    if (result.success) {
      setFieldErrors({});
      return true;
    }

    const errors: FieldError = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FieldError;
      errors[field] = issue.message;
    }
    setFieldErrors(errors);
    return false;
  }

  // Submit handler
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setGeneralError(null);

      if (!validateFields()) return;
      if (!isRound1Available) {
        setGeneralError('Round is not available. Please check the competition status.');
        return;
      }

      setSubmitting(true);

      try {
        const res = await fetch('/api/participant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantCode,
            schoolName,
            section,
            language: selectedLanguage,
          }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Registration failed. Please try again.');
        }

        // Store participant and navigate
        setParticipant(json.participant);
        // Persist to localStorage as well as the in-memory store. Round 2 lives
        // on its own page with its own React tree, and previously had no way to
        // learn who this student was — so it offered a registration form and
        // minted a SECOND participant that could never qualify.
        saveParticipant({
          id: json.participant.id,
          participantCode: json.participant.participantCode,
          name: json.participant.name,
          schoolName: json.participant.schoolName ?? schoolName,
          language: selectedLanguage,
        });
        navigate('round1-quiz');
      } catch (err) {
        setGeneralError(
          err instanceof Error ? err.message : 'Something went wrong. Please try again.'
        );
      } finally {
        setSubmitting(false);
      }
    },
    [participantCode, schoolName, section, selectedLanguage, isRound1Available, setParticipant, navigate]
  );

  return (
    <div className="islamic-pattern min-h-screen flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-md"
      >
        {/* ── Back Button ── */}
        <motion.button
          type="button"
          onClick={() => navigate('landing')}
          className="flex items-center gap-2 mb-6 text-sm font-medium text-navy-deep/60 hover:text-emerald-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          whileHover={{ x: -4 }}
          whileTap={{ scale: 0.97 }}
        >
          <ArrowLeft className="size-4" />
          Back
        </motion.button>

        <Card className="border-gold-accent/20 gold-glow overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* ── Language Badge ── */}
            <div className="flex items-center justify-center">
              <Badge
                className={`px-4 py-1.5 text-sm font-semibold ${
                  isGujarati
                    ? 'bg-navy-deep text-gold-accent'
                    : 'bg-emerald-deep text-ivory-warm'
                }`}
              >
                {isGujarati ? 'हिंदी क्विज़' : 'English Quiz'}
              </Badge>
            </div>

            {/* ── Title ── */}
            <div className="text-center space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-deep tracking-tight">
                {title}
              </h1>
              <p className="text-sm text-navy-deep/60">
                Enter your details to start the quiz
              </p>
            </div>

            {/* ── Round Unavailable Message ── */}
            <AnimatePresence>
              {!isRound1Available && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4"
                >
                  <AlertCircle className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Round is not available
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {round1Status === 'locked'
                        ? 'The quiz has not started yet. Please wait for the administrator to open Round 1.'
                        : round1Status === 'closed'
                          ? 'Round 1 has already ended. Check the leaderboard for results.'
                          : round1Status === 'paused'
                            ? 'Round 1 is temporarily paused. Please wait for it to reopen.'
                            : 'The competition is not currently accepting registrations.'}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Registration Form ── */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Name Field */}
              <motion.div
                custom={0}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label htmlFor="reg-code" className="text-navy-deep font-semibold text-sm">
                  <UserCircle className="size-4 mr-1.5 text-emerald-deep" />
                  Student Code
                </Label>
                <Input
                  id="reg-code"
                  type="text"
                  placeholder="e.g. M.E.S.B S-1"
                  value={participantCode}
                  onChange={(e) => {
                    // Left exactly as typed. The server upper-cases and
                    // collapses whitespace, so normalising here as well only
                    // fought the space bar on IDs like "M.E.S.B S-1".
                    setParticipantCode(e.target.value);
                    if (fieldErrors.participantCode) setFieldErrors((prev) => ({ ...prev, participantCode: undefined }));
                  }}
                  disabled={submitting || !isRound1Available}
                  className={`bg-white ${
                    fieldErrors.participantCode
                      ? 'border-destructive focus-visible:ring-destructive/20'
                      : 'focus-visible:border-emerald-deep'
                  }`}
                  autoComplete="off" autoCapitalize="characters"
                />
                {fieldErrors.participantCode && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive font-medium"
                  >
                    {fieldErrors.participantCode}
                  </motion.p>
                )}
              </motion.div>

              {/* School Field */}
              <motion.div
                custom={1}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label htmlFor="reg-section" className="text-navy-deep font-semibold text-sm">
                  Class
                </Label>
                {/* Juniors (std 6-8) and seniors (std 9-12) are ranked against
                    their own age group, so this decides which leaderboard the
                    result lands on and who makes the cut into Round 2. */}
                <select
                  id="reg-section"
                  value={section}
                  onChange={(e) => {
                    setSection(e.target.value as SectionId | '');
                    if (fieldErrors.section) setFieldErrors((prev) => ({ ...prev, section: undefined }));
                  }}
                  disabled={submitting || !isRound1Available}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                >
                  <option value="">Choose your class…</option>
                  {SECTIONS.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.section && (
                  <p className="text-sm text-red-600">{fieldErrors.section}</p>
                )}
              </motion.div>

              <motion.div variants={fieldVariants} className="space-y-2">
                <Label htmlFor="reg-school" className="text-navy-deep font-semibold text-sm">
                  School Name
                </Label>
                <Input
                  id="reg-school"
                  type="text"
                  placeholder="e.g., M.E.S. English Medium School"
                  value={schoolName}
                  onChange={(e) => {
                    setSchoolName(e.target.value);
                    if (fieldErrors.schoolName) setFieldErrors((prev) => ({ ...prev, schoolName: undefined }));
                  }}
                  disabled={submitting || !isRound1Available}
                  className={`bg-white ${
                    fieldErrors.schoolName
                      ? 'border-destructive focus-visible:ring-destructive/20'
                      : 'focus-visible:border-emerald-deep'
                  }`}
                  autoComplete="organization"
                />
                {fieldErrors.schoolName && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive font-medium"
                  >
                    {fieldErrors.schoolName}
                  </motion.p>
                )}
              </motion.div>

              {/* Language Toggle */}
              <motion.div
                custom={3}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label className="text-navy-deep font-semibold text-sm flex items-center gap-1.5">
                  <Languages className="size-4 text-emerald-deep" />
                  Choose your language
                </Label>
                <div
                  className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/60 border border-border"
                  role="radiogroup"
                  aria-label="Quiz language"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!isGujarati}
                    onClick={() => setSelectedLanguage('english')}
                    disabled={submitting || !isRound1Available}
                    className={`h-11 rounded-lg font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      !isGujarati
                        ? 'bg-emerald-deep text-gold-accent shadow-md'
                        : 'bg-transparent text-navy-deep/70 hover:bg-white/60'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isGujarati}
                    onClick={() => setSelectedLanguage('gujarati')}
                    disabled={submitting || !isRound1Available}
                    className={`h-11 rounded-lg font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isGujarati
                        ? 'bg-navy-deep text-gold-accent shadow-md'
                        : 'bg-transparent text-navy-deep/70 hover:bg-white/60'
                    }`}
                  >
                    हिंदी
                  </button>
                </div>
              </motion.div>

              {/* ── General Error ── */}
              <AnimatePresence>
                {generalError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-3"
                  >
                    <AlertCircle className="size-4 text-destructive flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive font-medium">{generalError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Submit Button ── */}
              <motion.div
                custom={4}
                variants={fieldVariants}
                initial="hidden"
                animate="visible"
              >
                <Button
                  type="submit"
                  disabled={submitting || !isRound1Available}
                  className="w-full h-12 text-base font-bold bg-emerald-deep text-gold-accent hover:bg-emerald-mid transition-colors gold-glow focus-visible:ring-emerald-deep/50 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Registering…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-5" />
                      Start Quiz
                    </>
                  )}
                </Button>
              </motion.div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
