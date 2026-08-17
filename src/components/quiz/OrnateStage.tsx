'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * The Round 1 hall — a lantern-lit, gold-ornamented ground for the thirty
 * questions to sit in.
 *
 * MEASUREMENTS
 * The whole point of this component is that the question lands in the middle
 * of the screen, at a size a phone can read without pinching, on every device
 * from a 360px handset to a projector. So the geometry is stated once, here,
 * rather than guessed per screen:
 *
 *   - the content column is capped at 42rem (672px) — about 60 characters of
 *     question text per line, which is the range prose stays comfortable in;
 *   - it is centred on both axes, with `place-items-center`, at every
 *     breakpoint. It used to be top-aligned on phones, which pushed the answer
 *     options toward the bottom edge and left dead space above the question;
 *   - the frame reserves a fixed gutter — 0.75rem on a phone, rising to 2.5rem
 *     on a large screen — so the ornament never crowds the question and never
 *     disappears entirely;
 *   - the height is `100dvh` minus the app's nav bar, not `100vh`. `vh` on
 *     mobile Safari and Chrome measures the viewport *without* the address bar,
 *     which is how content ends up below the fold; and ignoring the nav bar
 *     made every screen exactly one bar too tall, so the round's header slid
 *     underneath it.
 *
 * The ornament is drawn, not photographed: SVG tilings and stroked arches. That
 * keeps it sharp on a projector, weightless to load, and recolourable — the
 * accent shifts per question, so question 17 does not look like question 16.
 */

export interface OrnateTheme {
  /** The metal: rules, ornament, numerals on the dark ground. */
  accent: string;
  /** The night ground. */
  bg: string;
  motif: 'eightfold' | 'girih' | 'zellij' | 'muqarnas';
  name: string;
}

/**
 * Six jewel-and-gold grounds, cycled by question number. Thirty questions pass
 * through the set five times, so no two consecutive questions ever match, and
 * the whole round still reads as one evening.
 */
export const ORNATE_THEMES: OrnateTheme[] = [
  { name: 'Gold',    accent: '#E3C05C', bg: 'linear-gradient(165deg, #2A1E0D 0%, #16110A 55%, #0B0805 100%)', motif: 'eightfold' },
  { name: 'Emerald', accent: '#8FD9BE', bg: 'linear-gradient(165deg, #0F241C 0%, #0B1714 55%, #060D0B 100%)', motif: 'girih' },
  { name: 'Amber',   accent: '#F0C46A', bg: 'linear-gradient(165deg, #2E1E08 0%, #191106 55%, #0D0904 100%)', motif: 'zellij' },
  { name: 'Teal',    accent: '#7FD3D0', bg: 'linear-gradient(165deg, #0C2325 0%, #09181A 55%, #050E0F 100%)', motif: 'muqarnas' },
  { name: 'Bronze',  accent: '#DEAE72', bg: 'linear-gradient(165deg, #281A0F 0%, #181009 55%, #0C0705 100%)', motif: 'eightfold' },
  { name: 'Saffron', accent: '#F2D98A', bg: 'linear-gradient(165deg, #2D2109 0%, #1A1305 55%, #0E0A03 100%)', motif: 'girih' },
];

export function ornateTheme(n: number): OrnateTheme {
  const i = Math.max(1, n || 1);
  return ORNATE_THEMES[(i - 1) % ORNATE_THEMES.length];
}

