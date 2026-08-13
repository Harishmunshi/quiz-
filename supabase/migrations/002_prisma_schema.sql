-- ============================================================================
-- Islamic Quiz Competition — Prisma-compatible schema for Supabase Postgres
--
-- RUN THIS ONCE in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
--
-- Why this file replaces 001_initial_schema.sql:
--   001 created snake_case tables (competition_settings, admin_users, ...).
--   Prisma Client queries PascalCase tables with camelCase columns
--   ("CompetitionSettings"."schoolName"), because the models carry no @@map.
--   The app therefore could never see 001's tables. This file creates exactly
--   what Prisma Client expects.
--
-- Safe to re-run: every statement is IF NOT EXISTS / idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Remove the unused snake_case tables from 001 so the database has one schema,
-- not two. Skip this block if you deliberately kept data in them.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS round2_attempts CASCADE;
DROP TABLE IF EXISTS round2_challenges CASCADE;
DROP TABLE IF EXISTS round1_answers CASCADE;
DROP TABLE IF EXISTS round1_attempts CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS participants CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;
DROP TABLE IF EXISTS competition_settings CASCADE;

-- ============================================================================
-- CompetitionSettings — a single row that drives the whole competition
-- ============================================================================
CREATE TABLE IF NOT EXISTS "CompetitionSettings" (
    "id"                     TEXT NOT NULL,
    "name"                   TEXT NOT NULL DEFAULT 'Islamic Quiz Competition',
    "schoolName"             TEXT NOT NULL DEFAULT 'M.E.S. English Medium School',
    "description"            TEXT,
    "currentRound"           INTEGER NOT NULL DEFAULT 0,
    "competitionStatus"      TEXT NOT NULL DEFAULT 'draft',
    "round1Status"           TEXT NOT NULL DEFAULT 'locked',
    "round2Status"           TEXT NOT NULL DEFAULT 'locked',
    "round1StartAt"          TIMESTAMP(3),
    "round1EndAt"            TIMESTAMP(3),
    "round2StartAt"          TIMESTAMP(3),
    "round2EndAt"            TIMESTAMP(3),
    "round1TotalQuestions"   INTEGER NOT NULL DEFAULT 10,
    "round1TimeLimit"        INTEGER NOT NULL DEFAULT 0,
    "round2TimeLimit"        INTEGER NOT NULL DEFAULT 60,
    "allowRound2Retry"       BOOLEAN NOT NULL DEFAULT true,
    "round2PenaltySeconds"   INTEGER NOT NULL DEFAULT 5,
    "isTestMode"             BOOLEAN NOT NULL DEFAULT false,
    -- Round 2 live mode (admin-gated, one question at a time)
    "round2Mode"             TEXT NOT NULL DEFAULT 'live',
    "round2CurrentQuestion"  INTEGER NOT NULL DEFAULT 0,
    "round2QuestionState"    TEXT NOT NULL DEFAULT 'idle',
    "round2QuestionOpenedAt" TIMESTAMP(3),
    "round2QuestionLockedAt" TIMESTAMP(3),
    "round2QuestionSeconds"  INTEGER NOT NULL DEFAULT 30,
    "round2ShowAnswer"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompetitionSettings_pkey" PRIMARY KEY ("id")
);

-- Idempotent top-up: adds the Round 2 live columns to a table created by an
-- earlier version of this file.
ALTER TABLE "CompetitionSettings"
    ADD COLUMN IF NOT EXISTS "round2Mode"             TEXT NOT NULL DEFAULT 'live',
    ADD COLUMN IF NOT EXISTS "round2CurrentQuestion"  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "round2QuestionState"    TEXT NOT NULL DEFAULT 'idle',
    ADD COLUMN IF NOT EXISTS "round2QuestionOpenedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "round2QuestionLockedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "round2QuestionSeconds"  INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS "round2ShowAnswer"       BOOLEAN NOT NULL DEFAULT true;

-- ============================================================================
-- AdminUser
-- ============================================================================
CREATE TABLE IF NOT EXISTS "AdminUser" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "password"  TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_email_key" ON "AdminUser"("email");

-- ============================================================================
-- Participant
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Participant" (
    "id"              TEXT NOT NULL,
    "participantCode" TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "className"       TEXT NOT NULL,
    "division"        TEXT NOT NULL,
    "language"        TEXT NOT NULL DEFAULT 'english',
    "isTest"          BOOLEAN NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Participant_participantCode_key"
    ON "Participant"("participantCode");

