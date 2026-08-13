-- ============================================================================
-- School name replaces class/division, plus the Round 2 entry gate.
-- ALREADY APPLIED to the live Supabase project — kept here so repo and
-- database tell the same story.
-- ============================================================================

ALTER TABLE "Participant"
  ADD COLUMN IF NOT EXISTS "schoolName"     TEXT    NOT NULL DEFAULT 'M.E.S. English Medium School',
  ADD COLUMN IF NOT EXISTS "round2Eligible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "round2JoinedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disqualified"   BOOLEAN NOT NULL DEFAULT false;

-- No longer collected at registration.
ALTER TABLE "Participant" ALTER COLUMN "className" DROP NOT NULL;
ALTER TABLE "Participant" ALTER COLUMN "division"  DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Participant_round2Eligible_idx" ON "Participant"("round2Eligible");
CREATE INDEX IF NOT EXISTS "Participant_disqualified_idx"   ON "Participant"("disqualified");

ALTER TABLE "CompetitionSettings"
  ADD COLUMN IF NOT EXISTS "round2QualifyTopN"    INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "round2JoinPin"        TEXT,
  ADD COLUMN IF NOT EXISTS "round2RequirePin"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "round2RequireQualify" BOOLEAN NOT NULL DEFAULT true;

-- Only one settings row may ever exist. Four were created by concurrent
-- lambdas racing the find-or-create in /api/competition; different lambdas
-- then read different rows, which would silently fork competition state
-- mid-event. A unique index on a constant expression makes that impossible.
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitionSettings_singleton"
    ON "CompetitionSettings" ((true));

UPDATE "CompetitionSettings"
SET "round1TotalQuestions" = 30,
    "round1TimeLimit"      = 0,
    "round2QuestionSeconds" = 120,
    "round2QualifyTopN"     = 20;
