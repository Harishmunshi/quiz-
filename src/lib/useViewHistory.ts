'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { VIEWS, hashForView, isAppView, resolveInitialView } from '@/lib/navigation';

/**
 * Ties the Zustand view state to the browser's own history.
 *
 * The app renders eighteen screens at one URL. That is a perfectly reasonable
 * way to build a kiosk-style flow, but it silently breaks the one navigation
 * control every user already knows: Back. On a phone the hardware back button
 * doesn't step back a screen — it leaves the site.
 *
 * So: every view change pushes a history entry with a readable hash
 * (`#/admin-questions`), Back and Forward pop between them, and a refresh lands
 * you where you were instead of at the top.
 *
 * Two deliberate exceptions:
 *
 *   - A view marked `guarded` is a quiz in progress. Back is absorbed — we push
 *     the entry straight back on — because a stray swipe on a phone would
 *     otherwise forfeit a student's attempt mid-competition.
 *   - A view marked `restorable: false` depends on state we only hold in
 *     memory. Reloading onto it would render an empty shell, so it resolves to
 *     its parent instead.
 */
export function useViewHistory() {
  const currentView = useAppStore((s) => s.currentView);
  const restoreView = useAppStore((s) => s.restoreView);
  const isAdminRef = useRef(false);
  isAdminRef.current = useAppStore((s) => s.isAdmin);

  const ready = useRef(false);

  // Seed from the URL, once.
  useEffect(() => {
    const initial = resolveInitialView(window.location.hash, isAdminRef.current);
    window.history.replaceState({ view: initial }, '', hashForView(initial));
    if (initial !== 'landing') restoreView(initial);
    ready.current = true;

    const onPop = (event: PopStateEvent) => {
      const view = useAppStore.getState().currentView;

      // A quiz in flight refuses to be navigated away from. Re-push so the
      // entry we just consumed is back in place for the next attempt.
      if (VIEWS[view]?.guarded) {
        window.history.pushState({ view }, '', hashForView(view));
        return;
      }

      const target =
        (event.state && isAppView(event.state.view) && event.state.view) ||
        resolveInitialView(window.location.hash, useAppStore.getState().isAdmin);

      const meta = VIEWS[target];
      if (meta?.requiresAdmin && !useAppStore.getState().isAdmin) {
        restoreView('admin-login');
        return;
      }
      restoreView(target);
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [restoreView]);

  // Mirror every forward navigation into the history stack.
  useEffect(() => {
    if (!ready.current) return;
    const hash = hashForView(currentView);
    if (window.location.hash === hash) return;
    window.history.pushState({ view: currentView }, '', hash);
  }, [currentView]);

  // Escape backs out, matching the nav bar. Ignored on guarded views and while
  // the user is typing, so it never eats a keystroke in an admin form.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      const meta = VIEWS[useAppStore.getState().currentView];
      if (!meta || meta.guarded || !meta.parent) return;
      window.history.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
