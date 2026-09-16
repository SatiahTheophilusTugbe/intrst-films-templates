import crypto from "node:crypto";

const fail = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
};

export const HCTI_OBSERVABILITY_VERSION = "hcti-observability@1.0.0";

export function normalizeHctiImageUrl(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "hcti.io" || !url.pathname.startsWith("/v1/image/")) return null;
    return value;
  } catch {
    return null;
  }
}

export function verifyDownloadedRender({ bytes, content_type, expected_width = 1080, expected_height = 1350 }) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24) fail("RENDER_BYTES_INVALID", "Downloaded render bytes are missing or truncated.");
  const normalizedType = typeof content_type === "string" ? content_type.split(";", 1)[0].trim().toLowerCase() : null;
  const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (normalizedType !== "image/png" || !isPng) {
    fail("RENDER_MIME_INVALID", "Downloaded render Content-Type and decoded format must both be image/png.", { content_type: normalizedType, decoded_format: isPng ? "image/png" : "unknown" });
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== expected_width || height !== expected_height) {
    fail("RENDER_GEOMETRY_INVALID", "Downloaded render dimensions do not match the requested viewport.", { expected_width, expected_height, width, height });
  }
  return {
    output_mime: "image/png",
    output_width: width,
    output_height: height,
    output_bytes: bytes.length,
    output_sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

export function assertTransportObservability({
  transport_enabled,
  terminal_postflight_enabled,
  provider_call_budget,
  automatic_retries,
  browser_layout_verified,
}) {
  if (automatic_retries !== 0) fail("RETRY_POLICY_INVALID", "HCTI automatic retries must remain zero.");
  if (!Number.isSafeInteger(provider_call_budget) || provider_call_budget < 0 || provider_call_budget > 1) {
    fail("EXECUTION_BUDGET_INVALID", "HCTI provider-call budget must be zero or one.");
  }
  if (transport_enabled && terminal_postflight_enabled !== true) {
    fail("TERMINAL_POSTFLIGHT_REQUIRED", "HCTI transport cannot run without terminal postflight persistence.");
  }
  if (transport_enabled && browser_layout_verified !== true) {
    fail("BROWSER_LAYOUT_NOT_VERIFIED", "HCTI transport cannot run before browser image-paint verification.");
  }
  return true;
}

export function buildRequestEvidence({ run_id, batch_id, output_identity, request_body, endpoint = "https://hcti.io/v1/image" }) {
  if (!run_id || !batch_id || !output_identity || !request_body) fail("REQUEST_EVIDENCE_INVALID", "Complete request identity is required.");
  const bytes = Buffer.from(JSON.stringify(request_body), "utf8");
  const request_sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  return {
    run_id,
    batch_id,
    output_identity,
    endpoint,
    request_sha256,
    request_bytes: bytes.length,
    attempt_count: 1,
    retry_count: 0,
    raw_request_persisted: false,
    encoded_payload_persisted: false,
    idempotency_key: `hcti:${batch_id}:${output_identity}:${request_sha256}`,
  };
}

export function normalizeTransportOutcome(raw, requestEvidence) {
  const status = Number(raw?.statusCode ?? raw?.status ?? 0) || null;
  const body = raw?.body ?? raw;
  const render_id = typeof body?.id === "string" && body.id ? body.id : null;
  const image_url = normalizeHctiImageUrl(body?.url);
  const accepted = status !== null && status >= 200 && status < 300;
  const complete = accepted && render_id !== null && image_url !== null;
  const knownRejection = status !== null && status >= 400 && status < 500;
  const outcome = complete ? "SUCCESS" : knownRejection ? "KNOWN_FAILURE" : "OUTCOME_UNKNOWN";
  const error_class = complete
    ? null
    : accepted
      ? "MALFORMED_PROVIDER_RESPONSE"
      : status === 413
        ? "REQUEST_TOO_LARGE"
        : knownRejection
          ? "PROVIDER_REJECTED"
          : status !== null && status >= 500
            ? "AMBIGUOUS_PROVIDER_5XX"
            : "TRANSPORT_OUTCOME_UNKNOWN";
  return {
    ...requestEvidence,
    http_status: status,
    render_id,
    image_url,
    provider_receipt: complete ? "proven" : knownRejection ? "rejected" : "unknown",
    outcome,
    error_class,
    provider_calls: 1,
    transport_attempts: 1,
    retry_count: 0,
    raw_response_persisted: false,
  };
}

export function classifyRenderVerification(transport, verification = {}) {
  if (transport.outcome !== "SUCCESS") return transport;
  if (verification.retrieval_status !== "verified") {
    return { ...transport, ...verification, terminal_state: "rendered_download_verification_failed", review_status: "manual_reconciliation_required" };
  }
  if (verification.visual_qa_status === "failed") {
    return { ...transport, ...verification, terminal_state: "rendered_visual_qa_failed", review_status: "changes_required" };
  }
  return { ...transport, ...verification, terminal_state: "rendered_pending_visual_qa", review_status: "pending" };
}

export function sanitizeObservabilityEvidence(value) {
  const prohibited = /(?:credential|authorization|header|request_body|response_body|raw_payload|html|data_uri|base64)/i;
  const walk = (input) => {
    if (Array.isArray(input)) return input.map(walk);
    if (!input || typeof input !== "object") return input;
    const output = {};
    for (const [key, item] of Object.entries(input)) {
      if (prohibited.test(key)) continue;
      output[key] = walk(item);
    }
    return output;
  };
  return walk(value);
}
