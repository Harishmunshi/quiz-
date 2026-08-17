-- ============================================================
-- 006 — Hand out participant codes from a sequence, not COUNT(*)
-- ============================================================
--
-- WHY
-- /api/participant built the code as:
--
--     const count = await db.participant.count();
--     const code  = `MES${String(count + 1).padStart(4, '0')}`;
--
-- COUNT(*) is a read. Thirty students tapping "Register" in the same second
-- all read the same count, all build the same code, and all try to INSERT it.
-- "Participant"."participantCode" is UNIQUE, so exactly one wins and the rest
-- come back as a P2002 unique violation — which the route's catch-all turned
-- into "Registration failed. Please try again." That is the failure the whole
-- hall would have seen at the start of the event.
--
-- A sequence is the fix Postgres already ships: nextval() is atomic, takes no
-- lock other code waits on, and never hands the same number to two callers.
--
-- SAFE TO RE-RUN. Additive only: no table is altered, no row is touched.
-- To undo: DROP SEQUENCE participant_code_seq;
--
-- APPLIED to project fzngwfydwhybczemnjfa on 2026-08-17.

CREATE SEQUENCE IF NOT EXISTS participant_code_seq AS bigint START WITH 1;

-- Start the sequence past every code already issued, so existing participants
-- keep their codes and nobody is handed a duplicate. Codes look like MES0007;
-- strip the prefix, take the highest, carry on from there.
SELECT setval(
  'participant_code_seq',
  GREATEST(
    (
      SELECT COALESCE(MAX(NULLIF(regexp_replace("participantCode", '\D', '', 'g'), '')::bigint), 0)
      FROM "Participant"
    ),
    -- Never rewind: if this migration is re-run after codes have been issued,
    -- keep whatever the sequence has already reached.
    (SELECT last_value FROM participant_code_seq)
  ),
  true
);
