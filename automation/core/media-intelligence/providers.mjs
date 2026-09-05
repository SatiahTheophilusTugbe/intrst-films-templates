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
const AUTHORIZED_PROJECT_ID = "o8RQQQgne2c6jXr5";
const DEPLOYED_PROVIDER_USAGE_TABLE_ID = "WFeE982gMt0XfiIm";
const SECRET_OR_PAYLOAD_KEY = /(?:api[_-]?key|secret|token|password|authorization|credential[_-]?id|request[_-]?headers|response[_-]?body|raw[_-]?payload|transcript[_-]?text)/i;
const CLAIM_STATUSES = new Set(["CLAIMED", "ALREADY_CLAIMED", "PRIOR_SUCCESS", "PRIOR_OUTCOME_UNKNOWN", "CLAIM_BACKEND_UNAVAILABLE", "CLAIM_CORRUPT"]);
const APPLICATION_USAGE_FIELDS = new Set(["schema_version", "usage_id", "run_id", "subject_id", "provider", "endpoint", "purpose", "occurred_at", "credits_used", "credits_remaining", "estimated_cost", "cache_status", "success", "data_returned", "downstream_usage", "escalation_reason", "transcriptapi_sufficient", "execution_budget", "workflow_execution_count", "provider_call_count", "cache_hit_count", "polling_prohibited", "terminal_or_resume_state", "next_action_at", "idempotency_key", "created_at"]);
const PHYSICAL_USAGE_FIELDS = new Set(["usage_id", "run_id", "subject_id", "provider", "endpoint", "purpose", "occurred_at", "credits_used", "credits_remaining", "estimated_cost", "cache_status", "success", "data_returned", "downstream_usage_json", "escalation_reason", "transcriptapi_sufficient", "execution_budget", "workflow_execution_count", "provider_call_count", "cache_hit_count", "polling_prohibited", "terminal_or_resume_state", "next_action_at", "idempotency_key", "created_at"]);
const REQUIRED_APPLICATION_USAGE_FIELDS = new Set(["schema_version", "usage_id", "run_id", "subject_id", "provider", "endpoint", "purpose", "occurred_at", "credits_used", "estimated_cost", "cache_status", "success", "data_returned", "downstream_usage", "idempotency_key"]);
const REQUIRED_PHYSICAL_USAGE_FIELDS = new Set(["usage_id", "run_id", "subject_id", "provider", "endpoint", "purpose", "occurred_at", "estimated_cost", "cache_status", "success", "data_returned", "downstream_usage_json", "execution_budget", "workflow_execution_count", "provider_call_count", "cache_hit_count", "polling_prohibited", "terminal_or_resume_state", "idempotency_key", "created_at"]);

