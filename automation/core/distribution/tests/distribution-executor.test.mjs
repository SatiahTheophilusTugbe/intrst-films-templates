import test from "node:test";
import assert from "node:assert/strict";
import { createPublisherAdapter, executeDistribution, preflightDistribution } from "../distribution-executor.mjs";

const ids = {
  output: "INT-OUT-01K4X4Q7B6D0MMPY000000004",
  story: "INT-STO-01K4X4Q7B6D0MMPY000000002",
  asset: "INT-AST-01K4X4Q7B6D0MMPY000000003",
  approval: "INT-REV-01K4X4Q7B6D0MMPY000000006",
  run: "INT-RUN-01K4X4Q7B6D0MMPY000000008",
};

function fixtureDeps({ existing = [], credential = { logical_name: "INT | Blotato | Development | Distribution" }, adapter = null } = {}) {
  const calls = { submit: 0, logs: [], runs: [] };
  const publisher = adapter ?? createPublisherAdapter({
    name: "test-publisher",
    validateConfig: async () => true,
    submit: async () => { calls.submit += 1; return { status: "published", provider_post_id: "provider-post-1", provider_post_url: "https://public.example/post-1" }; },
    normalizeResult: (value) => value,
    normalizeError: () => "PUBLISH_FAILURE",
  });
  return {
    calls,
    loadContentOutput: async () => ({ output_id: ids.output, story_object_id: ids.story, version: "1.0.0", status: "approved_for_publish", publish_clearance: true, editorial_approval: true, rights_clearance: true, asset_ids_json: JSON.stringify([ids.asset]), manifest_json: JSON.stringify({ platform_targets: ["facebook"], caption: "Approved copy" }) }),
    loadStoryObject: async () => ({ story_object_id: ids.story, approval_state: "approved", approved_by: "operator", approved_at: "2026-09-06T00:00:00Z" }),
    loadAsset: async () => ({ asset_id: ids.asset, rights_status: "publishable", identity_status: "verified", technical_status: "acquired_original_file", drive_url: "https://drive.example/asset" }),
    loadApproval: async () => ({ review_id: ids.approval, status: "approved", decision: "approved", decision_actor: "operator" }),
    findPublishingLog: async () => existing,
    resolvePublisherAdapter: async () => publisher,
    resolvePublisherCredential: async () => credential,
    persistPublishingLog: async (row) => calls.logs.push(row),
    persistWorkflowRun: async (row) => calls.runs.push(row),
  };
}

const request = { content_output_id: ids.output, run_id: ids.run, mode: "controlled_manual", budget: { max_publications: 1, max_attempts: 1, automatic_retries: 0 } };

test("resolves canonical dependencies and publishes exactly once", async () => {
  const deps = fixtureDeps();
  const result = await executeDistribution(request, deps);
  assert.equal(result.status, "published");
  assert.equal(deps.calls.submit, 1);
  assert.equal(result.retry_count, 0);
  assert.equal(deps.calls.logs.at(-1).status, "published");
});

test("blocks duplicate successful target before adapter transport", async () => {
  const deps = fixtureDeps({ existing: [{ status: "published" }] });
  await assert.rejects(() => preflightDistribution(request, deps), { code: "ALREADY_PUBLISHED" });
  assert.equal(deps.calls.submit, 0);
});

test("missing publisher credential fails closed before transport", async () => {
  const deps = fixtureDeps({ credential: null });
  await assert.rejects(() => preflightDistribution(request, deps), { code: "CREDENTIAL_FAILURE" });
  assert.equal(deps.calls.submit, 0);
});

test("rights, relationship and approval gates fail closed", async () => {
  const deps = fixtureDeps();
  deps.loadAsset = async () => ({ asset_id: ids.asset, rights_status: "blocked", identity_status: "verified", technical_status: "acquired_original_file", drive_url: "https://drive.example/asset" });
  await assert.rejects(() => preflightDistribution(request, deps), { code: "RIGHTS_BLOCK" });
  assert.equal(deps.calls.submit, 0);
});

test("ambiguous adapter outcome is terminal and never retried", async () => {
  let attempts = 0;
  const adapter = createPublisherAdapter({
    name: "test-publisher",
    validateConfig: async () => true,
    submit: async () => { attempts += 1; throw Object.assign(new Error("connection interrupted"), { code: "NETWORK" }); },
    normalizeResult: (value) => value,
    normalizeError: () => "OUTCOME_UNKNOWN",
  });
  const deps = fixtureDeps({ adapter });
  const result = await executeDistribution(request, deps);
  assert.equal(result.status, "outcome_unknown");
  assert.equal(attempts, 1);
  assert.equal(result.retry_count, 0);
  assert.equal(deps.calls.runs.at(-1).state, "outcome_unknown");
});
