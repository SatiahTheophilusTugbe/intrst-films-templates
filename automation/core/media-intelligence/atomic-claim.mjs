export const ATOMIC_CLAIM_BACKEND_VERSION = "postgres-v1";
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
        cause: String(error?.message ?? "claim backend unavailable")
      };
    }

    const row = Array.isArray(result) ? result[0] : result;
    if (!row || !["CLAIMED", "ALREADY_CLAIMED"].includes(row.status) || row.atomic !== true) {
      throw new Error("ATOMIC_CLAIM_RESULT_INVALID");
    }

    return Object.freeze({ status: row.status, atomic: true });
  };
}
