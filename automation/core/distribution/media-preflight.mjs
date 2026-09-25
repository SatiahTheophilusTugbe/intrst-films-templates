import { validateOrderedMedia, platformMediaEligibility } from './ordered-media.mjs';

export const PREFLIGHT_VERSION = 'distribution-preflight@1.0.0';
export function preflightMedia({ request, output, assets, approvals, platform, accountId }) {
  if (request.contract_version !== PREFLIGHT_VERSION || request.distribution_mode !== 'preflight_only' || request.transport_disabled !== true) throw new Error('PREFLIGHT_CONTRACT_REQUIRED');
  for (const key of ['maximum_renders', 'maximum_publications', 'maximum_comment_mutations', 'automatic_retries']) {
    if (request.budget?.[key] !== 0) throw new Error('ZERO_CALL_BUDGET_REQUIRED');
  }
  const manifest = JSON.parse(output.manifest_json);
  if (output.output_id !== request.content_output_id || output.story_object_id !== request.story_object_id || manifest.content_package_id !== request.content_package_id || manifest.media_set?.format !== request.requested_format) throw new Error('PACKAGE_IDENTITY_MISMATCH');
  if (assets.some(a => a.story_object_id !== output.story_object_id || a.identity_subject_id !== output.subject_id)) throw new Error('ASSET_SUBJECT_MISMATCH');
  const review = approvals.filter(a => a.review_id === manifest.approval_record_id && a.entity_id === output.output_id && a.review_type === 'visual_only' && a.status === 'approved' && a.decision === 'VISUAL_APPROVED');
  if (review.length !== 1 || !review[0].decision_actor || !review[0].reviewed_at) throw new Error('CANONICAL_VISUAL_APPROVAL_REQUIRED');
  for (const item of manifest.media_set.items) {
    if (item.visual_approval?.review_id !== review[0].review_id || item.visual_approval.actor !== review[0].decision_actor || item.visual_approval.date !== review[0].reviewed_at.slice(0, 10)) throw new Error('VISUAL_APPROVAL_LINEAGE_MISMATCH');
  }
  const media = validateOrderedMedia({ assetIds: JSON.parse(output.asset_ids_json), mediaSet: manifest.media_set, assets, requireRights: false });
  const eligibility = platformMediaEligibility(platform, media);
  const pending = [];
  if (output.editorial_approval !== true) pending.push('EDITORIAL_APPROVAL_REQUIRED');
  if (output.rights_clearance !== true || assets.some(a => a.rights_status !== 'publishable')) pending.push('RIGHTS_CLEARANCE_REQUIRED');
  if (output.publish_clearance !== true) pending.push('PUBLICATION_APPROVAL_REQUIRED');
  pending.push('ATOMIC_POSTGRES_CLAIM_UNPROVEN', 'FRESH_DELIVERY_VERIFICATION_REQUIRED');
  return { contract_version: PREFLIGHT_VERSION, content_package_id: request.content_package_id, content_output_id: output.output_id, output_version: output.version, story_object_id: output.story_object_id, subject_id: output.subject_id, requested_format: media.format, platform, account_id: accountId, media_set: media, media_urls: media.media_urls, approval_record_id: review[0].review_id, media_eligibility: eligibility, approval_eligible: pending.length === 0, pending_gates: pending, transport_disabled: true, external_call: false, automatic_retries: 0, provider_call_count: 0, publication_call_count: 0, comment_call_count: 0, cache_hit_count: media.items.length, next_action_at: null, atomic_claim_binding: { status: 'unresolved', guarantee: false }, render_ids: media.items.map(i => i.render_id), hashes: media.items.map(i => i.sha256) };
}