/** One repeating tile per motif — a full-screen pattern costs a single path. */
function Motif({ motif, accent }: { motif: OrnateTheme['motif']; accent: string }) {
  const id = `ornate-${motif}`;
  return (
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {motif === 'eightfold' && (
          <pattern id={id} width="80" height="80" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={accent} strokeWidth="1">
              <rect x="16" y="16" width="48" height="48" />
              <rect x="16" y="16" width="48" height="48" transform="rotate(45 40 40)" />
              <circle cx="40" cy="40" r="6" />
            </g>
          </pattern>
        )}
        {motif === 'girih' && (
          <pattern id={id} width="90" height="52" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={accent} strokeWidth="1">
              <path d="M0 26 L22 0 L68 0 L90 26 L68 52 L22 52 Z" />
              <path d="M22 0 L45 26 L22 52 M68 0 L45 26 L68 52" />
            </g>
          </pattern>
        )}
        {motif === 'zellij' && (
          <pattern id={id} width="64" height="64" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={accent} strokeWidth="1">
              <path d="M32 0 L64 32 L32 64 L0 32 Z" />
              <path d="M32 16 L48 32 L32 48 L16 32 Z" />
              <path d="M0 0 L8 8 M64 0 L56 8 M0 64 L8 56 M64 64 L56 56" />
            </g>
          </pattern>
        )}
        {motif === 'muqarnas' && (
          <pattern id={id} width="56" height="98" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={accent} strokeWidth="1">
              <path d="M28 0 L56 16 L56 49 L28 65 L0 49 L0 16 Z" />
              <path d="M28 33 L56 49 M28 33 L0 49 M28 33 L28 0" />
            </g>
          </pattern>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** A quarter arch with rosettes; the four corners are CSS mirrors of one path. */
function Corner({ accent, className }: { accent: string; className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      className={`pointer-events-none absolute h-14 w-14 sm:h-20 sm:w-20 lg:h-28 lg:w-28 ${className}`}
    >
      <g fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round">
        <path d="M2 118 L2 40 Q2 2 40 2 L118 2" opacity="0.9" />
        <path d="M12 118 L12 46 Q12 12 46 12 L118 12" opacity="0.45" />
        <path d="M26 30 q10 -14 24 -14" opacity="0.65" />
      </g>
      <g fill={accent} opacity="0.8">
        <circle cx="26" cy="26" r="3.5" />
        <circle cx="47" cy="14" r="2" />
        <circle cx="14" cy="47" r="2" />
      </g>
    </svg>
  );
}

/**
 * Wraps a screen in the ornate hall.
 *
 * `questionNumber` picks the accent. `header` is pinned to the top inside the
 * gutter — the timer and progress live there — while `children` is centred in
 * whatever space remains.
 */
export default function OrnateStage({
  questionNumber,
  children,
  header,
}: {
  questionNumber: number;
  children: ReactNode;
  header?: ReactNode;
}) {
  const theme = ornateTheme(questionNumber);

  return (
    <div
      className="relative isolate flex min-h-[calc(100dvh-3.25rem)] flex-col overflow-hidden"
      style={{ background: theme.bg }}
    >
      {/* Lantern light — two glows of unequal size, so it reads as lit from
          somewhere rather than as a flat gradient. */}
      <motion.div
        key={`glow-${theme.name}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl sm:h-96 sm:w-96"
          style={{ background: theme.accent, opacity: 0.17 }}
        />
        <div
          className="absolute -right-20 top-1/4 h-56 w-56 rounded-full blur-3xl sm:h-80 sm:w-80"
          style={{ background: theme.accent, opacity: 0.1 }}
        />
        <div
          className="absolute -bottom-16 left-1/2 h-48 w-[80%] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: theme.accent, opacity: 0.08 }}
        />
      </motion.div>

      {/* Geometry — texture at a distance, invisible at reading range. */}
      <motion.div
        key={`motif-${theme.name}`}
        initial={{ opacity: 0, scale: 1.03 }}
        animate={{ opacity: 0.15, scale: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <Motif motif={theme.motif} accent={theme.accent} />
      </motion.div>

      {/* A hairline of metal just inside the viewport edge, and four corners. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-2 rounded-2xl sm:inset-4 lg:inset-6"
        style={{ border: `1px solid ${theme.accent}33` }}
      />
      <Corner accent={theme.accent} className="left-1 top-1 opacity-70 sm:left-2 sm:top-2" />
      <Corner accent={theme.accent} className="right-1 top-1 -scale-x-100 opacity-70 sm:right-2 sm:top-2" />
      <Corner accent={theme.accent} className="bottom-1 left-1 -scale-y-100 opacity-45 sm:bottom-2 sm:left-2" />
      <Corner accent={theme.accent} className="bottom-1 right-1 -scale-100 opacity-45 sm:bottom-2 sm:right-2" />

      {/* Header sits inside the gutter, never under the ornament. */}
      {header && (
        <div className="relative z-10 px-5 pt-5 sm:px-8 sm:pt-7 lg:px-12 lg:pt-9">
          <div className="mx-auto w-full max-w-[42rem]">{header}</div>
        </div>
      )}

      {/* The question. Centred on both axes, capped at a comfortable reading
          measure, with the gutter kept clear of the frame. */}
      <main className="relative z-10 grid flex-1 place-items-center px-5 py-5 sm:px-8 sm:py-7 lg:px-12 lg:py-9">
        <div className="w-full max-w-[42rem]">{children}</div>
      </main>
    </div>
  );
}
