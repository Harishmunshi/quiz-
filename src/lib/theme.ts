/**
 * One source of truth for the palette, so every page reads as the same product.
 *
 * THE PALETTE
 *   #0A0D14  near-black   ink
 *   #FFB000  amber        primary action
 *   #FFE66D  pale yellow  highlight
 *   #2DD4BF  mint         secondary / affirmative
 *   #F4F5F7  off-white    page
 *
 * BRIGHT COLOURS ARE FILLS, NOT TEXT
 * This is the rule that keeps the design honest. Amber on the off-white page is
 * a 1.68:1 contrast ratio and mint is 1.71:1 — both far below the 4.5:1 needed
 * for body text. As *text* they would be barely visible under projector glare
 * or to a student with weak eyesight, however good they look in a mockup.
 *
 * So the bright tones are backgrounds, with near-black sitting on them:
 *   ink on amber   10.61:1
 *   ink on mint    10.44:1
 *   ink on yellow  15.54:1
 * and where an accent must appear as text, a darkened cousin is used instead:
 *   GOLD_INK #966700  4.54:1
 *   MINT_INK #1A7D70  4.57:1
 *
 * Every ratio quoted above was computed against the real page background, not
 * eyeballed.
 */

export const THEME = {
  /** Page background — identical on every screen. */
  PAGE_BG: 'linear-gradient(180deg, #F4F5F7 0%, #E9EBEF 100%)',
  /** Projector background: same family, a touch deeper for a big screen. */
  BOARD_BG: 'linear-gradient(180deg, #F4F5F7 0%, #E3E6EC 100%)',

  /** Page tones. */
  IVORY: '#F4F5F7',
  SAND: '#E9EBEF',

  /** Near-black. Headlines, body copy, and text set on any bright fill. */
  EMERALD: '#0A0D14',
  EMERALD_MID: '#1C2230',
  EMERALD_BRIGHT: '#1A7D70',

  /** Amber for fills, borders, chips — never for small text. */
  GOLD: '#FFB000',
  /** Amber darkened until it is legible as text. */
  GOLD_INK: '#966700',

  /** Secondary text — 5.48:1. */
  MUTED: '#5B6472',
  /** Hairlines and input borders. */
  BORDER: '#D7DAE1',
  /** Card surface above the page. */
  CARD: 'rgba(255,255,255,0.82)',

  /** Mint, as text. Correct answers, climbing ranks. */
  CORRECT: '#1A7D70',
  WRONG: '#B3261E',
} as const;

// ── Named exports, so components can pull one token at a time ───────────
export const INK = '#0A0D14';
export const AMBER = '#FFB000';
export const AMBER_HOVER = '#FFC33D';
export const YELLOW = '#FFE66D';
export const MINT = '#2DD4BF';
export const PAPER = '#F4F5F7';
export const PAPER_DEEP = '#E9EBEF';
export const SURFACE = '#FFFFFF';
export const AMBER_INK = '#966700';
export const MINT_INK = '#1A7D70';
export const MUTED = '#5B6472';
export const BORDER = '#D7DAE1';
export const DANGER = '#B3261E';
export const PAGE_BG = THEME.PAGE_BG;
export const GOLD = AMBER;
export const GOLD_INK = AMBER_INK;

/**
 * Per-question accents.
 *
 * Eight steps around the palette, so consecutive questions feel distinct
 * without ever leaving the brand. `fill` is only ever used behind near-black;
 * `ink` is the readable-as-text version of the same hue; `tint` is the faint
 * wash used for page backgrounds and chips.
 */
export const QUESTION_ACCENTS = [
  { name: 'Amber', fill: '#FFB000', ink: '#966700', tint: '#FFF4DE' },
  { name: 'Mint', fill: '#2DD4BF', ink: '#1A7D70', tint: '#DFF7F3' },
  { name: 'Saffron', fill: '#FFE66D', ink: '#7C7035', tint: '#FFF9DF' },
  { name: 'Teal', fill: '#14B8A6', ink: '#136B62', tint: '#DCF3F0' },
  { name: 'Honey', fill: '#F59E0B', ink: '#8A5A00', tint: '#FDF0DA' },
  { name: 'Aqua', fill: '#5EEAD4', ink: '#15756A', tint: '#E4FAF6' },
  { name: 'Bronze', fill: '#E8A33D', ink: '#8A5F14', tint: '#FBF1DF' },
  { name: 'Jade', fill: '#34D399', ink: '#0F6B60', tint: '#DEF6F2' },
] as const;

/** School crest, served from the public Supabase storage bucket. */
export const SCHOOL_LOGO_URL =
  process.env.NEXT_PUBLIC_SCHOOL_LOGO_URL ??
  'https://fzngwfydwhybczemnjfa.supabase.co/storage/v1/object/public/school%20logo/logo.png';

export const SCHOOL_NAME_DEFAULT = 'M.E.S. English Medium School';
