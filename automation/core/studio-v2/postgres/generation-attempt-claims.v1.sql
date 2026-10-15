-- STU-004 / Christmas Invoice preparation only.
-- Prepared migration: DO NOT APPLY without project-scoped authorization and concurrency proof.
CREATE TABLE IF NOT EXISTS intrst_generation_attempt_claims (
  claim_id text PRIMARY KEY,
  operation_key text NOT NULL UNIQUE,
  generation_job_id text NOT NULL,
  attempt_id text NOT NULL UNIQUE,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  shot_id text NOT NULL,
  shot_manifest_hash char(64) NOT NULL,
  continuity_state_hash char(64) NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  model_version text NOT NULL,
  estimated_cost_minor bigint NOT NULL CHECK (estimated_cost_minor >= 0),
  currency char(3) NOT NULL,
  claim_state text NOT NULL CHECK (claim_state IN ('claimed','submitted','settled','outcome_unknown','failed_before_submission','failed_after_submission','cancelled')),
  provider_receipt_id text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  settled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (generation_job_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS intrst_generation_attempt_claims_due_idx
  ON intrst_generation_attempt_claims (claim_state, updated_at);

CREATE OR REPLACE FUNCTION intrst_claim_generation_attempt(
  p_claim_id text,
  p_operation_key text,
  p_generation_job_id text,
  p_attempt_id text,
  p_attempt_number integer,
  p_shot_id text,
  p_shot_manifest_hash char(64),
  p_continuity_state_hash char(64),
  p_provider text,
  p_model text,
  p_model_version text,
  p_estimated_cost_minor bigint,
  p_currency char(3)
) RETURNS SETOF intrst_generation_attempt_claims
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO intrst_generation_attempt_claims (
    claim_id, operation_key, generation_job_id, attempt_id,
    attempt_number, shot_id, shot_manifest_hash, continuity_state_hash,
    provider, model, model_version, estimated_cost_minor, currency, claim_state
  ) VALUES (
    p_claim_id, p_operation_key, p_generation_job_id, p_attempt_id,
    p_attempt_number, p_shot_id, p_shot_manifest_hash, p_continuity_state_hash,
    p_provider, p_model, p_model_version, p_estimated_cost_minor, p_currency, 'claimed'
  ) ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT * FROM intrst_generation_attempt_claims
  WHERE operation_key = p_operation_key;
END;
$$;

-- No reset/delete function is provided. Unknown outcomes are sticky until append-only
-- reconciliation evidence supports an explicit state transition.
