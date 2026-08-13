'use client';

/**
 * Participant identity for the standalone /round2 page.
 *
 * The Zustand store lives in memory only, so a participant who opens /round2
 * in a new tab — or whose phone reloads the page mid-round, which happens
 * constantly on school wifi — would otherwise lose their identity and their
 * score. Persisting to localStorage means a reload puts them straight back
 * where they were.
 */

const KEY = 'mes-quiz-participant';

export interface StoredParticipant {
  id: string;
  participantCode: string;
  name: string;
  className: string;
  division: string;
  language: 'english' | 'gujarati';
}

export function loadParticipant(): StoredParticipant | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredParticipant;
    return parsed && typeof parsed.id === 'string' && parsed.id.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveParticipant(p: StoredParticipant): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private browsing / storage full — the session still works for this tab.
  }
}

export function clearParticipant(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* no-op */
  }
}
