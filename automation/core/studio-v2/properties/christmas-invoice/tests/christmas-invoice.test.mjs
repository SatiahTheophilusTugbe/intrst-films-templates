import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isCanonicalId } from "../../../../ids/ids.mjs";
import { validateStudioObject, validateContinuitySnapshot, assertGenerationTransition, generationRetryDecision } from "../../../studio-v2.mjs";
import {
  namespace, continuityInput, runtimeContract, costLedger, telemetryContract,
  deterministicGraphics, buildPropertyObjects, buildContinuitySnapshots,
  validateObjectGraph, routePropertyShot, validateAttemptRecord,
  summarizePropertyCosts, canBeginStu008Generation
} from "../christmas-invoice.mjs";

const fixture = JSON.parse(readFileSync(new URL("../test-fixtures.json", import.meta.url), "utf8"));
const objects = buildPropertyObjects();
const snapshots = buildContinuitySnapshots();

test("development aliases are not production primary keys", () => {
  assert.equal(namespace.development_aliases.production_primary_key_eligible, false);
  assert.ok(!objects.some(object => ["H26-01", "SIG-H26-001"].includes(object.object_id)));
});

test("property graph contains the locked ten-episode canon without invented shots", () => {
  assert.deepEqual(validateObjectGraph(objects, snapshots), { valid: true, errors: [], counts: { objects: 32, episodes: 10, scenes: 12, shots: 0, continuity_snapshots: 11 } });
  assert.deepEqual(objects.filter(x => x.object_type === "episode").map(x => x.payload.sequence), [1,2,3,4,5,6,7,8,9,10]);
});

test("all production object IDs use approved canonical types", () => {
  for (const object of objects) assert.equal(isCanonicalId(object.object_id, object.object_type), true, object.object_id);
});

test("all Studio envelopes and payload hashes validate", () => {
  for (const object of objects) assert.equal(validateStudioObject(object), true, object.object_id);
});

test("locked scripts stay source-bound rather than copied into repository scenes", () => {
  for (const scene of objects.filter(x => x.object_type === "scene")) {
    assert.equal(scene.payload.dialogue.inline_text_persisted, false);
    assert.match(scene.payload.dialogue.script_sha256, /^[a-f0-9]{64}$/);
  }
});

test("continuity creates an immutable genesis plus ten episode-out snapshots", () => {
  assert.equal(snapshots.length, 11);
  for (const snapshot of snapshots) assert.equal(validateContinuitySnapshot(snapshot), true);
  for (let index = 1; index < snapshots.length; index += 1) {
    assert.equal(snapshots[index].parent_state_id, snapshots[index - 1].continuity_state_id);
    assert.equal(snapshots[index].parent_state_hash, snapshots[index - 1].state_hash);
  }
});

test("all required continuity dimensions are materialized", () => {
  for (const dimension of continuityInput.required_dimensions) assert.ok(dimension in snapshots.at(-1).state, dimension);
});

test("STU-006 machine-readable deltas remain separately preserved as source inputs", () => {
  assert.equal(continuityInput.deltas.length, 10);
  assert.deepEqual(continuityInput.deltas.map(x => x.narrative_delta.episode), [1,2,3,4,5,6,7,8,9,10]);
  for (const delta of continuityInput.deltas) assert.match(delta.source_sha256, /^[a-f0-9]{64}$/);
});

test("wardrobe remains explicitly pending WIN 5 and never silently inferred", () => {
  for (const snapshot of snapshots) assert.equal(snapshot.state.wardrobe_state.status, "awaiting_STU-007");
});

test("Episodes 4-10 remain blocked while Episodes 1-3 are only conditionally eligible", () => {
  const episodes = objects.filter(x => x.object_type === "episode");
  assert.ok(episodes.slice(0,3).every(x => x.payload.release_state === "proof_gate_locked_not_generation_authorized"));
  assert.ok(episodes.slice(3).every(x => x.payload.release_state === "blocked_pending_STU-008_expansion_authorization"));
  assert.equal(runtimeContract.authorization.generation_enabled, false);
});

test("router uses property requirements and rejects the cheaper incapable candidate", () => {
  const result = routePropertyShot(fixture.route_request);
  assert.equal(result.status, "selected");
  assert.equal(result.selected.provider, "synthetic-a");
  assert.equal(result.automatic_provider_calls, 0);
  assert.equal(result.automatic_retries, 0);
  assert.equal(result.candidate_results.find(x => x.provider === "synthetic-b").eligible, false);
});

test("router fails closed if a required shot dimension is absent", () => {
  const request = structuredClone(fixture.route_request);
  delete request.shot_requirements.continuity_sensitivity;
  assert.throws(() => routePropertyShot(request), /SHOT_ROUTING_FIELD_MISSING/);
});

test("ambiguous provider attempt is structurally valid and sticky", () => assert.equal(validateAttemptRecord(fixture.ambiguous_attempt), true));

