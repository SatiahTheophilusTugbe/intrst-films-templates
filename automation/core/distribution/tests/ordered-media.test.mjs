import test from "node:test";
import assert from "node:assert/strict";
import { validateOrderedMedia, platformMediaEligibility } from "../ordered-media.mjs";
import { executeDistribution } from "../distribution-executor.mjs";

function fixture(count = 7) {
  const items = Array.from({ length: count }, (_, i) => {
    const sha256 = String(i + 1).padStart(64, "0"), url = `https://media.example/${i}.png`;
    return { order: i + 1, asset_id: `asset-${i}`, delivery_url: url, mime_type: "image/png", width: 1080, height: 1350, sha256,
      verification: { run_id: "synthetic", sha256, mime_type: "image/png", width: 1080, height: 1350 },
      visual_approval: { actor: "operator", date: "2026-09-18", status: "VISUAL_APPROVED" },
      delivery_verification: { url, sha256, checked_at: "2026-09-18", provider_accessible: true } };
  });
  return { assetIds: items.map(x => x.asset_id), mediaSet: { format: count === 1 ? "single_image" : "carousel", items }, assets: items.map(x => ({ asset_id: x.asset_id, file_hash: x.sha256, mime_type: x.mime_type, rights_status: "publishable", identity_status: "verified", technical_status: "technically_verified", drive_url: "https://drive.example/render" })) };
}

for (const count of [1, 7]) test(`resolves ${count} images with immutable order`, () => {
  const f = fixture(count), result = validateOrderedMedia(f);
  assert.deepEqual(result.media_urls, f.mediaSet.items.map(x => x.delivery_url));
  assert.deepEqual(result.asset_ids, f.assetIds);
});

for (const [name, mutate, code] of [
  ["missing slide", f => f.assets.pop(), "MEDIA_SET_INCOMPLETE"],
  ["duplicate slide", f => f.assetIds[1] = f.assetIds[0], "DUPLICATE_ASSET"],
  ["reordered slide", f => f.assetIds.reverse(), "MEDIA_ORDER_OR_IDENTITY_MISMATCH"],
  ["hash mismatch", f => f.assets[2].file_hash = "f".repeat(64), "MEDIA_HASH_MISMATCH"],
  ["unavailable delivery", f => f.mediaSet.items[2].delivery_verification.provider_accessible = false, "DELIVERY_UNVERIFIED"],
  ["missing approval", f => delete f.mediaSet.items[3].visual_approval, "VISUAL_APPROVAL_REQUIRED"],
  ["missing rights", f => f.assets[4].rights_status = "pending", "RIGHTS_BLOCK"],
  ["wrong dimensions", f => f.mediaSet.items[2].width = 500, "MEDIA_PROOF_REQUIRED"],
]) test(`rejects ${name}`, () => assert.throws(() => { const f = fixture(); mutate(f); validateOrderedMedia(f); }, { code }));

test("platform matrix rejects complete unsupported sets without truncation", () => {
  const f = fixture();
  assert.equal(platformMediaEligibility("instagram", f.mediaSet).eligible, true);
  for (const p of ["x", "threads", "youtube", "facebook", "tiktok"]) assert.equal(platformMediaEligibility(p, f.mediaSet).eligible, false, p);
  assert.equal(f.mediaSet.items.length, 7);
});

test("one carousel claim and transport persist complete ordered lineage before submit", async () => {
  const f = fixture(), events = [], claims = [], runs = [], logs = [];
  const output = { output_id: "synthetic-output", story_object_id: "synthetic-story", version: "v2", status: "approved_for_publish", publish_clearance: true, editorial_approval: true, rights_clearance: true, asset_ids_json: JSON.stringify(f.assetIds), manifest_json: JSON.stringify({ media_set: f.mediaSet, platform_targets: ["instagram"], destination_account: "synthetic-account", caption: "Synthetic test" }) };
  const deps = {
    loadContentOutput: async () => output, loadStoryObject: async () => ({ approval_state: "approved", approved_by: "operator", approved_at: "2026-09-18" }),
    loadAsset: async id => f.assets.find(x => x.asset_id === id), loadApproval: async () => ({ status: "approved", decision: "approved", decision_actor: "operator", review_id: "synthetic-review" }),
    findPublishingLog: async () => [], resolvePublisherCredential: async () => ({}),
    claimPublication: async claim => { claims.push(claim); events.push("claim"); return { status: "CLAIMED", atomic: true }; },
    persistWorkflowRun: async row => { runs.push(row); events.push("run"); }, persistPublishingLog: async row => { logs.push(row); events.push("log"); },
    resolvePublisherAdapter: async () => ({ validateConfig: async () => {}, submit: async payload => { events.push("transport"); assert.deepEqual(payload.media_urls, f.mediaSet.items.map(x => x.delivery_url)); throw new Error("ambiguous"); }, normalizeResult: x => x, normalizeError: () => "OUTCOME_UNKNOWN" }),
  };
  const result = await executeDistribution({ content_output_id: output.output_id, run_id: "synthetic-run", mode: "controlled_manual", budget: { max_publications: 1, max_attempts: 1, automatic_retries: 0 } }, deps);
  assert.equal(claims.length, 1);
  assert.equal(claims[0].instruction_version, "v2");
  assert.equal(claims[0].media_set.items.length, 7);
  assert.deepEqual(events.slice(0, 4), ["claim", "run", "log", "transport"]);
  assert.equal(events.filter(x => x === "transport").length, 1);
  assert.equal(result.status, "outcome_unknown");
  assert.equal(result.retry_count, 0);
  for (const row of [...runs, ...logs]) assert.deepEqual(row.asset_ids, f.assetIds);
});
