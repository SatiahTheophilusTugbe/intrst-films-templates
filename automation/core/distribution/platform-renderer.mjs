export class PlatformRenderError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = "PlatformRenderError"; this.code = code; this.details = details; }
}

const SUPPORTED = new Set(["facebook", "instagram", "threads", "youtube", "x", "tiktok"]);
const ACCOUNT_KEYS = {
  facebook: "__FACEBOOK_BLOTATO_ACCOUNT_ID__",
  instagram: "__INSTAGRAM_BLOTATO_ACCOUNT_ID__",
  threads: "__THREADS_BLOTATO_ACCOUNT_ID__",
  youtube: "__YOUTUBE_BLOTATO_ACCOUNT_ID__",
  x: "__X_BLOTATO_ACCOUNT_ID__",
  tiktok: "__TIKTOK_BLOTATO_ACCOUNT_ID__",
};

function fail(code, message, details) { throw new PlatformRenderError(code, message, details); }
function hashtags(values) {
  if (!Array.isArray(values)) return [];
  const normalized = values.map((value) => String(value).trim().replace(/^#/, "")).filter(Boolean);
  if (new Set(normalized.map((value) => value.toLowerCase())).size !== normalized.length) fail("COPY_VALIDATION", "Hashtags must be unique.");
  if (normalized.length > 3) fail("COPY_VALIDATION", "A platform payload may contain at most three hashtags.");
  return normalized;
}

export const DISTRIBUTION_ROUTING = Object.freeze({
  facebook: { adapter_mode: "http", account_id: ACCOUNT_KEYS.facebook, first_comment: true },
  instagram: { adapter_mode: "http", account_id: ACCOUNT_KEYS.instagram, first_comment: true },
  threads: { adapter_mode: "native", account_id: ACCOUNT_KEYS.threads, first_comment: false },
  youtube: { adapter_mode: "native", account_id: ACCOUNT_KEYS.youtube, first_comment: false },
  x: { adapter_mode: "native", account_id: ACCOUNT_KEYS.x, first_comment: false },
  tiktok: { adapter_mode: "http", account_id: ACCOUNT_KEYS.tiktok, first_comment: false },
});

function intentText(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value.intent === "string") return value.intent.trim();
  return "";
}

function removeTrailingIntent(caption, intent) {
  const normalizedCaption = caption.trim();
  if (!intent) return normalizedCaption;
  if (normalizedCaption.endsWith(intent)) return normalizedCaption.slice(0, -intent.length).trim();
  return normalizedCaption;
}

export function renderPlatformPayload({ platform, caption_body, caption, engagement_intent, hashtags: inputHashtags = [], media_urls = [], title = null, account_id = null }) {
  if (!SUPPORTED.has(platform)) fail("PLATFORM_UNSUPPORTED", `No renderer is defined for ${platform}.`);
  const sourceCaption = caption_body ?? caption;
  if (!sourceCaption || typeof sourceCaption !== "string") fail("MISSING_COPY", "Caption body is required.");
  const intent = intentText(engagement_intent);
  if (!intent) fail("MISSING_ENGAGEMENT_INTENT", "engagement_intent is required.");
  const route = DISTRIBUTION_ROUTING[platform];
  const resolvedAccount = account_id ?? route.account_id;
  const tags = hashtags(inputHashtags);
  const tagLine = tags.length ? `#${tags.join(" #")}` : "";
  const body = removeTrailingIntent(sourceCaption, intent);
  const closing = `${intent}${tagLine ? `\n\n${tagLine}` : ""}`;
  const payload = { platform, account_id: resolvedAccount, caption: body, media_urls: [...media_urls], title, hashtags: tags, engagement_intent: intent, adapter_mode: route.adapter_mode };
  if (route.first_comment) {
    payload.first_comment = closing;
  } else if (platform === "x") {
    payload.caption = `${body}${tagLine ? `\n\n${tagLine}` : ""}`.slice(0, 280);
    payload.engagement_rendered = false;
  } else if (platform === "tiktok") {
    payload.caption = [body, tagLine].filter(Boolean).join("\n\n");
    payload.engagement_rendered = false;
  } else {
    payload.caption = `${body}\n\n${closing}`;
  }
  payload.character_count = payload.caption.length;
  payload.render_version = "distribution-renderer@1.1.0";
  payload.engagement_rendered = route.first_comment || (platform !== "x" && platform !== "tiktok");
  return payload;
}

export function normalizePublisherResult(input, context) {
  const result = input && typeof input === "object" ? input : {};
  return {
    content_output_id: context.content_output_id,
    platform: context.platform,
    account_id: context.account_id,
    provider: "blotato",
    adapter_mode: context.adapter_mode,
    provider_job_id: result.provider_job_id ?? result.submissionId ?? result.id ?? null,
    platform_post_id: result.platform_post_id ?? result.postId ?? null,
    public_url: result.public_url ?? result.postUrl ?? null,
    submitted_at: result.submitted_at ?? null,
    published_at: result.published_at ?? null,
    provider_status: result.provider_status ?? result.status ?? "unknown",
    outcome: result.outcome ?? (result.status === "published" ? "SUCCESS" : result.status === "submitted" ? "SUBMITTED" : "OUTCOME_UNKNOWN"),
    attempt_count: 1,
    retry_count: 0,
    error_class: result.error_class ?? null,
  };
}
