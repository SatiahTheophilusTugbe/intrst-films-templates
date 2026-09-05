import { createHash } from "node:crypto";

const ID = /^INT-[A-Z]{3}-[0-9A-HJKMNP-TV-Z]{26}$/;
export const MEDIA_ADAPTER_VERSION = "1.1.0";
export const MEDIA_OUTPUT_SCHEMA_VERSION = "1.0.0";
const CACHE_NAMESPACE = "media:v2";
const PRIMARY_TASKS = new Set(["youtube_search", "channel_discovery", "video_discovery", "playlist_discovery", "transcript_retrieval"]);
const SPECIALIST_TASKS = new Set(["audience_comments", "comment_replies", "shorts_intelligence", "community_intelligence", "competitor_enrichment"]);

function typedId(value, code) {
  return ID.test(value ?? "") && value.startsWith(`INT-${code}-`);
}

export class MediaIntelligenceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "MediaIntelligenceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new MediaIntelligenceError(code, message, details);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

export function normalizeRequestedLanguage(language) {
  if (language === null || language === undefined || language === "") return "auto";
  if (language === "auto") return "auto";
  if (typeof language !== "string" || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language.trim())) fail("LANGUAGE_INVALID", "Requested language must be a normalized language tag.");
  return language.trim().toLowerCase();
}

