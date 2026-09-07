export class DistributionContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DistributionContractError";
    this.code = code;
    this.details = details;
  }
}

const TERMINAL_SUCCESS = new Set(["published"]);
const SUPPORTED_PLATFORMS = new Set(["youtube", "facebook", "instagram", "tiktok", "x", "threads"]);

function fail(code, message, details) {
  throw new DistributionContractError(code, message, details);
}

function required(value, name) {
  if (value === undefined || value === null || value === "") fail("SCHEMA_VALIDATION", `${name} is required.`);
  return value;
}

function parseJson(value, name) {
  if (typeof value === "object" && value !== null) return value;
  try { return JSON.parse(required(value, name)); } catch { fail("SCHEMA_VALIDATION", `${name} must contain valid JSON.`); }
}

function outputTargets(output) {
  const manifest = parseJson(output.manifest_json, "content_output.manifest_json");
  const targets = manifest.platform_targets ?? (manifest.platform ? [manifest.platform] : []);
  if (!Array.isArray(targets) || targets.length === 0 || targets.some((platform) => !SUPPORTED_PLATFORMS.has(platform))) {
    fail("SCHEMA_VALIDATION", "content output must declare supported platform target(s).");
  }
  return { manifest, targets };
}

function validateAdapter(adapter) {
  for (const method of ["validateConfig", "submit", "normalizeResult", "normalizeError"]) {
    if (typeof adapter?.[method] !== "function") fail("ADAPTER_CONTRACT_INVALID", `Publisher adapter method ${method} is required.`);
  }
}

function engagementIntent(manifest) {
  const value = manifest?.engagement_intent;
  return typeof value === "string" ? value.trim() : typeof value?.intent === "string" ? value.intent.trim() : "";
}

