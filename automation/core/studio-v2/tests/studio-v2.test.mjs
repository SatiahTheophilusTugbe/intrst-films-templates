import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hashCanonical,
  validateStudioObject,
  routeModel,
  validateContinuitySnapshot,
  evaluateContinuity,
  assertGenerationTransition,
  validateGenerationJob,
  canCreateAttempt,
  validateCostEntry,
  summarizeCostLedger,
  productionMetrics,
  normalizeStudioError,
  generationRetryDecision
} from "../studio-v2.mjs";

const U = "01M00000000000000000000000";
const id = code => `INT-${code}-${U}`;
const h = char => char.repeat(64);

function signal(status = "draft") {
  const payload = {
    source_type: "synthetic_fixture",
    research_summary: "Generic architecture fixture without property content.",
    audience_signal: {},
    factual_evidence_boundary: "fixture_only",
    season_window: {},
    publish_by_date: null,
    tension: "generic",
    audience: {},
    opportunity_score: 80,
    source_refs: [],
    approval_state: status
  };
  return {
    schema_version: "studio-v2-object@1.0.0",
    object_type: "signal",
    object_id: id("SIG"),
    version: "1.0.0",
    status,
    payload,
    payload_hash: hashCanonical(payload),
    approval_record_id: status === "approved" ? id("REV") : null,
    audit: { created_at: "2026-10-14T00:00:00Z", created_by: "synthetic_test", updated_at: "2026-10-14T00:00:00Z", approved_by: status === "approved" ? "synthetic_reviewer" : null, approved_at: status === "approved" ? "2026-10-14T00:00:00Z" : null }
  };
}

function candidate(patch = {}) {
  return {
    provider: "provider-a",
    model: "model-a",
    adapter: "adapter-a",
    adapter_version: "1.0.0",
    credential_ref: "INT | Provider A | Development",
    commercial_use_permitted: true,
    budget_reservation_possible: true,
    capabilities: { tasks: ["video"], modalities: ["image_to_video"], aspect_ratios: ["9:16"], max_width: 1080, max_height: 1920, max_duration_seconds: 10, identity_reference: true, lip_sync: true, data_regions: ["us"] },
    estimated_cost_minor: 200,
    currency: "USD",
    p95_latency_ms: 60000,
    circuit_state: "closed",
    scores: { quality_fit: 90, identity_consistency: 90, performance_fit: 80, camera_control_fit: 80, dialogue_fit: 80, environment_fit: 80, historical_acceptance_rate: 80, reliability: 80, latency_fit: 70, cost_efficiency: 70 },
    evidence: ["synthetic_catalog"],
    ...patch
  };
}

function routeRequest(candidates = [candidate()]) {
  return {
    contract_version: "model-router@1.0.0",
    route_decision_id: id("RTE"),
    generation_job_id: id("GJB"),
    shot_id: id("SHT"),
    shot_manifest_hash: h("a"),
    continuity_state_id: id("CNT"),
    continuity_state_hash: h("b"),
    generation_profile_version: "generic@1.0.0",
    route_policy_version: "studio-route-score@1.0.0",
    model_catalog_version: "synthetic@1.0.0",
    requirements: { task: "video", modality: "image_to_video", aspect_ratio: "9:16", width: 1080, height: 1920, duration_seconds: 8, commercial_use_required: true, identity_consistency: "required", performance: "high", camera_motion: "controlled", dialogue_lip_sync: "required", environment: "interior", data_region: "us" },
    budget: { currency: "USD", ceiling_minor: 500 },
    candidates,
    idempotency_key: "synthetic-route"
  };
}

function snapshot(scope = "series_genesis") {
  const state = { characters: { c1: { wardrobe: "state-a", knowledge: ["fact-a"] } }, relationships: {}, locations: {}, props: {}, timeline_facts: [], unresolved_promises: [] };
  return {
    contract_version: "continuity-engine@1.0.0",
    continuity_state_id: id("CNT"),
    series_id: id("SER"),
    episode_id: scope === "series_genesis" ? null : id("EPI"),
    version: "1.0.0",
    parent_state_id: scope === "series_genesis" ? null : `INT-CNT-01M00000000000000000000001`,
    scope,
    state,
    state_hash: hashCanonical(state),
    mutation_ids: [],
    approval_record_id: scope === "episode_out" ? id("REV") : null,
    created_at: "2026-10-14T00:00:00Z"
  };
}

