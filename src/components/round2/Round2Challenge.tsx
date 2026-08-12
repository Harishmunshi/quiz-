'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '@/lib/store';
import { formatTimerDisplay } from '@/lib/timer/formatter';
import {
  Loader2,
  AlertCircle,
  Send,
  RotateCcw,
  GripVertical,
  Zap,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────
interface ChallengeData {
  id: string;
  challengeNumber: number;
  prompt: string;
  items: string;
  correctOrder: string;
  timeLimitMs: number;
  maxAttempts: number;
  isActive: boolean;
}

type Phase =
  | 'loading'
  | 'countdown-round'
  | 'countdown-title'
  | 'countdown-ready'
  | 'countdown-3'
  | 'countdown-2'
  | 'countdown-1'
  | 'countdown-go'
  | 'playing'
  | 'submitting'
  | 'correct'
  | 'incorrect'
  | 'expired'
  | 'error';

// ── Sortable Tile ────────────────────────────────────────────
function SortableTile({ id, text, index }: { id: string; text: string; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3"
    >
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0"
        style={{
          backgroundColor: 'rgba(200, 169, 81, 0.15)',
          color: '#C8A951',
        }}
      >
        {index + 1}
      </div>
      <div
        {...attributes}
        {...listeners}
        className="flex-1 flex items-center gap-3 min-h-14 rounded-xl px-4 py-3 cursor-grab active:cursor-grabbing select-none transition-shadow duration-200"
        style={{
          backgroundColor: isDragging
            ? 'rgba(200, 169, 81, 0.15)'
            : 'rgba(7, 26, 43, 0.6)',
          border: `2px solid ${isDragging ? 'rgba(200, 169, 81, 0.7)' : 'rgba(200, 169, 81, 0.3)'}`,
          boxShadow: isDragging
            ? '0 8px 32px rgba(200, 169, 81, 0.2)'
            : 'none',
        }}
      >
        <GripVertical className="w-5 h-5 shrink-0" style={{ color: 'rgba(200, 169, 81, 0.5)' }} />
        <span
          className="text-sm sm:text-base font-medium leading-snug"
          style={{ color: '#F7F2E7' }}
        >
          {text}
        </span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function Round2Challenge() {
  const {
    participant,
    competitionSettings,
    setRound2AttemptId,
    setRound2StartTime,
    setRound2Result,
    resetRound2,
    navigate,
  } = useAppStore();

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [originalItems, setOriginalItems] = useState<string[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [attemptId, setLocalAttemptId] = useState<string | null>(null);
  const [startTime, setLocalStartTime] = useState<number | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(0);
  const [timeLimitMs, setTimeLimitMs] = useState(60000);

  const rafRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMounted = useRef(false);

  // ── Shuffle helper ─────────────────────────────────────────
  const shuffleArray = useCallback((arr: string[]): string[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // Make sure it's not already in correct order
    const correctOrder = JSON.parse(
      challenge?.correctOrder ?? '[]'
    ) as string[];
    if (JSON.stringify(shuffled) === JSON.stringify(correctOrder) && shuffled.length > 1) {
      return shuffleArray(arr);
    }
    return shuffled;
  }, [challenge?.correctOrder]);

  // ── Countdown sequence ──────────────────────────────────────
  const runCountdown = useCallback(() => {
    const steps: Array<{ phase: Phase; delay: number }> = [
      { phase: 'countdown-round', delay: 1200 },
      { phase: 'countdown-title', delay: 1200 },
      { phase: 'countdown-ready', delay: 1000 },
      { phase: 'countdown-3', delay: 800 },
      { phase: 'countdown-2', delay: 800 },
      { phase: 'countdown-1', delay: 800 },
      { phase: 'countdown-go', delay: 600 },
    ];

    let cumulativeDelay = 0;
    steps.forEach(({ phase: p, delay }) => {
      countdownTimerRef.current = setTimeout(() => {
        setPhase(p);
      }, cumulativeDelay);
      cumulativeDelay += delay;
    });

    // After GO, start the game
    countdownTimerRef.current = setTimeout(() => {
      setPhase('playing');
    }, cumulativeDelay);
  }, []);

  // ── Initialize: fetch data & run countdown ──────────────────
  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;

    const init = async () => {
      try {
        // 1. Check round2 status
        const compRes = await fetch('/api/competition');
        if (!compRes.ok) throw new Error('Failed to fetch competition status');
        const compData = await compRes.json();
        const settings = compData.data;

        if (!settings || settings.round2Status !== 'open') {
          setError('Round 2 is not open yet. Please wait for the administrator to open it.');
          setPhase('error');
          return;
        }

        if (!participant?.id) {
          setError('Participant information not found. Please register again.');
          setPhase('error');
          return;
        }

        // 2. Fetch challenges
        const chalRes = await fetch('/api/round2/challenges');
        if (!chalRes.ok) throw new Error('Failed to fetch challenges');
        const chalData = await chalRes.json();
        const challenges: ChallengeData[] = chalData.data;

        if (!challenges || challenges.length === 0) {
          setError('No active challenges available.');
          setPhase('error');
          return;
        }

        const activeChallenge = challenges[0];
        setChallenge(activeChallenge);
        setTimeLimitMs(activeChallenge.timeLimitMs);

        const parsedItems = JSON.parse(activeChallenge.items) as string[];
        setOriginalItems(parsedItems);
        const shuffled = shuffleArray(parsedItems);
        setItems(shuffled);

        // 3. Start countdown
        setPhase('loading');
        runCountdown();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setPhase('error');
      }
    };

    init();
  }, [participant, shuffleArray, runCountdown]);

  // ── Start attempt after GO ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    if (attemptId) return; // already started
    if (!participant?.id || !challenge?.id) return;

    const startAttempt = async () => {
      try {
        const res = await fetch('/api/round2/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: participant.id,
            challengeId: challenge.id,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to start attempt');
        }

        const data = await res.json();
        const newAttemptId = data.data.attemptId;
        setLocalAttemptId(newAttemptId);
        setRound2AttemptId(newAttemptId);
        const now = Date.now();
        setLocalStartTime(now);
        setRound2StartTime(now);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start');
        setPhase('error');
      }
    };

    startAttempt();
  }, [phase, attemptId, participant, challenge, setRound2AttemptId, setRound2StartTime]);

  // ── RAF Timer ───────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || !startTime) return;

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      setElapsedMs(elapsed);

      if (elapsed >= timeLimitMs) {
        // Auto-expire
        setPhase('expired');
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, startTime, timeLimitMs]);

  // ── Cleanup countdown timers on unmount ─────────────────────
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
  }, []);

  // ── Drag end handler ────────────────────────────────────────
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  // ── Reset ordering (for retry) ─────────────────────────────
  const handleReset = useCallback(() => {
    if (originalItems.length > 0) {
      const shuffled = shuffleArray(originalItems);
      setItems(shuffled);
    }
  }, [originalItems, shuffleArray]);

  // ── Submit handler ──────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!attemptId || !startTime || phase === 'submitting') return;

    setPhase('submitting');
    // Stop timer
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const finalElapsed = Date.now() - startTime;
    setElapsedMs(finalElapsed);

    try {
      const res = await fetch('/api/round2/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          submittedOrder: items,
          clientElapsedMs: finalElapsed,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Submission failed');
      }

      const data = await res.json();

      setRound2Result({
        isCorrect: data.isCorrect,
        serverElapsedMs: data.serverElapsedMs,
        finalTimeMs: data.finalTimeMs,
        canRetry: data.canRetry,
        remainingAttempts: data.remainingAttempts,
      });

      if (data.isCorrect) {
        setPhase('correct');
        // Navigate after 2 seconds
        setTimeout(() => {
          navigate('round2-result');
        }, 2000);
      } else {
        setCanRetry(data.canRetry);
        setRemainingAttempts(data.remainingAttempts);
        setPhase('incorrect');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      setPhase('error');
    }
  }, [attemptId, startTime, items, phase, setRound2Result, navigate]);

  // ── Try Again handler ───────────────────────────────────────
  const handleTryAgain = useCallback(async () => {
    // Reset local state for a new attempt
    setLocalAttemptId(null);
    setLocalStartTime(null);
    setElapsedMs(0);
    setCanRetry(false);
    setRemainingAttempts(0);
    handleReset();
    setPhase('playing');
  }, [handleReset]);

  // ── Countdown renderer ──────────────────────────────────────
  const renderCountdown = () => {
    const overlay = (
      <div className="fixed inset-0 z-40 flex items-center justify-center speed-theme">
        <motion.div
          key={phase}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          {phase === 'countdown-round' && (
            <>
              <motion.p
                className="text-2xl sm:text-3xl font-bold tracking-widest mb-2"
                style={{ color: '#C8A951' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                ROUND 02
              </motion.p>
            </>
          )}
          {phase === 'countdown-title' && (
            <motion.p
              className="text-xl sm:text-2xl font-bold tracking-wide px-6"
              style={{ color: '#F7F2E7' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              SPEED ORDERING CHALLENGE
            </motion.p>
          )}
          {phase === 'countdown-ready' && (
            <motion.p
              className="text-3xl sm:text-4xl font-bold"
              style={{ color: '#C8A951' }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              GET READY
            </motion.p>
          )}
          {phase === 'countdown-3' && (
            <span
              className="text-8xl sm:text-9xl font-black countdown-number"
              style={{ color: '#C8A951' }}
            >
              3
            </span>
          )}
          {phase === 'countdown-2' && (
            <span
              className="text-8xl sm:text-9xl font-black countdown-number"
              style={{ color: '#C8A951' }}
            >
              2
            </span>
          )}
          {phase === 'countdown-1' && (
            <span
              className="text-8xl sm:text-9xl font-black countdown-number"
              style={{ color: '#C8A951' }}
            >
              1
            </span>
          )}
          {phase === 'countdown-go' && (
            <motion.span
              className="text-8xl sm:text-9xl font-black"
              style={{ color: '#F7F2E7' }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              GO!
            </motion.span>
          )}
        </motion.div>
      </div>
    );
    return overlay;
  };

  // ── Loading State ───────────────────────────────────────────
  if (phase === 'loading' || phase === 'error' && error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 speed-theme">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          {phase === 'loading' ? (
            <>
              <div
                className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(200, 169, 81, 0.15)' }}
              >
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#C8A951' }} />
              </div>
              <p className="text-lg font-medium" style={{ color: '#F7F2E7' }}>
                Preparing challenge…
              </p>
              <p className="text-sm mt-2" style={{ color: 'rgba(247, 242, 231, 0.6)' }}>
                May Allah grant you speed and accuracy
              </p>
            </>
          ) : (
            <Card
              className="border-0 shadow-2xl"
              style={{
                backgroundColor: 'rgba(7, 26, 43, 0.9)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <CardContent className="p-6 text-center">
                <div
                  className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
                >
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2" style={{ color: '#F7F2E7' }}>
                  {error?.includes('not open') ? 'Round Closed' : 'Error'}
                </h2>
                <p className="text-sm mb-6" style={{ color: 'rgba(247, 242, 231, 0.7)' }}>
                  {error}
                </p>
                <Button
                  onClick={() => navigate('landing')}
                  className="w-full h-11 text-sm font-medium"
                  style={{ backgroundColor: '#C8A951', color: '#071A2B' }}
                >
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Countdown phases ────────────────────────────────────────
  if (['countdown-round', 'countdown-title', 'countdown-ready', 'countdown-3', 'countdown-2', 'countdown-1', 'countdown-go'].includes(phase)) {
    return (
      <AnimatePresence mode="wait">
        {renderCountdown()}
      </AnimatePresence>
    );
  }

  // ── Expired ─────────────────────────────────────────────────
  if (phase === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 speed-theme">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <Card
            className="border-0 shadow-2xl"
            style={{
              backgroundColor: 'rgba(7, 26, 43, 0.9)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <CardContent className="p-6 text-center">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
              >
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: '#F7F2E7' }}
              >
                TIME'S UP!
              </h2>
              <p
                className="text-sm mb-6"
                style={{ color: 'rgba(247, 242, 231, 0.7)' }}
              >
                The time limit has been reached. Your attempt has been recorded.
              </p>
              <Button
                onClick={() => navigate('round2-result')}
                className="w-full h-11 text-sm font-medium"
                style={{ backgroundColor: '#C8A951', color: '#071A2B' }}
              >
                View Result
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Correct overlay ─────────────────────────────────────────
  if (phase === 'correct') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 speed-theme">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            <CheckCircle2 className="w-24 h-24 mx-auto mb-6" style={{ color: '#22c55e' }} />
          </motion.div>
          <motion.h2
            className="text-4xl sm:text-5xl font-black mb-3"
            style={{ color: '#22c55e' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            CORRECT!
          </motion.h2>
          <motion.p
            className="text-2xl sm:text-3xl font-bold timer-glow mb-2"
            style={{ color: '#C8A951' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            {formatTimerDisplay(elapsedMs)}
          </motion.p>
          <motion.p
            className="text-sm"
            style={{ color: 'rgba(247, 242, 231, 0.6)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            Redirecting to results…
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // ── Incorrect overlay ───────────────────────────────────────
  if (phase === 'incorrect') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 speed-theme">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md w-full"
        >
          <Card
            className="border-0 shadow-2xl"
            style={{
              backgroundColor: 'rgba(7, 26, 43, 0.9)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <CardContent className="p-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <XCircle className="w-20 h-20 mx-auto mb-4" style={{ color: '#ef4444' }} />
              </motion.div>
              <h2
                className="text-3xl font-black mb-2"
                style={{ color: '#ef4444' }}
              >
                INCORRECT
              </h2>
              <p
                className="text-sm mb-6"
                style={{ color: 'rgba(247, 242, 231, 0.7)' }}
              >
                {canRetry
                  ? `You have ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`
                  : 'No more attempts available.'}
              </p>
              <div className="flex flex-col gap-3">
                {canRetry && (
                  <Button
                    onClick={handleTryAgain}
                    className="w-full h-11 text-sm font-semibold"
                    style={{ backgroundColor: '#C8A951', color: '#071A2B' }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
                <Button
                  onClick={() => navigate('round2-result')}
                  variant="outline"
                  className="w-full h-11 text-sm font-medium"
                  style={{
                    borderColor: 'rgba(200, 169, 81, 0.3)',
                    color: '#C8A951',
                    backgroundColor: 'rgba(200, 169, 81, 0.05)',
                  }}
                >
                  View Result
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Main Playing UI ─────────────────────────────────────────
  const remainingMs = Math.max(0, timeLimitMs - elapsedMs);
  const isTimeLow = remainingMs < 10000;

  return (
    <div className="min-h-screen flex flex-col speed-theme">
      {/* Header: Timer + Challenge Info */}
      <header className="sticky top-0 z-10 px-4 pt-4 pb-2 sm:px-6 sm:pt-6">
        <div className="max-w-lg mx-auto">
          {/* Round badge */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color: '#C8A951' }} />
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'rgba(200, 169, 81, 0.8)' }}
            >
              Round 02 — Speed Challenge
            </span>
            <Zap className="w-4 h-4" style={{ color: '#C8A951' }} />
          </div>

          {/* Large Central Timer */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-4"
          >
            <p
              className="text-5xl sm:text-7xl font-black tabular-nums timer-glow"
              style={{
                color: isTimeLow ? '#ef4444' : '#F7F2E7',
              }}
            >
              {formatTimerDisplay(elapsedMs)}
            </p>
            {timeLimitMs > 0 && (
              <p
                className="text-xs mt-1 font-medium"
                style={{
                  color: isTimeLow
                    ? 'rgba(239, 68, 68, 0.8)'
                    : 'rgba(247, 242, 231, 0.5)',
                }}
              >
                Limit: {formatTimerDisplay(timeLimitMs)}
              </p>
            )}
          </motion.div>

          {/* Challenge Prompt */}
          {challenge && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-4"
            >
              <Card
                className="border-0"
                style={{
                  backgroundColor: 'rgba(200, 169, 81, 0.08)',
                  border: '1px solid rgba(200, 169, 81, 0.15)',
                }}
              >
                <CardContent className="p-3 sm:p-4">
                  <p
                    className="text-sm sm:text-base font-medium"
                    style={{ color: '#F7F2E7' }}
                  >
                    {challenge.prompt}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </header>

      {/* Draggable Tiles Area */}
      <main className="flex-1 flex items-start justify-center px-4 py-2 sm:px-6 sm:py-4">
        <div className="max-w-lg w-full">
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2.5">
                {items.map((item, index) => (
                  <SortableTile
                    key={item}
                    id={item}
                    text={item}
                    index={index}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </main>

      {/* Action Buttons */}
      <footer className="sticky bottom-0 z-10 px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
        <div className="max-w-lg mx-auto flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleSubmit}
            disabled={phase === 'submitting' || !attemptId}
            className="flex-1 h-12 sm:h-14 text-sm sm:text-base font-bold rounded-xl"
            style={{
              backgroundColor:
                phase === 'submitting'
                  ? 'rgba(200, 169, 81, 0.5)'
                  : '#C8A951',
              color: '#071A2B',
            }}
          >
            {phase === 'submitting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                SUBMIT ANSWER
              </>
            )}
          </Button>
          <Button
            onClick={handleReset}
            disabled={phase === 'submitting'}
            variant="outline"
            className="h-12 sm:h-14 px-6 text-sm font-medium rounded-xl"
            style={{
              borderColor: 'rgba(200, 169, 81, 0.3)',
              color: '#C8A951',
              backgroundColor: 'rgba(200, 169, 81, 0.05)',
            }}
          >
            <RotateCcw className="w-4 h-4" />
            RESET
          </Button>
        </div>
      </footer>
    </div>
  );
}
