import { createHash } from "node:crypto";

export const ATOMIC_CLAIM_BACKEND_VERSION = "postgres-v1";
export const PUBLICATION_CLAIM_BACKEND_VERSION = "postgres-publication-v2-prepared";
export const ATOMIC_CLAIM_CREDENTIAL_REF = "INT | PostgreSQL | Development | Atomic Claims";
export const ATOMIC_CLAIM_TABLE = "intrst_media_operation_claims";

export const ATOMIC_CLAIM_SQL = `WITH attempted AS (
  INSERT INTO intrst_media_operation_claims (
    operation_key, run_id, subject_id, provider, task, requested_at, idempotency_key
  ) VALUES ($1,$2,$3,$4,$5,$6,$7)
  ON CONFLICT (operation_key) DO NOTHING
  RETURNING operation_key
)
SELECT CASE WHEN EXISTS (SELECT 1 FROM attempted)
  THEN 'CLAIMED' ELSE 'ALREADY_CLAIMED' END AS status,
  TRUE AS atomic;`;

const REQUIRED = ["operation_key", "run_id", "subject_id", "provider", "task", "requested_at", "idempotency_key"];

export function createPostgresAtomicClaimBinding({ execute, credentialRef = ATOMIC_CLAIM_CREDENTIAL_REF } = {}) {
  if (credentialRef !== ATOMIC_CLAIM_CREDENTIAL_REF) throw new Error("ATOMIC_CLAIM_CREDENTIAL_REF_INVALID");
  if (typeof execute !== "function") throw new Error("ATOMIC_CLAIM_EXECUTOR_REQUIRED");

  return async function claimOperation(input) {
    if (!input || REQUIRED.some((key) => !input[key]) || input.provider !== "transcriptapi" || input.task !== "transcript_retrieval") {
      throw new Error("ATOMIC_CLAIM_INPUT_INVALID");
    }

    const params = REQUIRED.map((key) => input[key]);
    let result;
    try {
      result = await execute({ sql: ATOMIC_CLAIM_SQL, params, credential_ref: credentialRef });
    } catch (error) {
      return {
        status: "CLAIM_BACKEND_UNAVAILABLE",
        atomic: false,
        cause: "claim backend unavailable"
      };
    }

    const row = Array.isArray(result) ? result[0] : result;
    if (!row || !["CLAIMED", "ALREADY_CLAIMED"].includes(row.status) || row.atomic !== true) {
      throw new Error("ATOMIC_CLAIM_RESULT_INVALID");
    }

    return Object.freeze({ status: row.status, atomic: true });
  };
}

export const PUBLICATION_CLAIM_SQL = `SELECT public.intrst_claim_publication_v2($1,$2,$3,$4,$5,$6,$7) AS claim;`;
export const PUBLICATION_READBACK_SQL = `SELECT to_jsonb(c) AS claim FROM public.intrst_media_operation_claims c WHERE operation_key = $1;`;
export const PUBLICATION_TERMINAL_SQL = `UPDATE public.intrst_media_operation_claims
SET claim_status = $3, terminal_outcome = $3,
    reconciliation_state = CASE WHEN $3 = 'published' THEN 'resolved' ELSE 'required' END
WHERE operation_key = $1 AND attempt_id = $2 AND operation_type = 'publication' AND claim_status = 'claimed'
RETURNING to_jsonb(intrst_media_operation_claims) AS claim;`;

const PUBLICATION_FIELDS = ['output_id', 'platform', 'account_id', 'instruction_version', 'root_run_id', 'attempt_id'];
const OUTCOMES = new Set(['CLAIMED', 'ALREADY_CLAIMED', 'PRIOR_SUCCESS', 'PRIOR_OUTCOME_UNKNOWN']);
const blocked = status => Object.freeze({ status, atomic: false, durable: false, transport_prohibited: true, automatic_retries: 0 });

