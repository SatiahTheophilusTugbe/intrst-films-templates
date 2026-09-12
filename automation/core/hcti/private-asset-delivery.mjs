import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildFourFormatBatch } from "./four-format-bridge.mjs";

const contractPath = fileURLToPath(new URL("./private-asset-delivery.contract.json", import.meta.url));
export const PRIVATE_ASSET_DELIVERY_CONTRACT = Object.freeze(JSON.parse(fs.readFileSync(contractPath, "utf8")));

const fail = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
};

const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function detectImage(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24) fail("ASSET_BYTES_INVALID", "Downloaded asset bytes are missing or truncated.");
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mime_type: "image/png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { mime_type: "image/jpeg", height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  fail("ASSET_MIME_INVALID", "Downloaded bytes are not a supported PNG or JPEG image.");
}

export function verifyPrivateAssetBytes(assetKey, bytes, contract = PRIVATE_ASSET_DELIVERY_CONTRACT) {
  const expected = contract.assets?.[assetKey];
  if (!expected) fail("ASSET_NOT_CANONICAL", `Unknown canonical asset: ${assetKey}`);
  const detected = detectImage(bytes);
  const actual = { drive_id: expected.drive_id, ...detected, bytes: bytes.length, sha256: digest(bytes) };
  for (const field of ["mime_type", "width", "height", "bytes", "sha256"]) {
    if (actual[field] !== expected[field]) fail("ASSET_VERIFICATION_FAILED", `${assetKey} ${field} mismatch.`, { asset_key: assetKey, field, expected: expected[field], actual: actual[field] });
  }
  return { asset_key: assetKey, ...actual, retrieval_status: "verified", delivery_mode: contract.delivery_mode };
}

export function toTransientDataUri(assetKey, bytes, contract = PRIVATE_ASSET_DELIVERY_CONTRACT) {
  const verified = verifyPrivateAssetBytes(assetKey, bytes, contract);
  return { verified, data_uri: `data:${verified.mime_type};base64,${bytes.toString("base64")}` };
}

export function sanitizeDeliveryEvidence(verified, verifiedAt = new Date().toISOString()) {
  const allowed = ["asset_key", "drive_id", "mime_type", "width", "height", "bytes", "sha256", "retrieval_status", "delivery_mode"];
  const result = Object.fromEntries(allowed.filter((key) => verified[key] !== undefined).map((key) => [key, verified[key]]));
  return { ...result, verification_timestamp: verifiedAt, encoded_payload_persisted: false };
}

function dataUriPrefix(mime) { return `data:${mime};base64,`; }
function base64Length(bytes) { return 4 * Math.ceil(bytes / 3); }

export function measureFourFormatRequestBodies(contract = PRIVATE_ASSET_DELIVERY_CONTRACT) {
  const prefixes = Object.fromEntries(Object.entries(contract.assets).map(([key, value]) => [key, `${dataUriPrefix(value.mime_type)}A`]));
  const batch = buildFourFormatBatch({ assetUrls: prefixes });
  const slides = JSON.parse(batch.sources.files["hcti/narrative-carousel-v01/fixture-dolly-seven-slides.json"]);
  const assetKeys = [
    ["A4"],
    ...slides.map((slide) => [slide.background_image === "assets/A4.jpg" ? "A4" : slide.background_image]),
    ["A4"],
    ["source_photo", "source_caption"],
  ];
  return batch.outputs.map((output, index) => {
    const body = { html: output.html, viewport_width: output.viewport_width, viewport_height: output.viewport_height, device_scale: output.device_scale, format: output.output_format };
    const encodedAssetBytes = assetKeys[index].reduce((sum, key) => sum + base64Length(contract.assets[key].bytes) - 1, 0);
    return {
      output_index: index + 1,
      format: output.format,
      asset_keys: assetKeys[index],
      request_bytes: Buffer.byteLength(JSON.stringify(body), "utf8") + encodedAssetBytes,
      asset_bytes: assetKeys[index].reduce((sum, key) => sum + contract.assets[key].bytes, 0),
    };
  });
}

export function assertHctiRequestSize(requestBytes, limitBytes = PRIVATE_ASSET_DELIVERY_CONTRACT.hcti.request_size_limit_bytes) {
  if (!Number.isSafeInteger(requestBytes) || requestBytes <= 0) fail("HCTI_REQUEST_INVALID", "Measured request size must be a positive integer.");
  if (limitBytes == null) return { allowed_by: "controlled_canary_authorization", request_bytes: requestBytes, documented_limit_bytes: null };
  if (!Number.isSafeInteger(limitBytes) || limitBytes <= 0) fail("HCTI_REQUEST_LIMIT_INVALID", "Configured HCTI request-size limit must be a positive safe integer.", { request_bytes: requestBytes, limit_bytes: limitBytes });
  if (requestBytes > limitBytes) fail("HCTI_REQUEST_TOO_LARGE", "Measured HCTI request exceeds the proven provider limit.", { request_bytes: requestBytes, limit_bytes: limitBytes });
  return { allowed_by: "documented_limit", request_bytes: requestBytes, documented_limit_bytes: limitBytes };
}

export function assertRuntimeDeliveryReady({ contract = PRIVATE_ASSET_DELIVERY_CONTRACT, credentialBindingStatus = contract.google_drive_credential?.binding_status, requestSizeLimitBytes = contract.hcti.request_size_limit_bytes } = {}) {
  if (!["bound", "bound_project_scoped"].includes(credentialBindingStatus)) fail("DRIVE_CREDENTIAL_UNAVAILABLE", "A project-owned Google Drive credential is required before private-asset retrieval.");
  for (const measurement of measureFourFormatRequestBodies(contract)) assertHctiRequestSize(measurement.request_bytes, requestSizeLimitBytes);
  return true;
}
