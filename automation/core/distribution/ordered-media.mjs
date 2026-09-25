// Pure, transport-free boundary. This exact source is embedded in the n8n candidate.
export const ORDERED_MEDIA_VERSION = "ordered-media@1.0.0";

export function mediaError(code) { throw Object.assign(new Error(code), { code }); }

export function validateOrderedMedia({ assetIds, mediaSet, assets, requireRights = true }) {
  if (!Array.isArray(assetIds) || !assetIds.length) mediaError("MISSING_ASSET");
  if (new Set(assetIds).size !== assetIds.length) mediaError("DUPLICATE_ASSET");
  if (!mediaSet || !["single_image", "carousel", "archive", "evidence"].includes(mediaSet.format)) mediaError("MEDIA_SET_REQUIRED");
  const items = mediaSet.items;
  if (!Array.isArray(items) || items.length !== assetIds.length || !Array.isArray(assets) || assets.length !== items.length) mediaError("MEDIA_SET_INCOMPLETE");
  if (mediaSet.format === "carousel" ? items.length < 2 : items.length !== 1) mediaError("MEDIA_COUNT_INVALID");
  const seenHashes = new Set();
  for (let i = 0; i < items.length; i++) {
    const item = items[i], asset = assets[i];
    if (!asset || item.order !== i + 1 || item.asset_id !== assetIds[i] || asset.asset_id !== assetIds[i]) mediaError("MEDIA_ORDER_OR_IDENTITY_MISMATCH");
    if (asset.identity_status !== "verified" || !asset.drive_url || !["acquired_original_file", "technically_verified"].includes(asset.technical_status)) mediaError("ASSET_VERIFICATION_REQUIRED");
    if (requireRights && asset.rights_status !== "publishable") mediaError("RIGHTS_BLOCK");
    if (!Number.isInteger(item.width) || item.width <= 0 || !Number.isInteger(item.height) || item.height <= 0 || !["image/png", "image/jpeg", "image/webp"].includes(item.mime_type)) mediaError("MEDIA_TECHNICAL_INVALID");
    if (!/^[a-f0-9]{64}$/.test(item.sha256 ?? "") || (asset.file_hash ?? asset.sha256) !== item.sha256) mediaError("MEDIA_HASH_MISMATCH");
    if (seenHashes.has(item.sha256)) mediaError("DUPLICATE_MEDIA_BYTES");
    seenHashes.add(item.sha256);
    if (asset.mime_type !== item.mime_type) mediaError("MEDIA_MIME_MISMATCH");
    // Existing tables have no dimension columns: render verification lives in the
    // versioned manifest, tied to registry identity/hash and approval lineage.
    const proof = item.verification;
    if (!proof || proof.sha256 !== item.sha256 || proof.width !== item.width || proof.height !== item.height || proof.mime_type !== item.mime_type || !proof.run_id) mediaError("MEDIA_PROOF_REQUIRED");
    if (!item.visual_approval?.actor || !item.visual_approval?.date || item.visual_approval.status !== "VISUAL_APPROVED") mediaError("VISUAL_APPROVAL_REQUIRED");
    if (typeof item.delivery_url !== 'string' || !item.delivery_url) mediaError("DELIVERY_URL_REQUIRED");
    // n8n's isolated Code runtime does not expose the URL global. Validate a
    // conservative HTTPS DNS authority without credentials or backslashes.
    if (!/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?(?:[/?#][^\s\\]*)?$/i.test(item.delivery_url)) mediaError("DELIVERY_URL_INVALID");
    const delivery = item.delivery_verification;
    if (!delivery || delivery.url !== item.delivery_url || delivery.sha256 !== item.sha256 || delivery.provider_accessible !== true || !delivery.checked_at) mediaError("DELIVERY_UNVERIFIED");
  }
  return { format: mediaSet.format, items: items.map(item => ({ ...item })), media_urls: items.map(item => item.delivery_url), asset_ids: [...assetIds] };
}

// Limits verified 2026-09-18 against Blotato's published adapter requirements.
// Unknown limits are deliberately not inferred from platform consumer UIs.
export function platformMediaEligibility(platform, mediaSet) {
  const items = mediaSet.items;
  const count = items.length;
  const limits = { instagram: 10, x: 4, threads: 1, youtube: 0, facebook: null, tiktok: null };
  if (!(platform in limits)) return { eligible: false, reason: "PLATFORM_UNSUPPORTED" };
  if (platform === "youtube") return { eligible: false, reason: "IMAGE_POST_UNSUPPORTED", maximum_items: 0 };
  if (platform === "tiktok" && items.some(x => !["image/jpeg", "image/webp"].includes(x.mime_type))) return { eligible: false, reason: "PLATFORM_MIME_INCOMPATIBLE", maximum_items: null };
  if (limits[platform] === null && count > 1) return { eligible: false, reason: "ADAPTER_MEDIA_LIMIT_UNVERIFIED", maximum_items: null };
  if (limits[platform] !== null && count > limits[platform]) return { eligible: false, reason: "PLATFORM_MEDIA_COUNT_INCOMPATIBLE", maximum_items: limits[platform] };
  if (platform === "instagram" && items.some(x => !["image/png", "image/jpeg"].includes(x.mime_type) || x.width / x.height < .8 || x.width / x.height > 1.91)) return { eligible: false, reason: "PLATFORM_GEOMETRY_OR_MIME_INCOMPATIBLE", maximum_items: 10 };
  return { eligible: true, reason: "MEDIA_FORMAT_ELIGIBLE_APPROVALS_STILL_REQUIRED", maximum_items: limits[platform] };
}
