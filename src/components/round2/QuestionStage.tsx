'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * The per-question stage.
 *
 * Every question gets its own visual identity while staying inside the brand
 * palette. The point is that a hall *feels* the question change before it reads
 * the words — the backdrop shifts hue, a new geometric motif fades in behind,
 * and the panel re-enters.
 *
 * The eight accents are all steps between the brand's amber (#FFB000) and mint
 * (#2DD4BF), so no question ever looks like it belongs to a different website.
 * Nothing here is random: the theme is derived from the question number, so the
 * projector, the student phones and the admin panel all show the same accent
 * for question 7 — which matters when the quiz master says "look at the mint
 * one".
 *
 * Each `accent` is used for fills, rules and motifs only. Each `ink` is the
 * darkened version of the same hue, used wherever the accent has to carry
 * words — every one of them clears 4.5:1 against its own background.
 *
 * The motifs are Islamic geometric tilings built as SVG patterns. They sit at
 * very low opacity behind the content: texture at distance, invisible up close,
 * never competing with the text.
 */

export interface QuestionTheme {
  /** Accent used for rules, numerals and the item chips' border. */
  accent: string;
  /** A darker cousin of `accent` with enough contrast for small text on ivory. */
  ink: string;
  /** Page background — always in the ivory family, tinted toward the accent. */
  bg: string;
  /** Which geometric motif to draw behind the content. */
  motif: 'eightfold' | 'girih' | 'zellij' | 'muqarnas';
  /** Shown as a small label; helps the quiz master call out the question. */
  name: string;
}

/**
 * Eight themes, cycled by question number.
 *
 * Each background is a two-stop vertical gradient that starts at, or very near,
 * the landing page's #F4F5F7 and settles into a tinted #E9EBEF. Holding the top
 * stop nearly constant is what keeps thirty questions feeling like one event
 * rather than thirty separate websites.
 */
export const QUESTION_THEMES: QuestionTheme[] = [
  { name: 'Amber',   accent: '#FFB000', ink: '#966700', bg: 'linear-gradient(180deg, #F6F6F5 0%, #F2ECE0 100%)', motif: 'eightfold' },
  { name: 'Mint',    accent: '#2DD4BF', ink: '#1A7D70', bg: 'linear-gradient(180deg, #F4F6F6 0%, #E6F2EF 100%)', motif: 'girih' },
  { name: 'Saffron', accent: '#FFE66D', ink: '#7C7035', bg: 'linear-gradient(180deg, #F7F7F3 0%, #F3F0E1 100%)', motif: 'zellij' },
  { name: 'Teal',    accent: '#14B8A6', ink: '#136B62', bg: 'linear-gradient(180deg, #F4F6F6 0%, #E4F0EE 100%)', motif: 'muqarnas' },
  { name: 'Honey',   accent: '#F59E0B', ink: '#8A5A00', bg: 'linear-gradient(180deg, #F6F6F4 0%, #F1EADC 100%)', motif: 'eightfold' },
  { name: 'Aqua',    accent: '#5EEAD4', ink: '#15756A', bg: 'linear-gradient(180deg, #F5F7F7 0%, #E8F4F2 100%)', motif: 'girih' },
  { name: 'Bronze',  accent: '#E8A33D', ink: '#8A5F14', bg: 'linear-gradient(180deg, #F6F6F4 0%, #F0EBE0 100%)', motif: 'zellij' },
  { name: 'Jade',    accent: '#34D399', ink: '#0F6B60', bg: 'linear-gradient(180deg, #F5F6F6 0%, #E7F2EC 100%)', motif: 'muqarnas' },
];

/** Question 1 gets the first theme. Question 0 (standby) also gets it. */
export function themeForQuestion(questionNumber: number): QuestionTheme {
  const n = Math.max(1, questionNumber || 1);
  return QUESTION_THEMES[(n - 1) % QUESTION_THEMES.length];
}

/**
 * The SVG tilings. Each is a single repeating tile — the browser handles the
 * rest, so a full-screen pattern costs one path, not thousands of elements.
 */
function Motif({ motif, accent }: { motif: QuestionTheme['motif']; accent: string }) {
  const id = `motif-${motif}`;
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {motif === 'eightfold' && (
          // The eight-pointed star (khatim) — two overlaid squares.
          <pattern id={id} width="80" height="80" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={accent} strokeWidth="1">
              <rect x="16" y="16" width="48" height="48" />
              <rect x="16" y="16" width="48" height="48" transform="rotate(45 40 40)" />
              <circle cx="40" cy="40" r="6" />
            </g>
          </pattern>
        )}
        {motif === 'girih' && (
          // Girih strapwork — interlaced decagon-derived lines.
          <pattern id={id} width="90" height="52" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={accent} strokeWidth="1">
              <path d="M0 26 L22 0 L68 0 L90 26 L68 52 L22 52 Z" />
              <path d="M22 0 L45 26 L22 52 M68 0 L45 26 L68 52" />
            </g>
          </pattern>
        )}
        {motif === 'zellij' && (
          // Zellij interlace — offset squares on a diagonal lattice.
          <pattern id={id} width="64" height="64" patternUnits="userSpaceOnUse">
            <g fill="none" stroke={accent} strokeWidth="1">
              <path d="M32 0 L64 32 L32 64 L0 32 Z" />
              <path d="M32 16 L48 32 L32 48 L16 32 Z" />
              <path d="M0 0 L8 8 M64 0 L56 8 M0 64 L8 56 M64 64 L56 56" />
            </g>
          </pattern>
        )}
        {motif === 'muqarnas' && (
          // Muqarnas cells — stacked honeycomb niches.
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

/**
 * Wraps a question in its themed stage.
 *
 * `questionNumber` is the only input that matters — change it and everything
 * cross-fades. `full` makes the stage own the whole viewport (projector and
 * student pages); without it the stage is a card.
 */
export default function QuestionStage({
  questionNumber,
  children,
  full = false,
  className = '',
  showLabel = false,
}: {
  questionNumber: number;
  children: ReactNode;
  full?: boolean;
  className?: string;
  showLabel?: boolean;
}) {
  const theme = themeForQuestion(questionNumber);

  return (
    <div
      className={[
        'relative isolate overflow-hidden',
        full ? 'min-h-screen' : 'rounded-3xl border border-black/5',
        className,
      ].join(' ')}
    >
      {/* Background wash. Keyed on the theme rather than the question number so
          consecutive questions sharing a theme don't flash for no reason. */}
      <motion.div
        key={`bg-${theme.name}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="absolute inset-0 -z-20"
        style={{ background: theme.bg }}
      />
      {/* Hold the base ivory underneath so the cross-fade never shows white. */}
      <div
        className="absolute inset-0 -z-30"
        style={{ background: 'linear-gradient(180deg, #F4F5F7 0%, #E9EBEF 100%)' }}
      />

      {/* Motif. Drifts very slowly — enough that a still photograph and a live
          screen look different, not enough to distract anyone reading. */}
      <motion.div
        key={`motif-${theme.name}`}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 0.07, scale: 1 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        className="absolute inset-0 -z-10"
      >
        <Motif motif={theme.motif} accent={theme.accent} />
      </motion.div>

      {/* A soft accent bloom in the top corner gives the flat wash some depth. */}
      <motion.div
        key={`bloom-${theme.name}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.16 }}
        transition={{ duration: 0.9 }}
        className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full blur-3xl"
        style={{ background: theme.accent }}
      />

      {showLabel && (
        <span
          className="absolute right-4 top-4 z-10 rounded-full px-2.5 py-1 font-mono text-[10px] tracking-[0.25em]"
          style={{ color: theme.ink, background: `${theme.accent}1A` }}
        >
          {theme.name.toUpperCase()}
        </span>
      )}

      {children}
    </div>
  );
}
