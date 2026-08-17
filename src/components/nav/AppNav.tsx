'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Home, LogOut } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { VIEWS } from '@/lib/navigation';
import { SCHOOL_LOGO_URL } from '@/lib/theme';

/**
 * The bar that makes the app navigable.
 *
 * Before this, every screen past the landing page was a one-way door: the app
 * lives at a single URL, so the browser's own Back button had nothing to go
 * back to, and most screens shipped no exit of their own. Signing into the
 * admin panel meant retyping the address to get out.
 *
 * It renders on every screen except the landing page and the two projector
 * views, which are deliberately chromeless — a nav bar has no business being
 * on a hall screen.
 *
 * The trail (Home › Admin › Questions) is not decoration. On a phone, one
 * unlabelled arrow leaves you guessing where it goes; naming the destination
 * removes the guess.
 */
export default function AppNav() {
  const { currentView, navigate, isAdmin, logoutAdmin } = useAppStore();
  const meta = VIEWS[currentView];

  if (!meta || currentView === 'landing') return null;

  // Projector screens carry no bar — but they still need an exit. Before this,
  // the QR screen and the hall leaderboard were genuine dead ends: reachable
  // from the dashboard in one click, and escapable only by retyping the URL.
  // A dim corner button stays invisible from ten metres away and is obvious to
  // whoever is standing at the laptop.
  if (meta.chromeless) {
    return (
      <button
        type="button"
        onClick={() => navigate(meta.parent ?? 'landing')}
        aria-label="Leave the projector view"
        className="fixed left-4 top-4 z-50 flex items-center gap-2 rounded-full border border-[#FFB000]/30 bg-white/25 px-3 py-2 text-sm font-semibold text-[#0A0D14] opacity-25 backdrop-blur-sm transition-all hover:bg-white/90 hover:opacity-100 focus-visible:opacity-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Exit
      </button>
    );
  }

  // Guarded views (a quiz in flight) get no exit — leaving forfeits the
  // attempt, and an accidental tap on a phone is far too easy.
  const backTo = meta.guarded ? null : meta.parent;

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="sticky top-0 z-40 border-b border-[#FFB000]/25 bg-[#F4F5F7]/85 backdrop-blur-md"
    >
      <nav className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-4">
        {backTo ? (
          <button
            type="button"
            onClick={() => navigate(backTo)}
            aria-label={`Back to ${VIEWS[backTo].label}`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#FFB000]/35 bg-white/70 px-2.5 py-1.5 text-sm font-semibold text-[#0A0D14] transition-colors hover:bg-white active:scale-[0.98] sm:px-3"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{VIEWS[backTo].label}</span>
            <span className="sm:hidden">Back</span>
          </button>
        ) : (
          <span className="shrink-0 rounded-xl bg-[#B3261E]/10 px-2.5 py-1.5 text-xs font-semibold text-[#B3261E]">
            In progress
          </span>
        )}

        {/* Home is always reachable in one tap, whatever the trail says. */}
        {!meta.guarded && (
          <button
            type="button"
            onClick={() => navigate('landing')}
            aria-label="Go to the home page"
            className="flex shrink-0 items-center justify-center rounded-xl border border-transparent p-2 text-[#5B6472] transition-colors hover:bg-white/70 hover:text-[#0A0D14]"
          >
            <Home className="h-4 w-4" />
          </button>
        )}

        {/* Trail */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SCHOOL_LOGO_URL}
            alt=""
            className="hidden h-7 w-7 shrink-0 rounded-full object-contain sm:block"
          />
          {meta.section && (
            <>
              <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-[#966700] sm:inline">
                {meta.section}
              </span>
              <ChevronRight className="hidden h-3 w-3 shrink-0 text-[#5B6472]/40 sm:block" />
            </>
          )}
          <span className="truncate text-sm font-bold text-[#0A0D14]">{meta.label}</span>
        </div>

        {isAdmin && meta.section === 'Admin' && (
          <button
            type="button"
            onClick={logoutAdmin}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-[#5B6472] transition-colors hover:bg-white/70 hover:text-[#B3261E]"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        )}
      </nav>
    </motion.header>
  );
}
