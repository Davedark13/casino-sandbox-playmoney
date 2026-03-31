ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

UPDATE users
SET password_hash = '$2a$12$XXuJKBeCF5YZIQioPT1JM.3e.G09RzD0lrLmH3k7lXIRTt16TbT.C'
WHERE password_hash IS NULL;

INSERT INTO kyc_documents (user_id, status, document_type, storage_path, reviewer_note, reviewed_at)
SELECT id, 'verified', 'seeded-id', '/seed/verified-id.png', 'Bootstrapped sandbox user', NOW()
FROM users
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
AND NOT EXISTS (
  SELECT 1
  FROM kyc_documents kd
  WHERE kd.user_id = users.id
);

CREATE TABLE IF NOT EXISTS game_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  bet_amount_cents BIGINT NOT NULL,
  payout_amount_cents BIGINT NOT NULL DEFAULT 0,
  rng_value INTEGER NOT NULL,
  proof TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created_at ON transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_requested_at ON withdrawals (user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_flags_user_created_at ON user_flags (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_rounds_user_created_at ON game_rounds (user_id, created_at DESC);

CREATE OR REPLACE VIEW kyc AS
SELECT DISTINCT ON (user_id)
  user_id,
  status,
  document_type,
  storage_path AS document,
  reviewer_note,
  created_at,
  reviewed_at
FROM kyc_documents
ORDER BY user_id, created_at DESC;

CREATE OR REPLACE VIEW activity_logs AS
SELECT
  id,
  CASE
    WHEN actor_type = 'user' THEN actor_id::uuid
    WHEN target_id ~* '^[0-9a-f-]{36}$' THEN target_id::uuid
    ELSE NULL
  END AS user_id,
  actor_type,
  actor_id,
  action,
  details AS metadata,
  created_at
FROM audit_logs;
