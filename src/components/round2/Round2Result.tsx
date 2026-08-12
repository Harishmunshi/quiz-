'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';
import { formatTimerDisplay } from '@/lib/timer/formatter';
import {
  CheckCircle2,
  XCircle,
  Timer,
  Home,
  BarChart3,
  Zap,
  RotateCcw,
  Star,
} from 'lucide-react';

export default function Round2Result() {
  const {
    round2Result,
    navigate,
    resetRound2,
  } = useAppStore();

  // If somehow navigated here without a result, redirect
  useEffect(() => {
    if (!round2Result) {
      navigate('landing');
    }
  }, [round2Result, navigate]);

  if (!round2Result) return null;

  const { isCorrect, serverElapsedMs, finalTimeMs, canRetry } = round2Result;

  const handleLeaderboard = () => {
    navigate('round2-leaderboard');
  };

  const handleBackHome = () => {
    resetRound2();
    navigate('landing');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 speed-theme">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-lg"
      >
        {/* Result Icon + Heading */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-6"
        >
          {isCorrect ? (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}
              >
                <CheckCircle2 className="w-10 h-10" style={{ color: '#22c55e' }} />
              </motion.div>
              <motion.h1
                className="text-3xl sm:text-4xl font-black tracking-wide"
                style={{ color: '#22c55e' }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                CORRECT!
              </motion.h1>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
              >
                <XCircle className="w-10 h-10" style={{ color: '#ef4444' }} />
              </motion.div>
              <motion.h1
                className="text-3xl sm:text-4xl font-black tracking-wide"
                style={{ color: '#ef4444' }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
              >
                INCORRECT
              </motion.h1>
            </>
          )}

          <motion.p
            className="text-sm mt-3"
            style={{ color: 'rgba(247, 242, 231, 0.6)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {isCorrect
              ? 'MashaAllah! Your result has been recorded'
              : 'Don\'t give up — perseverance is key in Islam'}
          </motion.p>
        </motion.div>

        {/* Result Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card
            className="border-0 shadow-2xl overflow-hidden"
            style={{
              backgroundColor: 'rgba(7, 26, 43, 0.85)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(200, 169, 81, 0.15)',
            }}
          >
            <CardContent className="p-6 sm:p-8">
              {/* Speed Icon + Round badge */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <Zap className="w-4 h-4" style={{ color: '#C8A951' }} />
                <span
                  className="text-xs font-semibold tracking-widest uppercase"
                  style={{ color: 'rgba(200, 169, 81, 0.8)' }}
                >
                  Round 02 — Speed Challenge
                </span>
                <Zap className="w-4 h-4" style={{ color: '#C8A951' }} />
              </div>

              {/* Time Display */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col items-center"
                >
                  <Timer className="w-5 h-5 mb-2" style={{ color: '#C8A951' }} />
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: 'rgba(247, 242, 231, 0.5)' }}
                  >
                    {isCorrect ? 'Completion Time' : 'Time Elapsed'}
                  </p>
                  <p
                    className="text-4xl sm:text-5xl font-black tabular-nums timer-glow"
                    style={{
                      color: isCorrect ? '#C8A951' : 'rgba(247, 242, 231, 0.7)',
                    }}
                  >
                    {formatTimerDisplay(isCorrect ? finalTimeMs : serverElapsedMs)}
                  </p>
                </motion.div>
              </div>

              {/* Divider */}
              <div
                className="h-px w-full mb-6"
                style={{ backgroundColor: 'rgba(200, 169, 81, 0.15)' }}
              />

              {/* Status Summary */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex items-center justify-center gap-3 rounded-xl p-4"
                style={{
                  backgroundColor: isCorrect
                    ? 'rgba(34, 197, 94, 0.08)'
                    : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${isCorrect ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                }}
              >
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" style={{ color: '#22c55e' }} />
                    <span
                      className="text-sm font-medium"
                      style={{ color: '#22c55e' }}
                    >
                      Your result has been recorded
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5" style={{ color: '#ef4444' }} />
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'rgba(247, 242, 231, 0.7)' }}
                    >
                      {canRetry
                        ? 'You can try again from the challenge page'
                        : 'No more attempts remaining'}
                    </span>
                  </>
                )}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0 }}
          className="flex flex-col gap-3 mt-5"
        >
          <Button
            onClick={handleLeaderboard}
            className="w-full h-12 text-sm font-semibold rounded-xl"
            style={{
              backgroundColor: '#C8A951',
              color: '#071A2B',
            }}
          >
            <BarChart3 className="w-4 h-4" />
            View Leaderboard
          </Button>

          {canRetry && (
            <Button
              onClick={() => navigate('round2-challenge')}
              variant="outline"
              className="w-full h-11 text-sm font-medium rounded-xl"
              style={{
                borderColor: 'rgba(200, 169, 81, 0.3)',
                color: '#C8A951',
                backgroundColor: 'rgba(200, 169, 81, 0.08)',
              }}
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
          )}

          <Button
            onClick={handleBackHome}
            variant="outline"
            className="w-full h-11 text-sm font-medium rounded-xl"
            style={{
              borderColor: 'rgba(200, 169, 81, 0.3)',
              color: 'rgba(247, 242, 231, 0.8)',
              backgroundColor: 'rgba(200, 169, 81, 0.05)',
            }}
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </motion.div>

        {/* Decorative Stars */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          transition={{ duration: 1, delay: 1.3 }}
          className="flex justify-center mt-6"
        >
          <Star className="w-4 h-4 mx-1" style={{ color: '#C8A951' }} />
          <Star className="w-3 h-3 mx-1 mt-0.5" style={{ color: '#C8A951' }} />
          <Star className="w-5 h-5 mx-1" style={{ color: '#C8A951' }} />
          <Star className="w-3 h-3 mx-1 mt-0.5" style={{ color: '#C8A951' }} />
          <Star className="w-4 h-4 mx-1" style={{ color: '#C8A951' }} />
        </motion.div>
      </motion.div>
    </div>
  );
}
