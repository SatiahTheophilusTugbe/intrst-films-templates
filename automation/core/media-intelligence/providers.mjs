import { createHash } from "node:crypto";
import { normalizeError } from "../contracts/aut-009.mjs";
import { createId } from "../ids/ids.mjs";
import { buildCacheKey, canonicalYouTubeVideoId, MEDIA_ADAPTER_VERSION, MEDIA_OUTPUT_SCHEMA_VERSION, MediaIntelligenceError, normalizeRequestedLanguage } from "./media-intelligence.mjs";

const DEFINITIONS = Object.freeze({
  transcriptapi: {
    role: "primary",
    credential_ref: "INT | TranscriptAPI | Development | Media Intelligence",
    tasks: ["youtube_search", "channel_discovery", "video_discovery", "playlist_discovery", "transcript_retrieval"]
  },
  scrapecreators: {
    role: "specialist_free_tier",
    credential_ref: "INT | ScrapeCreators | Development | Media Intelligence",
    tasks: ["audience_comments", "comment_replies", "shorts_intelligence", "community_intelligence", "competitor_enrichment"]
  }
});

class ProviderStub {
  constructor(provider) {
    this.provider = provider;
    this.definition = DEFINITIONS[provider];
  }

  async healthcheck() {
    return { provider: this.provider, ready: false, status: "credential_validation_pending", network_call_performed: false };
  }

  validate_config(config = {}) {
    if (config.environment !== "development" || config.credential_ref !== this.definition.credential_ref) throw new MediaIntelligenceError("CONFIG_INVALID", `${this.provider} requires its approved development logical credential reference.`);
    if (Object.keys(config).some((key) => /(?:api[_-]?key|secret|token|password|authorization|credential[_-]?id)/i.test(key))) throw new MediaIntelligenceError("SECRET_BOUNDARY", "Provider config cannot contain secret material or credential IDs.");
    return true;
  }

  async submit() {
    throw new MediaIntelligenceError("PROVIDER_NOT_CONNECTED", `${this.provider} runtime calls are not deployed.`);
  }

  async get_status() {
    throw new MediaIntelligenceError("PROVIDER_NOT_CONNECTED", `${this.provider} runtime calls are not deployed.`);
  }

  normalize_result() {
    throw new MediaIntelligenceError("NORMALIZER_NOT_IMPLEMENTED", `${this.provider} response normalization requires a captured Dolly fixture.`);
  }

  normalize_error(error) {
    const error_class = normalizeError(error);
    return {
      error_class,
      message: String(error?.message ?? error_class).replace(/(?:api[_-]?key|secret|token|password|authorization|credential[_-]?id)\s*[:=]\s*\S+/ig, "[REDACTED]"),
      retryable: false,
      outcome: error?.transmission_started === false ? "NOT_TRANSMITTED" : "OUTCOME_UNKNOWN"
    };
  }
}

export class TranscriptAPIProvider extends ProviderStub {
  constructor({ transport = null, cache = null, usage = null, idFactory = createId, sleep = async () => {} } = {}) {
    super("transcriptapi");
    this.transport = transport;
    this.cache = cache;
    this.usage = usage;
    this.idFactory = idFactory;
    this.sleep = sleep;
  }

  async healthcheck() {
    return { provider: this.provider, ready: Boolean(this.transport), status: this.transport ? "development_transport_ready" : "transport_not_configured", network_call_performed: false };
  }

  normalize_result(raw, { video_id, language, endpoint = "transcript" } = {}) {
    if (!raw || typeof raw !== "object" || !video_id) throw new MediaIntelligenceError("MALFORMED_PROVIDER_RESPONSE", "TranscriptAPI response must contain an object and canonical video ID.");
    if (endpoint !== "transcript") throw new MediaIntelligenceError("PROVIDER_CAPABILITY_BLOCK", "Only transcript retrieval is enabled for the paid development adapter.");
    const transcript = validateTranscriptResponse(raw, { video_id, language });
    return {
      endpoint: "transcript",
      video_id,
      response_version: raw.response_version,
      language: normalizeRequestedLanguage(raw.language),
      segments: transcript.map((segment, index) => ({
        segment_id: String(segment.segment_id),
        start_seconds: segment.start_seconds,
        end_seconds: segment.end_seconds,
        content_hash: segment.content_hash,
        token_count: segment.token_count
      })),
      normalized_object_count: transcript.length
    };
  }

