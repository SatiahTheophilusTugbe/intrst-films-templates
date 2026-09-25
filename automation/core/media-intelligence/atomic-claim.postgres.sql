-- AUT-013 / AUT-014 development-only atomic operation claim backend.
-- Secrets/connection material are intentionally excluded.
-- Provision in a dedicated development PostgreSQL database reachable only through
-- the logical n8n credential: INT | PostgreSQL | Development | Atomic Claims.

BEGIN;
CREATE TABLE IF NOT EXISTS public.intrst_media_operation_claims (
  operation_key TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'transcriptapi'),
  task TEXT NOT NULL CHECK (task = 'transcript_retrieval'),
  requested_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

-- Publication extension v2. PREPARED ONLY: not live-proven or runtime-bound.
-- Run the complete migration in one transaction using the migration owner.
LOCK TABLE public.intrst_media_operation_claims IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.intrst_media_operation_claims
  ADD COLUMN IF NOT EXISTS operation_type TEXT NOT NULL DEFAULT 'transcript_retrieval',
  ADD COLUMN IF NOT EXISTS output_id TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS account_id TEXT,
  ADD COLUMN IF NOT EXISTS instruction_version TEXT,
  ADD COLUMN IF NOT EXISTS ordered_media_set_hash TEXT,
  ADD COLUMN IF NOT EXISTS root_run_id TEXT,
  ADD COLUMN IF NOT EXISTS attempt_id TEXT,
  ADD COLUMN IF NOT EXISTS claim_status TEXT NOT NULL DEFAULT 'claimed',
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS terminal_outcome TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_state TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.intrst_media_operation_claims
  DROP CONSTRAINT IF EXISTS intrst_media_operation_claims_provider_check,
  DROP CONSTRAINT IF EXISTS intrst_media_operation_claims_task_check,
  DROP CONSTRAINT IF EXISTS intrst_media_operation_claims_operation_check;
ALTER TABLE public.intrst_media_operation_claims
  ADD CONSTRAINT intrst_media_operation_claims_operation_check CHECK (
    (operation_type = 'transcript_retrieval' AND provider = 'transcriptapi' AND task = 'transcript_retrieval')
    OR (operation_type = 'publication' AND provider = 'publication_adapter' AND task = 'publication'
      AND output_id IS NOT NULL AND output_id <> ''
      AND platform IS NOT NULL AND platform IN ('facebook','instagram','threads','youtube','x','tiktok')
      AND account_id IS NOT NULL AND account_id <> ''
      AND instruction_version IS NOT NULL AND instruction_version <> ''
      AND ordered_media_set_hash IS NOT NULL AND ordered_media_set_hash ~ '^[a-f0-9]{64}$'
      AND root_run_id IS NOT NULL AND root_run_id <> ''
      AND attempt_id IS NOT NULL AND attempt_id <> ''
      AND idempotency_key = 'publish:' || output_id || ':' || platform || ':' || account_id || ':' || instruction_version
      AND operation_key = idempotency_key || ':media:' || ordered_media_set_hash
      AND ((claim_status = 'claimed' AND terminal_outcome IS NULL AND reconciliation_state = 'not_required')
        OR (claim_status = 'published' AND terminal_outcome IS NOT DISTINCT FROM 'published' AND reconciliation_state = 'resolved')
        OR (claim_status = 'outcome_unknown' AND terminal_outcome IS NOT DISTINCT FROM 'outcome_unknown' AND reconciliation_state = 'required')))
  );
-- Preserve legacy uniqueness; publication identity adds the ordered media hash.
DROP INDEX IF EXISTS public.intrst_media_operation_claims_idempotency_key_uq;
CREATE UNIQUE INDEX intrst_media_operation_claims_idempotency_key_uq
  ON public.intrst_media_operation_claims (idempotency_key)
  WHERE operation_type = 'transcript_retrieval';
CREATE UNIQUE INDEX IF NOT EXISTS intrst_media_operation_claims_publication_uq
  ON public.intrst_media_operation_claims (idempotency_key, ordered_media_set_hash)
  WHERE operation_type = 'publication';

CREATE OR REPLACE FUNCTION public.intrst_claim_publication_v2(
  p_output TEXT, p_platform TEXT, p_account TEXT, p_version TEXT,
  p_media_hash TEXT, p_root TEXT, p_attempt TEXT
) RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, public
SET lock_timeout = '5s'
AS $$
DECLARE
  k TEXT := 'publish:' || p_output || ':' || p_platform || ':' || p_account || ':' || p_version;
  won BOOLEAN;
  r public.intrst_media_operation_claims%ROWTYPE;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed'
    OR current_setting('synchronous_commit') <> 'on' THEN
    RAISE EXCEPTION 'CLAIM_SESSION_POLICY_INVALID';
  END IF;
  INSERT INTO public.intrst_media_operation_claims
    (operation_key, run_id, subject_id, provider, task, requested_at, idempotency_key,
     operation_type, output_id, platform, account_id, instruction_version,
     ordered_media_set_hash, root_run_id, attempt_id)
  VALUES (k || ':media:' || p_media_hash, p_root, p_output, 'publication_adapter', 'publication',
    CURRENT_TIMESTAMP, k, 'publication', p_output, p_platform, p_account, p_version,
    p_media_hash, p_root, p_attempt)
  ON CONFLICT (operation_key) DO NOTHING;
  won := FOUND;
  -- A separate command in this VOLATILE function gets a fresh READ COMMITTED
  -- snapshot after a competing insert commits. No spin, reclaim or retry.
  SELECT * INTO STRICT r FROM public.intrst_media_operation_claims
    WHERE operation_key = k || ':media:' || p_media_hash FOR SHARE;
  RETURN to_jsonb(r) || jsonb_build_object('status', CASE
    WHEN r.claim_status = 'published' THEN 'PRIOR_SUCCESS'
    WHEN r.claim_status = 'outcome_unknown' THEN 'PRIOR_OUTCOME_UNKNOWN'
    WHEN won THEN 'CLAIMED' ELSE 'ALREADY_CLAIMED' END);
END;
$$;
REVOKE ALL ON FUNCTION public.intrst_claim_publication_v2(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.intrst_preserve_publication_claim_v2()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.operation_type = 'publication' THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'CLAIM_DELETE_PROHIBITED'; END IF;
    IF (to_jsonb(NEW) - ARRAY['claim_status','terminal_outcome','reconciliation_state','updated_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['claim_status','terminal_outcome','reconciliation_state','updated_at'])
       OR OLD.claim_status <> 'claimed'
       OR NEW.claim_status NOT IN ('published','outcome_unknown') THEN
      RAISE EXCEPTION 'CLAIM_TRANSITION_PROHIBITED';
    END IF;
    NEW.updated_at := CURRENT_TIMESTAMP;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS intrst_preserve_publication_claim_v2 ON public.intrst_media_operation_claims;
CREATE TRIGGER intrst_preserve_publication_claim_v2 BEFORE UPDATE OR DELETE
ON public.intrst_media_operation_claims FOR EACH ROW
EXECUTE FUNCTION public.intrst_preserve_publication_claim_v2();
COMMIT;

-- Provisioning owner must grant the dedicated runtime role only the required
-- function/table privileges. Never grant DELETE or allow claim resets.
-- Runtime executor: autocommit, synchronous_commit=on, READ COMMITTED,
-- statement_timeout <= 10s; resolve only after COMMIT. Read back on a separate
-- connection before transport. A timeout/credential/error means no transport,
-- no retry, and operator reconciliation. Do not infer proof from this migration.
