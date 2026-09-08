import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAttemptIdentity, buildHctiRequest, HCTI_CONTRACT, loadCanonicalFixture, loadLockedSource, normalizeHctiResult, validateFixture } from "../hcti-bridge.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const template = fs.readFileSync(path.join(root, "template.html"), "utf8");
const fixture = loadCanonicalFixture();

const source = loadLockedSource();
assert.equal(source.template_sha, HCTI_CONTRACT.template_blob_sha);
assert.equal(source.fixture_sha, HCTI_CONTRACT.fixture_blob_sha);
assert.equal(HCTI_CONTRACT.source_commit, "1a383d02e4d306deb0fd0543b05e850f6b2b38a7");
assert.equal(HCTI_CONTRACT.max_attempts, 1);
assert.equal(HCTI_CONTRACT.automatic_retries, 0);
assert.equal(fixture.subject_image, "<runtime image URL or data URI>");
assert.equal(validateFixture(fixture, { allowPlaceholder: true }).layout_variant, "variant-left");

const request = buildHctiRequest(fixture, template, { runtimeImage: "https://example.test/approved-dolly.webp" });
assert.match(request.html, /DOLLY PARTON/);
assert.match(request.html, /<span class="accent-word">library\.<\/span>/);
assert.match(request.html, /https:\/\/example\.test\/approved-dolly\.webp/);
assert.doesNotMatch(request.html, /<p[^>]*class=["']dek["']|In 1995, Dolly Parton turned/i);
assert.doesNotMatch(request.html, /\{\{[^}]+\}\}/);
assert.equal(request.viewport_width, 1080);
assert.equal(request.viewport_height, 1350);
assert.equal(request.device_scale, 1);
assert.doesNotMatch(request.html, /<script|onerror=|javascript:/i);

assert.throws(() => buildHctiRequest(fixture, template), (error) => error.code === "ASSET_NOT_APPROVED");
assert.throws(() => buildHctiRequest({ ...fixture, dek: "stale" }, template, { runtimeImage: "https://example.test/approved-dolly.webp" }), (error) => error.code === "STALE_SOURCE");
assert.throws(() => buildHctiRequest({ ...fixture, layout_variant: "variant-bottom" }, template, { runtimeImage: "https://example.test/approved-dolly.webp" }), (error) => error.code === "LOCK_MISMATCH");
assert.throws(() => buildHctiRequest({ ...fixture, cta_display: "block" }, template, { runtimeImage: "https://example.test/approved-dolly.webp" }), (error) => error.code === "LOCK_MISMATCH");
assert.throws(() => buildHctiRequest({ ...fixture, headline_html: "<strong>unsafe</strong>" }, template, { runtimeImage: "https://example.test/approved-dolly.webp" }), (error) => error.code === "SCHEMA_VALIDATION");
assert.throws(() => buildHctiRequest(fixture, template, { runtimeImage: "javascript:alert(1)" }), (error) => error.code === "ASSET_NOT_APPROVED");

const attempt = buildAttemptIdentity({ runId: "AUT-HCTI-TEST-001", fixture: { ...fixture, asset_id: "INT-AST-TEST" } });
assert.match(attempt, /^hcti-render:[a-f0-9]{64}$/);
const normalized = normalizeHctiResult({ id: "abc123", url: "https://hcti.io/v1/image/abc123" }, { asset_id: "INT-AST-TEST", source_id: "SRC-TEST", attempt_id: attempt });
assert.equal(normalized.raw_payload_persisted, false);
assert.equal(normalized.width, 1080);
assert.equal(normalized.template_blob_sha, HCTI_CONTRACT.template_blob_sha);
assert.throws(() => normalizeHctiResult({ id: "abc123", url: "https://evil.example/image/abc123" }), (error) => error.code === "MALFORMED_PROVIDER_RESPONSE");
console.log("hcti bridge tests: 17 passed");
