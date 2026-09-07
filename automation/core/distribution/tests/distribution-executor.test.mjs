import test from "node:test";
import assert from "node:assert/strict";
import { createPublisherAdapter, executeDistribution, preflightDistribution, resolveProviderMediaUrl } from "../distribution-executor.mjs";
import { DISTRIBUTION_ROUTING, renderPlatformPayload } from "../platform-renderer.mjs";
import { BLOTATO_HTTP_CREDENTIAL, createBlotatoHttpAdapter } from "../publisher-adapters.mjs";
import { createBlotatoFirstCommentAdapter } from "../first-comment-adapter.mjs";

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
    submit: async () => { calls.submit += 1; return { status: "published", submissionId: "provider-post-1", provider_post_url: "https://public.example/post-1" }; },
    normalizeResult: (value) => ({ ...value, provider_job_id: value.submissionId ?? null }),
    normalizeError: () => "PUBLISH_FAILURE",
  });
  return {
    calls,
    loadContentOutput: async () => ({ output_id: ids.output, story_object_id: ids.story, version: "1.0.0", status: "approved_for_publish", publish_clearance: true, editorial_approval: true, rights_clearance: true, asset_ids_json: JSON.stringify([ids.asset]), manifest_json: JSON.stringify({ platform_targets: ["facebook"], caption: "Approved copy" }) }),
    loadStoryObject: async () => ({ story_object_id: ids.story, approval_state: "approved", approved_by: "operator", approved_at: "2026-09-06T00:00:00Z" }),
    loadAsset: async () => ({ asset_id: ids.asset, rights_status: "publishable", identity_status: "verified", technical_status: "acquired_original_file", drive_url: "https://drive.example/asset", provider_media_url: "https://media.example/asset.jpg" }),
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

test("routing remains subject- and format-agnostic", () => {
  assert.equal(DISTRIBUTION_ROUTING.facebook.adapter_mode, "http");
  assert.equal(DISTRIBUTION_ROUTING.instagram.adapter_mode, "http");
  assert.equal(DISTRIBUTION_ROUTING.threads.adapter_mode, "native");
  assert.equal(DISTRIBUTION_ROUTING.youtube.adapter_mode, "native");
  assert.equal(DISTRIBUTION_ROUTING.x.adapter_mode, "native");
  assert.equal(DISTRIBUTION_ROUTING.tiktok.adapter_mode, "http");
  assert.throws(() => renderPlatformPayload({ platform: "linkedin", caption: "Body", engagement_intent: "Intent" }), { code: "PLATFORM_UNSUPPORTED" });
});

test("provider media delivery is explicit or deterministically derived from an approved Wikimedia file page", () => {
  assert.equal(resolveProviderMediaUrl({ provider_media_url: "https://cdn.example/asset.jpg" }), "https://cdn.example/asset.jpg");
  assert.equal(resolveProviderMediaUrl({ source_url: "https://commons.wikimedia.org/wiki/File:Young-Dolly-Parton.jpg" }), "https://commons.wikimedia.org/wiki/Special:FilePath/Young-Dolly-Parton.jpg");
  assert.equal(resolveProviderMediaUrl({ source_url: "https://example.com/private/file" }), null);
});

test("TikTok uses the HTTP adapter and does not inherit first-comment behavior", () => {
  const payload = renderPlatformPayload({ platform: "tiktok", caption: "Story body", engagement_intent: "Invite the audience to respond.", hashtags: ["Story", "Legacy"] });
  assert.equal(payload.adapter_mode, "http");
  assert.equal(payload.first_comment, undefined);
  assert.equal(payload.caption, "Story body\n\n#Story #Legacy");
  assert.equal(payload.engagement_rendered, false);
});

test("Facebook and Instagram render engagement intent as a separate first comment", () => {
  for (const platform of ["facebook", "instagram"]) {
    const payload = renderPlatformPayload({ platform, caption: "Story body", engagement_intent: "Invite the audience to respond.", hashtags: ["Story", "Legacy"] });
    assert.equal(payload.first_comment, "Invite the audience to respond.");
    assert.equal(payload.caption, "Story body\n\n#Story #Legacy");
    assert.equal(typeof payload.character_count, "number");
    assert.equal(payload.render_version, "distribution-renderer@1.3.0");
  }
});

test("Threads and YouTube render engagement intent in the closing paragraph", () => {
  for (const platform of ["threads", "youtube"]) {
    const payload = renderPlatformPayload({ platform, caption: "Story body", engagement_intent: "Invite the audience to respond.", hashtags: ["Story"] });
    assert.match(payload.caption, /Story body\n\nInvite the audience to respond\./);
    assert.match(payload.caption, /#Story$/);
    assert.equal(payload.first_comment, undefined);
  }
});

test("Threads renderer is deterministic and never exceeds 500 characters", () => {
  const body = "Dolly Parton turned a personal family wound into a durable literacy institution. " + "Her work continues to put books directly into children's homes and to make reading feel possible for every family.";
  const payload = renderPlatformPayload({ platform: "threads", caption: body, engagement_intent: "Which part of her legacy changed how you understand her?", hashtags: ["Literacy", "DollyParton", "Books"] });
  assert.ok(payload.character_count <= 500);
  assert.ok(payload.caption.startsWith("Dolly Parton turned a personal family wound"));
  assert.equal(payload.render_version, "distribution-renderer@1.3.0");
});

test("Threads drops optional engagement and hashtags before cutting story substance", () => {
  const body = "A".repeat(480);
  const payload = renderPlatformPayload({ platform: "threads", caption: body, engagement_intent: "A very long engagement prompt that cannot fit beside the story without changing its meaning.", hashtags: ["One", "Two", "Three"] });
  assert.equal(payload.caption, body);
  assert.equal(payload.character_count, 480);
});

test("X prioritizes substance and may omit engagement and hashtags", () => {
  const payload = renderPlatformPayload({ platform: "x", caption: "Story body", engagement_intent: "Invite the audience to respond.", hashtags: [] });
  assert.equal(payload.caption, "Story body");
  assert.equal(payload.engagement_rendered, false);
});

test("renderer removes a duplicated trailing engagement question", () => {
  const payload = renderPlatformPayload({ platform: "facebook", caption_body: "Story body\n\nInvite the audience to respond.", engagement_intent: { intent: "Invite the audience to respond.", tone: "reflective", optional: false }, hashtags: ["#Story"] });
  assert.equal(payload.caption, "Story body\n\n#Story");
  assert.equal(payload.first_comment, "Invite the audience to respond.");
});

test("renderer caps contextual hashtags at three", () => {
  assert.throws(() => renderPlatformPayload({ platform: "facebook", caption: "Body", engagement_intent: "Intent", hashtags: ["a", "b", "c", "d"] }), { code: "COPY_VALIDATION" });
});

test("Blotato adapters share a normalized result contract and reject placeholders at live gate", async () => {
  let calls = 0;
  const adapter = createBlotatoHttpAdapter({ transport: async (payload) => { calls += 1; return { status: "published", submissionId: "job-1" }; } });
  const boundCredential = { ...BLOTATO_HTTP_CREDENTIAL, api_key: "test-bound-value" };
  await assert.rejects(() => adapter.validateConfig({ credential: boundCredential, account_id: "__FACEBOOK_BLOTATO_ACCOUNT_ID__" }), /ACCOUNT_ROUTING_MISSING/);
  await assert.rejects(() => adapter.validateConfig({ credential: BLOTATO_HTTP_CREDENTIAL, account_id: "acct-1" }), /CREDENTIAL_FAILURE/);
  await adapter.validateConfig({ credential: boundCredential, account_id: "acct-1" });
  const result = await adapter.submit({ platform: "facebook", caption: "Body" }, "publish:output:facebook:1");
  assert.equal(calls, 1);
  assert.equal(result.submissionId, "job-1");
  assert.equal(adapter.adapter_mode, "http");
  const normalized = adapter.normalizeResult(result, { content_output_id: ids.output, platform: "facebook", account_id: "acct-1", adapter_mode: "http" });
  assert.deepEqual(normalized, {
    content_output_id: ids.output,
    platform: "facebook",
    account_id: "acct-1",
    provider: "blotato",
    adapter_mode: "http",
    provider_job_id: "job-1",
    platform_post_id: null,
    public_url: null,
    submitted_at: null,
    published_at: null,
    provider_status: "published",
    outcome: "SUCCESS",
    attempt_count: 1,
    retry_count: 0,
    error_class: null,
  });
});

test("MCP first-comment adapter creates a top-level comment with the published Blotato post ID", async () => {
  const calls = [];
  const adapter = createBlotatoFirstCommentAdapter({
    listPublishedPosts: async () => [{ postId: "blotato-post-1", postSubmissionId: "submission-1", platform: "facebook", accountId: "101607426321841", state: { type: "published" } }],
    postComment: async (args) => { calls.push(args); return { id: "comment-1", status: "queued" }; },
  });
  const postId = await adapter.resolvePublishedPostId({ platform: "facebook", account_id: "101607426321841", postSubmissionId: "submission-1" });
  const result = await adapter.postFirstComment({ platform: "facebook", postId, postIdSource: "blotato_list_posts.published.postId", text: "Invite the audience to respond." });
  assert.deepEqual(calls, [{ postId: "blotato-post-1", text: "Invite the audience to respond." }]);
  assert.equal(result.status, "queued");
  assert.equal(result.parent_comment_id, null);
});

test("MCP first-comment adapter rejects submission IDs and ambiguous post resolution", async () => {
  const adapter = createBlotatoFirstCommentAdapter({
    listPublishedPosts: async () => [
      { postId: "a", postSubmissionId: "submission-1", platform: "instagram", accountId: "69849", state: { type: "published" } },
      { postId: "b", postSubmissionId: "submission-1", platform: "instagram", accountId: "69849", state: { type: "published" } },
    ],
    postComment: async () => ({ status: "queued" }),
  });
  await assert.rejects(() => adapter.resolvePublishedPostId({ platform: "instagram", account_id: "69849", postSubmissionId: "submission-1" }), { code: "POST_ID_AMBIGUOUS" });
  await assert.rejects(() => adapter.postFirstComment({ platform: "instagram", postId: "submission-1", text: "Invite the audience to respond." }), { code: "POST_ID_UNRESOLVED" });
});

test("main publication success is preserved while a first comment is queued", async () => {
  const deps = fixtureDeps();
  deps.loadContentOutput = async () => ({ output_id: ids.output, story_object_id: ids.story, version: "1.0.0", status: "approved_for_publish", publish_clearance: true, editorial_approval: true, rights_clearance: true, asset_ids_json: JSON.stringify([ids.asset]), manifest_json: JSON.stringify({ platform_targets: ["facebook"], caption: "Approved copy", engagement_intent: "Invite the audience to respond." }) });
  deps.firstCommentAdapter = {
    resolvePublishedPostId: async ({ postSubmissionId }) => { assert.equal(postSubmissionId, "provider-post-1"); return "blotato-post-1"; },
    postFirstComment: async ({ postId, text, postIdSource }) => { assert.deepEqual({ postId, text, postIdSource }, { postId: "blotato-post-1", text: "Invite the audience to respond.", postIdSource: "blotato_list_posts.published.postId" }); return { status: "queued" }; },
  };
  const result = await executeDistribution(request, deps);
  assert.equal(result.status, "published_comment_queued");
  assert.equal(deps.calls.logs.at(-1).status, "published_comment_queued");
});

test("first-comment resolution failure preserves the main publication", async () => {
  const deps = fixtureDeps();
  deps.loadContentOutput = async () => ({ output_id: ids.output, story_object_id: ids.story, version: "1.0.0", status: "approved_for_publish", publish_clearance: true, editorial_approval: true, rights_clearance: true, asset_ids_json: JSON.stringify([ids.asset]), manifest_json: JSON.stringify({ platform_targets: ["instagram"], caption: "Approved copy", engagement_intent: "Invite the audience to respond." }) });
  deps.firstCommentAdapter = {
    resolvePublishedPostId: async () => { throw Object.assign(new Error("ambiguous"), { code: "POST_ID_AMBIGUOUS" }); },
    postFirstComment: async () => { throw new Error("must not be called"); },
  };
  const result = await executeDistribution(request, deps);
  assert.equal(result.status, "published_comment_reconciliation_required");
  assert.equal(deps.calls.logs.at(-1).status, "published_comment_reconciliation_required");
});
