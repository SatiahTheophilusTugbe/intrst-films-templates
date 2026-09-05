-- AUT-013 development-only atomic operation claim backend.
-- Secrets/connection material are intentionally excluded.
-- Provision in a dedicated development PostgreSQL database reachable only through
-- the logical n8n credential: INT | PostgreSQL | Development | Atomic Claims.

CREATE TABLE IF NOT EXISTS intrst_media_operation_claims (
  operation_key TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'transcriptapi'),
  task TEXT NOT NULL CHECK (task = 'transcript_retrieval'),
  requested_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS intrst_media_operation_claims_idempotency_key_uq
  ON intrst_media_operation_claims (idempotency_key);

-- Runtime claim statement (single transaction statement):
-- WITH attempted AS (
--   INSERT INTO intrst_media_operation_claims
--     (operation_key, run_id, subject_id, provider, task, requested_at, idempotency_key)
--   VALUES ($1,$2,$3,$4,$5,$6,$7)
--   ON CONFLICT (operation_key) DO NOTHING
--   RETURNING operation_key
-- )
-- SELECT CASE WHEN EXISTS (SELECT 1 FROM attempted)
--   THEN 'CLAIMED' ELSE 'ALREADY_CLAIMED' END AS status,
--   TRUE AS atomic;