  async retrieveTranscript({ request, videoId, language = "auto", sample = null, cacheEntryId, now = new Date().toISOString(), timeoutMs = 5000, maxRetries, endpoint = "transcript", retry_authorized = false, prior_attempt_reconciled = false }) {
    if (!request || request.task !== "transcript_retrieval") throw new MediaIntelligenceError("REQUEST_INVALID", "TranscriptAPI retrieval requires a transcript_retrieval request.");
    if (endpoint !== "transcript") throw new MediaIntelligenceError("PROVIDER_CAPABILITY_BLOCK", "Only transcript retrieval is enabled for the paid development adapter.");
    if (maxRetries !== undefined) throw new MediaIntelligenceError("RETRY_POLICY_INVALID", "Paid TranscriptAPI retrieval permits exactly one transport attempt and rejects maxRetries.");
    this.validate_config({ environment: request.environment, credential_ref: this.definition.credential_ref });
    if (!this.cache || typeof this.cache.get !== "function" || typeof this.cache.put !== "function") throw new MediaIntelligenceError("CACHE_REQUIRED", "TranscriptAPI retrieval requires a cache implementation.");
    if (!this.usage || typeof this.usage.record !== "function" || typeof this.usage.findByIdempotencyKey !== "function" || typeof this.usage.findByOperationKey !== "function") throw new MediaIntelligenceError("USAGE_LEDGER_REQUIRED", "Paid TranscriptAPI retrieval requires exact-attempt and operation-reconciliation ledger lookups.");
    const canonicalVideoId = canonicalYouTubeVideoId(videoId);
    const normalizedLanguage = normalizeRequestedLanguage(language);
    const key = buildCacheKey({ provider: "transcriptapi", task: request.task, platform: "youtube", resourceType: "transcript", externalId: canonicalVideoId, language: normalizedLanguage, sample, adapterVersion: MEDIA_ADAPTER_VERSION, outputSchemaVersion: MEDIA_OUTPUT_SCHEMA_VERSION });
    if (request.cache_key !== key) throw new MediaIntelligenceError("CACHE_KEY_MISMATCH", "Request cache_key does not match the adapter-derived key.");
    const cached = await this.cache.get(key);
    if (cached) {
      await this.recordUsage({ request, endpoint, now, cache_status: "hit", success: true, data_returned: "transcript", idempotencyKey: `cache-hit:${key}`, cache_hit_count: 1, provider_call_count: 0 });
      return { cache_status: "hit", provider: "cache", video_id: canonicalVideoId, result: cached };
    }
    if (request.provider_call_budget < 1) throw new MediaIntelligenceError("BUDGET_BLOCK", "Provider call budget is exhausted after cache miss.");
    if (!this.transport || typeof this.transport.request !== "function") throw new MediaIntelligenceError("PROVIDER_NOT_CONNECTED", "TranscriptAPI development transport is not configured.");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new MediaIntelligenceError("TIMEOUT_INVALID", "Timeout must be between 1 and 30000 milliseconds.");
    const operationKey = `transcript-operation:v1:${createHash("sha256").update(key).digest("hex")}`;
    const prior = await this.usage.findByOperationKey(operationKey);
    const idempotencyKey = prior && retry_authorized && prior_attempt_reconciled
      ? `transcript-attempt:v1:${createHash("sha256").update(JSON.stringify({ run_id: request.run_id, operation_key: operationKey })).digest("hex")}`
      : operationKey;
    const exactPrior = await this.usage.findByIdempotencyKey(idempotencyKey);
    if ((prior || exactPrior) && (!retry_authorized || !prior_attempt_reconciled || (prior && prior.run_id === request.run_id) || (exactPrior && exactPrior.run_id === request.run_id))) throw new MediaIntelligenceError("ATTEMPT_RECONCILIATION_REQUIRED", "A prior paid attempt requires a fresh authorized run, prior-attempt reconciliation and explicit retry approval.");
    const controller = new AbortController();
    let raw;
    try { raw = await withTimeout(this.transport.request({ video_id: canonicalVideoId, language: normalizedLanguage, endpoint, credential_ref: this.definition.credential_ref, idempotency_key: idempotencyKey, signal: controller.signal }), timeoutMs, controller); }
    catch (error) {
      const normalized = this.normalize_error(error);
      await this.recordUsage({ request, endpoint, now, cache_status: "miss", success: false, data_returned: "none", idempotencyKey, provider_call_count: 1, credits_used: normalized.outcome === "OUTCOME_UNKNOWN" ? null : 0, escalation_reason: normalized.outcome === "OUTCOME_UNKNOWN" ? "OUTCOME_UNKNOWN" : normalized.error_class, terminal_or_resume_state: normalized.outcome === "OUTCOME_UNKNOWN" ? "manual_reconciliation_required" : "failed_terminal" });
      throw new MediaIntelligenceError(normalized.outcome === "OUTCOME_UNKNOWN" ? "OUTCOME_UNKNOWN" : normalized.error_class, normalized.message, { attempts: 1 });
    }
    let result;
    try { validateTranscriptResponse(raw, { video_id: canonicalVideoId, language: normalizedLanguage }); result = this.normalize_result(raw, { video_id: canonicalVideoId, language: normalizedLanguage, endpoint }); }
    catch (error) {
      await this.recordUsage({ request, endpoint, now, cache_status: "miss", success: false, data_returned: "none", idempotencyKey, provider_call_count: 1, escalation_reason: "MALFORMED_PROVIDER_RESPONSE", credits_used: null, terminal_or_resume_state: "failed_terminal" });
      throw error;
    }
    await this.recordUsage({ request, endpoint, now, cache_status: "miss", success: true, data_returned: "transcript", idempotencyKey, provider_call_count: 1, credits_used: null, terminal_or_resume_state: "complete" });
    try { await this.cache.put(key, result, { cache_entry_id: cacheEntryId, refresh_policy: "immutable", cache_status: "miss" }); }
    catch (error) { throw new MediaIntelligenceError("CACHE_PERSISTENCE_FAILURE", "Transcript attempt was metered but cache persistence failed; provider recall is prohibited.", { cause: String(error?.message ?? "cache failure") }); }
    return { cache_status: "miss", provider: "transcriptapi", video_id: canonicalVideoId, result };
  }

