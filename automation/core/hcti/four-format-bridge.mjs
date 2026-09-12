import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FOUR_FORMAT_CONTRACT = Object.freeze({
  provider: "hcti",
  source_branch: "design/hcti-editorial-v01",
  source_commit: "ff2a6c51821e7d3edc1dd440f1a677c852fe6a7c",
  lock_path: "hcti/four-format-master-lock-v2.json",
  implementation_version: "semantic-image-v2",
  locked_file_count: 16,
  width: 1080,
  height: 1350,
  output_format: "png",
  device_scale: 1,
  max_attempts: 1,
  automatic_retries: 0,
  formats: ["single", "carousel", "archive", "evidence"],
});

const rootFromModule = fileURLToPath(new URL("../../..", import.meta.url));
const canonicalTextBytes = (bytes) => Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n"), "utf8");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const gitBlobSha = (bytes) => crypto.createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}`), Buffer.from([0]), bytes])).digest("hex");
const fail = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
};
const required = (value, name) => {
  if (typeof value !== "string" || !value.trim()) fail("SCHEMA_VALIDATION", `${name} is required.`);
  return value.trim();
};
const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const validateImage = (value, name) => {
  const image = required(value, name);
  if (/^https:\/\/[^\s"'<>]+$/i.test(image)) return image;
  if (/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(image)) return image;
  fail("ASSET_NOT_APPROVED", `${name} must be an approved HTTPS image URL or image data URI.`);
};
const validatePosition = (value, name) => {
  const normalized = required(value, name);
  const match = /^(\d{1,3})%$/.exec(normalized);
  if (!match || Number(match[1]) > 100) fail("SCHEMA_VALIDATION", `${name} must be a percentage from 0% to 100%.`);
  return normalized;
};
const richText = (value, name, tags) => {
  const source = required(value, name);
  const tokenized = [];
  const patterns = [];
  if (tags.includes("br")) patterns.push("<br\\s*\\/?>");
  if (tags.includes("em")) patterns.push("<em>|<\\/em>");
  if (tags.includes("span")) patterns.push("<span\\s+class=[\"']accent(?:-word)?[\"']>|<\\/span>");
  const pattern = new RegExp(patterns.join("|"), "gi");
  const safe = source.replace(pattern, (tag) => { tokenized.push(tag); return `\u0000${tokenized.length - 1}\u0000`; });
  if (/[<>]/.test(safe)) fail("SCHEMA_VALIDATION", `${name} contains unsupported markup.`);
  return escapeHtml(safe).replace(/\u0000(\d+)\u0000/g, (_, index) => tokenized[Number(index)]);
};

function readFile(baseDir, relativePath) {
  const filePath = path.join(baseDir, relativePath);
  if (!fs.existsSync(filePath)) fail("SOURCE_MISSING", `Locked source file is missing: ${relativePath}`);
  return fs.readFileSync(filePath);
}

export function loadLockedFourFormatSources(baseDir = rootFromModule) {
  const lockBytes = readFile(baseDir, FOUR_FORMAT_CONTRACT.lock_path);
  const lock = JSON.parse(lockBytes.toString("utf8"));
  if (lock.version !== 2 || Object.keys(lock.files ?? {}).length !== FOUR_FORMAT_CONTRACT.locked_file_count) fail("LOCK_MISMATCH", "Four-format source lock metadata does not match semantic-image v2.");
  const files = {};
  for (const [relativePath, expected] of Object.entries(lock.files ?? {})) {
    const bytes = canonicalTextBytes(readFile(baseDir, relativePath));
    const actual = { sha256: sha256(bytes), git_blob_sha: gitBlobSha(bytes) };
    if (actual.sha256 !== expected.sha256 || actual.git_blob_sha !== expected.git_blob_sha) {
      fail("LOCK_MISMATCH", `Locked source hash mismatch: ${relativePath}`, { relativePath, expected, actual });
    }
    files[relativePath] = bytes.toString("utf8");
  }
  return { lock, files };
}

export function validateCarousel(slides) {
  if (!Array.isArray(slides) || slides.length !== 7) fail("SCHEMA_VALIDATION", "Carousel requires exactly seven slides.");
  const roles = ["hook", "scene", "context", "complication", "reveal", "consequence", "residue"];
  slides.forEach((slide, index) => {
    if (slide.slide_number !== index + 1 || slide.story_role !== roles[index]) fail("SCHEMA_VALIDATION", "Carousel slides must be uniquely numbered in canonical role order.");
    required(slide.subject, `slides[${index}].subject`);
    required(slide.visual_mode, `slides[${index}].visual_mode`);
    required(slide.background_image, `slides[${index}].background_image`);
    validatePosition(slide.image_position_x, `slides[${index}].image_position_x`);
    validatePosition(slide.image_position_y, `slides[${index}].image_position_y`);
    richText(slide.headline_html, `slides[${index}].headline_html`, ["br", "span"]);
  });
  return slides;
}

const textFields = {
  single: ["subject", "story_label", "kicker", "source_line", "cta_text"],
  carousel: ["eyebrow", "kicker", "support_copy", "mini_hook", "handle_text", "cta_text", "deck_name"],
  archive: ["subject", "source_type", "date_label", "kicker", "headline", "micro_caption", "detail_label"],
  evidence: ["subject", "eyebrow", "source_label", "source_context", "interpretation", "scope_note", "date_label", "date_context", "detail_note"],
};
const richFields = {
  single: ["headline_html"],
  carousel: ["headline_html", "source_line"],
  archive: ["excerpt_html", "excerpt_attribution_html", "provenance"],
  evidence: ["claim_html", "provenance"],
};

function normalizeOutput(format, input) {
  const output = structuredClone(input);
  if (format === "single") {
    output.subject_image = validateImage(output.subject_image, "subject_image");
    output.headline_html = richText(output.headline_html, "headline_html", ["br", "span"]);
  } else if (format === "carousel") {
    output.background_image = validateImage(output.background_image, "background_image");
    output.headline_html = richText(output.headline_html, "headline_html", ["br", "span"]);
  } else if (format === "archive") {
    output.artifact_image = validateImage(output.artifact_image, "artifact_image");
    output.excerpt_html = richText(output.excerpt_html, "excerpt_html", ["br", "em"]);
  } else if (format === "evidence") {
    output.source_image = validateImage(output.source_image, "source_image");
    output.detail_image = validateImage(output.detail_image, "detail_image");
    output.claim_html = richText(output.claim_html, "claim_html", ["br", "em"]);
  } else fail("SCHEMA_VALIDATION", `Unsupported format: ${format}`);
  for (const field of textFields[format]) if (output[field] !== undefined && output[field] !== "") output[field] = escapeHtml(output[field]);
  for (const field of richFields[format]) if (output[field] !== undefined && output[field] !== "") {
    const tags = field.includes("headline") ? ["br", "span"] : field.includes("excerpt") || field.includes("claim") ? ["br", "em"] : ["br"];
    output[field] = richText(output[field], field, tags);
  }
  return output;
}

function substitute(template, values) {
  const placeholders = [...template.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]);
  const unknown = placeholders.filter((name) => !(name in values));
  if (unknown.length) fail("SCHEMA_VALIDATION", `No value supplied for template fields: ${unknown.join(", ")}`);
  const html = template.replace(/\{\{([^}]+)\}\}/g, (_, name) => values[name]);
  if (/\{\{[^}]+\}\}|saved[-_ ]template|<script\b|javascript:/i.test(html)) fail("SCHEMA_VALIDATION", "Rendered HTML contains unresolved or prohibited content.");
  if (/(?:background(?:-image)?\s*:[^;}]*url\([^)]*data:image\/|style\s*=\s*["'][^"']*data:image\/)/i.test(html)) {
    fail("CSS_IMAGE_BINDING_PROHIBITED", "Image bytes must be bound through semantic img src attributes, never CSS.");
  }
  return html;
}

