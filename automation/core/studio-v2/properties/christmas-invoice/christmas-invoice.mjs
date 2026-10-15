import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hashCanonical, routeModel, summarizeCostLedger, productionMetrics } from "../../studio-v2.mjs";
import { isCanonicalId } from "../../../ids/ids.mjs";

const dir = new URL("./", import.meta.url);
const readJson = name => JSON.parse(readFileSync(new URL(name, dir), "utf8"));
export const namespace = readJson("property-namespace.json");
export const narrative = readJson("narrative-objects.json");
export const continuityInput = readJson("continuity-deltas.json");
export const runtimeContract = readJson("generation-runtime.contract.json");
export const costLedger = readJson("cost-ledger.json");
export const telemetryContract = readJson("telemetry.contract.json");
export const deterministicGraphics = readJson("deterministic-graphics.contract.json");
export const qcContract = readJson("qc.contract.json");

const SERIES_ID = namespace.identity.series_id;
const REVIEW_ID = namespace.identity.series_lock_review_id;
const CHARACTER_IDS = Object.values(namespace.identity.character_ids);
const CREATED_AT = "2026-10-14T00:00:00.000Z";

function envelope(definition) {
  const { object_type, object_id, status, payload } = definition;
  const result = {
    schema_version: "studio-v2-object@1.0.0",
    object_type,
    object_id,
    version: "1.0.0",
    status,
    payload,
    payload_hash: hashCanonical(payload),
    approval_record_id: status === "approved" ? REVIEW_ID : null,
    audit: { created_at: CREATED_AT, created_by: "STU-004-property-instantiation", updated_at: CREATED_AT, approved_by: status === "approved" ? "WIN-0-human-series-script-lock" : null, approved_at: status === "approved" ? CREATED_AT : null }
  };
  if (["character", "relationship", "location", "episode", "scene", "shot"].includes(object_type)) result.series_id = SERIES_ID;
  return result;
}

function episodeDefinition(item, index) {
  const payload = {
    series_id: SERIES_ID,
    sequence: item.sequence,
    hook: item.hook,
    objective: item.objective,
    conflict: item.conflict,
    turn: item.turn,
    reveal: item.reveal,
    cliffhanger: item.cliffhanger,
    runtime_target_seconds: item.runtime_target_seconds,
    character_ids: CHARACTER_IDS,
    location_ids: item.location_ids,
    continuity_in_state_id: namespace.identity.continuity_state_ids[index],
    planned_continuity_mutations: [continuityInput.deltas[index].source_sha256],
    monetization_position: { authority: "WIN-6", status: "external_handoff_not_generation_authorization" },
    release_state: item.sequence <= 3 ? "proof_gate_locked_not_generation_authorized" : "blocked_pending_STU-008_expansion_authorization",
    approval_state: "approved"
  };
  return { object_type: "episode", object_id: item.object_id, status: "approved", payload };
}

function sceneDefinition(item) {
  const episode = narrative.episodes.find(value => value.sequence === item.episode_sequence);
  const payload = {
    series_id: SERIES_ID,
    episode_id: episode.object_id,
    sequence: item.sequence,
    purpose: item.purpose,
    conflict: episode.conflict,
    character_ids: CHARACTER_IDS,
    location_id: item.location_id,
    story_time: item.story_time,
    action: item.action,
    dialogue: { source_document_id: narrative.source_binding.document_id, source_revision_id: narrative.source_binding.revision_id, episode_sequence: item.episode_sequence, script_sha256: episode.script_sha256, inline_text_persisted: false },
    continuity_requirements: item.continuity_requirements,
    shot_ids: [],
    approval_state: "review_required"
  };
  return { object_type: "scene", object_id: item.object_id, status: "review_required", episode_id: episode.object_id, payload };
}

export function buildPropertyObjects() {
  const objects = narrative.objects.map(envelope);
  for (const [index, item] of narrative.episodes.entries()) objects.push(envelope(episodeDefinition(item, index)));
  for (const item of narrative.scenes) objects.push({ ...envelope(sceneDefinition(item)), episode_id: narrative.episodes.find(value => value.sequence === item.episode_sequence).object_id });
  return Object.freeze(objects);
}

