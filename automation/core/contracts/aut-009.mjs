const ID = /^INT-[A-Z]{3}-[0-9A-HJKMNP-TV-Z]{26}$/;
const TRANSIENT = new Set(["RATE_LIMIT", "TEMPORARY_PROVIDER", "NETWORK"]);
const TERMINAL_REVIEW = new Set(["MISSING_SOURCE", "CLAIM_BLOCK", "RIGHTS_BLOCK", "IDENTITY_BLOCK", "HUMAN_REVIEW_BLOCK", "BUDGET_BLOCK", "PROVIDER_CAPABILITY_BLOCK"]);

export class ContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ContractError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ContractError(code, message, details);
}

function requireFields(value, fields, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("SCHEMA_VALIDATION", `${name} must be an object.`);
  for (const field of fields) if (!(field in value)) fail("SCHEMA_VALIDATION", `${name}.${field} is required.`);
}

function unique(values, name) {
  if (!Array.isArray(values) || new Set(values).size !== values.length) fail("SCHEMA_VALIDATION", `${name} must be a unique array.`);
}

function typedId(value, code) {
  return ID.test(value ?? "") && value.startsWith(`INT-${code}-`);
}

export function validateStoryObject(value, { forGeneration = false } = {}) {
  requireFields(value, ["schema_version", "story_object_id", "subject_id", "subject_name", "trigger", "central_question", "thesis", "contradiction", "emotional_question", "chronology", "verified_claims", "attributed_claims", "prohibited_or_uncertain_claims", "quote_extracts", "source_ids", "source_urls", "archive_assets", "rights_status", "asset_identity_status", "derivative_safe_facts", "platform_constraints", "visual_mode", "editorial_version", "approval_state", "audit"], "story_object");
  if (value.schema_version !== "1.0.0") fail("SCHEMA_VALIDATION", "Unsupported Story Object schema version.");
  if (!typedId(value.story_object_id, "STO") || !typedId(value.subject_id, "SUB")) fail("SCHEMA_VALIDATION", "Story Object identities must use INT-STO and INT-SUB IDs.");
  unique(value.source_ids, "source_ids");
  if (value.source_ids.some((id) => !typedId(id, "SRC"))) fail("SCHEMA_VALIDATION", "Story Object source_ids must use INT-SRC identities.");
  const verified = new Map();
  for (const claim of value.verified_claims) {
    requireFields(claim, ["claim_id", "text", "source_ids", "verification_status"], "verified_claim");
    if (!Array.isArray(claim.source_ids) || claim.source_ids.length === 0) fail("MISSING_SOURCE", `Claim ${claim.claim_id} has no source.`);
    if (!typedId(claim.claim_id, "CLM") || claim.source_ids.some((id) => !typedId(id, "SRC"))) fail("SCHEMA_VALIDATION", "Claim and source identities are mistyped.");
    verified.set(claim.claim_id, claim);
  }
  for (const claim of value.attributed_claims) {
    requireFields(claim, ["claim_id", "text", "source_ids", "verification_status", "attribution"], "attributed_claim");
    if (!claim.attribution) fail("SCHEMA_VALIDATION", `Attributed claim ${claim.claim_id} lacks attribution.`);
    if (!typedId(claim.claim_id, "CLM") || !Array.isArray(claim.source_ids) || claim.source_ids.length === 0 || claim.source_ids.some((id) => !typedId(id, "SRC"))) fail("SCHEMA_VALIDATION", "Attributed claim identities are invalid.");
    verified.set(claim.claim_id, claim);
  }
  const restricted = new Set(value.prohibited_or_uncertain_claims.map((claim) => claim.claim_id));
  for (const fact of value.derivative_safe_facts) {
    if (!verified.has(fact.claim_id) || restricted.has(fact.claim_id)) fail("CLAIM_BLOCK", `Derivative-safe claim ${fact.claim_id} is not eligible.`);
  }
  for (const event of value.chronology) {
    unique(event.claim_ids, "chronology.claim_ids");
    for (const claimId of event.claim_ids) if (!verified.has(claimId)) fail("CLAIM_BLOCK", `Chronology contains orphan Claim ID ${claimId}.`);
  }
  for (const constraint of Object.values(value.platform_constraints)) if (constraint.max_hashtags !== undefined && (!Number.isInteger(constraint.max_hashtags) || constraint.max_hashtags < 0 || constraint.max_hashtags > 3)) fail("SCHEMA_VALIDATION", "Platform max_hashtags must be between 0 and 3.");
  if (value.approval_state === "approved" && (!value.audit.approved_by || !value.audit.approved_at)) fail("HUMAN_REVIEW_BLOCK", "Approved Story Object requires approval actor and timestamp.");
  if (forGeneration && value.approval_state !== "approved") fail("HUMAN_REVIEW_BLOCK", "Only approved Story Objects may feed generators.");
  if (forGeneration && value.rights_status === "blocked") fail("RIGHTS_BLOCK", "Story Object rights are blocked.");
  if (forGeneration && value.asset_identity_status === "blocked") fail("IDENTITY_BLOCK", "Story Object asset identity is blocked.");
  return true;
}

const DERIVATIVE_STATES = ["queued", "generating", "validation", "render_ready", "rendering", "qc", "approval_required", "approved", "publish_queued", "publishing", "published"];
const EXCEPTION_STATES = new Set(["blocked", "failed_recoverable", "failed_terminal", "rejected", "superseded"]);

export function assertDerivativeTransition(from, to) {
  if (EXCEPTION_STATES.has(to)) return true;
  const index = DERIVATIVE_STATES.indexOf(from);
  if (index < 0 || DERIVATIVE_STATES[index + 1] !== to) fail("STATE_TRANSITION_INVALID", `Invalid derivative transition ${from} -> ${to}.`);
  return true;
}