export function publicationClaimIdentity(input) {
  if (!input || PUBLICATION_FIELDS.some(k => typeof input[k] !== 'string' || !input[k].trim() || /[:\s]/.test(input[k]))) throw new Error('PUBLICATION_CLAIM_INPUT_INVALID');
  if (!['facebook','instagram','threads','youtube','x','tiktok'].includes(input.platform)) throw new Error('PUBLICATION_PLATFORM_INVALID');
  const media = input.media_set;
  if (!media || !['single_image','carousel','archive','evidence'].includes(media.format) || !Array.isArray(media.items) || !media.items.length ||
      (media.format === 'carousel' ? media.items.length < 2 : media.items.length !== 1)) throw new Error('PUBLICATION_MEDIA_INVALID');
  const ids = new Set();
  const items = media.items.map((x, i) => {
    if (x.order !== i + 1 || typeof x.asset_id !== 'string' || !x.asset_id || ids.has(x.asset_id) || !/^[a-f0-9]{64}$/.test(x.sha256 ?? '')) throw new Error('PUBLICATION_MEDIA_INVALID');
    ids.add(x.asset_id);
    return [x.order, x.asset_id, x.sha256];
  });
  // Hash stable asset identity and bytes in exact order; expiring delivery URLs
  // and approval timestamps cannot accidentally create a fresh claim.
  const hash = createHash('sha256').update(JSON.stringify(['ordered-media-claim@1', media.format, items])).digest('hex');
  const key = `publish:${input.output_id}:${input.platform}:${input.account_id}:${input.instruction_version}`;
  if (input.idempotency_key !== undefined && input.idempotency_key !== key) throw new Error('PUBLICATION_IDENTITY_MISMATCH');
  return Object.freeze({ idempotency_key: key, operation_key: `${key}:media:${hash}`, ordered_media_set_hash: hash });
}

function oneClaim(result) {
  const rows = Array.isArray(result) ? result : result?.rows;
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.claim) throw new Error('CLAIM_RESULT_INVALID');
  return rows[0].claim;
}

// Prepared adapter only. executeCommitted MUST await autocommit completion;
// readCommitted MUST use a separate database connection, never the write txn.
// This release deliberately never grants publication transport permission.
export function createPostgresPublicationClaimBinding({ executeCommitted, readCommitted, credentialRef = ATOMIC_CLAIM_CREDENTIAL_REF } = {}) {
  if (credentialRef !== ATOMIC_CLAIM_CREDENTIAL_REF) throw new Error('ATOMIC_CLAIM_CREDENTIAL_REF_INVALID');
  if (typeof executeCommitted !== 'function' || typeof readCommitted !== 'function') throw new Error('ATOMIC_CLAIM_EXECUTOR_REQUIRED');
  return async input => {
    let identity;
    try { identity = publicationClaimIdentity(input); } catch { return blocked('CLAIM_INPUT_INVALID'); }
    try {
      const row = oneClaim(await executeCommitted({ sql: PUBLICATION_CLAIM_SQL,
        params: [input.output_id, input.platform, input.account_id, input.instruction_version, identity.ordered_media_set_hash, input.root_run_id, input.attempt_id], credential_ref: credentialRef }));
      if (!OUTCOMES.has(row.status)) return blocked('CLAIM_RESULT_INVALID');
      const durable = oneClaim(await readCommitted({ sql: PUBLICATION_READBACK_SQL, params: [identity.operation_key], credential_ref: credentialRef }));
      for (const evidence of [row, durable]) {
        if (evidence.operation_type !== 'publication' || Object.entries(identity).some(([k,v]) => evidence[k] !== v) ||
          ['output_id','platform','account_id','instruction_version'].some(k => evidence[k] !== input[k]) ||
          !evidence.root_run_id || !evidence.attempt_id ||
          ['claimed_at','created_at','updated_at'].some(k => !Number.isFinite(Date.parse(evidence[k])))) return blocked('CLAIM_READBACK_INVALID');
      }
      if (row.attempt_id !== durable.attempt_id || row.root_run_id !== durable.root_run_id) return blocked('CLAIM_READBACK_INVALID');
      let status = row.status;
      if (durable.claim_status === 'published' && durable.terminal_outcome === 'published' && durable.reconciliation_state === 'resolved') status = 'PRIOR_SUCCESS';
      else if (durable.claim_status === 'outcome_unknown' && durable.terminal_outcome === 'outcome_unknown' && durable.reconciliation_state === 'required') status = 'PRIOR_OUTCOME_UNKNOWN';
      else if (durable.claim_status !== 'claimed' || durable.terminal_outcome !== null || durable.reconciliation_state !== 'not_required' || !['CLAIMED','ALREADY_CLAIMED'].includes(status)) return blocked('CLAIM_READBACK_INVALID');
      if (status === 'CLAIMED' && (durable.attempt_id !== input.attempt_id || durable.root_run_id !== input.root_run_id)) return blocked('CLAIM_READBACK_INVALID');
      return Object.freeze({ ...identity, status, attempt_id: durable.attempt_id, root_run_id: durable.root_run_id,
        claimed_at: durable.claimed_at, terminal_outcome: durable.terminal_outcome, reconciliation_state: durable.reconciliation_state,
        durable: true, atomic: false, transport_prohibited: true, automatic_retries: 0,
        binding_status: 'LIVE_DATABASE_PROOF_REQUIRED' });
    } catch { return blocked('CLAIM_BACKEND_UNAVAILABLE'); }
  };
}
