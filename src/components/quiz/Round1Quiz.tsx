'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAppStore } from '@/lib/store';
import OrnateStage from '@/components/quiz/OrnateStage';
import { ChevronLeft, ChevronRight, Send, Clock, AlertCircle, Loader2, BookOpen } from 'lucide-react';
import type { QuizQuestion } from '@/types/competition';

const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

type ApiQuestion = {
  id: string;
  questionNumber: number;
  englishQuestion: string;
  gujaratiQuestion: string;
  optionAEnglish: string;
  optionBEnglish: string;
  optionCEnglish: string;
  optionDEnglish: string;
  optionAGujarati: string;
  optionBGujarati: string;
  optionCGujarati: string;
  optionDGujarati: string;
};

export default function Round1Quiz() {
  const {
    quizQuestions,
    currentQuestionIndex,
    selectedAnswers,
    quizStartTime,
    quizTimeLimit,
    attemptId,
    competitionSettings,
    participant,
    selectedLanguage,
    setSelectedLanguage,
    setQuizQuestions,
    setAttemptId,
    setCurrentQuestionIndex,
    selectAnswer,
    startQuiz,
    setRound1Result,
    navigate,
  } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timeExpired, setTimeExpired] = useState(false);
  const hasInitialized = useRef(false);
  const hasSubmitted = useRef(false);

  // ── Timer Effect ───────────────────────────────────────────
  useEffect(() => {
    if (!quizStartTime || quizTimeLimit <= 0) return;

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - quizStartTime) / 1000);
      const remaining = Math.max(0, quizTimeLimit - elapsed);
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        setTimeExpired(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [quizStartTime, quizTimeLimit]);

  // ── Auto-submit on time expiry ─────────────────────────────
  useEffect(() => {
    if (timeExpired && !hasSubmitted.current) {
      handleSubmit();
    }
  }, [timeExpired]);

  // ── Initialize Quiz ────────────────────────────────────────
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initQuiz = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 1. Fetch competition settings
        const settingsRes = await fetch('/api/competition');
        if (!settingsRes.ok) throw new Error('Failed to fetch competition settings');
        const settingsData = await settingsRes.json();
        const settings = settingsData.data;

        if (!settings || settings.round1Status !== 'open') {
          setError('This round is currently closed. Please wait for the administrator to open it.');
          setIsLoading(false);
          return;
        }

        if (!participant?.id) {
          setError('Participant information not found. Please register again.');
          setIsLoading(false);
          return;
        }

        // 2. Start attempt
        const startRes = await fetch('/api/round1/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId: participant.id }),
        });
        if (!startRes.ok) {
          const errData = await startRes.json();
          throw new Error(errData.error || 'Failed to start attempt');
        }
        const startData = await startRes.json();
        const newAttemptId = startData.data?.attemptId;

        // 3. Fetch questions
        const questionsRes = await fetch('/api/round1/questions');
        if (!questionsRes.ok) throw new Error('Failed to fetch questions');
        const questionsData = await questionsRes.json();
        const rawQuestions: ApiQuestion[] = questionsData.data;

        // 4. Keep BOTH languages. Which one is shown is decided at render time,
        //    so a student can switch mid-paper without losing their answers or
        //    re-reading the questions. Flattening to one here is what previously
        //    made the choice permanent for the whole attempt.
        const transformed: QuizQuestion[] = rawQuestions.map((q) => ({
          id: q.id,
          questionNumber: q.questionNumber,
          questionText: q.englishQuestion,
          questionTextSecondary: q.gujaratiQuestion,
          options: {
            A: q.optionAEnglish,
            B: q.optionBEnglish,
            C: q.optionCEnglish,
            D: q.optionDEnglish,
          },
          optionsSecondary: {
            A: q.optionAGujarati,
            B: q.optionBGujarati,
            C: q.optionCGujarati,
            D: q.optionDGujarati,
          },
        }));

        // 5. Populate store
        setQuizQuestions(transformed);
        setAttemptId(newAttemptId);
        startQuiz(Date.now(), settings.round1TimeLimit || 0);
        setCurrentQuestionIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    initQuiz();
  }, [
    participant,
    // selectedLanguage is deliberately NOT a dependency. Both languages are
    // fetched once and the toggle only changes which is rendered; leaving it
    // here would re-run initQuiz on every switch, which calls /round1/start
    // again and would restart the student’s attempt mid-paper.
    setQuizQuestions,
    setAttemptId,
    setCurrentQuestionIndex,
    startQuiz,
  ]);

  // ── Submit Handler ─────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (isSubmitting || hasSubmitted.current || !attemptId) return;

    hasSubmitted.current = true;
    setIsSubmitting(true);

    try {
      const answers = Object.entries(selectedAnswers).map(([qId, opt]) => ({
        questionId: qId,
        selectedOption: opt as 'A' | 'B' | 'C' | 'D',
      }));

      const res = await fetch('/api/round1/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, answers }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Submission failed');
      }

      const data = await res.json();

      setRound1Result({
        score: data.score ?? 0,
        totalQuestions: data.totalQuestions,
        correctAnswers: data.correctAnswers,
        incorrectAnswers: data.incorrectAnswers,
        completionTimeMs: data.completionTimeMs,
      });

      navigate('round1-result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      hasSubmitted.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }, [attemptId, selectedAnswers, isSubmitting, setRound1Result, navigate]);

  // ── Helpers ────────────────────────────────────────────────
  const currentQuestion = quizQuestions[currentQuestionIndex];
  const totalQuestions = quizQuestions.length;
  const progressPercent = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;
  const answeredCount = Object.keys(selectedAnswers).length;

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── Loading State ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(160deg, #0A0D14 0%, #0A0D14 60%, #141A26 100%)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div
            className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(200, 169, 81, 0.15)' }}
          >
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#966700' }} />
          </div>
          <p className="text-lg font-medium" style={{ color: '#F4F5F7' }}>
            Preparing your quiz…
          </p>
          <p className="text-sm mt-2" style={{ color: 'rgba(247, 242, 231, 0.6)' }}>
            May Allah bless your knowledge
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────
  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(160deg, #0A0D14 0%, #0A0D14 60%, #141A26 100%)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
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
                className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
              >
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: '#F4F5F7' }}>
                {error.includes('closed') ? 'Round Closed' : 'Error'}
              </h2>
              <p className="text-sm mb-6" style={{ color: 'rgba(247, 242, 231, 0.7)' }}>
                {error}
              </p>
              <Button
                onClick={() => navigate('landing')}
                className="w-full h-11 text-sm font-medium"
                style={{
                  backgroundColor: '#FFB000',
                  color: '#0A0D14',
                }}
              >
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Main Quiz UI ───────────────────────────────────────────
  return (
    <OrnateStage
      questionNumber={currentQuestionIndex + 1}
      header={
        <>
          {/* Timer Bar */}
          {quizTimeLimit > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-4 flex items-center justify-between rounded-xl px-4 py-2.5"
              style={{
                backgroundColor: remainingSeconds <= 60
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(6, 59, 45, 0.6)',
                border: remainingSeconds <= 60
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : '1px solid rgba(200, 169, 81, 0.2)',
              }}
            >
              <div className="flex items-center gap-2">
                <Clock
                  className="w-4 h-4"
                  style={{
                    color: remainingSeconds <= 60 ? '#f87171' : '#FFB000',
                  }}
                />\n                <span
                  className="text-sm font-medium"
                  style={{
                    color: remainingSeconds <= 60 ? '#f87171' : 'rgba(247, 242, 231, 0.8)',
                  }}
                >
                  Time Remaining
                </span>
              </div>
              <span
                className="text-lg font-bold tabular-nums"
                style={{
                  color: remainingSeconds <= 60 ? '#f87171' : '#FFB000',
                }}
              >
                {formatTime(remainingSeconds)}
              </span>
            </motion.div>
          )}

          {/* Progress Info */}
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-sm font-medium"
              style={{ color: 'rgba(247, 242, 231, 0.7)' }}
            >
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </span>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                backgroundColor: 'rgba(200, 169, 81, 0.15)',
                color: '#966700',
              }}
            >
              {answeredCount}/{totalQuestions} answered
            </span>
          </div>

          {/* Progress Bar */}
          <div
            className="h-2 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(247, 242, 231, 0.1)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: '#FFB000' }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </>
      }
    >
      <div className="w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Card
                className="border-0 shadow-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, #FBF7EC 0%, #F3EBD9 100%)',
                  boxShadow:
                    '0 0 0 1px rgba(227,192,92,0.55), 0 0 0 5px rgba(0,0,0,0.30), 0 30px 70px -24px rgba(0,0,0,0.8)',
                }}
              >
                <CardContent className="p-5 sm:p-8">
                  {/* Question Number Badge */}
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold shrink-0"
                      style={{
                        background: 'linear-gradient(180deg, #F0D98A 0%, #D9B24C 100%)',
                        color: '#3B2E08',
                      }}
                    >
                      {currentQuestion?.questionNumber}
                    </div>
                    <BookOpen
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'rgba(154, 118, 28, 0.55)' }}
                    />

                    {/* Language toggle.
                        Sits on the question card rather than in a settings menu
                        because the moment a student needs it is the moment they
                        cannot read the question in front of them. Switching only
                        changes what is displayed — answers already given are
                        keyed by option letter and are untouched. */}
                    <div
                      className="ml-auto flex shrink-0 items-center overflow-hidden rounded-lg"
                      style={{ border: '1px solid rgba(154,118,28,0.35)' }}
                      role="group"
                      aria-label="Question language"
                    >
                      {(['english', 'gujarati'] as const).map((lang) => {
                        const active = selectedLanguage === lang;
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setSelectedLanguage(lang)}
                            aria-pressed={active}
                            className="px-2.5 py-1 text-[11px] font-bold transition-colors sm:text-xs"
                            style={{
                              background: active
                                ? 'linear-gradient(180deg, #F0D98A 0%, #D9B24C 100%)'
                                : 'transparent',
                              color: active ? '#3B2E08' : 'rgba(154,118,28,0.85)',
                            }}
                          >
                            {lang === 'english' ? 'EN' : 'हिं'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Question Text — reads from whichever language is selected
                      right now, so the toggle takes effect instantly. */}
                  <h2
                    className="mb-6 text-lg leading-relaxed font-semibold sm:text-xl"
                    style={{ color: '#17130B' }}
                  >
                    {selectedLanguage === 'english'
                      ? currentQuestion?.questionText
                      : currentQuestion?.questionTextSecondary}
                  </h2>

                  {/* Options */}
                  <div className="grid gap-3">
                    {OPTION_KEYS.map((key) => {
                      const isSelected =
                        currentQuestion &&
                        selectedAnswers[currentQuestion.id] === key;

                      return (
                        <motion.button
                          key={key}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() =>
                            currentQuestion &&
                            selectAnswer(currentQuestion.id, key)
                          }
                          className="w-full flex items-center gap-3 sm:gap-4 rounded-xl px-4 py-3.5 sm:px-5 sm:py-4 text-left transition-all duration-200 cursor-pointer"
                          style={{
                            background: isSelected
                              ? 'linear-gradient(180deg, #3A2C10 0%, #241A08 100%)'
                              : 'linear-gradient(180deg, #2A2116 0%, #1B150D 100%)',
                            border: isSelected
                              ? '2px solid #E3C05C'
                              : '2px solid rgba(227,192,92,0.28)',
                            boxShadow: isSelected
                              ? '0 6px 20px -8px rgba(227,192,92,0.6)'
                              : 'none',
                          }}
                        >
                          <span
                            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-sm font-bold shrink-0 transition-colors duration-200"
                            style={{
                              background: isSelected
                                ? 'linear-gradient(180deg, #F5E3A8 0%, #E3C05C 100%)'
                                : 'linear-gradient(180deg, #EFE6CE 0%, #D8CBA6 100%)',
                              color: '#2A1F07',
                            }}
                          >
                            {key}
                          </span>
                          <span
                            className="text-base leading-relaxed sm:text-lg"
                            style={{ color: isSelected ? '#FBF3DC' : '#EFE6D2' }}
                          >
                            {selectedLanguage === 'english'
                              ? currentQuestion?.options[key]
                              : currentQuestion?.optionsSecondary[key]}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-5 sm:mt-6 gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              className="h-11 px-5 text-sm font-medium rounded-xl"
              style={{
                borderColor: 'rgba(200, 169, 81, 0.3)',
                color: '#966700',
                backgroundColor: 'rgba(200, 169, 81, 0.05)',
              }}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            {currentQuestionIndex === totalQuestions - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="h-11 px-6 sm:px-8 text-sm font-semibold rounded-xl"
                style={{
                  backgroundColor: isSubmitting
                    ? 'rgba(200, 169, 81, 0.5)'
                    : '#FFB000',
                  color: '#0A0D14',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                className="h-11 px-5 text-sm font-medium rounded-xl"
                style={{
                  backgroundColor: 'rgba(200, 169, 81, 0.15)',
                  color: '#966700',
                  border: '1px solid rgba(200, 169, 81, 0.3)',
                }}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
      </div>

      {/* Submit All Banner (when on non-last question) */}
      {currentQuestionIndex < totalQuestions - 1 && answeredCount === totalQuestions && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 pb-4 sm:px-6 sm:pb-6"
        >
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full h-12 text-sm font-semibold rounded-xl"
              style={{
                backgroundColor: isSubmitting
                  ? 'rgba(200, 169, 81, 0.5)'
                  : '#FFB000',
                color: '#0A0D14',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit All Answers
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </OrnateStage>
  );
}
