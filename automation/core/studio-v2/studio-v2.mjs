import { createHash } from "node:crypto";

export const STUDIO_V2_VERSION = "studio-v2@1.0.0";
export const MODEL_ROUTER_VERSION = "model-router@1.0.0";
export const CONTINUITY_VERSION = "continuity-engine@1.0.0";
export const GENERATION_JOB_VERSION = "generation-job@1.0.0";
export const COST_LEDGER_VERSION = "studio-cost-ledger@1.0.0";

const ID = /^INT-([A-Z]{3})-[0-9A-HJKMNP-TV-Z]{26}$/;
const HASH = /^[a-f0-9]{64}$/;
const TYPE_CODE = Object.freeze({ signal: "SIG", series: "SER", character: "CHR", relationship: "REL", location: "LOC", episode: "EPI", scene: "SCN", shot: "SHT" });
const PAYLOAD_FIELDS = Object.freeze({
  signal: ["source_type", "research_summary", "audience_signal", "factual_evidence_boundary", "season_window", "publish_by_date", "tension", "audience", "opportunity_score", "source_refs", "approval_state"],
  series: ["title", "genre", "logline", "premise", "research_signal_ids", "audience", "theme", "world", "tone", "visual_language", "season_question", "central_conflict", "stakes", "reversal_engine", "escalation_rules", "reveal_schedule", "monetization_hypothesis", "season_window", "approval_state"],
  character: ["series_id", "name", "age_range", "physical_identity", "personality", "desire", "fear", "secret", "contradiction", "relationship_ids", "voice_profile", "wardrobe_ids", "reference_asset_ids", "expression_asset_ids", "performance_notes", "allowed_variation", "prohibited_variation", "current_state", "approval_state"],
  relationship: ["series_id", "character_ids", "relationship_type", "public_state", "private_state", "power_balance", "history", "unresolved_promises", "current_state", "approval_state"],
  location: ["series_id", "canonical_description", "geography", "layout", "lighting_states", "time_states", "prop_anchor_ids", "reference_asset_ids", "allowed_variation", "prohibited_variation", "continuity_rules", "approval_state"],
  episode: ["series_id", "sequence", "hook", "objective", "conflict", "turn", "reveal", "cliffhanger", "runtime_target_seconds", "character_ids", "location_ids", "continuity_in_state_id", "planned_continuity_mutations", "monetization_position", "release_state", "approval_state"],
  scene: ["series_id", "episode_id", "sequence", "purpose", "conflict", "character_ids", "location_id", "story_time", "action", "dialogue", "continuity_requirements", "shot_ids", "approval_state"],
  shot: ["series_id", "episode_id", "scene_id", "sequence", "character_ids", "location_id", "prop_ids", "framing", "action", "performance", "lens", "camera_move", "lighting", "duration_seconds", "dialogue_audio", "reference_asset_ids", "generation_profile", "max_attempts", "budget_ceiling_minor", "currency", "continuity_requirements", "generation_status", "selected_take_asset_id", "provenance", "approval_state"]
});

const SCORE_WEIGHTS = Object.freeze({ quality_fit: 22, identity_consistency: 18, performance_fit: 14, camera_control_fit: 10, dialogue_fit: 8, environment_fit: 6, historical_acceptance_rate: 8, reliability: 6, latency_fit: 3, cost_efficiency: 5 });
const HAPPY = ["planned", "validated", "continuity_verified", "routed", "budget_reserved", "claimed", "in_progress", "qc_pending", "creative_review", "accepted", "registered", "completed"];
const EXCEPTIONS = Object.freeze({
  planned: ["cancelled", "blocked"], validated: ["blocked", "cancelled"], continuity_verified: ["blocked", "cancelled"], routed: ["blocked", "cancelled"], budget_reserved: ["blocked", "cancelled"],
  claimed: ["in_progress", "outcome_unknown", "failed_terminal"], in_progress: ["deferred", "qc_pending", "outcome_unknown", "failed_recoverable", "failed_terminal"],
  deferred: ["in_progress", "outcome_unknown", "failed_recoverable", "failed_terminal"], qc_pending: ["creative_review", "failed_recoverable", "failed_terminal", "rejected"],
  creative_review: ["accepted", "rejected", "failed_recoverable"], failed_recoverable: ["routed", "dead_letter"], outcome_unknown: ["in_progress", "qc_pending", "failed_terminal", "dead_letter"],
  rejected: [], failed_terminal: [], dead_letter: [], cancelled: [], blocked: []
});

