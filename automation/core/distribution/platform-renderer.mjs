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

export const DISTRIBUTION_RENDERER_PARITY_MARKERS = Object.freeze([
  "distribution-renderer@1.3.1",
  "provider_media_url",
  "first_comment",
  "COPY_REVIEW_REQUIRED",
  "500",
]);

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

function normalizeParagraphBreaks(value) {
  return String(value).replaceAll(String.fromCharCode(92, 110), String.fromCharCode(10));
}

function removeTrailingIntent(caption, intent) {
  const normalizedCaption = caption.trim();
  if (!intent) return normalizedCaption;
  if (normalizedCaption.endsWith(intent)) return normalizedCaption.slice(0, -intent.length).trim();
  return normalizedCaption;
}

function truncateAtBoundary(value, limit) {
  if (value.length <= limit) return value;
  const prefix = value.slice(0, limit).trimEnd();
  const sentenceEnd = Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf("!"), prefix.lastIndexOf("?"));
  if (sentenceEnd >= Math.floor(limit * 0.55)) return prefix.slice(0, sentenceEnd + 1).trim();
  const wordEnd = prefix.lastIndexOf(" ");
  return (wordEnd > 0 ? prefix.slice(0, wordEnd) : prefix).trim();
}

function renderThreadsCaption(body, intent, tagValues) {
  const max = 500;
  const tagLines = [];
  for (const tag of tagValues) {
    const candidate = [...tagLines, tag];
    const line = `#${candidate.join(" #")}`;
    const withIntent = [body, intent, line].filter(Boolean).join("\n\n");
    if (withIntent.length <= max) tagLines.push(tag);
  }
  const tagLine = tagLines.length ? `#${tagLines.join(" #")}` : "";
  const withIntent = [body, intent, tagLine].filter(Boolean).join("\n\n");
  if (withIntent.length <= max) return withIntent;
  const bodyAndIntent = [body, intent].filter(Boolean).join("\n\n");
  if (bodyAndIntent.length <= max) return bodyAndIntent;
  return truncateAtBoundary(body, max);
}

export function renderPlatformPayload({ platform, caption_body, caption, engagement_intent, hashtags: inputHashtags = [], media_urls = [], title = null, account_id = null }) {
  if (!SUPPORTED.has(platform)) fail("PLATFORM_UNSUPPORTED", `No renderer is defined for ${platform}.`);
  const rawCaption = caption_body ?? caption;
  if (typeof rawCaption !== "string" || !rawCaption.trim()) fail("MISSING_COPY", "Caption body is required.");
  const sourceCaption = normalizeParagraphBreaks(rawCaption);
  const intent = intentText(engagement_intent);
  if (!intent) fail("MISSING_ENGAGEMENT_INTENT", "engagement_intent is required.");
  const route = DISTRIBUTION_ROUTING[platform];
  const resolvedAccount = account_id ?? route.account_id;
  const tags = hashtags(inputHashtags);
  const tagLine = tags.length ? `#${tags.join(" #")}` : "";
  const body = removeTrailingIntent(sourceCaption, intent);
  if (!body) fail("MISSING_COPY", "Story body must remain after engagement separation.");
  const closing = `${intent}${tagLine ? `\n\n${tagLine}` : ""}`;
  const firstComment = intent;
  const payload = { platform, account_id: resolvedAccount, caption: body, media_urls: [...media_urls], title, hashtags: tags, engagement_intent: intent, adapter_mode: route.adapter_mode };
  if (route.first_comment) {
    payload.first_comment = firstComment;
    payload.caption = [body, tagLine].filter(Boolean).join("\n\n");
  } else if (platform === "x") {
    if (body.length > 280) fail("COPY_REVIEW_REQUIRED", "X story exceeds the renderer budget; supply a coherent platform-native variant.", { character_count: body.length, limit: 280 });
    const withTags = [body, tagLine].filter(Boolean).join("\n\n");
    payload.caption = withTags.length <= 280 ? withTags : body;
    payload.engagement_rendered = false;
  } else if (platform === "tiktok") {
    payload.caption = [body, tagLine].filter(Boolean).join("\n\n");
    payload.engagement_rendered = false;
  } else if (platform === "threads") {
    payload.caption = renderThreadsCaption(body, intent, tags);
    payload.engagement_rendered = payload.caption.includes(intent);
  } else {
    payload.caption = `${body}\n\n${closing}`;
  }
  payload.character_count = payload.caption.length;
  payload.render_version = "distribution-renderer@1.3.1";
  payload.engagement_rendered ??= route.first_comment || platform === "youtube";
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
    provider_job_id: result.provider_job_id ?? result.postSubmissionId ?? result.submissionId ?? result.id ?? null,
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
