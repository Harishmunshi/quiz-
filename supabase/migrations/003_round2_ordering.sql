-- ============================================================================
-- Round 2 becomes an ORDERING round: students arrange items into the correct
-- sequence. Scoring is all-or-nothing per question, with cumulative response
-- time as the tiebreak.
--
-- ALREADY APPLIED to the live Supabase project. Kept here so the repo and the
-- database tell the same story.
-- ============================================================================

DROP TABLE IF EXISTS "Round2LiveAnswer" CASCADE;

CREATE TABLE IF NOT EXISTS "Round2LiveQuestion" (
    "id"              TEXT NOT NULL,
    "questionNumber"  INTEGER NOT NULL,
    "type"            TEXT NOT NULL DEFAULT 'order',
    "titleEnglish"    TEXT NOT NULL,
    "titleSecondary"  TEXT,
    "promptEnglish"   TEXT NOT NULL,
    "promptSecondary" TEXT,
    -- JSON array in display order:
    -- [{"key":"al-balad","en":"Al-Balad","ar":"البلد","hi":"अल-बलद"}, ...]
    "items"           TEXT NOT NULL,
    -- JSON array of item keys in the correct sequence.
    "correctOrder"    TEXT NOT NULL,
    "correctOption"   TEXT,
    "marks"           INTEGER NOT NULL DEFAULT 1,
    "timeLimitSec"    INTEGER NOT NULL DEFAULT 120,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round2LiveQuestion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Round2LiveQuestion_questionNumber_key"
    ON "Round2LiveQuestion"("questionNumber");
CREATE INDEX IF NOT EXISTS "Round2LiveQuestion_isActive_idx"
    ON "Round2LiveQuestion"("isActive");

CREATE TABLE IF NOT EXISTS "Round2LiveAnswer" (
    "id"               TEXT NOT NULL,
    "participantId"    TEXT NOT NULL,
    "questionId"       TEXT NOT NULL,
    "questionNumber"   INTEGER NOT NULL,
    "answerType"       TEXT NOT NULL DEFAULT 'order',
    "submittedOrder"   TEXT,
    "selectedOption"   TEXT,
    "isCorrect"        BOOLEAN NOT NULL DEFAULT false,
    "correctPositions" INTEGER NOT NULL DEFAULT 0,
    "marks"            INTEGER NOT NULL DEFAULT 0,
    "responseTimeMs"   INTEGER NOT NULL,
    "isTest"           BOOLEAN NOT NULL DEFAULT false,
    "answeredAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round2LiveAnswer_pkey" PRIMARY KEY ("id")
);

-- The one-shot guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS "Round2LiveAnswer_participantId_questionId_key"
    ON "Round2LiveAnswer"("participantId", "questionId");
CREATE INDEX IF NOT EXISTS "Round2LiveAnswer_questionId_idx"     ON "Round2LiveAnswer"("questionId");
CREATE INDEX IF NOT EXISTS "Round2LiveAnswer_questionNumber_idx" ON "Round2LiveAnswer"("questionNumber");
CREATE INDEX IF NOT EXISTS "Round2LiveAnswer_isTest_idx"         ON "Round2LiveAnswer"("isTest");
CREATE INDEX IF NOT EXISTS "Round2LiveAnswer_isCorrect_idx"      ON "Round2LiveAnswer"("isCorrect");

ALTER TABLE "Round2LiveAnswer" ADD CONSTRAINT "Round2LiveAnswer_participantId_fkey"
    FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Round2LiveAnswer" ADD CONSTRAINT "Round2LiveAnswer_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Round2LiveQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Round2LiveQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Round2LiveAnswer"   ENABLE ROW LEVEL SECURITY;

-- 120s suits a 12-item ordering task.
UPDATE "CompetitionSettings" SET "round2QuestionSeconds" = 120;