export class StudioContractError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = "StudioContractError"; this.code = code; this.details = details; }
}
const fail = (code, message, details) => { throw new StudioContractError(code, message, details); };
const requireObject = (value, name) => { if (!value || typeof value !== "object" || Array.isArray(value)) fail("SCHEMA_VALIDATION", `${name} must be an object.`); };
const requireFields = (value, fields, name) => { requireObject(value, name); for (const field of fields) if (!(field in value)) fail("SCHEMA_VALIDATION", `${name}.${field} is required.`); };
const typed = (value, code) => typeof value === "string" && ID.test(value) && value.startsWith(`INT-${code}-`);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function hashCanonical(value) { return createHash("sha256").update(canonical(value)).digest("hex"); }

export function validateStudioObject(value) {
  requireFields(value, ["schema_version", "object_type", "object_id", "version", "status", "payload", "payload_hash", "audit"], "studio_object");
  if (value.schema_version !== "studio-v2-object@1.0.0" || !TYPE_CODE[value.object_type]) fail("SCHEMA_VALIDATION", "Unsupported Studio object version or type.");
  if (!typed(value.object_id, TYPE_CODE[value.object_type])) fail("SCHEMA_VALIDATION", "Studio object ID type does not match object_type.");
  if (!/^\d+\.\d+\.\d+$/.test(value.version)) fail("SCHEMA_VALIDATION", "Studio object version must be semantic versioning.");
  if (!HASH.test(value.payload_hash) || value.payload_hash !== hashCanonical(value.payload)) fail("PAYLOAD_HASH_MISMATCH", "Studio object payload hash is invalid.");
  requireFields(value.payload, PAYLOAD_FIELDS[value.object_type], `${value.object_type}.payload`);
  if (value.payload.approval_state !== value.status) fail("APPROVAL_STATE_MISMATCH", "Envelope and payload approval states must match.");
  if (value.status === "approved" && (!typed(value.approval_record_id, "REV") || !value.audit?.approved_by || !value.audit?.approved_at)) fail("HUMAN_REVIEW_BLOCK", "Approved Studio object requires review ID, actor and timestamp.");
  if (["character", "relationship", "location", "episode", "scene", "shot"].includes(value.object_type) && !typed(value.series_id, "SER")) fail("SCHEMA_VALIDATION", "Child Studio object requires series_id.");
  if (["episode", "scene", "shot"].includes(value.object_type) && value.object_type !== "episode" && !typed(value.episode_id, "EPI")) fail("SCHEMA_VALIDATION", "Scene/shot requires episode_id.");
  if (["scene", "shot"].includes(value.object_type) && value.object_type === "shot" && !typed(value.scene_id, "SCN")) fail("SCHEMA_VALIDATION", "Shot requires scene_id.");
  return true;
}

function capabilityReasons(request, candidate) {
  const req = request.requirements;
  const cap = candidate.capabilities ?? {};
  const reasons = [];
  if (!candidate.commercial_use_permitted) reasons.push("COMMERCIAL_USE_BLOCKED");
  if (!candidate.credential_ref) reasons.push("CREDENTIAL_REF_MISSING");
  if (candidate.budget_reservation_possible !== true) reasons.push("BUDGET_RESERVATION_UNAVAILABLE");
  if (candidate.circuit_state !== "closed") reasons.push("ADAPTER_CIRCUIT_NOT_CLOSED");
  if (candidate.currency !== request.budget.currency || candidate.estimated_cost_minor > request.budget.ceiling_minor) reasons.push("BUDGET_BLOCK");
  if (!cap.tasks?.includes(req.task) || !cap.modalities?.includes(req.modality)) reasons.push("MODALITY_UNSUPPORTED");
  if (!cap.aspect_ratios?.includes(req.aspect_ratio) || cap.max_width < req.width || cap.max_height < req.height) reasons.push("GEOMETRY_UNSUPPORTED");
  if (!cap.data_regions?.includes(req.data_region)) reasons.push("DATA_REGION_UNSUPPORTED");
  if (cap.max_duration_seconds < req.duration_seconds) reasons.push("DURATION_UNSUPPORTED");
  if (req.identity_consistency === "required" && cap.identity_reference !== true) reasons.push("IDENTITY_CONTROL_UNSUPPORTED");
  if (req.dialogue_lip_sync === "required" && cap.lip_sync !== true) reasons.push("LIP_SYNC_UNSUPPORTED");
  return reasons;
}

