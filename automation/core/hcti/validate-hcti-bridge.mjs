import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HCTI_CONTRACT, buildHctiRequest, loadCanonicalFixture } from "./hcti-bridge.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const template = fs.readFileSync(path.join(root, "template.html"), "utf8");
const html = buildHctiRequest(loadCanonicalFixture(), template).html;
assert.equal(HCTI_CONTRACT.credential_type, "httpBasicAuth");
assert.equal(HCTI_CONTRACT.width, 1080);
assert.equal(HCTI_CONTRACT.height, 1350);
assert.match(html, /width: 1080px; height: 1350px/);
assert.match(html, /background-image: url\('/);
assert.doesNotMatch(html, /api[_-]?key|authorization|password|secret/i);
console.log("hcti bridge validator: passed");
