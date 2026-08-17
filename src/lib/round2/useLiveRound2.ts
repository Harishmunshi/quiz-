'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { OrderItem, Round2State } from './live';

/**
 * Adaptive polling for the Round 2 live state.
 *
 * REVISION POLLING
 * Screens poll `/tick`, not `/state`. The tick is one cached settings read plus
 * one indexed COUNT, and it answers a single question: has anything changed?
 * Only when its `rev` string differs does the client pull the full state, which
 * is several queries and the entire question body.
 *
 * The effect during a live round: thirty phones polling twice a second cost
 * thirty cheap counts per second instead of a hundred and fifty real queries,
 * and the expensive fetch happens at the handful of moments per question when
 * the quiz master actually presses something. Cheaper AND faster — which is why
 * the fast interval could come down from 800ms to 500ms.
 *
 * Cadence:
 *   - 500ms while a question is open or being locked/revealed
 *   - 2000ms while idle
 *   - paused entirely when the tab is hidden
 *   - a full resync every 10s regardless, so a change the revision cannot see
 *     (an admin disqualifying someone mid-round) still lands quickly
 *
 * Requests never overlap: a slow response on weak wifi cannot pile up into a
 * queue that then applies out of order. `refresh()` is exposed so a screen can
 * pull immediately after an action instead of waiting for the next tick.
 */

const FAST_MS = 500;
const SLOW_MS = 2000;
/** Belt-and-braces full refetch, catching anything `rev` does not cover. */
const RESYNC_MS = 10_000;

export interface MyAnswer {
  submittedOrder: string[];
  responseTimeMs: number;
  isCorrect: boolean | null;
  correctPositions: number | null;
  /** Submitted after the question's time limit: graded and shown, but scores 0. */
  late: boolean;
}

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
  /** This question's own start line. Null means it has not been started. */
  openedAt?: string | null;
  /** Non-null once its answer key is public — the question is then closed. */
  revealedAt?: string | null;
  /** Whether this student may still submit this question. */
  answerable?: boolean;
  /** This student's answer to THIS question. */
  myAnswer?: MyAnswer | null;
  /** Correct sequence — present only after this question's own reveal. */
  correctOrder?: string[] | null;
  answerCount?: number;
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
  /** The question the board is on. Still here for the projector and admin. */
  question: LiveQuestion | null;
  correctOrder: string[] | null;
  answerCount: number;
  myAnswer: MyAnswer | null;
  /**
   * Every question that has been started, each carrying this student's own
   * answer and whether they may still submit it.
   *
   * The student screen drives its question switcher from this. Before it existed
   * the client only ever held the one question the board was showing, so going
   * back to Q1 was impossible on the screen even once the API allowed it.
   */
  questions: LiveQuestion[];
  /** How many questions this student could still answer right now. */
  answerableCount: number;
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
  const rev = useRef<string | null>(null);
  const lastFull = useRef(0);

  const onFailure = useCallback(() => {
    failures.current += 1;
    // One dropped request on school wifi is normal; only tell the student
    // something is wrong once it's clearly not recovering.
    if (failures.current >= 3) setConnected(false);
  }, []);

  const onSuccess = useCallback((serverNow: string) => {
    clockOffset.current = new Date(serverNow).getTime() - Date.now();
    setError(null);
    setConnected(true);
    failures.current = 0;
  }, []);

  /** Pull the whole payload. Used on mount, on a revision change, and on resync. */
  const fetchState = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const qs = participantId ? `?participantId=${encodeURIComponent(participantId)}` : '';
      const res = await fetch(`/api/round2/live/state${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        stateRef.current = json.data.state;
        lastFull.current = Date.now();
        setLive(json.data as LiveState);
        onSuccess(json.data.serverNow);
      } else {
        setError(json.error ?? 'Could not reach the competition server');
      }
    } catch {
      onFailure();
    } finally {
      inFlight.current = false;
    }
  }, [participantId, onSuccess, onFailure]);

  /**
   * The cheap poll. Escalates to a full fetch only when the revision moves,
   * when the periodic resync is due, or when we have no state at all yet.
   */
  const poll = useCallback(async () => {
    if (inFlight.current) return;
    try {
      const res = await fetch('/api/round2/live/tick', { cache: 'no-store' });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Could not reach the competition server');
        return;
      }

      onSuccess(json.data.serverNow);

      const changed = rev.current !== json.data.rev;
      rev.current = json.data.rev;

      if (changed || !live || Date.now() - lastFull.current > RESYNC_MS) {
        await fetchState();
        return;
      }

      // Nothing structural moved. Fold in the one number that does move
      // continuously, without paying for the full payload.
      setLive((prev) =>
        prev && prev.answerCount !== json.data.answerCount
          ? { ...prev, answerCount: json.data.answerCount }
          : prev
      );
    } catch {
      onFailure();
    }
  }, [fetchState, live, onSuccess, onFailure]);

  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const delay = stateRef.current === 'idle' ? SLOW_MS : FAST_MS;
      timer.current = setTimeout(tick, delay);
    };

    const tick = async () => {
      if (document.visibilityState === 'visible') await pollRef.current();
      schedule();
    };

    // Coming back to the tab should feel instant, not "wait for the next tick".
    const onVisible = () => {
      if (document.visibilityState === 'visible') pollRef.current();
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
    /** The current server revision — screens use it to know when to refetch. */
    revision: rev,
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
