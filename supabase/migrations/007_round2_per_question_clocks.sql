-- ============================================================
-- 007 — Per-question clocks, so any Round 2 question stays answerable
-- ============================================================
--
-- WHY
-- Round 2 kept ONE clock and ONE state for the whole round, on
-- CompetitionSettings: round2CurrentQuestion, round2QuestionState,
-- round2QuestionOpenedAt. Every gate in /api/round2/live/answer read from it:
--
--     if (settings.round2QuestionState !== 'open')     -> reject
--     question = findFirst({ questionNumber: settings.round2CurrentQuestion })
--     if (question.id !== questionId)                  -> reject STALE_QUESTION
--     responseTimeMs = now - settings.round2QuestionOpenedAt
--
-- The consequence: exactly one question was ever answerable, and only while the
-- quiz master held it open. A student who had not submitted Q1 could not submit
-- it once Q2 opened — there was no Q1 clock left to measure against, and the
-- id check bounced them anyway. Locking, revealing or stepping to the next
-- question shut everyone out of everything.
--
-- Moving the clock onto the question itself is what lets Q1 and Q2 be in play
-- independently. openedAt is that question's own start line; revealedAt is the
-- only thing that closes it.
--
-- BACKFILL
-- Questions already answered in this database must keep working, so anything
-- with answers against it is treated as already opened, dated from its earliest
-- answer. The current question is dated from the settings clock it was using.
--
-- SAFE TO RE-RUN. Additive: two nullable columns and two indexes.
-- To undo: ALTER TABLE "Round2LiveQuestion" DROP COLUMN "openedAt", DROP COLUMN "revealedAt";

ALTER TABLE "Round2LiveQuestion" ADD COLUMN IF NOT EXISTS "openedAt"   TIMESTAMP(3);
ALTER TABLE "Round2LiveQuestion" ADD COLUMN IF NOT EXISTS "revealedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Round2LiveQuestion_openedAt_idx"   ON "Round2LiveQuestion"("openedAt");
CREATE INDEX IF NOT EXISTS "Round2LiveQuestion_revealedAt_idx" ON "Round2LiveQuestion"("revealedAt");

-- Any question that already has answers was plainly open at some point. Date it
-- from its first answer so that answer's recorded responseTimeMs stays coherent.
UPDATE "Round2LiveQuestion" q
SET "openedAt" = sub."firstAnswer"
FROM (
  SELECT "questionId", MIN("answeredAt") AS "firstAnswer"
  FROM "Round2LiveAnswer"
  GROUP BY "questionId"
) sub
WHERE q.id = sub."questionId"
  AND q."openedAt" IS NULL;

-- The question currently on the board inherits the settings clock it was
-- running on, so an in-flight round survives this migration.
UPDATE "Round2LiveQuestion" q
SET "openedAt" = s."round2QuestionOpenedAt"
FROM "CompetitionSettings" s
WHERE q."questionNumber" = s."round2CurrentQuestion"
  AND q."openedAt" IS NULL
  AND s."round2QuestionOpenedAt" IS NOT NULL;

-- If the board is sitting on 'revealed', that question is finished: close it.
UPDATE "Round2LiveQuestion" q
SET "revealedAt" = COALESCE(s."round2QuestionLockedAt", NOW())
FROM "CompetitionSettings" s
WHERE q."questionNumber" = s."round2CurrentQuestion"
  AND s."round2QuestionState" = 'revealed'
  AND q."revealedAt" IS NULL;
