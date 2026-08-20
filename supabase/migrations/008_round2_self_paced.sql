-- ============================================================
-- 008 — Round 2 becomes self-paced: a clock per student, per question
-- ============================================================
--
-- WHY
-- Round 2 timed everyone from one clock on CompetitionSettings:
-- round2QuestionOpenedAt, set when the quiz master opened a question. One clock
-- for the whole hall meant only one question could ever be in play — there was
-- nowhere to record when a particular student started a particular question, so
-- a student who had not answered Q1 lost it the moment Q2 opened.
--
-- Round 1 has never had this problem, because Round1Attempt.startedAt is per
-- student. This table gives Round 2 the same thing.
--
-- The UNIQUE constraint is the point: the clock starts once. A student who
-- reloads, switches phone, or comes back an hour later resumes their original
-- start time rather than being handed a fresh one, so refreshing cannot buy a
-- better time.
--
-- PURELY ADDITIVE. One new table. No column is altered, no row is read,
-- modified or deleted, and nothing existing depends on it.
--
-- This is deliberately unlike migration 007, which backfilled revealedAt onto
-- whatever question the board happened to be showing and thereby closed Q1
-- permanently. There is no backfill here at all.
--
-- To undo: DROP TABLE "Round2LiveStart";

CREATE TABLE IF NOT EXISTS "Round2LiveStart" (
  "id"            TEXT         NOT NULL,
  "participantId" TEXT         NOT NULL,
  "questionId"    TEXT         NOT NULL,
  "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isTest"        BOOLEAN      NOT NULL DEFAULT false,
  CONSTRAINT "Round2LiveStart_pkey" PRIMARY KEY ("id")
);

-- One clock per student per question. Everything above depends on this.
CREATE UNIQUE INDEX IF NOT EXISTS "Round2LiveStart_participantId_questionId_key"
  ON "Round2LiveStart"("participantId", "questionId");

CREATE INDEX IF NOT EXISTS "Round2LiveStart_questionId_idx"
  ON "Round2LiveStart"("questionId");

DO $$
BEGIN
  ALTER TABLE "Round2LiveStart"
    ADD CONSTRAINT "Round2LiveStart_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Round2LiveStart"
    ADD CONSTRAINT "Round2LiveStart_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Round2LiveQuestion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
