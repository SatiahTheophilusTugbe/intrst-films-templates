import assert from "node:assert/strict";
import { buildFourFormatBatch, FOUR_FORMAT_CONTRACT, loadLockedFourFormatSources } from "../four-format-bridge.mjs";

const synthetic = {
  A4: "https://example.test/a4.jpg",
  "assets/A1-high.jpg": "https://example.test/a1.jpg",
  "assets/mountains.jpg": "https://example.test/mountains.jpg",
  "assets/open-book.jpg": "https://example.test/book.jpg",
  "assets/reading.png": "https://example.test/reading.png",
  "assets/milestone.jpg": "https://example.test/milestone.jpg",
  source_photo: "https://example.test/source-photo.png",
  source_caption: "https://example.test/source-caption.png",
};

const sources = loadLockedFourFormatSources();
assert.equal(Object.keys(sources.lock.files).length, 15);
const batch = buildFourFormatBatch({ assetUrls: synthetic });
assert.equal(batch.outputs.length, 10);
assert.deepEqual(batch.outputs.map((output) => output.format), ["single", "carousel", "carousel", "carousel", "carousel", "carousel", "carousel", "carousel", "archive", "evidence"]);
for (const output of batch.outputs) {
  assert.equal(output.viewport_width, 1080);
  assert.equal(output.viewport_height, 1350);
  assert.equal(output.device_scale, 1);
  assert.equal(output.output_format, "png");
  assert.doesNotMatch(output.html, /\{\{[^}]+\}\}|saved[-_ ]template|<script\b|javascript:/i);
}
assert.equal((batch.outputs[1].html.match(/<main[^>]+data-slide="1"/g) ?? []).length, 1);
assert.equal((batch.outputs[7].html.match(/<main[^>]+data-slide="7"/g) ?? []).length, 1);
assert.match(batch.outputs[0].html, /<span class="accent-word">library\.<\/span>/);
assert.match(batch.outputs[8].html, /artifact_protagonist|Dolly said no\./);
assert.match(batch.outputs[9].html, /https:\/\/example\.test\/source-photo\.png/);
assert.throws(() => buildFourFormatBatch({ assetUrls: { ...synthetic, source_caption: "" } }), (error) => error.code === "SCHEMA_VALIDATION");
assert.throws(() => buildFourFormatBatch({ assetUrls: { ...synthetic, "assets/A1-high.jpg": "javascript:alert(1)" } }), (error) => error.code === "ASSET_NOT_APPROVED");
assert.throws(() => buildFourFormatBatch({ assetUrls: synthetic, carousel: [{ ...JSON.parse(sources.files["hcti/narrative-carousel-v01/fixture-dolly-seven-slides.json"])[0], slide_number: 2 }] }), (error) => error.code === "SCHEMA_VALIDATION");
assert.equal(FOUR_FORMAT_CONTRACT.max_attempts, 1);
assert.equal(FOUR_FORMAT_CONTRACT.automatic_retries, 0);
console.log("four-format bridge tests: 12 passed");
