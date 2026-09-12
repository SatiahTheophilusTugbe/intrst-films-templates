import assert from "node:assert/strict";
import {
  assertTransportObservability,
  buildRequestEvidence,
  classifyRenderVerification,
  normalizeTransportOutcome,
  sanitizeObservabilityEvidence,
} from "../render-observability.mjs";

const enabled = {
  transport_enabled: true,
  terminal_postflight_enabled: true,
  browser_layout_verified: true,
  provider_call_budget: 1,
  automatic_retries: 0,
};
assert.equal(assertTransportObservability(enabled), true);
assert.throws(() => assertTransportObservability({ ...enabled, terminal_postflight_enabled: false }), (error) => error.code === "TERMINAL_POSTFLIGHT_REQUIRED");
assert.throws(() => assertTransportObservability({ ...enabled, browser_layout_verified: false }), (error) => error.code === "BROWSER_LAYOUT_NOT_VERIFIED");
assert.throws(() => assertTransportObservability({ ...enabled, automatic_retries: 1 }), (error) => error.code === "RETRY_POLICY_INVALID");

const evidence = buildRequestEvidence({
  run_id: "RUN-1",
  batch_id: "BATCH-1",
  output_identity: "carousel-04",
  request_body: { html: "<p>synthetic</p>", viewport_width: 1080, viewport_height: 1350 },
});
assert.match(evidence.request_sha256, /^[a-f0-9]{64}$/);
assert.equal(evidence.attempt_count, 1);
assert.equal(evidence.retry_count, 0);
assert.equal("request_body" in evidence, false);

const success = normalizeTransportOutcome({ statusCode: 200, body: { id: "render-1", url: "https://hcti.io/v1/image/render-1" } }, evidence);
assert.equal(success.outcome, "SUCCESS");
assert.equal(success.provider_receipt, "proven");
assert.equal(normalizeTransportOutcome({ statusCode: 413, body: {} }, evidence).outcome, "KNOWN_FAILURE");
assert.equal(normalizeTransportOutcome({ statusCode: 500, body: {} }, evidence).outcome, "OUTCOME_UNKNOWN");
assert.equal(normalizeTransportOutcome({ statusCode: 200, body: {} }, evidence).error_class, "MALFORMED_PROVIDER_RESPONSE");
assert.equal(normalizeTransportOutcome({ message: "socket interrupted" }, evidence).outcome, "OUTCOME_UNKNOWN");

assert.equal(classifyRenderVerification(success, { retrieval_status: "failed" }).terminal_state, "rendered_download_verification_failed");
assert.equal(classifyRenderVerification(success, { retrieval_status: "verified", visual_qa_status: "failed" }).terminal_state, "rendered_visual_qa_failed");
assert.equal(classifyRenderVerification(success, { retrieval_status: "verified", visual_qa_status: "pending_human_review" }).terminal_state, "rendered_pending_visual_qa");

const sanitized = sanitizeObservabilityEvidence({
  request_sha256: evidence.request_sha256,
  html: "<private>",
  request_body: { data_uri: "private" },
  response_body: { token: "private" },
});
assert.deepEqual(Object.keys(sanitized), ["request_sha256"]);
console.log("HCTI render observability tests: 18 passed");
