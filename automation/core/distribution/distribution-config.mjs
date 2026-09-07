export const DISTRIBUTION_CREDENTIALS = Object.freeze({
  http: Object.freeze({
    logical_name: "INT | Blotato | Development | Distribution",
    credential_type: "httpHeaderAuth",
    secret_field: "api_key",
    provider_header: "blotato-api-key",
  }),
  native: Object.freeze({
    logical_name: "INT | Blotato Native | Development | Distribution",
    credential_type: "blotatoApi",
  }),
});

export const DISTRIBUTION_ACCOUNT_CONFIG = Object.freeze({
  facebook: "__FACEBOOK_BLOTATO_ACCOUNT_ID__",
  instagram: "__INSTAGRAM_BLOTATO_ACCOUNT_ID__",
  threads: "__THREADS_BLOTATO_ACCOUNT_ID__",
  youtube: "__YOUTUBE_BLOTATO_ACCOUNT_ID__",
  x: "__X_BLOTATO_ACCOUNT_ID__",
  tiktok: "__TIKTOK_BLOTATO_ACCOUNT_ID__",
});

export function resolveDistributionConfig(platform, overrides = {}) {
  const account_id = overrides.account_id ?? DISTRIBUTION_ACCOUNT_CONFIG[platform];
  const adapter_mode = ["facebook", "instagram", "tiktok"].includes(platform) ? "http" : "native";
  const credential = DISTRIBUTION_CREDENTIALS[adapter_mode];
  return { platform, account_id, adapter_mode, credential: { ...credential } };
}

export function isPlaceholder(value) {
  return typeof value !== "string" || value.length === 0 || value.startsWith("__");
}
