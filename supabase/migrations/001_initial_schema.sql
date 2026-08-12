-- ============================================================
-- Islamic Quiz Competition - Initial Schema Migration
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Competition Settings
CREATE TABLE IF NOT EXISTS competition_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Islamic Quiz Competition',
  school_name TEXT NOT NULL DEFAULT 'M.E.S. English Medium School',
  description TEXT,
  current_round INTEGER DEFAULT 0,
  competition_status TEXT NOT NULL DEFAULT 'draft' CHECK (competition_status IN ('draft', 'test', 'live', 'paused', 'completed')),
  round1_status TEXT NOT NULL DEFAULT 'locked' CHECK (round1_status IN ('locked', 'open', 'paused', 'closed')),
  round2_status TEXT NOT NULL DEFAULT 'locked' CHECK (round2_status IN ('locked', 'open', 'paused', 'closed')),
  round1_start_at TIMESTAMPTZ,
  round1_end_at TIMESTAMPTZ,
  round2_start_at TIMESTAMPTZ,
  round2_end_at TIMESTAMPTZ,
  round1_total_questions INTEGER DEFAULT 10,
  round1_time_limit INTEGER DEFAULT 0,
  round2_time_limit INTEGER DEFAULT 60,
  allow_round2_retry BOOLEAN DEFAULT true,
  round2_penalty_seconds INTEGER DEFAULT 5,
  is_test_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Participants
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  class_name TEXT NOT NULL,
  division TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'english' CHECK (language IN ('english', 'gujarati')),
  is_test BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_number INTEGER NOT NULL,
  english_question TEXT NOT NULL,
  gujarati_question TEXT NOT NULL,
  option_a_english TEXT NOT NULL,
  option_b_english TEXT NOT NULL,
  option_c_english TEXT NOT NULL,
  option_d_english TEXT NOT NULL,
  option_a_gujarati TEXT NOT NULL,
  option_b_gujarati TEXT NOT NULL,
  option_c_gujarati TEXT NOT NULL,
  option_d_gujarati TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  marks INTEGER DEFAULT 1,
  round INTEGER DEFAULT 1 CHECK (round IN (1, 2)),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Round 1 Attempts
CREATE TABLE IF NOT EXISTS round1_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  completion_time_ms INTEGER,
  score INTEGER,
  total_questions INTEGER,
  correct_answers INTEGER,
  incorrect_answers INTEGER,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'invalidated')),
  is_test BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Round 1 Answers
CREATE TABLE IF NOT EXISTS round1_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES round1_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id),
  selected_option TEXT NOT NULL,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ DEFAULT now()
);

-- Round 2 Challenges
CREATE TABLE IF NOT EXISTS round2_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  items JSONB NOT NULL,
  correct_order JSONB NOT NULL,
  time_limit_ms INTEGER DEFAULT 60000,
  is_active BOOLEAN DEFAULT true,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Round 2 Attempts
CREATE TABLE IF NOT EXISTS round2_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id),
  challenge_id UUID NOT NULL REFERENCES round2_challenges(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  client_elapsed_ms INTEGER,
  server_elapsed_ms INTEGER,
  attempt_number INTEGER DEFAULT 1,
  is_correct BOOLEAN,
  penalty_ms INTEGER DEFAULT 0,
  final_time_ms INTEGER,
  status TEXT DEFAULT 'started' CHECK (status IN ('started', 'correct', 'incorrect', 'expired', 'invalidated')),
  is_test BOOLEAN DEFAULT false,
  submitted_order JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_r1a_participant ON round1_attempts(participant_id);
CREATE INDEX IF NOT EXISTS idx_r1a_score ON round1_attempts(score DESC);
CREATE INDEX IF NOT EXISTS idx_r1a_time ON round1_attempts(completion_time_ms);
CREATE INDEX IF NOT EXISTS idx_r1a_submitted ON round1_attempts(submitted_at);
CREATE INDEX IF NOT EXISTS idx_r1a_status ON round1_attempts(status);
CREATE INDEX IF NOT EXISTS idx_r1a_test ON round1_attempts(is_test);
CREATE INDEX IF NOT EXISTS idx_r1a_attempt ON round1_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_r1a_question ON round1_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_r2a_participant ON round2_attempts(participant_id);
CREATE INDEX IF NOT EXISTS idx_r2a_challenge ON round2_attempts(challenge_id);
CREATE INDEX IF NOT EXISTS idx_r2a_time ON round2_attempts(final_time_ms);
CREATE INDEX IF NOT EXISTS idx_r2a_submitted ON round2_attempts(submitted_at);
CREATE INDEX IF NOT EXISTS idx_r2a_status ON round2_attempts(status);
CREATE INDEX IF NOT EXISTS idx_r2a_test ON round2_attempts(is_test);

-- RLS
ALTER TABLE competition_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE round1_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE round1_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE round2_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_competition" ON competition_settings FOR SELECT USING (true);
CREATE POLICY "participant_insert" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "participant_select" ON participants FOR SELECT USING (true);
CREATE POLICY "r1a_all" ON round1_attempts FOR ALL USING (true);
CREATE POLICY "r1ans_all" ON round1_answers FOR ALL USING (true);
CREATE POLICY "r2a_all" ON round2_attempts FOR ALL USING (true);
CREATE POLICY "r2c_all" ON round2_challenges FOR ALL USING (true);
CREATE POLICY "admin_all" ON admin_users FOR ALL USING (true);
CREATE POLICY "questions_all" ON questions FOR ALL USING (true);
CREATE POLICY "competition_all" ON competition_settings FOR ALL USING (true);

-- LEADERBOARD VIEWS
CREATE OR REPLACE VIEW v_round1_leaderboard AS
SELECT
  ROW_NUMBER() OVER (ORDER BY r.score DESC, r.completion_time_ms ASC, r.submitted_at ASC) as rank,
  p.id as participant_id,
  p.name as participant_name,
  p.class_name,
  p.division,
  p.language,
  r.score,
  r.total_questions,
  r.correct_answers,
  r.completion_time_ms,
  r.submitted_at
FROM round1_attempts r
JOIN participants p ON r.participant_id = p.id
WHERE r.status = 'submitted';

CREATE OR REPLACE VIEW v_round2_leaderboard AS
SELECT
  ROW_NUMBER() OVER (ORDER BY a.final_time_ms ASC, a.submitted_at ASC) as rank,
  p.id as participant_id,
  p.name as participant_name,
  p.class_name,
  p.division,
  a.final_time_ms,
  a.submitted_at
FROM round2_attempts a
JOIN participants p ON a.participant_id = p.id
WHERE a.status = 'correct' AND a.final_time_ms IS NOT NULL;
