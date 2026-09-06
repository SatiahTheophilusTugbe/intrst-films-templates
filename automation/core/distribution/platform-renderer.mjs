export class PlatformRenderError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = "PlatformRenderError"; this.code = code; this.details = details; }
}

const SUPPORTED = new Set(["facebook", "instagram", "threads", "youtube", "x", "tiktok", "linkedin"]);
const ACCOUNT_KEYS = {
  facebook: "__FACEBOOK_BLOTATO_ACCOUNT_ID__",
  instagram: "__INSTAGRAM_BLOTATO_ACCOUNT_ID__",
  threads: "__THREADS_BLOTATO_ACCOUNT_ID__",
  youtube: "__YOUTUBE_BLOTATO_ACCOUNT_ID__",
  x: "__X_BLOTATO_ACCOUNT_ID__",
  tiktok: "__TIKTOK_BLOTATO_ACCOUNT_ID__",
  linkedin: "__LINKEDIN_BLOTATO_ACCOUNT_ID__",
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
  tiktok: { adapter_mode: "native", account_id: ACCOUNT_KEYS.tiktok, first_comment: false },
  linkedin: { adapter_mode: "native", account_id: ACCOUNT_KEYS.linkedin, first_comment: false },
});

export function renderPlatformPayload({ platform, caption, engagement_intent, hashtags: inputHashtags = [], media_urls = [], title = null, account_id = null }) {
  if (!SUPPORTED.has(platform)) fail("PLATFORM_UNSUPPORTED", `No renderer is defined for ${platform}.`);
  if (!caption || typeof caption !== "string") fail("MISSING_COPY", "Caption body is required.");
  if (!engagement_intent || typeof engagement_intent !== "string") fail("MISSING_ENGAGEMENT_INTENT", "engagement_intent is required.");
  const route = DISTRIBUTION_ROUTING[platform];
  const resolvedAccount = account_id ?? route.account_id;
  const tags = hashtags(inputHashtags);
  const tagLine = tags.length ? `#${tags.join(" #")}` : "";
  const closing = `${engagement_intent}${tagLine ? `\n\n${tagLine}` : ""}`;
  const payload = { platform, account_id: resolvedAccount, caption, media_urls: [...media_urls], title, hashtags: tags, engagement_intent, adapter_mode: route.adapter_mode };
  if (route.first_comment) {
    payload.first_comment = closing;
    payload.caption = caption;
  } else if (platform === "x") {
    payload.caption = `${caption}${tagLine ? `\n\n${tagLine}` : ""}`;
    payload.engagement_rendered = false;
  } else {
    payload.caption = `${caption}\n\n${closing}`;
  }
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
    terminal_state: result.terminal_state ?? (result.status === "published" ? "published" : "reconciliation_required"),
    attempt_count: 1,
    retry_count: 0,
    error_class: result.error_class ?? null,
  };
}
