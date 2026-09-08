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
  template_version: "editorial-portrait-v01",
  source_commit: "9aa50d2994a90e08221c93e4417d0cdb4550ed23",
  width: 1080,
  height: 1350,
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

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function safeHeadline(value) {
  const source = required(value, "headline_html");
  const tokens = [];
  const tokenized = source.replace(/<br\s*\/?>/gi, () => { tokens.push("<br>"); return `\u0000${tokens.length - 1}\u0000`; }).replace(/<em>([\s\S]*?)<\/em>/gi, (_, text) => { tokens.push(`<em>${escapeHtml(text)}</em>`); return `\u0000${tokens.length - 1}\u0000`; });
  if (/[<>]/.test(tokenized)) fail("SCHEMA_VALIDATION", "headline_html contains unsupported markup.");
  return escapeHtml(tokenized).replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
}

function validateImage(value) {
  const image = required(value, "subject_image");
  if (/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(image)) return image;
  if (/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/[A-Za-z0-9._%()\-]+$/.test(image)) return image;
  if (/^https:\/\/[^\s"'<>]+$/.test(image)) return image;
  fail("SCHEMA_VALIDATION", "subject_image must be an approved HTTPS image URL or image data URI.");
}

function validatePosition(value) {
  const position = required(value, "image_position");
  if (!/^(?:\d{1,3}%|(?:left|center|right))\s+(?:\d{1,3}%|(?:top|center|bottom))$/.test(position)) fail("SCHEMA_VALIDATION", "image_position must be a bounded two-axis CSS position.");
  return position;
}

export function validateFixture(input) {
  if (!input || typeof input !== "object") fail("SCHEMA_VALIDATION", "Fixture must be an object.");
  return {
    subject_image: validateImage(input.subject_image),
    image_position: validatePosition(input.image_position),
    subject: required(input.subject, "subject"),
    story_label: required(input.story_label, "story_label"),
    kicker: required(input.kicker, "kicker"),
    headline_html: safeHeadline(input.headline_html),
    dek: required(input.dek, "dek"),
    source_line: required(input.source_line, "source_line"),
    asset_id: required(input.asset_id, "asset_id"),
    source_id: required(input.source_id, "source_id"),
  };
}

export function buildRenderHtml(fixture, templateHtml) {
  const value = validateFixture(fixture);
  const replacements = {
    subject_image: value.subject_image,
    image_position: value.image_position,
    subject: escapeHtml(value.subject),
    story_label: escapeHtml(value.story_label),
    kicker: escapeHtml(value.kicker),
    headline_html: value.headline_html,
    dek: escapeHtml(value.dek),
    source_line: escapeHtml(value.source_line),
  };
  return templateHtml.replace(/\{\{(subject_image|image_position|subject|story_label|kicker|headline_html|dek|source_line)\}\}/g, (_, key) => replacements[key]);
}

export function buildHctiRequest(fixture, templateHtml) {
  const html = buildRenderHtml(fixture, templateHtml);
  return {
    html,
    device_scale: 1,
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
  return JSON.parse(fs.readFileSync(path.join(baseDir, "fixture-dolly-literacy.json"), "utf8"));
}