-- ============================================================================
-- Question — round 1 and round 2 questions live in the same table,
-- separated by the "round" column.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Question" (
    "id"               TEXT NOT NULL,
    "questionNumber"   INTEGER NOT NULL,
    "englishQuestion"  TEXT NOT NULL,
    "gujaratiQuestion" TEXT NOT NULL,
    "optionAEnglish"   TEXT NOT NULL,
    "optionBEnglish"   TEXT NOT NULL,
    "optionCEnglish"   TEXT NOT NULL,
    "optionDEnglish"   TEXT NOT NULL,
    "optionAGujarati"  TEXT NOT NULL,
    "optionBGujarati"  TEXT NOT NULL,
    "optionCGujarati"  TEXT NOT NULL,
    "optionDGujarati"  TEXT NOT NULL,
    "correctOption"    TEXT NOT NULL,
    "marks"            INTEGER NOT NULL DEFAULT 1,
    "round"            INTEGER NOT NULL DEFAULT 1,
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);
-- Stops two questions claiming the same slot, which would make "open question 3"
-- ambiguous during a live round.
CREATE UNIQUE INDEX IF NOT EXISTS "Question_round_questionNumber_key"
    ON "Question"("round", "questionNumber");
CREATE INDEX IF NOT EXISTS "Question_round_isActive_idx"
    ON "Question"("round", "isActive");

-- ============================================================================
-- Round1Attempt
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Round1Attempt" (
    "id"               TEXT NOT NULL,
    "participantId"    TEXT NOT NULL,
    "startedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt"      TIMESTAMP(3),
    "completionTimeMs" INTEGER,
    "score"            INTEGER,
    "totalQuestions"   INTEGER,
    "correctAnswers"   INTEGER,
    "incorrectAnswers" INTEGER,
    "status"           TEXT NOT NULL DEFAULT 'in_progress',
    "isTest"           BOOLEAN NOT NULL DEFAULT false,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round1Attempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Round1Attempt_participantId_idx"    ON "Round1Attempt"("participantId");
CREATE INDEX IF NOT EXISTS "Round1Attempt_score_idx"            ON "Round1Attempt"("score");
CREATE INDEX IF NOT EXISTS "Round1Attempt_completionTimeMs_idx" ON "Round1Attempt"("completionTimeMs");
CREATE INDEX IF NOT EXISTS "Round1Attempt_submittedAt_idx"      ON "Round1Attempt"("submittedAt");
CREATE INDEX IF NOT EXISTS "Round1Attempt_status_idx"           ON "Round1Attempt"("status");
CREATE INDEX IF NOT EXISTS "Round1Attempt_isTest_idx"           ON "Round1Attempt"("isTest");

-- ============================================================================
-- Round1Answer
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Round1Answer" (
    "id"             TEXT NOT NULL,
    "attemptId"      TEXT NOT NULL,
    "questionId"     TEXT NOT NULL,
    "selectedOption" TEXT NOT NULL,
    "isCorrect"      BOOLEAN,
    "answeredAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round1Answer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Round1Answer_attemptId_idx"  ON "Round1Answer"("attemptId");
CREATE INDEX IF NOT EXISTS "Round1Answer_questionId_idx" ON "Round1Answer"("questionId");

-- ============================================================================
-- Round2Challenge / Round2Attempt — the legacy drag-and-drop speed round.
-- Kept so existing screens keep working; unused when round2Mode = 'live'.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Round2Challenge" (
    "id"              TEXT NOT NULL,
    "challengeNumber" INTEGER NOT NULL,
    "prompt"          TEXT NOT NULL,
    "items"           TEXT NOT NULL,
    "correctOrder"    TEXT NOT NULL,
    "timeLimitMs"     INTEGER NOT NULL DEFAULT 60000,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "maxAttempts"     INTEGER NOT NULL DEFAULT 3,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round2Challenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Round2Attempt" (
    "id"              TEXT NOT NULL,
    "participantId"   TEXT NOT NULL,
    "challengeId"     TEXT NOT NULL,
    "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt"     TIMESTAMP(3),
    "clientElapsedMs" INTEGER,
    "serverElapsedMs" INTEGER,
    "attemptNumber"   INTEGER NOT NULL DEFAULT 1,
    "isCorrect"       BOOLEAN,
    "penaltyMs"       INTEGER NOT NULL DEFAULT 0,
    "finalTimeMs"     INTEGER,
    "status"          TEXT NOT NULL DEFAULT 'started',
    "isTest"          BOOLEAN NOT NULL DEFAULT false,
    "submittedOrder"  TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round2Attempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Round2Attempt_participantId_idx" ON "Round2Attempt"("participantId");