function genesisState() {
  return {
    knowledge_state: ["family:christmas_at_carter_home", "maya:actual_daily_care_load", "daniel:recurring_transfer_history", "thomas:money_use_and_realtor_plan"],
    belief_state: ["maya:care_is_presence", "daniel:money_is_contribution", "thomas:care_without_consent_is_control"],
    obligation_state: ["maya:default_daily_care_until_current_system_changes"],
    money_state: [],
    leverage_state: ["maya:operational_knowledge_high", "daniel:financial_evidence_hidden", "thomas:property_authority_high"],
    relationship_state: ["maya-daniel:uneven_responsibility", "maya-thomas:care_and_control_entangled", "daniel-thomas:distance"],
    emotional_state: ["maya:contained_resentment", "daniel:complacent_distance", "thomas:defensive_autonomy"],
    prop_possession: { invoice: "maya/folded", transfer_records: "daniel/private", house_folder: "thomas/study", realtor_agreement: "thomas/study", care_calendar: "maya" },
    hidden_truth_state: { maya_job: "hidden", daniel_unverified_relief: "hidden", thomas_diversion: "hidden", thomas_realtor: "hidden" },
    location_state: ["dining_room:christmas_dinner_set", "study:private_documents"],
    timeline_state: ["2026-12-24_before_dinner"],
    wardrobe_state: { status: "awaiting_STU-007", character_states: {} },
    state_delta: "series genesis before the invoice is placed"
  };
}

function applyDelta(prior, input) {
  const n = input.narrative_delta;
  const s = input.supplement;
  return {
    knowledge_state: [...prior.knowledge_state, ...n.knowledge],
    belief_state: [...prior.belief_state, ...n.belief],
    obligation_state: [...prior.obligation_state, ...n.obligation],
    money_state: [...prior.money_state, ...n.money],
    leverage_state: [...prior.leverage_state, ...n.leverage],
    relationship_state: [...prior.relationship_state, ...n.relationship],
    emotional_state: [...prior.emotional_state, ...s.emotional_state],
    prop_possession: { ...prior.prop_possession, ...n.prop_possession },
    hidden_truth_state: { ...prior.hidden_truth_state, ...n.hidden_truth },
    location_state: [...prior.location_state, ...s.location_state],
    timeline_state: [...prior.timeline_state, ...s.timeline_state],
    wardrobe_state: s.wardrobe_state,
    state_delta: s.state_delta
  };
}

export function buildContinuitySnapshots() {
  const ids = namespace.identity.continuity_state_ids;
  const snapshots = [];
  let state = genesisState();
  snapshots.push(Object.freeze({ contract_version: "continuity-engine@1.0.0", continuity_state_id: ids[0], series_id: SERIES_ID, episode_id: null, version: "1.0.0", parent_state_id: null, parent_state_hash: null, scope: "series_genesis", state, state_hash: hashCanonical(state), mutation_ids: [], approval_record_id: REVIEW_ID, created_at: CREATED_AT }));
  continuityInput.deltas.forEach((input, index) => {
    const parent = snapshots.at(-1);
    state = applyDelta(parent.state, input);
    snapshots.push(Object.freeze({ contract_version: "continuity-engine@1.0.0", continuity_state_id: ids[index + 1], series_id: SERIES_ID, episode_id: namespace.identity.episode_ids[index], version: "1.0.0", parent_state_id: parent.continuity_state_id, parent_state_hash: parent.state_hash, scope: "episode_out", state, state_hash: hashCanonical(state), mutation_ids: [input.source_sha256], source_delta_hash: input.source_sha256, approval_record_id: REVIEW_ID, created_at: CREATED_AT }));
  });
  return Object.freeze(snapshots);
}

export function validateObjectGraph(objects = buildPropertyObjects(), snapshots = buildContinuitySnapshots()) {
  const errors = [];
  const ids = new Set(objects.map(object => object.object_id));
  if (ids.size !== objects.length) errors.push("DUPLICATE_OBJECT_ID");
  if (objects.length !== 32) errors.push("OBJECT_COUNT_MISMATCH");
  if (objects.filter(x => x.object_type === "episode").length !== 10) errors.push("EPISODE_COUNT_MISMATCH");
  if (objects.filter(x => x.object_type === "scene").length !== 12) errors.push("SCENE_COUNT_MISMATCH");
  if (objects.some(x => ["H26-01", "SIG-H26-001"].includes(x.object_id))) errors.push("DEVELOPMENT_ALIAS_USED_AS_PRIMARY_ID");
  for (const object of objects) if (!isCanonicalId(object.object_id, object.object_type === "continuity_snapshot" ? "continuity_snapshot" : object.object_type)) errors.push(`INVALID_ID:${object.object_id}`);
  for (const scene of objects.filter(x => x.object_type === "scene")) if (!ids.has(scene.episode_id) || !ids.has(scene.payload.location_id)) errors.push(`BROKEN_SCENE_REFERENCE:${scene.object_id}`);
  for (const episode of objects.filter(x => x.object_type === "episode")) if (!snapshots.some(x => x.continuity_state_id === episode.payload.continuity_in_state_id)) errors.push(`BROKEN_CONTINUITY_IN:${episode.object_id}`);
  if (snapshots.length !== 11) errors.push("CONTINUITY_SNAPSHOT_COUNT_MISMATCH");
  for (let index = 1; index < snapshots.length; index += 1) {
    if (snapshots[index].parent_state_id !== snapshots[index - 1].continuity_state_id || snapshots[index].parent_state_hash !== snapshots[index - 1].state_hash) errors.push(`CONTINUITY_CHAIN_BREAK:${index}`);
  }
  return Object.freeze({ valid: errors.length === 0, errors, counts: { objects: objects.length, episodes: 10, scenes: 12, shots: 0, continuity_snapshots: snapshots.length } });
}

