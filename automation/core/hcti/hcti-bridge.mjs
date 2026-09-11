import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const HCTI_CONTRACT = Object.freeze({
  provider: "hcti",
  endpoint: "https://hcti.io/v1/image",
  method: "POST",
  credential_ref: "INT | HCTI | Development | Production Renderer",
  credential_type: "httpBasicAuth",
  source_branch: "design/hcti-editorial-v01",
  source_commit: "1a383d02e4d306deb0fd0543b05e850f6b2b38a7",
  source_lock_path: "hcti/editorial-portrait-v01/render-lock-v0.4.json",
  template_path: "hcti/editorial-portrait-v01/template.html",
  fixture_path: "hcti/editorial-portrait-v01/fixture-dolly-literacy.json",
  template_blob_sha: "7bf754b1dacecda0d371597290be1f987ad5d514",
  fixture_blob_sha: "984f4210204c7bba53c85893aa833c5a436bb843",
  lock_version: "WORKING v0.4",
  template_version: "editorial-portrait-v01",
  width: 1080,
  height: 1350,
  device_scale: 1,
  layout_variant: "variant-left",
  max_attempts: 1,
  automatic_retries: 0,
});

export class HctiContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "HctiContractError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details) => { throw new HctiContractError(code, message, details); };
const required = (value, name) => {
  if (typeof value !== "string" || !value.trim()) fail("SCHEMA_VALIDATION", `${name} is required.`);
  return value.trim();
};