CREATE INDEX IF NOT EXISTS "Round2Attempt_challengeId_idx"   ON "Round2Attempt"("challengeId");
CREATE INDEX IF NOT EXISTS "Round2Attempt_finalTimeMs_idx"   ON "Round2Attempt"("finalTimeMs");
CREATE INDEX IF NOT EXISTS "Round2Attempt_submittedAt_idx"   ON "Round2Attempt"("submittedAt");
CREATE INDEX IF NOT EXISTS "Round2Attempt_status_idx"        ON "Round2Attempt"("status");
CREATE INDEX IF NOT EXISTS "Round2Attempt_isTest_idx"        ON "Round2Attempt"("isTest");

-- ============================================================================
-- Round2LiveAnswer — the new admin-gated, one-question-at-a-time round.
--
-- The unique index on (participantId, questionId) is the one-shot guarantee:
-- a participant cannot answer the same question twice, no matter how many
-- tabs they open or how fast they double-tap.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Round2LiveAnswer" (
    "id"             TEXT NOT NULL,
    "participantId"  TEXT NOT NULL,
    "questionId"     TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "selectedOption" TEXT NOT NULL,
    "isCorrect"      BOOLEAN NOT NULL DEFAULT false,
    "marks"          INTEGER NOT NULL DEFAULT 0,
    "responseTimeMs" INTEGER NOT NULL,
    "isTest"         BOOLEAN NOT NULL DEFAULT false,
    "answeredAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round2LiveAnswer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Round2LiveAnswer_participantId_questionId_key"
    ON "Round2LiveAnswer"("participantId", "questionId");
CREATE INDEX IF NOT EXISTS "Round2LiveAnswer_questionId_idx"     ON "Round2LiveAnswer"("questionId");
CREATE INDEX IF NOT EXISTS "Round2LiveAnswer_questionNumber_idx" ON "Round2LiveAnswer"("questionNumber");
CREATE INDEX IF NOT EXISTS "Round2LiveAnswer_isTest_idx"         ON "Round2LiveAnswer"("isTest");
CREATE INDEX IF NOT EXISTS "Round2LiveAnswer_isCorrect_idx"      ON "Round2LiveAnswer"("isCorrect");

-- ============================================================================
-- Foreign keys (added separately so the file stays re-runnable)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Round1Attempt_participantId_fkey') THEN
        ALTER TABLE "Round1Attempt" ADD CONSTRAINT "Round1Attempt_participantId_fkey"
            FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Round1Answer_attemptId_fkey') THEN
        ALTER TABLE "Round1Answer" ADD CONSTRAINT "Round1Answer_attemptId_fkey"
            FOREIGN KEY ("attemptId") REFERENCES "Round1Attempt"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Round1Answer_questionId_fkey') THEN
        ALTER TABLE "Round1Answer" ADD CONSTRAINT "Round1Answer_questionId_fkey"
            FOREIGN KEY ("questionId") REFERENCES "Question"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Round2Attempt_participantId_fkey') THEN
        ALTER TABLE "Round2Attempt" ADD CONSTRAINT "Round2Attempt_participantId_fkey"
            FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Round2Attempt_challengeId_fkey') THEN
        ALTER TABLE "Round2Attempt" ADD CONSTRAINT "Round2Attempt_challengeId_fkey"
            FOREIGN KEY ("challengeId") REFERENCES "Round2Challenge"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Round2LiveAnswer_participantId_fkey') THEN
        ALTER TABLE "Round2LiveAnswer" ADD CONSTRAINT "Round2LiveAnswer_participantId_fkey"
            FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Round2LiveAnswer_questionId_fkey') THEN
        ALTER TABLE "Round2LiveAnswer" ADD CONSTRAINT "Round2LiveAnswer_questionId_fkey"
            FOREIGN KEY ("questionId") REFERENCES "Question"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- Row Level Security
--
-- The app reaches Postgres through Prisma using the database password, which
-- bypasses RLS. Enabling RLS with no policies therefore changes nothing for
-- the app, while closing the PostgREST API that Supabase exposes publicly on
-- the anon key — otherwise anyone could read "Question"."correctOption"
-- straight out of the REST endpoint and win every round.
-- ============================================================================
ALTER TABLE "CompetitionSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminUser"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Participant"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Round1Attempt"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Round1Answer"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Round2Challenge"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Round2Attempt"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Round2LiveAnswer"    ENABLE ROW LEVEL SECURITY;