function job(patch = {}) {
  return {
    contract_version: "generation-job@1.0.0",
    generation_job_id: id("GJB"),
    shot_id: id("SHT"),
    root_run_id: id("RUN"),
    shot_manifest_hash: h("a"),
    continuity_state_id: id("CNT"),
    continuity_state_hash: h("b"),
    generation_profile_version: "generic@1.0.0",
    state: "planned",
    attempt_count: 0,
    max_attempts: 2,
    budget_ceiling_minor: 500,
    currency: "USD",
    automatic_retries: 0,
    reconciliation_state: "not_required",
    idempotency_key: "synthetic-job",
    ...patch
  };
}

function cost(entryType, amount, patch = {}) {
  return {
    contract_version: "studio-cost-ledger@1.0.0",
    cost_entry_id: patch.cost_entry_id ?? id("CST"),
    entry_type: entryType,
    scope_type: "generation_job",
    scope_id: id("GJB"),
    currency: "USD",
    amount_minor: amount,
    occurred_at: "2026-10-14T00:00:00Z",
    idempotency_key: `synthetic-${entryType}-${amount}`,
    ...patch
  };
}

test("Studio object validates with canonical payload hash", () => assert.equal(validateStudioObject(signal()), true));
test("approved Studio object requires explicit review actor and timestamp", () => assert.equal(validateStudioObject(signal("approved")), true));
test("Studio object rejects mismatched typed ID", () => assert.throws(() => validateStudioObject({ ...signal(), object_id: id("SER") }), /does not match/));
test("Studio object rejects payload hash drift", () => assert.throws(() => validateStudioObject({ ...signal(), payload_hash: h("f") }), /hash/));
test("Studio object rejects inferred approval", () => { const x = signal("approved"); x.audit.approved_by = null; assert.throws(() => validateStudioObject(x), /requires review/); });

test("router selects an eligible provider without provider calls or retries", () => {
  const result = routeModel(routeRequest());
  assert.equal(result.status, "selected");
  assert.equal(result.selected.provider, "provider-a");
  assert.equal(result.automatic_provider_calls, 0);
  assert.equal(result.automatic_retries, 0);
});
test("router blocks candidates above the shot budget", () => {
  const result = routeModel(routeRequest([candidate({ estimated_cost_minor: 501 })]));
  assert.equal(result.status, "blocked");
  assert.ok(result.candidate_results[0].rejection_reasons.includes("BUDGET_BLOCK"));
});
test("router fails closed on missing identity control", () => {
  const x = candidate(); x.capabilities = { ...x.capabilities, identity_reference: false };
  assert.ok(routeModel(routeRequest([x])).candidate_results[0].rejection_reasons.includes("IDENTITY_CONTROL_UNSUPPORTED"));
});
test("router tie-break is deterministic by cost then latency then provider/model", () => {
  const b = candidate({ provider: "provider-b", model: "model-b", estimated_cost_minor: 150 });
  const a = candidate({ provider: "provider-a", model: "model-a", estimated_cost_minor: 200 });
  assert.equal(routeModel(routeRequest([a, b])).selected.provider, "provider-b");
});

test("continuity genesis snapshot validates hash and parent", () => assert.equal(validateContinuitySnapshot(snapshot()), true));
test("episode-out continuity requires explicit approval record", () => { const x = snapshot("episode_out"); x.approval_record_id = null; assert.throws(() => validateContinuitySnapshot(x), /approval/); });
test("hard continuity mismatch blocks generation", () => {
  const result = evaluateContinuity(snapshot(), [{ assertion_id: "a1", path: "characters.c1.wardrobe", operator: "equals", expected: "state-b", severity: "hard", source_object_id: id("SHT") }]);
  assert.equal(result.outcome, "blocked"); assert.equal(result.generation_prohibited, true);
});
test("soft continuity mismatch warns without authorizing generation itself", () => {
  const result = evaluateContinuity(snapshot(), [{ assertion_id: "a1", path: "characters.c1.wardrobe", operator: "equals", expected: "state-b", severity: "soft", source_object_id: id("SHT") }]);
  assert.equal(result.outcome, "pass_with_warnings"); assert.equal(result.generation_prohibited, false);
});
test("matching continuity assertion passes", () => assert.equal(evaluateContinuity(snapshot(), [{ assertion_id: "a1", path: "characters.c1.knowledge", operator: "includes", expected: "fact-a", severity: "hard", source_object_id: id("SHT") }]).outcome, "pass"));