const difficultyRank = Object.freeze({ low: 1, medium: 2, high: 3, extreme: 4 });
export function routePropertyShot(request) {
  const required = ["character_count","emotional_performance_difficulty","camera_requirements","reference_dependence","prop_interaction","dialogue_lip_sync_requirement","motion_complexity","continuity_sensitivity","budget_remaining_minor"];
  for (const field of required) if (!(field in request.shot_requirements)) throw new Error(`SHOT_ROUTING_FIELD_MISSING:${field}`);
  const candidates = request.candidates.map(candidate => {
    const reasons = [];
    const cap = candidate.property_capabilities ?? {};
    if ((cap.max_characters ?? 0) < request.shot_requirements.character_count) reasons.push("CHARACTER_COUNT_UNSUPPORTED");
    if ((difficultyRank[cap.emotional_performance_max] ?? 0) < (difficultyRank[request.shot_requirements.emotional_performance_difficulty] ?? 99)) reasons.push("EMOTIONAL_PERFORMANCE_UNSUPPORTED");
    if (request.shot_requirements.prop_interaction !== "none" && cap.prop_interaction !== true) reasons.push("PROP_INTERACTION_UNSUPPORTED");
    if (request.shot_requirements.reference_dependence === "high" && cap.multi_reference !== true) reasons.push("REFERENCE_DEPENDENCE_UNSUPPORTED");
    if (request.shot_requirements.continuity_sensitivity === "high" && cap.continuity_controls !== true) reasons.push("CONTINUITY_CONTROL_UNSUPPORTED");
    if (request.shot_requirements.camera_requirements.some(value => !(cap.camera_controls ?? []).includes(value))) reasons.push("CAMERA_REQUIREMENT_UNSUPPORTED");
    return reasons.length ? { ...candidate, commercial_use_permitted: false, evidence: [...(candidate.evidence ?? []), ...reasons] } : candidate;
  });
  return routeModel({ ...request.base_route_request, candidates, budget: { ...request.base_route_request.budget, ceiling_minor: Math.min(request.base_route_request.budget.ceiling_minor, request.shot_requirements.budget_remaining_minor) } });
}

export function validateAttemptRecord(record) {
  for (const field of runtimeContract.attempt_record.required) if (!(field in record)) throw new Error(`ATTEMPT_FIELD_MISSING:${field}`);
  if (!isCanonicalId(record.attempt_id, "generation_attempt") || !isCanonicalId(record.generation_job_id, "generation_job") || !isCanonicalId(record.shot_id, "shot")) throw new Error("ATTEMPT_ID_INVALID");
  if (record.attempt_number < 1 || !Number.isInteger(record.attempt_number)) throw new Error("ATTEMPT_NUMBER_INVALID");
  if (!runtimeContract.attempt_record.decision_enum.includes(record.decision)) throw new Error("ATTEMPT_DECISION_INVALID");
  if (record.decision === "rejected" && !runtimeContract.attempt_record.rejection_taxonomy.includes(record.rejection_reason)) throw new Error("REJECTION_REASON_INVALID");
  if (record.decision === "outcome_unknown" && record.rejection_reason !== "OUTCOME_UNKNOWN") throw new Error("UNKNOWN_OUTCOME_NOT_STICKY");
  return true;
}

