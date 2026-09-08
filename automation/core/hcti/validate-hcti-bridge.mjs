import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HCTI_CONTRACT, buildHctiRequest, loadCanonicalFixture, loadLockedSource } from "./hcti-bridge.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const source = loadLockedSource();
const template = fs.readFileSync(path.join(root, "template.html"), "utf8");
const request = buildHctiRequest(loadCanonicalFixture(), template, { runtimeImage: "https://example.test/sanitized-approved-asset.webp" });

assert.equal(HCTI_CONTRACT.credential_type, "httpBasicAuth");
assert.equal(HCTI_CONTRACT.source_commit, "1a383d02e4d306deb0fd0543b05e850f6b2b38a7");
assert.equal(source.template_sha, "7bf754b1dacecda0d371597290be1f987ad5d514");
assert.equal(source.fixture_sha, "984f4210204c7bba53c85893aa833c5a436bb843");
assert.equal(HCTI_CONTRACT.width, 1080);
assert.equal(HCTI_CONTRACT.height, 1350);
assert.equal(request.device_scale, 1);
assert.match(request.html, /width=1080,height=1350/);
assert.match(request.html, /background-image:url\('https:\/\//);
assert.match(request.html, /class="accent-word"/);
assert.doesNotMatch(request.html, /<p[^>]*class=["']dek["']|supporting paragraph|api[_-]?key|authorization|password|secret/i);
assert.throws(() => buildHctiRequest(loadCanonicalFixture(), template), (error) => error.code === "ASSET_NOT_APPROVED");
console.log("hcti bridge validator: passed");