function score(candidate) {
  let total = 0;
  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    const value = candidate.scores?.[key] ?? 0;
    if (!Number.isInteger(value) || value < 0 || value > 100) fail("SCHEMA_VALIDATION", `Candidate score ${key} must be an integer 0..100.`);
    total += value * weight;
  }
  return Math.round(total / 100);
}

export function routeModel(request) {
  requireFields(request, ["contract_version", "route_decision_id", "generation_job_id", "shot_id", "shot_manifest_hash", "continuity_state_id", "continuity_state_hash", "generation_profile_version", "route_policy_version", "model_catalog_version", "requirements", "budget", "candidates", "idempotency_key"], "route_request");
  if (request.contract_version !== MODEL_ROUTER_VERSION || request.route_policy_version !== "studio-route-score@1.0.0") fail("SCHEMA_VALIDATION", "Unsupported route contract or policy.");
  if (!typed(request.route_decision_id, "RTE") || !typed(request.generation_job_id, "GJB") || !typed(request.shot_id, "SHT") || !typed(request.continuity_state_id, "CNT")) fail("SCHEMA_VALIDATION", "Route request identities are invalid.");
  if (![request.shot_manifest_hash, request.continuity_state_hash].every(x => HASH.test(x))) fail("SCHEMA_VALIDATION", "Route request hashes are invalid.");
  if (!Array.isArray(request.candidates) || request.candidates.length === 0) fail("SCHEMA_VALIDATION", "At least one route candidate is required.");
  const candidateResults = request.candidates.map(candidate => {
    const rejection_reasons = capabilityReasons(request, candidate);
    const total_score = score(candidate);
    if (total_score < 70) rejection_reasons.push("SCORE_BELOW_MINIMUM");
    return { provider: candidate.provider, model: candidate.model, adapter: candidate.adapter, adapter_version: candidate.adapter_version, estimated_cost_minor: candidate.estimated_cost_minor, currency: candidate.currency, p95_latency_ms: candidate.p95_latency_ms, total_score, eligible: rejection_reasons.length === 0, rejection_reasons, evidence: candidate.evidence };
  });
  const eligible = candidateResults.filter(x => x.eligible).sort((a, b) => b.total_score - a.total_score || a.estimated_cost_minor - b.estimated_cost_minor || a.p95_latency_ms - b.p95_latency_ms || `${a.provider}/${a.model}`.localeCompare(`${b.provider}/${b.model}`));
  const selected = eligible[0] ?? null;
  return Object.freeze({ contract_version: MODEL_ROUTER_VERSION, route_decision_id: request.route_decision_id, status: selected ? "selected" : "blocked", selected, candidate_results: candidateResults, route_policy_version: request.route_policy_version, model_catalog_version: request.model_catalog_version, automatic_provider_calls: 0, automatic_retries: 0 });
}

