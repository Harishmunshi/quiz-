/**
 * Junior and senior: the two age groups, and the one place they are defined.
 *
 * Std 6-8 and std 9-12 are separate competitions. A twelve-year-old ranked
 * against a seventeen-year-old is not a result anyone can defend, so each group
 * gets its own standings.
 *
 * The band is stored rather than the exact standard. That is all the ranking
 * needs, and picking one of two options is far harder to get wrong than typing
 * a number — which matters when five hundred students are filling this in at
 * once on their own phones.
 */

export type SectionId = 'junior' | 'senior';

export interface Section {
  id: SectionId;
  /** Shown in the dropdown. */
  label: string;
  /** Shown as the leaderboard heading. */
  boardTitle: string;
  /**
   * How many go through from Round 1 to Round 2 in this group.
   *
   * The two numbers differ because the groups differ in size, so a single cut
   * would take a far larger share of one than the other. The Round 1 board
   * draws a line after this many, which is what makes the cut visible on the
   * projector rather than something announced and argued about afterwards.
   */
  qualifyTop: number;
}

export const SECTIONS: Section[] = [
  { id: 'junior', label: 'Std 6 to 8', boardTitle: 'Junior Leaderboard', qualifyTop: 12 },
  { id: 'senior', label: 'Std 9 to 12', boardTitle: 'Senior Leaderboard', qualifyTop: 18 },
];

/** How many qualify from this group, or 0 when the group is unknown. */
export function qualifyTop(value: string | null | undefined): number {
  const id = toSection(value);
  return SECTIONS.find((s) => s.id === id)?.qualifyTop ?? 0;
}

/**
 * Narrow arbitrary input to a real section.
 *
 * Returns null rather than guessing. A student whose group was never recorded
 * belongs on neither age board, and silently filing them under "junior" would
 * put them in a competition they did not enter.
 */
export function toSection(value: string | null | undefined): SectionId | null {
  const key = (value ?? '').trim().toLowerCase();
  return key === 'junior' || key === 'senior' ? key : null;
}

export function sectionLabel(value: string | null | undefined): string {
  const id = toSection(value);
  return SECTIONS.find((s) => s.id === id)?.label ?? '—';
}

export function sectionBoardTitle(value: string | null | undefined): string {
  const id = toSection(value);
  return SECTIONS.find((s) => s.id === id)?.boardTitle ?? 'All Students';
}
