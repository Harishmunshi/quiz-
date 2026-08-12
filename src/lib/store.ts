import { create } from 'zustand';
import type { AppView, Round1LeaderboardEntry, Round2LeaderboardEntry, QuizQuestion } from '@/types/competition';
import type { CompetitionSettings, Participant } from '@/types/database';

interface AppState {
  // Navigation
  currentView: AppView;
  previousView: AppView | null;
  navigate: (view: AppView) => void;
  goBack: () => void;

  // Auth
  isAdmin: boolean;
  adminToken: string | null;
  adminName: string | null;
  setAdmin: (token: string, name: string) => void;
  logoutAdmin: () => void;

  // Participant
  participant: Participant | null;
  setParticipant: (p: Participant | null) => void;

  // Competition
  competitionSettings: CompetitionSettings | null;
  setCompetitionSettings: (s: CompetitionSettings) => void;

  // Round 1
  quizQuestions: QuizQuestion[];
  attemptId: string | null;
  currentQuestionIndex: number;
  selectedAnswers: Record<string, string>;
  quizStartTime: number | null;
  quizTimeLimit: number;
  round1Result: { score: number; totalQuestions: number; correctAnswers: number; incorrectAnswers: number; completionTimeMs: number } | null;
  setQuizQuestions: (q: QuizQuestion[]) => void;
  setAttemptId: (id: string | null) => void;
  setCurrentQuestionIndex: (i: number) => void;
  selectAnswer: (questionId: string, option: string) => void;
  startQuiz: (startTime: number, timeLimit: number) => void;
  setRound1Result: (r: AppState['round1Result']) => void;
  resetQuiz: () => void;

  // Round 2
  round2AttemptId: string | null;
  round2StartTime: number | null;
  round2Result: { isCorrect: boolean; serverElapsedMs: number; finalTimeMs: number; canRetry: boolean; remainingAttempts: number } | null;
  setRound2AttemptId: (id: string | null) => void;
  setRound2StartTime: (t: number) => void;
  setRound2Result: (r: AppState['round2Result']) => void;
  resetRound2: () => void;

  // Leaderboards
  round1Leaderboard: Round1LeaderboardEntry[];
  round2Leaderboard: Round2LeaderboardEntry[];
  setRound1Leaderboard: (entries: Round1LeaderboardEntry[]) => void;
  setRound2Leaderboard: (entries: Round2LeaderboardEntry[]) => void;

  // Realtime
  realtimeStatus: 'connected' | 'disconnected' | 'reconnecting';
  setRealtimeStatus: (s: 'connected' | 'disconnected' | 'reconnecting') => void;

  // Language selection
  selectedLanguage: 'english' | 'gujarati';
  setSelectedLanguage: (lang: 'english' | 'gujarati') => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentView: 'landing',
  previousView: null,
  navigate: (view) => set({ previousView: get().currentView, currentView: view }),
  goBack: () => {
    const prev = get().previousView;
    if (prev) set({ currentView: prev, previousView: 'landing' });
    else set({ currentView: 'landing' });
  },

  // Auth
  isAdmin: false,
  adminToken: null,
  adminName: null,
  setAdmin: (token, name) => set({ isAdmin: true, adminToken: token, adminName: name }),
  logoutAdmin: () => set({ isAdmin: false, adminToken: null, adminName: null, currentView: 'landing' }),

  // Participant
  participant: null,
  setParticipant: (p) => set({ participant: p }),

  // Competition
  competitionSettings: null,
  setCompetitionSettings: (s) => set({ competitionSettings: s }),

  // Round 1
  quizQuestions: [],
  attemptId: null,
  currentQuestionIndex: 0,
  selectedAnswers: {},
  quizStartTime: null,
  quizTimeLimit: 0,
  round1Result: null,
  setQuizQuestions: (q) => set({ quizQuestions: q }),
  setAttemptId: (id) => set({ attemptId: id }),
  setCurrentQuestionIndex: (i) => set({ currentQuestionIndex: i }),
  selectAnswer: (questionId, option) => set((s) => ({ selectedAnswers: { ...s.selectedAnswers, [questionId]: option } })),
  startQuiz: (startTime, timeLimit) => set({ quizStartTime: startTime, quizTimeLimit: timeLimit }),
  setRound1Result: (r) => set({ round1Result: r }),
  resetQuiz: () => set({ quizQuestions: [], attemptId: null, currentQuestionIndex: 0, selectedAnswers: {}, quizStartTime: null, quizTimeLimit: 0, round1Result: null }),

  // Round 2
  round2AttemptId: null,
  round2StartTime: null,
  round2Result: null,
  setRound2AttemptId: (id) => set({ round2AttemptId: id }),
  setRound2StartTime: (t) => set({ round2StartTime: t }),
  setRound2Result: (r) => set({ round2Result: r }),
  resetRound2: () => set({ round2AttemptId: null, round2StartTime: null, round2Result: null }),

  // Leaderboards
  round1Leaderboard: [],
  round2Leaderboard: [],
  setRound1Leaderboard: (entries) => set({ round1Leaderboard: entries }),
  setRound2Leaderboard: (entries) => set({ round2Leaderboard: entries }),

  // Realtime
  realtimeStatus: 'connected',
  setRealtimeStatus: (s) => set({ realtimeStatus: s }),

  // Language
  selectedLanguage: 'english',
  setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),
}));
