import type { AppView } from '@/types/competition';

/**
 * The map behind the app's client-side router.
 *
 * WHY THIS FILE EXISTS
 * `/` is a single URL that swaps between eighteen views held in Zustand. That
 * was fine while every screen was a dead end, but it means:
 *
 *   - the browser Back button does nothing, because no history entry is ever
 *     pushed. On a phone the hardware back button closes the tab instead of
 *     going back a screen;
 *   - a refresh always drops you at the landing page;
 *   - several screens (the admin sections in particular) had no visible way out
 *     at all, so the only escape was retyping the URL.
 *
 * This table gives every view a parent, a label and a restore policy. The nav
 * bar and the history sync both read from it, so "where does back go" is
 * answered in exactly one place rather than re-decided per screen.
 */

export interface ViewMeta {
  /** Shown in the nav bar. */
  label: string;
  /** Where the Back button goes. `null` means this view is a root. */
  parent: AppView | null;
  /** Section name, shown small above the label to give a sense of place. */
  section?: string;
  /**
   * Leaving loses work — an attempt in progress. These views get no Back
   * button, and the hardware back button is absorbed rather than obeyed.
   */
  guarded?: boolean;
  /** Projector screens: full bleed, no chrome over the top. */
  chromeless?: boolean;
  /**
   * Safe to land on directly after a refresh or a shared link. Views that
   * depend on in-memory state (a loaded question set, a finished attempt) are
   * not, and fall back to their parent.
   */
  restorable?: boolean;
  /** Requires an admin session; falls back to the login screen without one. */
  requiresAdmin?: boolean;
}

export const VIEWS: Record<AppView, ViewMeta> = {
  landing: { label: 'Home', parent: null, restorable: true },

  register: { label: 'Registration', parent: 'landing', section: 'Round 1' },
  'round1-quiz': { label: 'Round 1', parent: 'landing', section: 'Round 1', guarded: true },
  'round1-result': { label: 'Your result', parent: 'landing', section: 'Round 1' },
  'round1-leaderboard': {
    label: 'Round 1 leaderboard',
    parent: 'landing',
    section: 'Standings',
    restorable: true,
  },

  'round2-landing': { label: 'Round 2', parent: 'landing', section: 'Round 2', restorable: true },
  'round2-challenge': { label: 'Round 2', parent: 'round2-landing', section: 'Round 2', guarded: true },
  'round2-result': { label: 'Your result', parent: 'round2-landing', section: 'Round 2' },
  'round2-leaderboard': {
    label: 'Round 2 leaderboard',
    parent: 'landing',
    section: 'Standings',
    restorable: true,
  },

  'admin-login': { label: 'Admin sign in', parent: 'landing', section: 'Admin', restorable: true },
  'admin-dashboard': {
    label: 'Dashboard',
    parent: 'landing',
    section: 'Admin',
    restorable: true,
    requiresAdmin: true,
  },
  'admin-questions': {
    label: 'Questions',
    parent: 'admin-dashboard',
    section: 'Admin',
    restorable: true,
    requiresAdmin: true,
  },
  'admin-participants': {
    label: 'Participants',
    parent: 'admin-dashboard',
    section: 'Admin',
    restorable: true,
    requiresAdmin: true,
  },
  'admin-results': {
    label: 'Results',
    parent: 'admin-dashboard',
    section: 'Admin',
    restorable: true,
    requiresAdmin: true,
  },
  'admin-settings': {
    label: 'Settings',
    parent: 'admin-dashboard',
    section: 'Admin',
    restorable: true,
    requiresAdmin: true,
  },

  'display-qr': {
    label: 'Join code',
    parent: 'admin-dashboard',
    section: 'Projector',
    chromeless: true,
    restorable: true,
  },
  'display-leaderboard': {
    label: 'Leaderboard',
    parent: 'admin-dashboard',
    section: 'Projector',
    chromeless: true,
    restorable: true,
  },
};

const ALL_VIEWS = Object.keys(VIEWS) as AppView[];

/** Narrow an arbitrary string (a URL hash, say) to a real view. */
export function isAppView(value: string | null | undefined): value is AppView {
  return typeof value === 'string' && (ALL_VIEWS as string[]).includes(value);
}

/**
 * Which view a fresh page load should show, given the URL hash.
 *
 * Anything that depends on state we no longer have — a quiz mid-flight, a
 * result screen — falls back to its parent rather than rendering empty.
 */
export function resolveInitialView(hash: string | null, isAdmin: boolean): AppView {
  const raw = (hash || '').replace(/^#\/?/, '');
  if (!isAppView(raw)) return 'landing';
  const meta = VIEWS[raw];
  if (!meta.restorable) return meta.parent ?? 'landing';
  if (meta.requiresAdmin && !isAdmin) return 'admin-login';
  return raw;
}

/** The hash written to the address bar for a view. */
export function hashForView(view: AppView): string {
  return view === 'landing' ? '#/' : `#/${view}`;
}
