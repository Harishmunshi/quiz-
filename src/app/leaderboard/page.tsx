'use client';

import { useRouter } from 'next/navigation';
import LeaderboardView from '@/components/leaderboard/LeaderboardView';

/**
 * The leaderboard on a URL of its own: /leaderboard
 *
 * WHY THIS EXISTS
 * The board was only reachable from inside the app at `/` — as a hash view
 * (`#/round1-leaderboard`) whose state lives in a Zustand store, and from the
 * admin dashboard. That made it impossible to hand out: you could not put it on
 * a projector without first clicking through the app, could not share it with
 * teachers who have no business seeing the admin panel, and a refresh dropped
 * you back at the landing page.
 *
 * This route is public, read-only, and safe to share or leave open on a screen.
 * It reads the same two endpoints the in-app view does — /api/leaderboard/round1
 * and /round2 — which return ranked, already-submitted attempts only. There is
 * no admin session here and nothing on this page can write.
 *
 *   /leaderboard          Round 1 (tabs to Round 2)
 *   /leaderboard?round=2  opens on Round 2
 *
 * Polling and ranking are the component's own; nothing is duplicated here.
 */
export default function LeaderboardPage() {
  const router = useRouter();

  // Read on the client rather than via searchParams so this page needs no
  // Suspense boundary — it is a client component with no server-rendered data.
  const round =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('round') === '2'
      ? 2
      : 1;

  return <LeaderboardView round={round} onBack={() => router.push('/')} />;
}