function blobSha(content) {
  const bytes = Buffer.from(content.replaceAll("\r\n", "\n"), "utf8");
  return crypto.createHash("sha1").update(`blob ${bytes.length}`).update(Buffer.from([0])).update(bytes).digest("hex");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function safeHeadline(value) {
  const source = required(value, "headline_html");
  const tokens = [];
  const tokenized = source
    .replace(/<br\s*\/?>(?=.)/gi, () => { tokens.push("<br>"); return `\u0000${tokens.length - 1}\u0000`; })
    .replace(/<span class="accent-word">([\s\S]*?)<\/span>/gi, (_, text) => { tokens.push(`<span class="accent-word">${escapeHtml(text)}</span>`); return `\u0000${tokens.length - 1}\u0000`; });
  if (/[<>]/.test(tokenized)) fail("SCHEMA_VALIDATION", "headline_html contains unsupported markup.");
  return escapeHtml(tokenized).replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
}

function validateImage(value, { allowPlaceholder = false } = {}) {
  const image = required(value, "subject_image");
  if (allowPlaceholder && image === "<runtime image URL or data URI>") return image;
  if (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(image)) return image;
  if (/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/[A-Za-z0-9._%()\-]+$/.test(image)) return image;
  if (/^https:\/\/[^\s"'<>]+$/.test(image)) return image;
  fail("ASSET_NOT_APPROVED", "subject_image must be an approved HTTPS image URL or image data URI.");
}

function validatePercent(value, name) {
  const normalized = required(value, name);
  const match = /^(\d{1,3})%$/.exec(normalized);
  if (!match || Number(match[1]) > 100) fail("SCHEMA_VALIDATION", `${name} must be a percentage from 0% to 100%.`);
  return normalized;
}

export function validateFixture(input, options = {}) {
  if (!input || typeof input !== "object") fail("SCHEMA_VALIDATION", "Fixture must be an object.");
  if (input.dek !== undefined) fail("STALE_SOURCE", "Supporting paragraph/dek injection is not part of locked v0.4.");
  if (input.render_version !== HCTI_CONTRACT.lock_version) fail("LOCK_MISMATCH", "Fixture render_version does not match locked v0.4.");
  if (input.layout_variant !== HCTI_CONTRACT.layout_variant) fail("LOCK_MISMATCH", "Fixture layout_variant does not match locked variant-left.");
  if (input.cta_display !== "none") fail("LOCK_MISMATCH", "CTA must remain display:none.");
  return {
    subject: required(input.subject, "subject"),
    story_label: required(input.story_label, "story_label"),
    subject_image: validateImage(input.subject_image, options),
    image_position_x: validatePercent(input.image_position_x, "image_position_x"),
    image_position_y: validatePercent(input.image_position_y, "image_position_y"),
    blue_bleed_opacity: required(input.blue_bleed_opacity, "blue_bleed_opacity"),
    scrim_strength: required(input.scrim_strength, "scrim_strength"),
    layout_variant: input.layout_variant,
    kicker: required(input.kicker, "kicker"),
    headline_html: safeHeadline(input.headline_html),
    source_line: required(input.source_line, "source_line"),
    cta_display: input.cta_display,
    cta_text: String(input.cta_text ?? ""),
    render_version: input.render_version,
    asset_id: input.asset_id ? required(input.asset_id, "asset_id") : null,
    source_id: input.source_id ? required(input.source_id, "source_id") : null,
  };
}

export function loadLockedSource(baseDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures")) {
  const templatePath = path.resolve(baseDir, "..", "template.html");
  const fixturePath = path.join(baseDir, "fixture-dolly-literacy.json");
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  const template = fs.readFileSync(templatePath, "utf8");
  const actualTemplateSha = blobSha(template);
  const actualFixtureSha = blobSha(fs.readFileSync(fixturePath, "utf8"));
  if (actualTemplateSha !== HCTI_CONTRACT.template_blob_sha || actualFixtureSha !== HCTI_CONTRACT.fixture_blob_sha) {
    fail("LOCK_MISMATCH", "Locked HCTI template or fixture blob SHA does not match the approved source commit.", {
      source_commit: HCTI_CONTRACT.source_commit,
      actual_template_sha: actualTemplateSha,
      actual_fixture_sha: actualFixtureSha,
    });
  }
  return { fixture, template, template_sha: actualTemplateSha, fixture_sha: actualFixtureSha };
}

export function buildRenderHtml(fixture, templateHtml, { runtimeImage } = {}) {
  const source = loadLockedSource();
  if (blobSha(templateHtml) !== HCTI_CONTRACT.template_blob_sha || templateHtml !== source.template) fail("LOCK_MISMATCH", "Render template is not the locked source.");
  const value = validateFixture({ ...fixture, subject_image: runtimeImage ?? fixture.subject_image }, { allowPlaceholder: !runtimeImage });
  if (!runtimeImage) fail("ASSET_NOT_APPROVED", "A resolved approved runtime image is required before HCTI transport.");
  const replacements = {
    subject_image: value.subject_image,
    image_position_x: value.image_position_x,
    image_position_y: value.image_position_y,
    blue_bleed_opacity: value.blue_bleed_opacity,
    scrim_strength: value.scrim_strength,
    layout_variant: value.layout_variant,
    subject: escapeHtml(value.subject),
    story_label: escapeHtml(value.story_label),
    kicker: escapeHtml(value.kicker),
    headline_html: value.headline_html,
    source_line: escapeHtml(value.source_line),
    cta_display: value.cta_display,
    cta_text: escapeHtml(value.cta_text),
  };
  const html = templateHtml.replace(/\{\{(subject_image|image_position_x|image_position_y|blue_bleed_opacity|scrim_strength|layout_variant|subject|story_label|kicker|headline_html|source_line|cta_display|cta_text)\}\}/g, (_, key) => replacements[key]);
  if (/\{\{[^}]+\}\}|<p[^>]*class=["']dek["']/i.test(html)) fail("STALE_SOURCE", "Rendered HTML contains unresolved or supporting-paragraph source.");
  return html;
}

export function buildHctiRequest(fixture, templateHtml, options = {}) {
  const html = buildRenderHtml(fixture, templateHtml, options);
  return {
    html,
    device_scale: HCTI_CONTRACT.device_scale,
    viewport_width: HCTI_CONTRACT.width,
    viewport_height: HCTI_CONTRACT.height,
    expected_width: HCTI_CONTRACT.width,
    expected_height: HCTI_CONTRACT.height,
  };
}

export function buildAttemptIdentity({ runId, fixture }) {
  const canonical = JSON.stringify({ provider: HCTI_CONTRACT.provider, operation: "render", source_commit: HCTI_CONTRACT.source_commit, template_version: HCTI_CONTRACT.template_version, asset_id: fixture.asset_id, source_id: fixture.source_id, run_id: runId });
  return `hcti-render:${crypto.createHash("sha256").update(canonical).digest("hex")}`;
}

export function normalizeHctiResult(response, context = {}) {
  const body = response && typeof response === "object" ? response : {};
  if (typeof body.url !== "string" || !/^https:\/\/hcti\.io\/v1\/image\/[A-Za-z0-9_-]+$/.test(body.url) || typeof body.id !== "string" || !body.id) {
    fail("MALFORMED_PROVIDER_RESPONSE", "HCTI response did not contain the sanctioned url/id shape.");
  }
  return {
    provider: HCTI_CONTRACT.provider,
    render_id: body.id,
    image_url: body.url,
    width: HCTI_CONTRACT.width,
    height: HCTI_CONTRACT.height,
    template_version: HCTI_CONTRACT.template_version,
    source_commit: HCTI_CONTRACT.source_commit,
    template_blob_sha: HCTI_CONTRACT.template_blob_sha,
    fixture_blob_sha: HCTI_CONTRACT.fixture_blob_sha,
    asset_id: context.asset_id ?? null,
    source_id: context.source_id ?? null,
    attempt_id: context.attempt_id ?? null,
    outcome: "submitted",
    automatic_retries: 0,
    raw_payload_persisted: false,
  };
}

export function sanitizeHctiError(error) {
  return { error_class: "HCTI_RENDER_FAILURE", message: String(error?.code ?? error?.message ?? "provider failure").slice(0, 240), raw_payload_persisted: false };
}

export function loadCanonicalFixture(baseDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures")) {
  return loadLockedSource(baseDir).fixture;
}
