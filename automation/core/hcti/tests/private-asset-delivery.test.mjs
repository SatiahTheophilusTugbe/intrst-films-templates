import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PRIVATE_ASSET_DELIVERY_CONTRACT, assertHctiRequestSize, assertRuntimeDeliveryReady, measureFourFormatRequestBodies, sanitizeDeliveryEvidence, toTransientDataUri, verifyPrivateAssetBytes } from "../private-asset-delivery.mjs";

function png(width, height) {
  const bytes = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function jpeg(width, height) {
  const bytes = Buffer.alloc(24);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  return bytes;
}

const syntheticBytes = png(2, 3);
const syntheticContract = {
  delivery_mode: PRIVATE_ASSET_DELIVERY_CONTRACT.delivery_mode,
  assets: { synthetic: { drive_id: "DRIVE-SYNTHETIC", mime_type: "image/png", width: 2, height: 3, bytes: syntheticBytes.length, sha256: crypto.createHash("sha256").update(syntheticBytes).digest("hex") } },
};
const verified = verifyPrivateAssetBytes("synthetic", syntheticBytes, syntheticContract);
assert.equal(verified.retrieval_status, "verified");
assert.equal(verified.width, 2);
assert.equal(verified.height, 3);
const transient = toTransientDataUri("synthetic", syntheticBytes, syntheticContract);
assert.match(transient.data_uri, /^data:image\/png;base64,/);
const sanitized = sanitizeDeliveryEvidence(transient.verified, "2026-09-11T00:00:00.000Z");
assert.equal(sanitized.encoded_payload_persisted, false);
assert.equal("data_uri" in sanitized, false);
assert.doesNotMatch(JSON.stringify(sanitized), /base64/);
assert.throws(() => verifyPrivateAssetBytes("synthetic", Buffer.concat([syntheticBytes, Buffer.from([0])]), syntheticContract), (error) => error.code === "ASSET_VERIFICATION_FAILED");
assert.throws(() => verifyPrivateAssetBytes("unknown", syntheticBytes, syntheticContract), (error) => error.code === "ASSET_NOT_CANONICAL");
assert.throws(() => verifyPrivateAssetBytes("synthetic", Buffer.alloc(24), syntheticContract), (error) => error.code === "ASSET_MIME_INVALID");
const syntheticJpeg = jpeg(7, 5);
const jpegContract = { delivery_mode: syntheticContract.delivery_mode, assets: { jpeg: { drive_id: "DRIVE-JPEG", mime_type: "image/jpeg", width: 7, height: 5, bytes: syntheticJpeg.length, sha256: crypto.createHash("sha256").update(syntheticJpeg).digest("hex") } } };
assert.equal(verifyPrivateAssetBytes("jpeg", syntheticJpeg, jpegContract).mime_type, "image/jpeg");
const measurements = measureFourFormatRequestBodies();
assert.equal(measurements.length, 10);
assert.deepEqual(measurements.map((item) => item.format), ["single", "carousel", "carousel", "carousel", "carousel", "carousel", "carousel", "carousel", "archive", "evidence"]);
assert.ok(measurements.every((item) => item.request_bytes > item.asset_bytes));
assert.equal(assertHctiRequestSize(measurements[0].request_bytes).allowed_by, "controlled_canary_authorization");
assert.equal(assertHctiRequestSize(measurements[0].request_bytes, measurements[0].request_bytes).allowed_by, "documented_limit");
assert.throws(() => assertHctiRequestSize(measurements[0].request_bytes, measurements[0].request_bytes - 1), (error) => error.code === "HCTI_REQUEST_TOO_LARGE");
assert.throws(() => assertRuntimeDeliveryReady({ credentialBindingStatus: "missing" }), (error) => error.code === "DRIVE_CREDENTIAL_UNAVAILABLE");
assert.equal(assertRuntimeDeliveryReady({ credentialBindingStatus: "bound" }), true);
assert.equal(assertRuntimeDeliveryReady(), true);
assert.equal(PRIVATE_ASSET_DELIVERY_CONTRACT.source_pdf.sha256, PRIVATE_ASSET_DELIVERY_CONTRACT.source_pdf.sha256.toLowerCase());
assert.equal(PRIVATE_ASSET_DELIVERY_CONTRACT.hcti.maximum_attempts_per_output, 1);
assert.equal(PRIVATE_ASSET_DELIVERY_CONTRACT.hcti.automatic_retries, 0);
console.log("private asset delivery tests: 23 passed");
