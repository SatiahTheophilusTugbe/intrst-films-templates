import assert from "node:assert/strict";
import { createId } from "../../ids/ids.mjs";
import { ContractError, assertAdapter, assertDerivativeTransition, normalizeError, retryDecision, validateDerivativeManifest, validateRunEvent, validateStoryObject } from "../aut-009.mjs";

const entropy = new Uint8Array(10);
let tick = Date.parse("2026-09-05T00:00:00.000Z");
const id = (type) => createId(type, { timestamp: tick++, entropy });
let passed = 0;
const test = async (name, fn) => { await fn(); passed += 1; console.log(`ok - ${name}`); };
const expectCode = (code, fn) => assert.throws(fn, (error) => error instanceof ContractError && error.code === code);

const sourceId = id("source");
const claimId = id("claim");
const story = {
  schema_version: "1.0.0", story_object_id: id("story_object"), subject_id: id("subject"), subject_name: "Fixture Subject",
  trigger: "regression", central_question: "Question", thesis: "Thesis", contradiction: "Contradiction", emotional_question: "Emotion",
  chronology: [{ label: "Moment", date_or_period: null, summary: "Summary", claim_ids: [claimId] }],
  verified_claims: [{ claim_id: claimId, text: "Verified fact", source_ids: [sourceId], verification_status: "human_verified" }],
  attributed_claims: [], prohibited_or_uncertain_claims: [], quote_extracts: [], source_ids: [sourceId], source_urls: ["https://example.com"], archive_assets: [],
  rights_status: "publishable", asset_identity_status: "verified", derivative_safe_facts: [{ claim_id: claimId, text: "Verified fact", source_ids: [sourceId], verification_status: "human_verified" }],
  platform_constraints: {}, visual_mode: "editorial", editorial_version: "1.0.0", approval_state: "approved",
  audit: { created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:00Z", approved_by: "editor@example.com", approved_at: "2026-09-05T00:00:00Z", life_file_version: "1.0.0", story_bible_version: "1.0.0" }
};

const gates = Object.fromEntries(["schema", "evidence", "rights", "brand", "copy", "visual", "human", "publish", "audit"].map((name) => [name, { status: "pass", blocking: true, details: null }]));
const manifest = {
  schema_version: "1.0.0", manifest_id: id("manifest"), story_object_id: story.story_object_id, story_object_version: "1.0.0", derivative_type: "single_image",
  claim_ids: [claimId], source_ids: [sourceId], asset_ids: [], platform_targets: ["facebook"], payload: { factual: true }, quality_gates: gates,
  approval: { state: "approved", actor: "editor@example.com", approved_at: "2026-09-05T00:00:00Z", notes: null },
  render: { state: "rendered", renderer: "fixture", renderer_version: "1.0.0", output_asset_ids: [], job_id: null },
  publish: { state: "published", targets: [{ platform: "facebook", idempotency_key: "fixture:facebook:v1", status: "published", post_id: "post-1", post_url: "https://example.com/post-1", attempt: 1 }] },
  audit: { created_at: "2026-09-05T00:00:00Z", updated_at: null, run_id: id("run"), parent_run_id: null, prompt_version: null, template_id: null, template_version: null, model: null, model_version: null }
};

await test("valid approved Story Object", () => assert.equal(validateStoryObject(story, { forGeneration: true }), true));
await test("Story Object rejects mistyped identity", () => { const v=structuredClone(story); v.story_object_id=id("asset"); expectCode("SCHEMA_VALIDATION",()=>validateStoryObject(v)); });
await test("approval actor required", () => { const v=structuredClone(story); v.audit.approved_by=null; expectCode("HUMAN_REVIEW_BLOCK",()=>validateStoryObject(v)); });
await test("source required for verified claim", () => { const v=structuredClone(story); v.verified_claims[0].source_ids=[]; expectCode("MISSING_SOURCE",()=>validateStoryObject(v)); });
await test("hashtag cap is hard validation", () => { const v=structuredClone(story); v.platform_constraints.instagram={max_hashtags:4}; expectCode("SCHEMA_VALIDATION",()=>validateStoryObject(v)); });
await test("uncertain claim cannot be derivative safe", () => { const v=structuredClone(story); v.prohibited_or_uncertain_claims=[{claim_id:claimId}]; expectCode("CLAIM_BLOCK",()=>validateStoryObject(v)); });
await test("orphan chronology claim blocked", () => { const v=structuredClone(story); v.chronology[0].claim_ids=[id("claim")]; expectCode("CLAIM_BLOCK",()=>validateStoryObject(v)); });
await test("draft cannot feed generator", () => { const v=structuredClone(story); v.approval_state="draft"; expectCode("HUMAN_REVIEW_BLOCK",()=>validateStoryObject(v,{forGeneration:true})); });
await test("rights block stops generator", () => { const v=structuredClone(story); v.rights_status="blocked"; expectCode("RIGHTS_BLOCK",()=>validateStoryObject(v,{forGeneration:true})); });
await test("identity block stops generator", () => { const v=structuredClone(story); v.asset_identity_status="blocked"; expectCode("IDENTITY_BLOCK",()=>validateStoryObject(v,{forGeneration:true})); });
await test("valid published manifest", () => assert.equal(validateDerivativeManifest(manifest), true));
await test("unsupported derivative rejected", () => { const v=structuredClone(manifest); v.derivative_type="unknown"; expectCode("SCHEMA_VALIDATION",()=>validateDerivativeManifest(v)); });
await test("factual output requires claims", () => { const v=structuredClone(manifest); v.claim_ids=[]; expectCode("CLAIM_BLOCK",()=>validateDerivativeManifest(v)); });
await test("blocking gate prevents render", () => { const v=structuredClone(manifest); v.quality_gates.rights.status="fail"; expectCode("QUALITY_GATE_BLOCK",()=>validateDerivativeManifest(v)); });
await test("publish requires approval", () => { const v=structuredClone(manifest); v.approval.state="approval_required"; expectCode("HUMAN_REVIEW_BLOCK",()=>validateDerivativeManifest(v)); });
await test("published target requires receipt", () => { const v=structuredClone(manifest); v.publish.targets[0].post_id=null; expectCode("PUBLISH_AUDIT_MISSING",()=>validateDerivativeManifest(v)); });
await test("publish keys are unique", () => { const v=structuredClone(manifest); v.publish.targets.push({...v.publish.targets[0],platform:"x"}); expectCode("IDEMPOTENCY_COLLISION",()=>validateDerivativeManifest(v)); });
await test("state advances one step", () => assert.equal(assertDerivativeTransition("validation","render_ready"),true));
await test("state cannot skip approval", () => expectCode("STATE_TRANSITION_INVALID",()=>assertDerivativeTransition("qc","approved")));
await test("exception transition allowed", () => assert.equal(assertDerivativeTransition("rendering","failed_recoverable"),true));
await test("429 normalized", () => assert.equal(normalizeError({status:429}),"RATE_LIMIT"));
await test("credential failure terminal", () => assert.deepEqual(retryDecision("CREDENTIAL_FAILURE",1),{action:"stop_alert",retry:false}));
await test("transient retry bounded", () => { assert.equal(retryDecision("NETWORK",3).retry,true); assert.equal(retryDecision("NETWORK",4).retry,false); });
await test("malformed output regeneration bounded", () => { assert.equal(retryDecision("MALFORMED_MODEL_OUTPUT",1).action,"regenerate"); assert.equal(retryDecision("MALFORMED_MODEL_OUTPUT",2).retry,false); });
await test("uncertain publish lookup before retry", () => assert.equal(retryDecision("PUBLISH_FAILURE",1,{submitted:true}).action,"lookup_idempotency_key"));
await test("complete adapter accepted", () => assert.equal(assertAdapter(Object.fromEntries(["healthcheck","validate_config","submit","get_status","normalize_result","normalize_error"].map((method)=>[method,()=>method]))),true));
await test("missing adapter method rejected", () => expectCode("ADAPTER_CONTRACT_INVALID",()=>assertAdapter({})));
await test("run event validates lineage", () => assert.equal(validateRunEvent({run_id:id("run"),root_run_id:id("run"),parent_run_id:null,workflow_key:"INT-SVC-001",workflow_version:"1.0.0",module:"fixture",environment:"development",started_at:"2026-09-05T00:00:00Z",status:"running",attempt:1,input_ids:[],output_ids:[],source_ids:[],claim_ids:[],asset_ids:[],human_review_required:false,idempotency_key:"fixture"}),true));

console.log(`AUT-009 contracts: ${passed} cases passed`);