export function validateDerivativeManifest(value) {
  requireFields(value, ["schema_version", "manifest_id", "story_object_id", "story_object_version", "derivative_type", "claim_ids", "source_ids", "asset_ids", "platform_targets", "payload", "quality_gates", "approval", "render", "publish", "audit"], "manifest");
  if (value.schema_version !== "1.0.0" || !typedId(value.manifest_id, "MAN") || !typedId(value.story_object_id, "STO") || !typedId(value.audit.run_id, "RUN")) fail("SCHEMA_VALIDATION", "Manifest version or typed canonical identity is invalid.");
  for (const field of ["claim_ids", "source_ids", "asset_ids", "platform_targets"]) unique(value[field], field);
  if (!["single_image", "carousel", "archive_primary_source", "carousel_motion", "hero_reel"].includes(value.derivative_type)) fail("SCHEMA_VALIDATION", "Unsupported derivative type.");
  const platforms = new Set(["youtube", "facebook", "instagram", "tiktok", "x", "threads", "linkedin"]);
  if (value.platform_targets.some((platform) => !platforms.has(platform))) fail("SCHEMA_VALIDATION", "Unsupported platform target.");
  for (const gate of ["schema", "evidence", "rights", "brand", "copy", "visual", "human", "publish", "audit"]) if (!value.quality_gates[gate]) fail("SCHEMA_VALIDATION", `Missing quality gate ${gate}.`);
  if (value.payload.factual === true && value.claim_ids.length === 0) fail("CLAIM_BLOCK", "Factual payload requires Claim IDs.");
  const blockingFailure = Object.entries(value.quality_gates).find(([, gate]) => gate.blocking !== false && gate.status === "fail");
  if (blockingFailure && ["render_ready", "rendering", "rendered"].includes(value.render.state)) fail("QUALITY_GATE_BLOCK", `Blocking gate ${blockingFailure[0]} prevents rendering.`);
  if (value.publish.state !== "not_ready" && value.approval.state !== "approved") fail("HUMAN_REVIEW_BLOCK", "Publishing requires explicit approval.");
  if (value.approval.state === "approved" && (!value.approval.actor || !value.approval.approved_at)) fail("HUMAN_REVIEW_BLOCK", "Approval actor and timestamp are required.");
  const keys = value.publish.targets.map((target) => target.idempotency_key);
  if (new Set(keys).size !== keys.length) fail("IDEMPOTENCY_COLLISION", "Publish target idempotency keys must be unique.");
  for (const target of value.publish.targets) if (target.status === "published" && (!target.post_id || !target.post_url)) fail("PUBLISH_AUDIT_MISSING", "Published target requires provider post ID and URL.");
  return true;
}

export function normalizeError(input = {}) {
  const status = Number(input.status ?? input.statusCode ?? 0);
  const code = String(input.code ?? "").toUpperCase();
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500 || code === "ECONNRESET") return "TEMPORARY_PROVIDER";
  if (["ETIMEDOUT", "TIMEOUT", "ENETUNREACH"].includes(code)) return "NETWORK";
  if ([401, 403].includes(status)) return "CREDENTIAL_FAILURE";
  if (code === "MALFORMED_JSON") return "MALFORMED_MODEL_OUTPUT";
  if (code === "BUDGET_FLOOR") return "BUDGET_BLOCK";
  if (code === "CAPABILITY_BLOCKED") return "PROVIDER_CAPABILITY_BLOCK";
  return input.error_class ?? "UNKNOWN";
}

export function retryDecision(errorClass, attempt, { submitted = false } = {}) {
  if (!Number.isInteger(attempt) || attempt < 1) fail("SCHEMA_VALIDATION", "Attempt must be a positive integer.");
  if (errorClass === "CREDENTIAL_FAILURE") return { action: "stop_alert", retry: false };
  if (TERMINAL_REVIEW.has(errorClass)) return { action: "human_review", retry: false };
  if (errorClass === "PUBLISH_FAILURE" && submitted) return { action: "lookup_idempotency_key", retry: false };
  if (errorClass === "MALFORMED_MODEL_OUTPUT") return attempt < 2 ? { action: "regenerate", retry: true, delay_ms: 0 } : { action: "human_review", retry: false };
  if (TRANSIENT.has(errorClass)) return attempt < 4 ? { action: "retry", retry: true, delay_ms: Math.min(30000, 1000 * (2 ** (attempt - 1))) } : { action: "stop_alert", retry: false };
  return { action: "stop_alert", retry: false };
}

export function assertAdapter(adapter) {
  for (const method of ["healthcheck", "validate_config", "submit", "get_status", "normalize_result", "normalize_error"]) if (typeof adapter?.[method] !== "function") fail("ADAPTER_CONTRACT_INVALID", `Adapter method ${method} is required.`);
  return true;
}

export function validateRunEvent(event) {
  requireFields(event, ["run_id", "root_run_id", "workflow_key", "workflow_version", "module", "environment", "started_at", "status", "attempt", "input_ids", "output_ids", "source_ids", "claim_ids", "asset_ids", "human_review_required", "idempotency_key"], "run_event");
  if (![event.run_id, event.root_run_id].every((id) => typedId(id, "RUN")) || (event.parent_run_id && !typedId(event.parent_run_id, "RUN"))) fail("SCHEMA_VALIDATION", "Run lineage IDs must use INT-RUN identities.");
  if (!Number.isInteger(event.attempt) || event.attempt < 1) fail("SCHEMA_VALIDATION", "Run attempt must be positive.");
  if (event.approval_at && !event.approval_actor) fail("HUMAN_REVIEW_BLOCK", "Approval timestamp requires an actor.");
  return true;
}
