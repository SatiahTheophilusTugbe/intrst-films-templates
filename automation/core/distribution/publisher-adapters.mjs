import { normalizePublisherResult } from "./platform-renderer.mjs";

export const BLOTATO_HTTP_CREDENTIAL = Object.freeze({
  logical_name: "INT | Blotato | Development | Distribution",
  credential_type: "blotatoApi",
  api_key: "__SET_IN_N8N__",
});

export const BLOTATO_ACCOUNT_PLACEHOLDERS = Object.freeze({
  facebook: "__FACEBOOK_BLOTATO_ACCOUNT_ID__",
  instagram: "__INSTAGRAM_BLOTATO_ACCOUNT_ID__",
  threads: "__THREADS_BLOTATO_ACCOUNT_ID__",
  youtube: "__YOUTUBE_BLOTATO_ACCOUNT_ID__",
  x: "__X_BLOTATO_ACCOUNT_ID__",
  tiktok: "__TIKTOK_BLOTATO_ACCOUNT_ID__",
  linkedin: "__LINKEDIN_BLOTATO_ACCOUNT_ID__",
});

function validateBase({ credential, account_id }) {
  if (!credential || credential.logical_name !== BLOTATO_HTTP_CREDENTIAL.logical_name || credential.credential_type !== BLOTATO_HTTP_CREDENTIAL.credential_type || !credential.api_key || String(credential.api_key).startsWith("__")) throw new Error("CREDENTIAL_FAILURE");
  if (!account_id || String(account_id).startsWith("__")) throw new Error("ACCOUNT_ROUTING_MISSING");
  return true;
}

export function createBlotatoHttpAdapter({ transport }) {
  return {
    name: "blotato-http",
    adapter_mode: "http",
    validateConfig: async (config) => validateBase(config),
    submit: async (payload, idempotencyKey) => transport({ ...payload, idempotency_key: idempotencyKey, automatic_retries: 0 }),
    normalizeResult: (result, context) => normalizePublisherResult(result, context),
    normalizeError: (error) => ({ error_class: error?.error_class ?? "PUBLISH_FAILURE", retry_count: 0 }),
  };
}

export function createBlotatoNativeAdapter({ transport }) {
  return {
    name: "blotato-native",
    adapter_mode: "native",
    validateConfig: async (config) => validateBase(config),
    submit: async (payload, idempotencyKey) => transport({ ...payload, idempotency_key: idempotencyKey, automatic_retries: 0 }),
    normalizeResult: (result, context) => normalizePublisherResult(result, context),
    normalizeError: (error) => ({ error_class: error?.error_class ?? "PUBLISH_FAILURE", retry_count: 0 }),
  };
}
