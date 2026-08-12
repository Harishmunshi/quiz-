'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import LandingPage from '@/components/quiz/LandingPage';
import RegistrationForm from '@/components/quiz/RegistrationForm';
import Round1Quiz from '@/components/quiz/Round1Quiz';
import Round1Result from '@/components/quiz/Round1Result';
import LeaderboardView from '@/components/leaderboard/LeaderboardView';
import Round2Landing from '@/components/round2/Round2Landing';
import Round2Challenge from '@/components/round2/Round2Challenge';
import Round2Result from '@/components/round2/Round2Result';
import AdminLogin from '@/components/admin/AdminLogin';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminQuestions from '@/components/admin/AdminQuestions';
import AdminParticipants from '@/components/admin/AdminParticipants';
import AdminResults from '@/components/admin/AdminResults';
import AdminSettings from '@/components/admin/AdminSettings';
import AdminChallenges from '@/components/admin/AdminChallenges';
import QRDisplay from '@/components/display/QRDisplay';
import DisplayLeaderboard from '@/components/display/DisplayLeaderboard';

// Polling interval for leaderboard updates (simulates realtime)
const LEADERBOARD_POLL_MS = 4000;

export default function HomePage() {
  const { currentView, setCompetitionSettings, setRealtimeStatus } = useAppStore();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch competition settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/competition');
        const data = await res.json();
        if (data.success && data.data) {
          setCompetitionSettings(data.data);
        }
      } catch {
        // silently retry
      }
    };
    fetchSettings();
    const interval = setInterval(fetchSettings, 10000);
    return () => clearInterval(interval);
  }, [setCompetitionSettings]);

  // Seed database on first visit
  useEffect(() => {
    fetch('/api/seed', { method: 'POST' }).catch(() => {});
  }, []);

  // Simulate realtime connection status
  useEffect(() => {
    setRealtimeStatus('connected');
  }, [setRealtimeStatus]);

  // Poll leaderboard when on leaderboard views
  useEffect(() => {
    if (currentView === 'round1-leaderboard' || currentView === 'round2-leaderboard' || currentView === 'display-leaderboard') {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        setRealtimeStatus('connected');
      }, LEADERBOARD_POLL_MS);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [currentView, setRealtimeStatus]);

  const renderView = () => {
    switch (currentView) {
      case 'landing':
        return <LandingPage />;
      case 'round2-landing':
        return <Round2Landing />;
      case 'register':
        return <RegistrationForm />;
      case 'round1-quiz':
        return <Round1Quiz />;
      case 'round1-result':
        return <Round1Result />;
      case 'round1-leaderboard':
        return <LeaderboardView round={1} />;
      case 'round2-challenge':
        return <Round2Challenge />;
      case 'round2-result':
        return <Round2Result />;
      case 'round2-leaderboard':
        return <LeaderboardView round={2} />;
      case 'admin-login':
        return <AdminLogin />;
      case 'admin-dashboard':
        return <AdminDashboard />;
      case 'admin-questions':
        return <AdminQuestions />;
      case 'admin-participants':
        return <AdminParticipants />;
      case 'admin-results':
        return <AdminResults />;
      case 'admin-settings':
        return <AdminSettings />;
      case 'display-qr':
        return <QRDisplay />;
      case 'display-leaderboard':
        return <DisplayLeaderboard />;
      default:
        return <LandingPage />;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentView}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="min-h-screen"
      >
        {renderView()}
      </motion.div>
    </AnimatePresence>
  );
}