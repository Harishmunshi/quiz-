-- ============================================================
-- 009 — Junior / Senior: which age group a student competes in
-- ============================================================
--
-- WHY
-- Std 6-8 and std 9-12 are separate competitions. A twelve-year-old ranked
-- against a seventeen-year-old on one board is not a result anyone can defend,
-- so each age group needs its own standings.
--
-- "junior" = std 6-8, "senior" = std 9-12. The band is stored rather than the
-- exact standard because the band is all the ranking needs, and picking one of
-- two options is far harder to fat-finger than typing a number.
--
-- PURELY ADDITIVE. One nullable column and one index. No backfill, no row read
-- or modified. The Participant table is empty at the time of writing, so there
-- is nothing to backfill anyway.
--
-- Existing rows (there are none) would keep section = NULL and appear on the
-- combined board but on neither age board, which is the honest answer for a
-- student whose group was never recorded.
--
-- To undo: ALTER TABLE "Participant" DROP COLUMN "section";

ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "section" TEXT;

CREATE INDEX IF NOT EXISTS "Participant_section_idx" ON "Participant"("section");
