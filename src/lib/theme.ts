/**
 * One source of truth for the palette, so every page reads as the same product.
 *
 * The landing page sets the identity: a warm ivory field, deep emerald ink, gold
 * as the single accent. Round 2 originally used an inverted dark-emerald theme,
 * which made the competition feel like two different websites stitched together.
 * Everything now sits on the ivory ground.
 *
 * Note the two golds. #C8A951 is beautiful as a fill, a border, or a chip, but
 * as *text* on ivory it lands around 1.9:1 contrast — effectively unreadable at
 * small sizes, and worse under projector glare. GOLD_INK is the darkened
 * counterpart used wherever gold has to carry words.
 */

export const THEME = {
  /** Page background — identical to the landing page. */
  PAGE_BG: 'linear-gradient(180deg, #F7F2E7 0%, #EEE3CC 100%)',
  /** Projector background: same family, a touch deeper so it holds up on a big screen. */
  BOARD_BG: 'linear-gradient(180deg, #F7F2E7 0%, #E7DABF 100%)',

  IVORY: '#F7F2E7',
  SAND: '#EEE3CC',
  EMERALD: '#063B2D',
  EMERALD_MID: '#0A5E3F',
  EMERALD_BRIGHT: '#0A8A66',

  /** Gold for fills, borders, chips. */
  GOLD: '#C8A951',
  /** Gold darkened for legible text on ivory. */
  GOLD_INK: '#8A6A1C',

  /** Muted body copy. */
  MUTED: '#5A6B5E',
  /** Hairlines and input borders. */
  BORDER: '#D4C5A9',
  /** Card surface on the ivory ground. */
  CARD: 'rgba(255,255,255,0.72)',

  CORRECT: '#0A7D52',
  WRONG: '#B3261E',
} as const;

/** School crest, served from the public Supabase storage bucket. */
export const SCHOOL_LOGO_URL =
  process.env.NEXT_PUBLIC_SCHOOL_LOGO_URL ??
  'https://fzngwfydwhybczemnjfa.supabase.co/storage/v1/object/public/school%20logo/logo.png';

export const SCHOOL_NAME_DEFAULT = 'M.E.S. English Medium School';
