import assert from "node:assert/strict";
import { buildFourFormatBatch, FOUR_FORMAT_CONTRACT, loadLockedFourFormatSources } from "./four-format-bridge.mjs";

const sources = loadLockedFourFormatSources();
assert.equal(Object.keys(sources.lock.files).length, 15);
assert.equal(FOUR_FORMAT_CONTRACT.source_commit, "29e89dea8ec36ee35102117a5790bf804a2e24fc");
assert.equal(FOUR_FORMAT_CONTRACT.width, 1080);
assert.equal(FOUR_FORMAT_CONTRACT.height, 1350);
assert.equal(FOUR_FORMAT_CONTRACT.device_scale, 1);
assert.equal(FOUR_FORMAT_CONTRACT.automatic_retries, 0);
assert.throws(() => buildFourFormatBatch({ assetUrls: { A4: "not-an-image" } }), (error) => error.code === "ASSET_NOT_APPROVED");
console.log("four-format bridge validator: passed");