export function validateContinuitySnapshot(snapshot) {
  requireFields(snapshot, ["contract_version", "continuity_state_id", "series_id", "version", "parent_state_id", "scope", "state", "state_hash", "mutation_ids", "approval_record_id", "created_at"], "continuity_snapshot");
  if (snapshot.contract_version !== CONTINUITY_VERSION || !typed(snapshot.continuity_state_id, "CNT") || !typed(snapshot.series_id, "SER")) fail("SCHEMA_VALIDATION", "Continuity identity/version invalid.");
  if (snapshot.state_hash !== hashCanonical(snapshot.state)) fail("CONTINUITY_HASH_MISMATCH", "Continuity state hash mismatch.");
  if (snapshot.scope === "series_genesis" && snapshot.parent_state_id !== null) fail("CONTINUITY_PARENT_INVALID", "Genesis snapshot cannot have a parent.");
  if (snapshot.scope !== "series_genesis" && (!typed(snapshot.parent_state_id, "CNT") || !typed(snapshot.episode_id, "EPI"))) fail("CONTINUITY_PARENT_INVALID", "Episode snapshot requires parent and episode IDs.");
  if (snapshot.scope === "episode_out" && !typed(snapshot.approval_record_id, "REV")) fail("HUMAN_REVIEW_BLOCK", "Episode-out snapshot requires an approval record.");
  return true;
}

function pathValue(root, path) { return String(path).split(".").reduce((value, key) => value == null ? undefined : value[key], root); }
function assertionPass(actual, assertion) {
  switch (assertion.operator) {
    case "equals": return Object.is(actual, assertion.expected);
    case "not_equals": return !Object.is(actual, assertion.expected);
    case "includes": return Array.isArray(actual) ? actual.includes(assertion.expected) : String(actual ?? "").includes(String(assertion.expected));
    case "not_includes": return Array.isArray(actual) ? !actual.includes(assertion.expected) : !String(actual ?? "").includes(String(assertion.expected));
    case "exists": return actual !== undefined && actual !== null;
    case "absent": return actual === undefined || actual === null;
    case "one_of": return Array.isArray(assertion.expected) && assertion.expected.includes(actual);
    default: fail("SCHEMA_VALIDATION", `Unsupported continuity operator ${assertion.operator}.`);
  }
}
export function evaluateContinuity(snapshot, assertions) {
  validateContinuitySnapshot(snapshot);
  if (!Array.isArray(assertions)) fail("SCHEMA_VALIDATION", "Continuity assertions must be an array.");
  const findings = assertions.map(assertion => {
    requireFields(assertion, ["assertion_id", "path", "operator", "expected", "severity", "source_object_id"], "continuity_assertion");
    if (!["hard", "soft", "informational"].includes(assertion.severity)) fail("SCHEMA_VALIDATION", "Invalid continuity severity.");
    const actual = pathValue(snapshot.state, assertion.path);
    return { assertion_id: assertion.assertion_id, path: assertion.path, severity: assertion.severity, pass: assertionPass(actual, assertion), actual };
  });
  const hard = findings.some(x => !x.pass && x.severity === "hard");
  const warning = findings.some(x => !x.pass && x.severity !== "hard");
  return Object.freeze({ outcome: hard ? "blocked" : warning ? "pass_with_warnings" : "pass", generation_prohibited: hard, findings });
}

export function assertGenerationTransition(from, to) {
  const happyIndex = HAPPY.indexOf(from);
  if (happyIndex >= 0 && HAPPY[happyIndex + 1] === to) return true;
  if (EXCEPTIONS[from]?.includes(to)) return true;
  fail("STATE_TRANSITION_INVALID", `Invalid generation transition ${from} -> ${to}.`);
}

export function validateGenerationJob(job) {
  requireFields(job, ["contract_version", "generation_job_id", "shot_id", "root_run_id", "shot_manifest_hash", "continuity_state_id", "continuity_state_hash", "generation_profile_version", "state", "attempt_count", "max_attempts", "budget_ceiling_minor", "currency", "automatic_retries", "reconciliation_state", "idempotency_key"], "generation_job");
  if (job.contract_version !== GENERATION_JOB_VERSION || !typed(job.generation_job_id, "GJB") || !typed(job.shot_id, "SHT") || !typed(job.root_run_id, "RUN") || !typed(job.continuity_state_id, "CNT")) fail("SCHEMA_VALIDATION", "Generation job identity/version invalid.");
  if (![job.shot_manifest_hash, job.continuity_state_hash].every(x => HASH.test(x))) fail("SCHEMA_VALIDATION", "Generation job hashes invalid.");
  if (!Number.isInteger(job.attempt_count) || !Number.isInteger(job.max_attempts) || job.attempt_count < 0 || job.max_attempts < 1 || job.attempt_count > job.max_attempts) fail("SCHEMA_VALIDATION", "Generation attempt counts invalid.");
  if (job.automatic_retries !== 0) fail("RETRY_POLICY_INVALID", "Paid generation automatic retries must be zero.");
  if (["claimed", "in_progress", "deferred", "outcome_unknown", "qc_pending", "creative_review"].includes(job.state) && !typed(job.active_attempt_id, "ATM")) fail("SCHEMA_VALIDATION", "Active generation state requires active_attempt_id.");
  if (job.state === "outcome_unknown" && !["due", "in_progress", "manual_required"].includes(job.reconciliation_state)) fail("RECONCILIATION_REQUIRED", "Unknown outcome must require reconciliation.");
  return true;
}