export function assertSemanticImageBinding(html, expectedImages) {
  if (/(?:background(?:-image)?\s*:[^;}]*url\([^)]*data:image\/|style\s*=\s*["'][^"']*data:image\/)/i.test(html)) {
    fail("CSS_IMAGE_BINDING_PROHIBITED", "Image bytes must be bound through semantic img src attributes, never CSS.");
  }
  const semanticImages = html.match(/<img\b[^>]*\bsrc=["'][^"']+["'][^>]*>/gi) ?? [];
  if (semanticImages.length !== expectedImages) fail("SEMANTIC_IMAGE_BINDING_REQUIRED", `Expected exactly ${expectedImages} active semantic image binding(s).`);
  return semanticImages.length;
}

export function buildFourFormatRequest(format, input, sources, assetUrls) {
  const templatePath = {
    single: "hcti/editorial-portrait-v01/template-image-v2.html",
    carousel: "hcti/narrative-carousel-v01/template-image-v2.html",
    archive: "hcti/archive-card-v01/template-image-v2.html",
    evidence: "hcti/evidence-spread-v01/template-image-v2.html",
  }[format];
  const inputForValidation = { ...input };
  if (format === "single") inputForValidation.subject_image = assetUrls.subject_image;
  if (format === "carousel") inputForValidation.background_image = assetUrls.background_image;
  if (format === "archive") inputForValidation.artifact_image = assetUrls.artifact_image;
  if (format === "evidence") {
    inputForValidation.source_image = assetUrls.source_image;
    inputForValidation.detail_image = assetUrls.detail_image;
  }
  const value = normalizeOutput(format, inputForValidation);
  const runtime = { ...value };
  if (format === "single") runtime.subject_image = validateImage(assetUrls.subject_image, "assetUrls.subject_image");
  if (format === "carousel") runtime.background_image = validateImage(assetUrls.background_image, "assetUrls.background_image");
  if (format === "archive") runtime.artifact_image = validateImage(assetUrls.artifact_image, "assetUrls.artifact_image");
  if (format === "evidence") {
    runtime.source_image = validateImage(assetUrls.source_image, "assetUrls.source_image");
    runtime.detail_image = validateImage(assetUrls.detail_image, "assetUrls.detail_image");
  }
  const values = Object.fromEntries(Object.entries(runtime).map(([key, value]) => [key, String(value ?? "")]));
  const html = substitute(sources.files[templatePath], values);
  const expectedImages = format === "evidence" ? 2 : 1;
  const semanticImageCount = assertSemanticImageBinding(html, expectedImages);
  return {
    format,
    html,
    semantic_image_count: semanticImageCount,
    viewport_width: FOUR_FORMAT_CONTRACT.width,
    viewport_height: FOUR_FORMAT_CONTRACT.height,
    device_scale: FOUR_FORMAT_CONTRACT.device_scale,
    output_format: FOUR_FORMAT_CONTRACT.output_format,
  };
}

export function buildFourFormatBatch({ baseDir = rootFromModule, assetUrls, single, carousel, archive, evidence } = {}) {
  const sources = loadLockedFourFormatSources(baseDir);
  const outputs = [];
  outputs.push(buildFourFormatRequest("single", single ?? JSON.parse(sources.files["hcti/editorial-portrait-v01/fixture-dolly-literacy.json"]), sources, { subject_image: assetUrls?.A4 }));
  const slides = validateCarousel(carousel ?? JSON.parse(sources.files["hcti/narrative-carousel-v01/fixture-dolly-seven-slides.json"]));
  for (const slide of slides) outputs.push(buildFourFormatRequest("carousel", slide, sources, { background_image: assetUrls?.[slide.background_image] ?? assetUrls?.A4 }));
  outputs.push(buildFourFormatRequest("archive", archive ?? JSON.parse(sources.files["hcti/archive-card-v01/fixture-dolly-ownership.json"]), sources, { artifact_image: assetUrls?.A4 }));
  outputs.push(buildFourFormatRequest("evidence", evidence ?? JSON.parse(sources.files["hcti/evidence-spread-v01/fixture-dolly-loc.json"]), sources, { source_image: assetUrls?.source_photo, detail_image: assetUrls?.source_caption }));
  return { sources, outputs };
}

export function renderManifest(assetUrls) {
  return {
    A4: { asset_id: "A4", drive_id: "1FEpzAp4GI_i3zu8-AawepKxIqTNWq4_Y", delivery_url: assetUrls?.A4 ?? null },
    A1: { asset_id: "A1", drive_id: "1R2zBFOGZreOzM7DaZRsXnYLB-xagCjYt", delivery_url: assetUrls?.["assets/A1-high.jpg"] ?? null },
    mountains: { asset_id: "B1", drive_id: "1tIU-DSxZvKgybPABbK6z-NkQI8PjiFtQ", delivery_url: assetUrls?.["assets/mountains.jpg"] ?? null },
    book: { asset_id: "B2", drive_id: "1RKDjQ7fLotG-PToknmb20S1ozbkp-0Rv", delivery_url: assetUrls?.["assets/open-book.jpg"] ?? null },
    reading: { asset_id: "C1", drive_id: "1WtJZzwV1Jylp8PBewVla6NnYRktmecHp", delivery_url: assetUrls?.["assets/reading.png"] ?? null },
    milestone: { asset_id: "C2", drive_id: "1fVjXvmiwjIR7yWh--Oe8gcHlBZLIX4of", delivery_url: assetUrls?.["assets/milestone.jpg"] ?? null },
  };
}
