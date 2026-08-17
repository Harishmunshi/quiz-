-- Composite indexes for the Round 2 live-round hot paths.
--
-- Every one of these matches a WHERE clause that runs on a timer during a live
-- round, so the planner should never have to fall back to a sequential scan on
-- them — not at six participants, and not at two hundred.
--
--   1. The leaderboard aggregate filters participants by (isTest, disqualified)
--      before it groups. Two separate single-column indexes made the planner
--      choose one and filter the rest by hand.
--   2. The heartbeat counts answers for the current question by
--      (questionNumber, isTest) — the single most frequent query in the whole
--      application once a question is open.
--   3. The leaderboard joins answers per participant filtered by isTest. The
--      unique index on (participantId, questionId) leads with participantId but
--      cannot serve the isTest predicate.
--
-- IF NOT EXISTS throughout, so re-running this file is safe.

CREATE INDEX IF NOT EXISTS "Participant_isTest_disqualified_idx"
  ON public."Participant" ("isTest", "disqualified");

CREATE INDEX IF NOT EXISTS "Round2LiveAnswer_questionNumber_isTest_idx"
  ON public."Round2LiveAnswer" ("questionNumber", "isTest");

CREATE INDEX IF NOT EXISTS "Round2LiveAnswer_participantId_isTest_idx"
  ON public."Round2LiveAnswer" ("participantId", "isTest");