export function canCreateAttempt(job, { retry_approval_record_id = null, available_budget_minor = 0, reservation_minor = 0 } = {}) {
  validateGenerationJob(job);
  if (job.state === "outcome_unknown" || job.reconciliation_state === "manual_required") return { allowed: false, reason: "PRIOR_OUTCOME_UNKNOWN" };
  if (job.attempt_count >= job.max_attempts) return { allowed: false, reason: "ATTEMPT_LIMIT" };
  if (job.attempt_count > 0 && !typed(retry_approval_record_id, "REV")) return { allowed: false, reason: "RETRY_APPROVAL_REQUIRED" };
  if (![available_budget_minor, reservation_minor].every(Number.isInteger) || reservation_minor < 0 || reservation_minor > available_budget_minor || reservation_minor > job.budget_ceiling_minor) return { allowed: false, reason: "BUDGET_BLOCK" };
  return { allowed: true, reason: "ATTEMPT_AUTHORIZED" };
}

export function validateCostEntry(entry) {
  requireFields(entry, ["contract_version", "cost_entry_id", "entry_type", "scope_type", "scope_id", "currency", "amount_minor", "occurred_at", "idempotency_key"], "cost_entry");
  if (entry.contract_version !== COST_LEDGER_VERSION || !typed(entry.cost_entry_id, "CST") || !/^[A-Z]{3}$/.test(entry.currency) || !Number.isInteger(entry.amount_minor)) fail("SCHEMA_VALIDATION", "Cost entry identity/currency/amount invalid.");
  if (["reservation_released", "refund_credited"].includes(entry.entry_type) && (entry.amount_minor > 0 || !typed(entry.reference_entry_id, "CST"))) fail("SCHEMA_VALIDATION", "Release/refund must be non-positive and reference a prior entry.");
  if (["budget_opened", "reservation_created", "usage_accrued", "usage_settled"].includes(entry.entry_type) && entry.amount_minor < 0) fail("SCHEMA_VALIDATION", "Positive ledger entry cannot be negative.");
  if (entry.entry_type === "manual_adjustment" && (!typed(entry.approval_record_id, "REV") || !entry.actor || !entry.reason)) fail("HUMAN_REVIEW_BLOCK", "Manual cost adjustment requires approval, actor and reason.");
  return true;
}

