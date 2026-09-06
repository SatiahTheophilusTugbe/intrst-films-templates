import { normalizePublisherResult } from "./platform-renderer.mjs";
import { DISTRIBUTION_CREDENTIALS, DISTRIBUTION_ACCOUNT_CONFIG, isPlaceholder } from "./distribution-config.mjs";

export const BLOTATO_HTTP_CREDENTIAL = Object.freeze({ ...DISTRIBUTION_CREDENTIALS.http, api_key: "__SET_IN_N8N__" });
export const BLOTATO_NATIVE_CREDENTIAL = Object.freeze({ ...DISTRIBUTION_CREDENTIALS.native });

export const BLOTATO_ACCOUNT_PLACEHOLDERS = Object.freeze({ ...DISTRIBUTION_ACCOUNT_CONFIG });

function validateBase({ credential, account_id, expected_credential_type }) {
  const expectedName = expected_credential_type === BLOTATO_NATIVE_CREDENTIAL.credential_type ? BLOTATO_NATIVE_CREDENTIAL.logical_name : BLOTATO_HTTP_CREDENTIAL.logical_name;
  if (!credential || credential.logical_name !== expectedName || credential.credential_type !== expected_credential_type || (expected_credential_type !== BLOTATO_NATIVE_CREDENTIAL.credential_type && isPlaceholder(credential.api_key))) throw new Error("CREDENTIAL_FAILURE");
  if (isPlaceholder(account_id)) throw new Error("ACCOUNT_ROUTING_MISSING");
  return true;
}

export function createBlotatoHttpAdapter({ transport }) {
  return {
    name: "blotato-http",
    adapter_mode: "http",
    validateConfig: async (config) => validateBase({ ...config, expected_credential_type: BLOTATO_HTTP_CREDENTIAL.credential_type }),
    submit: async (payload, idempotencyKey) => transport({ ...payload, idempotency_key: idempotencyKey, automatic_retries: 0 }),
    normalizeResult: (result, context) => normalizePublisherResult(result, context),
    normalizeError: (error) => ({ error_class: error?.error_class ?? "PUBLISH_FAILURE", retry_count: 0 }),
  };
}

export function createBlotatoNativeAdapter({ transport }) {
  return {
    name: "blotato-native",
    adapter_mode: "native",
    validateConfig: async (config) => validateBase({ ...config, expected_credential_type: BLOTATO_NATIVE_CREDENTIAL.credential_type }),
    submit: async (payload, idempotencyKey) => transport({ ...payload, idempotency_key: idempotencyKey, automatic_retries: 0 }),
    normalizeResult: (result, context) => normalizePublisherResult(result, context),
    normalizeError: (error) => ({ error_class: error?.error_class ?? "PUBLISH_FAILURE", retry_count: 0 }),
  };
}
