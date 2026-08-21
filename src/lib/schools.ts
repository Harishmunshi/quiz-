/**
 * The sixteen competing schools, and the one place their names are decided.
 *
 * WHY THIS EXISTS
 * School was a free text box, and the live data showed the cost: one school
 * arrived as "M.E.S. English Medium School", "mes english medium school",
 * "MES ENGLISH MEDIUM SCHOOL", "mes", "Mes" and "MES" — six rows on the
 * projector for one school, 25 students split between them. Several typed a
 * person's name instead ("ALMAS KHAN", "Ishrat", "harish"), because the field
 * never said what it wanted.
 *
 * Two defences, because the dropdown alone is not enough:
 *   1. The form offers this list, so students pick rather than type.
 *   2. canonicalSchool() runs on write, so anything typed by an older client —
 *      or already in the database — still folds onto the canonical name.
 *
 * ADDING A SCHOOL
 * Add an entry below. `name` is exactly what appears on the leaderboard.
 * `aliases` are spellings to fold into it; matching ignores case, punctuation
 * and repeated spaces, so only genuinely different wordings need listing.
 */

export interface School {
  /** Exactly as it should appear on the projector. */
  name: string;
  /** Spellings that mean this school. Compared after normalisation. */
  aliases?: string[];
}

export const SCHOOLS: School[] = [
  {
    name: 'M.E.S. ENGLISH MEDIUM SCHOOL YAKUTPURA',
    aliases: [
      'mes english medium school',
      'mes english medium',
      'mes eng medium school',
      'mes eng',
      'mes english medium school yakutpura',
    ],
  },
  {
    name: 'M.E.S. BOYS HIGH SCHOOL YAKUTPURA',
    aliases: ['mes boys high school', 'mes boys school', 'mes boys', 'mesb'],
  },
  {
    name: 'M.E.S. HIGH SCHOOL NAGARVADA',
    aliases: ['mes high school nagarvada', 'mes nagarvada'],
  },
  { name: 'MADRASATUL ARABIYAH', aliases: ['madrasatul arabia', 'madrasa arabiyah'] },
  {
    name: 'M.E.S. GIRLS HIGH SCHOOL MOGALWADA',
    aliases: ['mes girls high school', 'mes girls school', 'mes girls'],
  },
  { name: 'NEW RAY SCHOOL KALLA', aliases: ['new ray school', 'newray kalla'] },
  {
    name: 'M.E.S. PRIMARY SCHOOL, MOGALWADA',
    aliases: ['mes primary school mogalwada', 'mes primary school', 'mes primary'],
  },
  {
    // The bare "M.E.S." on the list. Kept last among the M.E.S. entries so the
    // named branches above win an ambiguous match.
    name: 'M.E.S.',
    aliases: ['mes'],
  },
  { name: 'HANIFA SCHOOL', aliases: ['hanifa'] },
  { name: 'FAIZ SCHOOL', aliases: ['faiz'] },
  { name: 'FATEMA ZOHRA', aliases: ['fatema zohra school', 'fatima zohra'] },
  { name: 'ROSHAN MEMORIAL HIGH SCHOOL', aliases: ['roshan memorial', 'roshan school'] },
  { name: 'ROZY SCHOOL ENGLISH MEDIUM', aliases: ['rozy english medium', 'rozy english'] },
  { name: 'ROZY GUJARATI MEDIUM', aliases: ['rozy gujarati', 'rozy guj'] },
  { name: 'REFAI PUBLIC SCHOOL BORU', aliases: ['refai public school', 'refai boru', 'refai'] },
  { name: 'MANAJWALA INTERNATIONAL SCHOOL', aliases: ['manajwala international', 'manajwala'] },
];

/**
 * Strip everything that varies between two people typing the same school:
 * case, punctuation, and repeated spaces.
 */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.\-_,'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The name this school should be stored and displayed under.
 *
 * Falls back to the student's own text — tidied, not rejected. Turning a
 * student away at the door because their school is not on the list would be far
 * worse than one untidy row on the board.
 */
export function canonicalSchool(raw: string | null | undefined): string {
  const typed = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!typed) return '';

  const key = normalise(typed);
  for (const school of SCHOOLS) {
    if (normalise(school.name) === key) return school.name;
  }
  for (const school of SCHOOLS) {
    if (school.aliases?.some((a) => normalise(a) === key)) return school.name;
  }
  return typed;
}

/** True when the text matches a school we know, used to nudge the UI. */
export function isKnownSchool(raw: string | null | undefined): boolean {
  const name = canonicalSchool(raw);
  return SCHOOLS.some((s) => s.name === name);
}
