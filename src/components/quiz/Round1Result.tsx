'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/lib/store';
import { Trophy, CheckCircle2, XCircle, Timer, Home, BarChart3, Star } from 'lucide-react';

export default function Round1Result() {
  const {
    round1Result,
    navigate,
    resetQuiz,
  } = useAppStore();

  // If somehow navigated here without a result, redirect
  useEffect(() => {
    if (!round1Result) {
      navigate('landing');
    }
  }, [round1Result, navigate]);

  if (!round1Result) return null;

  const { score, totalQuestions, correctAnswers, incorrectAnswers, completionTimeMs } = round1Result;
  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  const formatTime = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (circumference * percentage) / 100;

  const handleLeaderboard = () => {
    navigate('round1-leaderboard');
  };

  const handleBackHome = () => {
    resetQuiz();
    navigate('landing');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(160deg, #063B2D 0%, #071A2B 60%, #0a2340 100%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-lg"
      >
        {/* Submission Recorded Heading */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-6"
        >
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
            style={{ backgroundColor: 'rgba(200, 169, 81, 0.15)' }}
          >
            <CheckCircle2 className="w-7 h-7" style={{ color: '#C8A951' }} />
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-wide"
            style={{ color: '#F7F2E7' }}
          >
            SUBMISSION RECORDED
          </h1>
          <p
            className="text-sm mt-2"
            style={{ color: 'rgba(247, 242, 231, 0.6)' }}
          >
            JazakAllahu Khairan for your participation
          </p>
        </motion.div>

        {/* Score Circle Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
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
              {/* Score Circle */}
              <div className="flex justify-center mb-6">
                <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                  <svg
                    className="w-full h-full -rotate-90"
                    viewBox="0 0 180 180"
                  >
                    {/* Background circle */}
                    <circle
                      cx="90"
                      cy="90"
                      r="80"
                      fill="none"
                      stroke="rgba(247, 242, 231, 0.08)"
                      strokeWidth="8"
                    />
                    {/* Progress circle */}
                    <motion.circle
                      cx="90"
                      cy="90"
                      r="80"
                      fill="none"
                      stroke="#C8A951"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset }}
                      transition={{ duration: 1.2, delay: 0.5, ease: 'easeOut' }}
                    />
                  </svg>
                  {/* Score Text Inside Circle */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: 0.8 }}
                      className="text-4xl sm:text-5xl font-bold"
                      style={{ color: '#C8A951' }}
                    >
                      {correctAnswers}<span
                        className="text-xl sm:text-2xl font-medium"
                        style={{ color: 'rgba(200, 169, 81, 0.6)' }}
                      >
                        /{totalQuestions}
                      </span>
                    </motion.span>
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.4, delay: 1.0 }}
                      className="text-sm font-medium mt-1"
                      style={{ color: 'rgba(247, 242, 231, 0.5)' }}
                    >
                      {percentage}%
                    </motion.span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div
                className="h-px w-full mb-6"
                style={{ backgroundColor: 'rgba(200, 169, 81, 0.15)' }}
              />

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {/* Correct */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.9 }}
                  className="flex flex-col items-center gap-2 rounded-xl p-3 sm:p-4"
                  style={{
                    backgroundColor: 'rgba(6, 59, 45, 0.5)',
                    border: '1px solid rgba(200, 169, 81, 0.1)',
                  }}
                >
                  <CheckCircle2 className="w-5 h-5" style={{ color: '#4ade80' }} />
                  <span
                    className="text-xl sm:text-2xl font-bold"
                    style={{ color: '#F7F2E7' }}
                  >
                    {correctAnswers}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'rgba(247, 242, 231, 0.5)' }}
                  >
                    Correct
                  </span>
                </motion.div>

                {/* Incorrect */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 1.0 }}
                  className="flex flex-col items-center gap-2 rounded-xl p-3 sm:p-4"
                  style={{
                    backgroundColor: 'rgba(6, 59, 45, 0.5)',
                    border: '1px solid rgba(200, 169, 81, 0.1)',
                  }}
                >
                  <XCircle className="w-5 h-5" style={{ color: '#f87171' }} />
                  <span
                    className="text-xl sm:text-2xl font-bold"
                    style={{ color: '#F7F2E7' }}
                  >
                    {incorrectAnswers}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'rgba(247, 242, 231, 0.5)' }}
                  >
                    Incorrect
                  </span>
                </motion.div>

                {/* Time */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 1.1 }}
                  className="flex flex-col items-center gap-2 rounded-xl p-3 sm:p-4"
                  style={{
                    backgroundColor: 'rgba(6, 59, 45, 0.5)',
                    border: '1px solid rgba(200, 169, 81, 0.1)',
                  }}
                >
                  <Timer className="w-5 h-5" style={{ color: '#C8A951' }} />
                  <span
                    className="text-lg sm:text-xl font-bold"
                    style={{ color: '#F7F2E7' }}
                  >
                    {formatTime(completionTimeMs)}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: 'rgba(247, 242, 231, 0.5)' }}
                  >
                    Time Taken
                  </span>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.3 }}
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
          transition={{ duration: 1, delay: 1.5 }}
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