test("invalid rejection taxonomy is refused", () => {
  const attempt = { ...fixture.ambiguous_attempt, decision: "rejected", rejection_reason: "MAKE_IT_BETTER" };
  assert.throws(() => validateAttemptRecord(attempt), /REJECTION_REASON_INVALID/);
});

test("cost ledger exposes the undivided $600 Episodes 1-3 ceiling with zero spend", () => {
  const result = summarizePropertyCosts(costLedger.entries, []);
  assert.equal(result.ledger.budget_opened_minor, 60000);
  assert.equal(result.ledger.available_minor, 60000);
  assert.equal(result.ledger.actual_minor, 0);
  assert.equal(result.generation_allowed, false);
  assert.equal(result.metrics.cost_per_finished_second_minor, null);
  assert.equal(result.metrics.continuity_defect_rate, null);
});

test("attempt economics derive provider, continuity and human-burden metrics", () => {
  const accepted = { ...fixture.ambiguous_attempt, decision:"accepted", rejection_reason:null, generation_cost_minor:1200, generation_latency_ms:90000, human_review_minutes:4, accepted_runtime_seconds:6 };
  const rejected = { ...fixture.ambiguous_attempt, attempt_id:"INT-ATM-01M00000000000000000000001", attempt_number:2, decision:"rejected", rejection_reason:"WARDROBE_DRIFT", generation_cost_minor:1000, generation_latency_ms:80000, human_review_minutes:2 };
  const result = summarizePropertyCosts(costLedger.entries, [accepted, rejected]);
  assert.equal(result.metrics.attempts_per_accepted_shot, 2);
  assert.equal(result.metrics.acceptance_rate, 0.5);
  assert.equal(result.metrics.cost_per_finished_second_minor, 2200 / 6);
  assert.equal(result.metrics.continuity_defect_rate, 0.5);
  assert.equal(result.metrics.human_intervention_minutes_per_accepted_shot, 6);
  assert.equal(result.metrics.regeneration_causes.WARDROBE_DRIFT, 1);
});

test("telemetry joins use stable IDs rather than titles or filenames", () => {
  assert.match(telemetryContract.join_policy, /never join keys/);
  assert.ok(telemetryContract.required_dimensions.includes("generation_job_id"));
  assert.ok(telemetryContract.required_dimensions.includes("platform_publication_id"));
});

test("plot-critical documents are deterministic and generative text is prohibited", () => {
  assert.equal(deterministicGraphics.graphics.length, 6);
  assert.ok(deterministicGraphics.rendering.prohibited.includes("generative_text"));
  assert.equal(deterministicGraphics.graphics.find(x => x.graphic_key === "invoice").canonical_text.amount, "$8,430");
});

test("STU-008 gate enumerates missing prerequisites and blocks without explicit authorization", () => {
  const result = canBeginStu008Generation({ episode_sequence: 1, available_budget_minor: 60000 });
  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes("STU_007_CHARACTER_LOCK_MISSING"));
  assert.ok(result.blockers.includes("ATOMIC_GENERATION_CLAIM_UNPROVEN"));
  assert.ok(result.blockers.includes("EXPLICIT_GENERATION_AUTHORIZATION_MISSING"));
});

test("Episodes 4-10 cannot pass even if all technical gates are asserted", () => {
  const result = canBeginStu008Generation({ episode_sequence: 4, stu007_character_lock:true, stu007_location_lock:true, stu007_wardrobe_lock:true, stu007_camera_grammar_lock:true, stu007_model_bakeoff:true, shot_manifest_locked:true, atomic_claim_proven:true, persistence_readback_proven:true, provider_adapter_zero_call_verified:true, human_qc_owner_assigned:true, explicit_generation_authorization:true, available_budget_minor:60000 });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.blockers, ["EPISODES_4_TO_10_NOT_AUTHORIZED"]);
});

test("generation state path remains modular and transition-valid", () => {
  const path = ["planned","validated","continuity_verified","routed","budget_reserved","claimed","in_progress","qc_pending","creative_review","accepted","registered","completed"];
  for (let index = 1; index < path.length; index += 1) assert.equal(assertGenerationTransition(path[index - 1], path[index]), true);
  assert.ok(runtimeContract.workflow_shape.modules.length > 5);
  assert.equal(runtimeContract.workflow_shape.monolith_prohibited, true);
});

test("submitted ambiguity reconciles and never auto-retries", () => {
  assert.deepEqual(generationRetryDecision("OUTCOME_UNKNOWN", { submitted: true }), { action:"reconcile", retry:false, automatic_retries:0 });
});

test("prepared PostgreSQL claim is unique, atomic and has no delete/reset route", () => {
  const sql = readFileSync(new URL("../../../postgres/generation-attempt-claims.v1.sql", import.meta.url), "utf8");
  assert.match(sql, /operation_key text NOT NULL UNIQUE/);
  assert.match(sql, /UNIQUE \(generation_job_id, attempt_number\)/);
  assert.match(sql, /ON CONFLICT DO NOTHING/);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+intrst_generation_attempt_claims/i);
});
