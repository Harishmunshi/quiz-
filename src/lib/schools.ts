/**
 * The competing schools, and the one place their names are decided.
 *
 * WHY THIS EXISTS
 * School was a free text box, and the live data showed what that costs: one
 * school arrived as "M.E.S. English Medium School", "mes english medium
 * school", "MES ENGLISH MEDIUM SCHOOL", "mes", "Mes" and "MES" — six rows on
 * the projector for one school. Several students typed a person's name instead
 * ("ALMAS KHAN", "Ishrat", "harish"), because the field did not say what it
 * wanted.
 *
 * Two defences, both needed:
 *   1. The forms offer this list, so most students pick rather than type.
 *   2. canonicalSchool() maps whatever does get typed onto the list, so a
 *      free-typed "mes eng medium" still lands as one school on the board.
 *
 * ADDING A SCHOOL
 * Add an entry below. `name` is what appears on the leaderboard; `aliases` are
 * the spellings to fold into it — lower-case, punctuation-free, since matching
 * strips both. Nothing else needs changing.
 */

export interface School {
  /** Exactly as it should appear on the projector. */
  name: string;
  /** Short form used in student IDs, e.g. "M.E.S.B S-1". Display only. */
  code?: string;
  /** Spellings that mean this school. Compared after normalisation. */
  aliases?: string[];
}

export const SCHOOLS: School[] = [
  {
    name: 'M.E.S. English Medium School',
    code: 'M.E.S.',
    aliases: [
      'mes english medium school',
      'mes eng medium school',
      'mes english medium',
      'mes eng',
      'mes',
      'm e s english medium school',
      'mesenglishmediumschool',
    ],
  },
  {
    name: 'M.E.S. Gujarati Medium School',
    code: 'M.E.S.G',
    aliases: ['mes gujarati medium school', 'mes gujarati', 'mes guj', 'mesguj'],
  },
  {
    name: 'M.E.S. Boys School',
    code: 'M.E.S.B',
    aliases: ['mes boys school', 'mes boys', 'mesb'],
  },
  {
    name: 'M.E.S. Girls School',
    code: 'M.E.S.G2',
    aliases: ['mes girls school', 'mes girls'],
  },
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
 * Falls back to the student's own text — tidied, not rejected. An inter-school
 * event will always have a school nobody put on the list, and turning that
 * student away at the door would be worse than one untidy row on the board.
 */
export function canonicalSchool(raw: string | null | undefined): string {
  const typed = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!typed) return '';

  const key = normalise(typed);
  for (const school of SCHOOLS) {
    if (normalise(school.name) === key) return school.name;
    if (school.aliases?.some((a) => normalise(a) === key)) return school.name;
  }
  return typed;
}

/** True when the text matches a school we know, used to nudge the UI. */
export function isKnownSchool(raw: string | null | undefined): boolean {
  const name = canonicalSchool(raw);
  return SCHOOLS.some((s) => s.name === name);
}
