'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderItem, Round2State } from './live';

/**
 * Adaptive polling for the Round 2 live state.
 *
 * Cadence is deliberately uneven:
 *   - 800ms while a question is open or being locked/revealed, so a student
 *     never sits on a stale screen during the part that matters
 *   - 2500ms while idle, so a hall of phones waiting between questions isn't
 *     hammering the database for no reason
 *   - paused entirely when the tab is hidden
 *
 * Requests never overlap: a slow response on weak wifi cannot pile up into a
 * queue that then applies out of order. `refresh()` is exposed so a screen can
 * pull immediately after an action instead of waiting for the next tick.
 */

const FAST_MS = 800;
const SLOW_MS = 2500;

export interface LiveQuestion {
  id: string;
  questionNumber: number;
  type: 'order' | 'mcq';
  titleEnglish: string;
  titleSecondary: string | null;
  promptEnglish: string;
  promptSecondary: string | null;
  items: OrderItem[];
  itemCount: number;
  marks: number;
  timeLimitSec: number;
}

export interface LiveState {
  serverNow: string;
  mode: string;
  round2Status: string;
  state: Round2State;
  currentQuestionNumber: number;
  totalQuestions: number;
  questionSeconds: number;
  openedAt: string | null;
  lockedAt: string | null;
  showAnswer: boolean;
  /** Server-computed entry gate for this participant. */
  gate: {
    requiresQualify: boolean;
    requiresPin: boolean;
    qualified: boolean;
    joined: boolean;
    disqualified: boolean;
    blocked: null | 'NOT_QUALIFIED' | 'DISQUALIFIED' | 'NEEDS_PIN';
  } | null;
  /** Whether a PIN has been generated. The PIN value itself never reaches a student. */
  pinIsSet: boolean;
  question: LiveQuestion | null;
  correctOrder: string[] | null;
  answerCount: number;
  myAnswer: {
    submittedOrder: string[];
    responseTimeMs: number;
    isCorrect: boolean | null;
    correctPositions: number | null;
  } | null;
}

export function useLiveRound2(participantId?: string | null) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);

  // Difference between server and device clocks, applied only when drawing the
  // countdown. Scoring is always computed server-side.
  const clockOffset = useRef(0);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<Round2State>('idle');
  const failures = useRef(0);

  const fetchState = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const qs = participantId ? `?participantId=${encodeURIComponent(participantId)}` : '';
      const res = await fetch(`/api/round2/live/state${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        clockOffset.current = new Date(json.data.serverNow).getTime() - Date.now();
        stateRef.current = json.data.state;
        setLive(json.data as LiveState);
        setError(null);
        setConnected(true);
        failures.current = 0;
      } else {
        setError(json.error ?? 'Could not reach the competition server');
      }
    } catch {
      failures.current += 1;
      // One dropped request on school wifi is normal; only tell the student
      // something is wrong once it's clearly not recovering.
      if (failures.current >= 3) setConnected(false);
    } finally {
      inFlight.current = false;
    }
  }, [participantId]);

  useEffect(() => {
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const s = stateRef.current;
      const delay = s === 'idle' ? SLOW_MS : FAST_MS;
      timer.current = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (document.visibilityState === 'visible') await fetchState();
      schedule();
    };

    // Coming back to the tab should feel instant, not "wait for the next tick".
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchState();
    };

    fetchState();
    schedule();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchState]);

  return {
    live,
    error,
    connected,
    clockOffset,
    refresh: fetchState,
    /** Apply a local change immediately rather than waiting for the next poll. */
    patch: (fn: (prev: LiveState) => LiveState) =>
      setLive((prev) => (prev ? fn(prev) : prev)),
  };
}

/**
 * A countdown driven by requestAnimationFrame rather than setInterval.
 *
 * setInterval at 100ms visibly stutters and drifts; rAF paints in step with the
 * display, so the milliseconds roll smoothly at 60fps. Returns remaining ms.
 */
export function useCountdown(
  openedAtIso: string | null,
  totalSeconds: number,
  clockOffset: React.RefObject<number>,
  active: boolean
): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!active || !openedAtIso || totalSeconds <= 0) {
      setRemaining(null);
      return;
    }
    const openedAt = new Date(openedAtIso).getTime();
    const totalMs = totalSeconds * 1000;
    let raf = 0;

    const frame = () => {
      const serverNow = Date.now() + (clockOffset.current ?? 0);
      setRemaining(Math.max(0, totalMs - (serverNow - openedAt)));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [openedAtIso, totalSeconds, active, clockOffset]);

  return remaining;
}