export function resolveProviderMediaUrl(asset) {
  const explicit = asset?.provider_media_url ?? asset?.public_media_url ?? asset?.delivery_url;
  if (typeof explicit === "string" && /^https?:\/\//.test(explicit)) return explicit;
  const sourceUrl = typeof asset?.source_url === "string" ? asset.source_url : "";
  const match = sourceUrl.match(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:(.+)$/);
  if (match) return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(match[1]))}`;
  return null;
}

export function validateDistributionRequest(request) {
  required(request?.content_output_id, "content_output_id");
  if (request.mode !== "controlled_manual") fail("POLICY_BLOCK", "Distribution execution requires controlled_manual mode.");
  const budget = request.budget ?? {};
  if (budget.max_publications !== 1 || budget.max_attempts !== 1 || budget.automatic_retries !== 0) {
    fail("BUDGET_BLOCK", "Controlled distribution requires one publication, one attempt and zero retries.");
  }
  return true;
}

export async function preflightDistribution(request, deps) {
  validateDistributionRequest(request);
  const output = await required(await deps.loadContentOutput(request.content_output_id), "content output");
  const story = await required(await deps.loadStoryObject(output.story_object_id), "story object");
  const assetIds = parseJson(output.asset_ids_json, "content_output.asset_ids_json");
  if (!Array.isArray(assetIds) || assetIds.length === 0) fail("MISSING_ASSET", "Output has no asset relationship.");
  const asset = await required(await deps.loadAsset(assetIds[0]), "asset");
  const providerMediaUrl = resolveProviderMediaUrl(asset);
  const approval = await required(await deps.loadApproval(output.output_id), "approval");
  const { manifest, targets } = outputTargets(output);
  if (output.status !== "approved_for_publish" || output.publish_clearance !== true || output.editorial_approval !== true || output.rights_clearance !== true) {
    fail("APPROVAL_BLOCK", "Content output is not fully approved for publishing.");
  }
  if (story.approval_state !== "approved" || !story.approved_by || !story.approved_at) fail("APPROVAL_BLOCK", "Story Object approval is incomplete.");
  if (asset.rights_status !== "publishable" || asset.identity_status !== "verified" || asset.technical_status !== "acquired_original_file" || !asset.drive_url || !providerMediaUrl) {
    fail("RIGHTS_BLOCK", "Asset rights, identity or file verification is incomplete.");
  }
  if (approval.status !== "approved" || approval.decision !== "approved" || !approval.decision_actor) fail("APPROVAL_BLOCK", "Publish approval is incomplete.");
  const captions = manifest.caption ?? manifest.copy?.caption ?? manifest.platform_copy;
  if (!captions && !manifest.platform_captions) fail("MISSING_COPY", "Approved platform-native copy is missing.");
  const account_id = manifest.destination_account ?? null;
  const existing = await deps.findPublishingLog({ output_id: output.output_id, platform: targets[0], account_id, instruction_version: output.version });
  if (existing?.some((row) => TERMINAL_SUCCESS.has(row.status))) fail("ALREADY_PUBLISHED", "Output is already published to the target platform.");
  const adapter = await deps.resolvePublisherAdapter(targets[0], output);
  validateAdapter(adapter);
  const credential = await deps.resolvePublisherCredential(targets[0], output);
  if (!credential) fail("CREDENTIAL_FAILURE", "No authorized publisher credential is available for the target.");
  await adapter.validateConfig({ platform: targets[0], credential, destination: manifest.destination_account ?? null });
  return { output, story, asset: { ...asset, provider_media_url: providerMediaUrl }, approval, manifest, targets, adapter, credential, existing, account_id };
}

export async function executeDistribution(request, deps) {
  const context = await preflightDistribution(request, deps);
  const platform = context.targets[0];
  const idempotencyKey = `publish:${context.output.output_id}:${platform}:${context.account_id ?? "unresolved"}:${context.output.version}`;
  if (typeof deps.claimPublication !== "function") fail("DUPLICATE_PROTECTION_UNAVAILABLE", "An atomic publication claim capability is required before transport.");
  const claim = await deps.claimPublication({
    idempotency_key: idempotencyKey,
    output_id: context.output.output_id,
    platform,
    account_id: context.account_id,
    run_id: request.run_id,
    requested_at: new Date().toISOString(),
  });
  if (!claim || claim.status !== "CLAIMED") {
    const code = claim?.status ?? "CLAIM_BACKEND_UNAVAILABLE";
    fail(code, `Publication claim did not return CLAIMED: ${code}.`, { idempotency_key: idempotencyKey });
  }
  const event = {
    run_id: request.run_id,
    content_output_id: context.output.output_id,
    story_object_id: context.output.story_object_id,
    asset_ids: JSON.parse(context.output.asset_ids_json),
    approval_id: context.approval.review_id,
    platform,
    account_id: context.account_id,
    provider: context.adapter.name ?? "publisher-adapter",
    idempotency_key: idempotencyKey,
    attempt_id: claim.attempt_id ?? `${idempotencyKey}:${request.run_id}`,
    attempt: 1,
    retry_count: 0,
    state: "preflight_passed",
  };
  await deps.persistWorkflowRun({ ...event, state: "started" });
  await deps.persistPublishingLog({ ...event, status: "submitted", approval_status: "approved" });
  let result;
  try {
    result = await context.adapter.submit({ output: context.output, story: context.story, asset: context.asset, approval: context.approval, manifest: context.manifest, platform }, idempotencyKey);
  } catch (error) {
    const normalized = context.adapter.normalizeError(error);
    await deps.persistPublishingLog({ ...event, status: "blocked_reconciliation", error_class: normalized, retry_count: 0 });
    await deps.persistWorkflowRun({ ...event, state: "outcome_unknown", status: "blocked_reconciliation", error_class: normalized });
    return { status: "outcome_unknown", error_class: normalized, provider_calls: 1, retry_count: 0, idempotency_key: idempotencyKey };
  }
  const normalized = context.adapter.normalizeResult(result, { content_output_id: context.output.output_id, platform, account_id: context.manifest.destination_account ?? null, adapter_mode: context.adapter.adapter_mode ?? "native" });
  const outcome = normalized.outcome ?? (normalized.status === "published" ? "SUCCESS" : normalized.status === "submitted" ? "SUBMITTED" : "OUTCOME_UNKNOWN");
  if (outcome !== "SUCCESS" && outcome !== "SUBMITTED") fail("PUBLISH_FAILURE", "Publisher returned an unsupported terminal outcome.");
  const status = outcome === "SUCCESS" ? "published" : "submitted";
  if (status === "published" && ["facebook", "instagram"].includes(platform) && deps.firstCommentAdapter && engagementIntent(context.manifest)) {
    try {
      const postId = await deps.firstCommentAdapter.resolvePublishedPostId({
        platform,
        account_id: context.manifest.destination_account ?? null,
        postSubmissionId: normalized.provider_job_id,
      });
      const comment = await deps.firstCommentAdapter.postFirstComment({
        platform,
        postId,
        postIdSource: "blotato_list_posts.published.postId",
        text: engagementIntent(context.manifest),
      });
      await deps.persistPublishingLog({ ...event, ...normalized, status: "published_comment_queued", first_comment_requested: true, first_comment_status: comment.status, first_comment_post_id: postId, retry_count: 0 });
      await deps.persistWorkflowRun({ ...event, state: "published_comment_queued", status: "published_comment_queued", first_comment_status: comment.status, first_comment_post_id: postId });
      return { ...normalized, status: "published_comment_queued", first_comment: comment, provider_calls: 1, retry_count: 0, idempotency_key: idempotencyKey };
    } catch (error) {
      const errorClass = error?.code ?? "COMMENT_RECONCILIATION_REQUIRED";
      await deps.persistPublishingLog({ ...event, ...normalized, status: "published_comment_reconciliation_required", first_comment_requested: true, first_comment_status: "reconciliation_required", error_class: errorClass, retry_count: 0 });
      await deps.persistWorkflowRun({ ...event, state: "published_comment_reconciliation_required", status: "published_comment_reconciliation_required", error_class: errorClass });
      return { ...normalized, status: "published_comment_reconciliation_required", first_comment: { status: "reconciliation_required", error_class: errorClass }, provider_calls: 1, retry_count: 0, idempotency_key: idempotencyKey };
    }
  }
  await deps.persistPublishingLog({ ...event, ...normalized, status, retry_count: 0 });
  await deps.persistWorkflowRun({ ...event, state: status, status });
  return { ...normalized, status, provider_calls: 1, retry_count: 0, idempotency_key: idempotencyKey };
}

export function createPublisherAdapter({ name, validateConfig, submit, normalizeResult, normalizeError }) {
  return { name, validateConfig, submit, normalizeResult, normalizeError };
}