export function summarizeCostLedger(entries, currency) {
  if (!Array.isArray(entries) || !/^[A-Z]{3}$/.test(currency)) fail("SCHEMA_VALIDATION", "Ledger entries and currency are required.");
  const totals = { budget_opened_minor: 0, reserved_minor: 0, accrued_minor: 0, settled_minor: 0, released_minor: 0, refunded_minor: 0, adjustments_minor: 0 };
  const entryIds = new Set();
  const idempotencyKeys = new Set();
  for (const entry of entries) {
    validateCostEntry(entry);
    if (entryIds.has(entry.cost_entry_id) || idempotencyKeys.has(entry.idempotency_key)) fail("DUPLICATE_LEDGER_ENTRY", "Cost ledger entries and idempotency keys must be unique.");
    entryIds.add(entry.cost_entry_id); idempotencyKeys.add(entry.idempotency_key);
    if (entry.currency !== currency) fail("CURRENCY_MISMATCH", "Cross-currency aggregation requires explicit FX entries.");
    if (entry.entry_type === "budget_opened") totals.budget_opened_minor += entry.amount_minor;
    if (entry.entry_type === "reservation_created") totals.reserved_minor += entry.amount_minor;
    if (entry.entry_type === "usage_accrued") totals.accrued_minor += entry.amount_minor;
    if (entry.entry_type === "usage_settled") totals.settled_minor += entry.amount_minor;
    if (entry.entry_type === "reservation_released") totals.released_minor += -entry.amount_minor;
    if (entry.entry_type === "refund_credited") totals.refunded_minor += -entry.amount_minor;
    if (entry.entry_type === "manual_adjustment") totals.adjustments_minor += entry.amount_minor;
  }
  const actual_minor = totals.settled_minor - totals.refunded_minor + totals.adjustments_minor;
  const encumbered_minor = Math.max(0, totals.reserved_minor - totals.released_minor - totals.settled_minor);
  return Object.freeze({ currency, ...totals, actual_minor, encumbered_minor, available_minor: totals.budget_opened_minor - actual_minor - encumbered_minor });
}

export function productionMetrics({ completed_attempts, accepted_shots, settled_generation_cost_minor, total_settled_production_cost_minor, finished_runtime_seconds, rejected_attempt_cost_minor }) {
  const ratio = (n, d) => d > 0 ? n / d : null;
  return Object.freeze({
    attempts_per_accepted_shot: ratio(completed_attempts, accepted_shots),
    acceptance_rate: ratio(accepted_shots, completed_attempts),
    cost_per_accepted_shot_minor: ratio(settled_generation_cost_minor, accepted_shots),
    cost_per_finished_minute_minor: finished_runtime_seconds > 0 ? total_settled_production_cost_minor / (finished_runtime_seconds / 60) : null,
    regeneration_cost_ratio: ratio(rejected_attempt_cost_minor, settled_generation_cost_minor)
  });
}

export function normalizeStudioError(input = {}, { submitted = false } = {}) {
  const status = Number(input.status ?? input.statusCode ?? 0);
  const code = String(input.code ?? "").toUpperCase();
  if (submitted && ["ETIMEDOUT", "TIMEOUT", "ECONNRESET", "MALFORMED_PROVIDER_RESULT"].includes(code)) return "OUTCOME_UNKNOWN";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return submitted ? "OUTCOME_UNKNOWN" : "TEMPORARY_PROVIDER";
  if ([401, 403].includes(status)) return "CREDENTIAL_FAILURE";
  if (["ETIMEDOUT", "TIMEOUT", "ECONNRESET", "ENETUNREACH"].includes(code)) return submitted ? "OUTCOME_UNKNOWN" : "NETWORK";
  if (code === "CONTINUITY_BLOCK") return "CONTINUITY_BLOCK";
  if (code === "BUDGET_BLOCK") return "BUDGET_BLOCK";
  if (code === "CLAIM_BACKEND_UNAVAILABLE") return "CLAIM_BACKEND_UNAVAILABLE";
  return input.error_class ?? "UNKNOWN";
}

export function generationRetryDecision(errorClass, { submitted = false, explicit_retry_approved = false } = {}) {
  if (submitted && ["NETWORK", "TEMPORARY_PROVIDER", "OUTCOME_UNKNOWN", "MALFORMED_PROVIDER_RESULT"].includes(errorClass)) return { action: "reconcile", retry: false, automatic_retries: 0 };
  if (["SCHEMA_VALIDATION", "IDENTITY_BLOCK", "RIGHTS_BLOCK", "CONTINUITY_BLOCK", "BUDGET_BLOCK", "CREDENTIAL_FAILURE"].includes(errorClass)) return { action: "human_review", retry: false, automatic_retries: 0 };
  if (explicit_retry_approved && ["PROVIDER_REJECTED", "TECHNICAL_QC_FAILED", "CREATIVE_REJECTED"].includes(errorClass)) return { action: "create_new_attempt", retry: true, automatic_retries: 0 };
  return { action: "stop_or_defer", retry: false, automatic_retries: 0 };
}