test("generation happy-path transitions are valid", () => { const states = ["planned", "validated", "continuity_verified", "routed", "budget_reserved", "claimed", "in_progress", "qc_pending", "creative_review", "accepted", "registered", "completed"]; for (let i = 0; i < states.length - 1; i++) assert.equal(assertGenerationTransition(states[i], states[i + 1]), true); });
test("generation cannot skip continuity and budget gates", () => assert.throws(() => assertGenerationTransition("validated", "claimed"), /Invalid generation transition/));
test("generation job rejects automatic paid retries", () => assert.throws(() => validateGenerationJob(job({ automatic_retries: 1 })), /must be zero/));
test("unknown outcome requires active attempt and reconciliation", () => assert.equal(validateGenerationJob(job({ state: "outcome_unknown", attempt_count: 1, active_attempt_id: id("ATM"), reconciliation_state: "manual_required" })), true));
test("unknown outcome prohibits a new attempt", () => assert.equal(canCreateAttempt(job({ state: "outcome_unknown", attempt_count: 1, active_attempt_id: id("ATM"), reconciliation_state: "manual_required" }), { retry_approval_record_id: id("REV"), available_budget_minor: 100, reservation_minor: 100 }).reason, "PRIOR_OUTCOME_UNKNOWN"));
test("retry requires an explicit approval record", () => assert.equal(canCreateAttempt(job({ attempt_count: 1 }), { available_budget_minor: 100, reservation_minor: 100 }).reason, "RETRY_APPROVAL_REQUIRED"));
test("authorized retry remains a new attempt, not automatic retry", () => assert.equal(canCreateAttempt(job({ attempt_count: 1 }), { retry_approval_record_id: id("REV"), available_budget_minor: 1000, reservation_minor: 100 }).allowed, true));
test("attempt reservation cannot exceed the shot ceiling or available budget", () => assert.equal(canCreateAttempt(job(), { available_budget_minor: 100, reservation_minor: 101 }).reason, "BUDGET_BLOCK"));

test("cost ledger accepts integer minor units", () => assert.equal(validateCostEntry(cost("budget_opened", 1000)), true));
test("refunds and releases must reference prior entries", () => assert.throws(() => validateCostEntry(cost("refund_credited", -10)), /reference/));
test("manual adjustments require human approval", () => assert.throws(() => validateCostEntry(cost("manual_adjustment", 10)), /Manual cost adjustment/));
test("ledger summary separates actual and encumbered cost", () => {
  const ref = id("CST");
  const entries = [
    cost("budget_opened", 1000, { cost_entry_id: `INT-CST-01M00000000000000000000001` }),
    cost("reservation_created", 400, { cost_entry_id: `INT-CST-01M00000000000000000000002` }),
    cost("usage_settled", 250, { cost_entry_id: `INT-CST-01M00000000000000000000003` }),
    cost("reservation_released", -150, { cost_entry_id: `INT-CST-01M00000000000000000000004`, reference_entry_id: ref }),
    cost("refund_credited", -25, { cost_entry_id: `INT-CST-01M00000000000000000000005`, reference_entry_id: ref })
  ];
  const result = summarizeCostLedger(entries, "USD");
  assert.equal(result.actual_minor, 225); assert.equal(result.encumbered_minor, 0); assert.equal(result.available_minor, 775);
});
test("cross-currency aggregation fails closed", () => assert.throws(() => summarizeCostLedger([cost("budget_opened", 100, { currency: "EUR" })], "USD"), /Cross-currency/));
test("zero-denominator production metrics return null", () => { const x = productionMetrics({ completed_attempts: 0, accepted_shots: 0, settled_generation_cost_minor: 0, total_settled_production_cost_minor: 0, finished_runtime_seconds: 0, rejected_attempt_cost_minor: 0 }); assert.equal(x.acceptance_rate, null); assert.equal(x.cost_per_finished_minute_minor, null); });

test("post-submit timeout normalizes to outcome unknown", () => assert.equal(normalizeStudioError({ code: "ETIMEDOUT" }, { submitted: true }), "OUTCOME_UNKNOWN"));
test("pre-submit rate limit remains a transient class", () => assert.equal(normalizeStudioError({ status: 429 }), "RATE_LIMIT"));
test("unknown or ambiguous submitted outcome never retries", () => assert.deepEqual(generationRetryDecision("OUTCOME_UNKNOWN", { submitted: true }), { action: "reconcile", retry: false, automatic_retries: 0 }));
test("quality regeneration requires explicit approval and remains non-automatic", () => assert.deepEqual(generationRetryDecision("TECHNICAL_QC_FAILED", { explicit_retry_approved: true }), { action: "create_new_attempt", retry: true, automatic_retries: 0 }));