export function summarizePropertyCosts(entries = costLedger.entries, attempts = []) {
  const ledger = summarizeCostLedger(entries, "USD");
  const completed = attempts.filter(x => ["accepted", "rejected"].includes(x.decision));
  const accepted = attempts.filter(x => x.decision === "accepted");
  const settled = completed.reduce((sum, x) => sum + x.generation_cost_minor, 0);
  const rejected = completed.filter(x => x.decision === "rejected").reduce((sum, x) => sum + x.generation_cost_minor, 0);
  const finishedSeconds = accepted.reduce((sum, x) => sum + (x.accepted_runtime_seconds ?? 0), 0);
  const baseMetrics = productionMetrics({ completed_attempts: completed.length, accepted_shots: accepted.length, settled_generation_cost_minor: settled, total_settled_production_cost_minor: settled, finished_runtime_seconds: finishedSeconds, rejected_attempt_cost_minor: rejected });
  const byProviderModel = {};
  const regenerationCauses = {};
  for (const attempt of completed) {
    const key = `${attempt.provider}/${attempt.model}/${attempt.model_version}`;
    const group = byProviderModel[key] ?? { attempts:0, accepted:0, cost_minor:0, latency_ms:0 };
    group.attempts += 1; group.accepted += attempt.decision === "accepted" ? 1 : 0; group.cost_minor += attempt.generation_cost_minor; group.latency_ms += attempt.generation_latency_ms ?? 0;
    byProviderModel[key] = group;
    if (attempt.decision === "rejected") regenerationCauses[attempt.rejection_reason] = (regenerationCauses[attempt.rejection_reason] ?? 0) + 1;
  }
  const humanMinutes = attempts.reduce((sum, x) => sum + (x.human_review_minutes ?? 0), 0);
  const continuityDefects = completed.filter(x => ["CONTINUITY_BLOCK","IDENTITY_DRIFT","WARDROBE_DRIFT","LOCATION_DRIFT","PROP_DRIFT","TIMELINE_DRIFT"].includes(x.rejection_reason)).length;
  const metrics = Object.freeze({ ...baseMetrics, cost_per_finished_second_minor: finishedSeconds > 0 ? settled / finishedSeconds : null, cost_by_provider_model_version: byProviderModel, regeneration_causes: regenerationCauses, continuity_defect_rate: completed.length > 0 ? continuityDefects / completed.length : null, human_intervention_minutes_per_accepted_shot: accepted.length > 0 ? humanMinutes / accepted.length : null });
  return Object.freeze({ ledger, metrics, ceiling_visible: ledger.budget_opened_minor === 60000, generation_allowed: ledger.available_minor > 0 && runtimeContract.authorization.generation_enabled });
}

export function canBeginStu008Generation(input = {}) {
  const blockers = [];
  if (input.episode_sequence > 3) blockers.push("EPISODES_4_TO_10_NOT_AUTHORIZED");
  if (input.stu007_character_lock !== true) blockers.push("STU_007_CHARACTER_LOCK_MISSING");
  if (input.stu007_location_lock !== true) blockers.push("STU_007_LOCATION_LOCK_MISSING");
  if (input.stu007_wardrobe_lock !== true) blockers.push("STU_007_WARDROBE_LOCK_MISSING");
  if (input.stu007_camera_grammar_lock !== true) blockers.push("STU_007_CAMERA_GRAMMAR_LOCK_MISSING");
  if (input.stu007_model_bakeoff !== true) blockers.push("STU_007_MODEL_BAKEOFF_MISSING");
  if (input.shot_manifest_locked !== true) blockers.push("SHOT_MANIFEST_LOCK_MISSING");
  if (input.atomic_claim_proven !== true) blockers.push("ATOMIC_GENERATION_CLAIM_UNPROVEN");
  if (input.persistence_readback_proven !== true) blockers.push("PERSISTENCE_READBACK_UNPROVEN");
  if (input.provider_adapter_zero_call_verified !== true) blockers.push("PROVIDER_ADAPTER_PREFLIGHT_MISSING");
  if (input.human_qc_owner_assigned !== true) blockers.push("HUMAN_QC_OWNER_MISSING");
  if (input.explicit_generation_authorization !== true) blockers.push("EXPLICIT_GENERATION_AUTHORIZATION_MISSING");
  if (!Number.isInteger(input.available_budget_minor) || input.available_budget_minor <= 0 || input.available_budget_minor > 60000) blockers.push("BUDGET_AVAILABILITY_INVALID");
  return Object.freeze({ allowed: blockers.length === 0, blockers, automatic_provider_calls: 0, automatic_retries: 0 });
}

export const packageRoot = fileURLToPath(dir);