  async recordUsage({ request, endpoint, now, cache_status, success, data_returned, idempotencyKey, provider_call_count = 0, cache_hit_count = 0, credits_used = 0, escalation_reason = null, terminal_or_resume_state = success ? "complete" : "failed_terminal" }) {
    try { await this.usage.record({ schema_version: "1.0.0", usage_id: this.idFactory("provider_usage"), run_id: request.run_id, subject_id: request.subject_id, provider: cache_status === "hit" ? "cache" : "transcriptapi", endpoint, purpose: request.purpose, occurred_at: now, credits_used, credits_remaining: null, estimated_cost: 0, cache_status, success, data_returned, downstream_usage: [], escalation_reason, transcriptapi_sufficient: true, execution_budget: request.provider_call_budget, workflow_execution_count: 1, provider_call_count, cache_hit_count, polling_prohibited: true, terminal_or_resume_state, next_action_at: null, idempotency_key: idempotencyKey, created_at: now }); }
    catch (error) { throw new MediaIntelligenceError("USAGE_PERSISTENCE_FAILURE", "Paid provider outcome could not be durably recorded; provider recall is prohibited.", { cause: String(error?.message ?? "ledger failure") }); }
  }
}

export class ScrapeCreatorsProvider extends ProviderStub {
  constructor() { super("scrapecreators"); }
}

export function deduplicateYouTubeVideos(values) {
  const unique = new Map();
  for (const value of values) {
    try { const video_id = canonicalYouTubeVideoId(value.video_id ?? value.id ?? value.url); unique.set(video_id, { ...value, video_id }); } catch { /* malformed search rows are excluded */ }
  }
  return [...unique.values()];
}

function validateTranscriptResponse(raw, { video_id, language }) {
  if (raw?.response_version !== MEDIA_OUTPUT_SCHEMA_VERSION || raw?.video_id !== video_id || typeof raw?.language !== "string" || (normalizeRequestedLanguage(language) !== "auto" && normalizeRequestedLanguage(raw.language) !== normalizeRequestedLanguage(language)) || !Array.isArray(raw?.transcript) || raw.transcript.length === 0) throw new MediaIntelligenceError("MALFORMED_PROVIDER_RESPONSE", "TranscriptAPI response is missing required version, identity, language or transcript fields.");
  const ids = new Set(); let previousEnd = 0;
  for (const segment of raw.transcript) {
    if (!segment || typeof segment.segment_id !== "string" || !segment.segment_id || ids.has(segment.segment_id)) throw new MediaIntelligenceError("MALFORMED_PROVIDER_RESPONSE", "Transcript segment IDs must be unique and deterministic.");
    if (!Number.isFinite(segment.start_seconds) || !Number.isFinite(segment.end_seconds) || segment.start_seconds < 0 || segment.end_seconds <= segment.start_seconds || segment.start_seconds < previousEnd) throw new MediaIntelligenceError("MALFORMED_PROVIDER_RESPONSE", "Transcript timestamps are invalid or out of order.");
    if (segment.segment_id !== `segment-${ids.size + 1}` || typeof segment.content_hash !== "string" || !/^[a-f0-9]{64}$/.test(segment.content_hash) || !Number.isInteger(segment.token_count) || segment.token_count <= 0 || Object.prototype.hasOwnProperty.call(segment, "text")) throw new MediaIntelligenceError("MALFORMED_PROVIDER_RESPONSE", "Transcript segments require deterministic IDs, a valid content hash and positive token count without copied text.");
    ids.add(segment.segment_id); previousEnd = segment.end_seconds;
  }
  return raw.transcript;
}

async function withTimeout(promise, timeoutMs, controller) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new MediaIntelligenceError("TIMEOUT_INVALID", "Timeout must be between 1 and 30000 milliseconds.");
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller?.abort(); reject(Object.assign(new Error("Provider request timed out"), { code: "TIMEOUT" })); }, timeoutMs); });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(timer); }
}

export { DEFINITIONS as MEDIA_PROVIDER_DEFINITIONS };