function assertSafeUsageRow(value, path = "usage") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertSafeUsageRow(item, `${path}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_OR_PAYLOAD_KEY.test(key)) throw new MediaIntelligenceError("SECRET_BOUNDARY", `Secret or raw payload field prohibited at ${path}.${key}.`);
    assertSafeUsageRow(child, `${path}.${key}`);
  }
}

export class ProviderUsageLedger {
  constructor({ projectId, tableId, findByIdempotencyKey, insertRow, claimOperation, claimAtomicGuarantee = false, exactLookupGuarantee = false }) {
    if (projectId !== AUTHORIZED_PROJECT_ID || tableId !== DEPLOYED_PROVIDER_USAGE_TABLE_ID) throw new MediaIntelligenceError("LEDGER_SCOPE_INVALID", "Provider usage ledger binding must target the authorized deployed INTRST Films table.");
    if (typeof findByIdempotencyKey !== "function" || typeof insertRow !== "function" || typeof claimOperation !== "function" || claimAtomicGuarantee !== true || exactLookupGuarantee !== true) throw new MediaIntelligenceError("LEDGER_UNAVAILABLE", "Provider usage ledger requires exact lookup, immutable insert and a proven atomic claim capability.");
    this.findByIdempotencyKey = findByIdempotencyKey;
    this.insertRow = insertRow;
    this.claimOperationBinding = claimOperation;
  }

  async findByOperationKey(operationKey) {
    if (!operationKey) throw new MediaIntelligenceError("LEDGER_LOOKUP_INVALID", "Operation key is required for exact provider usage lookup.");
    let result;
    try { result = await this.findByIdempotencyKey(operationKey); } catch (error) { throw new MediaIntelligenceError("LEDGER_LOOKUP_FAILURE", "Exact provider usage lookup failed closed.", { cause: String(error?.message ?? "lookup unavailable") }); }
    if (result === null || result === undefined) return null;
    if (Array.isArray(result)) {
      if (result.length === 0) return null;
      if (result.length > 1) throw new MediaIntelligenceError("CLAIM_CORRUPT", "Multiple provider usage records matched one operation key.");
      result = result[0];
    }
    if (!result || typeof result !== "object" || result.idempotency_key !== operationKey) throw new MediaIntelligenceError("CLAIM_CORRUPT", "Exact provider usage lookup returned a malformed or mismatched record.");
    return result;
  }

  async claimOperation(input) {
    if (!input?.operation_key || !input?.run_id || !input?.subject_id || input.provider !== "transcriptapi" || input.task !== "transcript_retrieval" || !input.requested_at) throw new MediaIntelligenceError("CLAIM_CORRUPT", "Atomic operation claim input is incomplete or outside the paid transcript contract.");
    let result;
    try { result = await this.claimOperationBinding(Object.freeze({ ...input })); }
    catch (error) { return { status: "CLAIM_BACKEND_UNAVAILABLE", atomic: false, cause: String(error?.message ?? "claim backend unavailable") }; }
    if (!result || !CLAIM_STATUSES.has(result.status) || result.atomic !== true) throw new MediaIntelligenceError("CLAIM_CORRUPT", "Atomic claim backend returned an unverifiable result.");
    return result;
  }

  async record(event) {
    if (!event?.idempotency_key || !["cache", "transcriptapi"].includes(event.provider) || (event.provider === "transcriptapi" && event.provider_call_count !== 1) || (event.provider === "cache" && event.provider_call_count !== 0) || event.polling_prohibited !== true) throw new MediaIntelligenceError("LEDGER_EVENT_INVALID", "Only non-polling cache events or one-attempt TranscriptAPI events may be persisted.");
    const row = projectProviderUsageRow(event);
    const existing = await this.findByOperationKey(event.idempotency_key);
    if (existing) throw new MediaIntelligenceError("DUPLICATE_OPERATION", "Immutable provider usage already exists for this operation identity.");
    try { return await this.insertRow(Object.freeze(row)); }
    catch (error) { throw new MediaIntelligenceError("LEDGER_PERSISTENCE_FAILURE", "Provider usage persistence failed closed.", { cause: String(error?.message ?? "ledger unavailable") }); }
  }

  async checkBeforeAttempt({ operationKey, idempotencyKey }) {
    const prior = await this.findByOperationKey(operationKey);
    const exact = await this.findByIdempotencyKey(idempotencyKey);
    if (prior || exact) return { allowed: false, route: "manual_reconciliation", reason: prior?.success === true ? "PRIOR_SUCCESS" : "PRIOR_UNKNOWN_OR_EXISTING_ATTEMPT" };
    return { allowed: true, route: "provider" };
  }
}

export function projectProviderUsageRow(event) {
  if (!event || typeof event !== "object" || Object.keys(event).some((key) => !APPLICATION_USAGE_FIELDS.has(key)) || [...REQUIRED_APPLICATION_USAGE_FIELDS].some((key) => !Object.prototype.hasOwnProperty.call(event, key))) throw new MediaIntelligenceError("USAGE_EVENT_INVALID", "Provider usage event contains an unknown or missing application field.");
  if (event.schema_version !== "1.0.0" || !event.usage_id || !event.run_id || !event.subject_id || !event.provider || !event.endpoint || !event.purpose || !event.occurred_at || !event.idempotency_key || !event.created_at || !Array.isArray(event.downstream_usage) || new Set(event.downstream_usage).size !== event.downstream_usage.length || event.downstream_usage.some((value) => typeof value !== "string") || typeof event.success !== "boolean" || typeof event.polling_prohibited !== "boolean" || event.polling_prohibited !== true) throw new MediaIntelligenceError("USAGE_EVENT_INVALID", "Provider usage event failed application contract validation.");
  if (event.credits_used !== null && event.credits_used !== undefined && (!Number.isFinite(event.credits_used) || event.credits_used < 0) || event.credits_remaining !== null && event.credits_remaining !== undefined && (!Number.isFinite(event.credits_remaining) || event.credits_remaining < 0) || !Number.isFinite(event.estimated_cost) || event.estimated_cost < 0 || !Number.isFinite(event.execution_budget) || !Number.isFinite(event.workflow_execution_count) || !Number.isFinite(event.provider_call_count) || !Number.isFinite(event.cache_hit_count)) throw new MediaIntelligenceError("USAGE_EVENT_INVALID", "Provider usage numeric fields are invalid.");
  assertSafeUsageRow(event);
  const row = {
    usage_id: event.usage_id, run_id: event.run_id, subject_id: event.subject_id, provider: event.provider, endpoint: event.endpoint, purpose: event.purpose, occurred_at: event.occurred_at,
    estimated_cost: event.estimated_cost, cache_status: event.cache_status, success: event.success, data_returned: event.data_returned,
    downstream_usage_json: JSON.stringify([...event.downstream_usage].sort()), execution_budget: event.execution_budget, workflow_execution_count: event.workflow_execution_count,
    provider_call_count: event.provider_call_count, cache_hit_count: event.cache_hit_count, polling_prohibited: true, terminal_or_resume_state: event.terminal_or_resume_state,
    idempotency_key: event.idempotency_key, created_at: event.created_at
  };
  for (const key of ["credits_used", "credits_remaining", "escalation_reason", "transcriptapi_sufficient", "next_action_at"]) if (event[key] !== null && event[key] !== undefined) row[key] = event[key];
  if (Object.keys(row).some((key) => !PHYSICAL_USAGE_FIELDS.has(key)) || [...REQUIRED_PHYSICAL_USAGE_FIELDS].some((key) => !Object.prototype.hasOwnProperty.call(row, key)) || typeof row.downstream_usage_json !== "string") throw new MediaIntelligenceError("USAGE_ROW_INVALID", "Projected provider usage row does not satisfy the deployed physical-column contract.");
  return row;
}

export class MockTranscriptTransport {
  constructor(handler) {
    if (typeof handler !== "function") throw new MediaIntelligenceError("MOCK_TRANSPORT_INVALID", "Mock transcript transport requires a handler.");
    this.handler = handler;
  }

  async request(input) { return this.handler(Object.freeze({ ...input })); }
}

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
  constructor({ transport = null, cache = null, usage = null, idFactory = createId, sleep = async () => {}, transportMode = "mock", deploymentState = "prepared_not_deployed" } = {}) {
    super("transcriptapi");
    if (transportMode === "mock" && transport !== null && !(transport instanceof MockTranscriptTransport)) throw new MediaIntelligenceError("MOCK_TRANSPORT_REQUIRED", "Mock preparation accepts only MockTranscriptTransport.");
    if (transportMode === "live" && (deploymentState !== "deployed" || !usage?.claimOperation)) throw new MediaIntelligenceError("LIVE_TRANSPORT_BLOCKED", "Live transport requires explicit deployment state and atomic claim binding.");
    if (!["mock", "live"].includes(transportMode)) throw new MediaIntelligenceError("TRANSPORT_MODE_INVALID", "Unsupported transcript transport mode.");
    this.transport = transport;
    this.cache = cache;
    this.usage = usage;
    this.idFactory = idFactory;
    this.sleep = sleep;
    this.transportMode = transportMode;
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
    if (this.transportMode === "live") this.validate_config({ environment: request.environment, credential_ref: this.definition.credential_ref });
    if (!this.cache || typeof this.cache.get !== "function" || typeof this.cache.put !== "function") throw new MediaIntelligenceError("CACHE_REQUIRED", "TranscriptAPI retrieval requires a cache implementation.");
    if (!this.usage || typeof this.usage.record !== "function" || typeof this.usage.findByIdempotencyKey !== "function" || typeof this.usage.findByOperationKey !== "function" || typeof this.usage.claimOperation !== "function") throw new MediaIntelligenceError("USAGE_LEDGER_REQUIRED", "Paid TranscriptAPI retrieval requires exact lookup, immutable outcome and atomic operation claim capabilities.");
    const canonicalVideoId = canonicalYouTubeVideoId(videoId);
    const normalizedLanguage = normalizeRequestedLanguage(language);
    const key = buildCacheKey({ provider: "transcriptapi", task: request.task, platform: "youtube", resourceType: "transcript", externalId: canonicalVideoId, language: normalizedLanguage, sample, adapterVersion: MEDIA_ADAPTER_VERSION, outputSchemaVersion: MEDIA_OUTPUT_SCHEMA_VERSION });
    if (request.cache_key !== key) throw new MediaIntelligenceError("CACHE_KEY_MISMATCH", "Request cache_key does not match the adapter-derived key.");
    const cached = await this.cache.get(key);
    if (cached) {
      await this.recordUsage({ request, endpoint, now, cache_status: "hit", success: true, data_returned: "transcript", idempotencyKey: `cache-hit:v1:${createHash("sha256").update(JSON.stringify({ run_id: request.run_id, cache_key: key })).digest("hex")}`, cache_hit_count: 1, provider_call_count: 0 });
      return { cache_status: "hit", provider: "cache", video_id: canonicalVideoId, result: cached };
    }
    if (request.provider_call_budget < 1) throw new MediaIntelligenceError("BUDGET_BLOCK", "Provider call budget is exhausted after cache miss.");
    if (!this.transport || typeof this.transport.request !== "function") throw new MediaIntelligenceError("PROVIDER_NOT_CONNECTED", "TranscriptAPI development transport is not configured.");
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new MediaIntelligenceError("TIMEOUT_INVALID", "Timeout must be between 1 and 30000 milliseconds.");
    const operationKey = `transcript-operation:v1:${createHash("sha256").update(key).digest("hex")}`;
    const idempotencyKey = `transcript-attempt:v1:${createHash("sha256").update(JSON.stringify({ run_id: request.run_id, operation_key: operationKey, retry_authorized, prior_attempt_reconciled })).digest("hex")}`;
    const claim = await this.usage.claimOperation({ operation_key: operationKey, run_id: request.run_id, subject_id: request.subject_id, provider: "transcriptapi", task: request.task, requested_at: now, prior_attempt_reconciled, retry_authorized, prior_attempt_id: request.prior_attempt_id ?? null, idempotency_key: idempotencyKey });
    if (claim.status !== "CLAIMED") throw new MediaIntelligenceError(claim.status === "PRIOR_SUCCESS" || claim.status === "PRIOR_OUTCOME_UNKNOWN" || claim.status === "ALREADY_CLAIMED" ? "ATTEMPT_RECONCILIATION_REQUIRED" : claim.status, "Paid operation did not acquire an atomic claim; provider transport is prohibited.");
    const controller = new AbortController();
    let raw;
    const transportInput = { video_id: canonicalVideoId, language: normalizedLanguage, endpoint, idempotency_key: idempotencyKey, signal: controller.signal };
    if (this.transportMode === "live") transportInput.credential_ref = this.definition.credential_ref;
    try { raw = await withTimeout(this.transport.request(transportInput), timeoutMs, controller); }
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