export function canonicalYouTubeVideoId(value) {
  const input = String(value ?? "").trim();
  const match = input.match(/^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#].*)?$/i) ?? input.match(/^([A-Za-z0-9_-]{11})$/);
  if (!match) fail("VIDEO_ID_INVALID", "A canonical 11-character YouTube video ID or recognized URL is required.");
  return match[1];
}

export function buildCacheKey({ provider, task, platform = "youtube", resourceType, externalId, language = null, sample = null, adapterVersion = MEDIA_ADAPTER_VERSION, outputSchemaVersion = MEDIA_OUTPUT_SCHEMA_VERSION }) {
  if (!provider || !task || !resourceType || !externalId || !adapterVersion || !outputSchemaVersion) fail("CACHE_KEY_INVALID", "Provider, task, resourceType, external ID and version fields are required.");
  const canonicalExternalId = platform === "youtube" && ["video", "transcript"].includes(resourceType) ? canonicalYouTubeVideoId(externalId) : String(externalId);
  const normalized = stableValue({ provider, task, platform, resource_type: resourceType, canonical_external_id: canonicalExternalId, requested_language: normalizeRequestedLanguage(language), sample, adapter_version: adapterVersion, output_schema_version: outputSchemaVersion });
  return `${CACHE_NAMESPACE}:${createHash("sha256").update(JSON.stringify(normalized)).digest("hex")}`;
}

export function validateRequest(request) {
  if (!request || typeof request !== "object" || request.schema_version !== "1.0.0") fail("REQUEST_INVALID", "Media Intelligence request v1 is required.");
  if (!typedId(request.run_id, "RUN") || !typedId(request.subject_id, "SUB")) fail("REQUEST_INVALID", "Typed canonical run_id and subject_id are required.");
  if (![...PRIMARY_TASKS, ...SPECIALIST_TASKS].includes(request.task)) fail("TASK_UNSUPPORTED", `Unsupported task ${request.task}.`);
  if (request.environment !== "development") fail("ENVIRONMENT_BLOCK", "Phase 1 Media Intelligence is development-only.");
  if (!request.purpose || !request.cache_key) fail("REQUEST_INVALID", "Purpose and cache key are required.");
  if (request.polling_prohibited !== true || !Number.isInteger(request.provider_call_budget) || request.provider_call_budget < 0 || request.provider_call_budget > 3) fail("EXECUTION_POLICY_INVALID", "Polling must be prohibited and provider_call_budget must be 0-3.");
  return true;
}

export function routeRequest(request, { cacheHit = false, scrapeCreditsRemaining = null, protectedFloor = 20 } = {}) {
  validateRequest(request);
  if (cacheHit) return { route: "cache", provider: null, reason: "CACHE_HIT", consume_credits: false };
  if (request.provider_call_budget < 1) return { route: "blocked", provider: null, reason: "EXECUTION_BUDGET_EXHAUSTED", consume_credits: false };
  if (PRIMARY_TASKS.has(request.task)) return { route: "provider", provider: "transcriptapi", reason: "PRIMARY_TASK", consume_credits: false };
  if (!request.allow_specialist_escalation) return { route: "review", provider: null, reason: "SPECIALIST_NOT_AUTHORIZED", consume_credits: false };
  if (request.transcriptapi_sufficient !== false) return { route: "review", provider: null, reason: "PRIMARY_SUFFICIENCY_NOT_DISPROVED", consume_credits: false };
  if (!request.specialist_reason) return { route: "review", provider: null, reason: "SPECIALIST_REASON_REQUIRED", consume_credits: false };
  if (!Number.isFinite(scrapeCreditsRemaining)) return { route: "review", provider: null, reason: "CREDIT_BALANCE_UNKNOWN", consume_credits: false };
  const estimated = Number(request.estimated_specialist_credits ?? 0);
  if (scrapeCreditsRemaining - estimated < protectedFloor) return { route: "blocked", provider: null, reason: "SCRAPECREATORS_CREDIT_FLOOR", consume_credits: false };
  return { route: "provider", provider: "scrapecreators", reason: request.specialist_reason, consume_credits: true };
}

export function normalizeMediaSource(raw, context) {
  if (!typedId(context?.source_id, "SRC") || !typedId(context?.subject_id, "SUB") || !typedId(context?.cache_entry_id, "CAC")) fail("NORMALIZATION_CONTEXT_INVALID", "Typed canonical source, subject and cache identities are required.");
  return {
    schema_version: "1.0.0",
    source_id: context.source_id,
    subject_id: context.subject_id,
    platform: context.platform ?? "youtube",
    provider: context.provider,
    source_kind: context.source_kind,
    external_id: String(raw.id ?? raw.video_id ?? raw.channel_id ?? raw.playlist_id ?? ""),
    canonical_url: context.canonical_url,
    title: String(raw.title ?? context.title ?? "Untitled source"),
    speaker: context.speaker ?? null,
    language: raw.language ?? context.language ?? null,
    published_at: raw.published_at ?? null,
    source_classification: context.source_classification ?? "unknown",
    rights_state: context.rights_state ?? "discovery_only",
    retrieved_at: context.retrieved_at,
    raw_payload_drive_url: context.raw_payload_drive_url ?? null,
    content_hash: context.content_hash ?? null,
    cache: {
      cache_entry_id: context.cache_entry_id,
      key: context.cache_key,
      status: context.cache_status,
      refresh_policy: context.refresh_policy,
      expires_at: context.expires_at ?? null
    }
  };
}

export function validateIntelligenceObject(value) {
  if (!value || value.schema_version !== "1.0.0" || !typedId(value.intelligence_id, "ITL") || !typedId(value.subject_id, "SUB") || !typedId(value.run_id, "RUN")) fail("INTELLIGENCE_OBJECT_INVALID", "Typed canonical Media Intelligence object is invalid.");
  if (!["research_moment", "audience_signal", "intelligence_gap"].includes(value.object_type)) fail("INTELLIGENCE_OBJECT_INVALID", "Unsupported intelligence object type.");
  if (!Array.isArray(value.source_ids) || new Set(value.source_ids).size !== value.source_ids.length) fail("INTELLIGENCE_OBJECT_INVALID", "source_ids must be unique.");
  if (value.source_ids.some((id) => !typedId(id, "SRC"))) fail("INTELLIGENCE_OBJECT_INVALID", "Media Intelligence source_ids must use INT-SRC identities.");
  if ((value.object_type === "audience_signal" || value.object_type === "intelligence_gap") && value.eligible_for_claims !== false) fail("AUDIENCE_EVIDENCE_BLOCK", "Audience signals and intelligence gaps cannot become claims.");
  if (value.object_type === "research_moment" && value.eligible_for_claims === true && value.payload.corroboration_state !== "corroborated") fail("CLAIM_BLOCK", "Only corroborated research moments may become claim candidates.");
  return true;
}

export function createUsageEvent({ usage_id, run_id, subject_id, provider, endpoint, purpose, occurred_at, credits_used = null, credits_remaining = null, estimated_cost = 0, cache_status, success, data_returned, downstream_usage = [], escalation_reason = null, transcriptapi_sufficient = null, idempotency_key }) {
  if (!typedId(usage_id, "USG") || !typedId(run_id, "RUN") || !typedId(subject_id, "SUB")) fail("USAGE_EVENT_INVALID", "Usage event identities must use INT-USG, INT-RUN and INT-SUB IDs.");
  if (provider === "scrapecreators" && (credits_used === null || credits_remaining === null)) fail("USAGE_EVENT_INVALID", "ScrapeCreators events require credit usage and remaining balance.");
  return { schema_version: "1.0.0", usage_id, run_id, subject_id, provider, endpoint, purpose, occurred_at, credits_used, credits_remaining, estimated_cost, cache_status, success, data_returned, downstream_usage, escalation_reason, transcriptapi_sufficient, idempotency_key };
}
