export const REUSE_VERSION = 'hcti-reuse@1.0.0';
export function reuseApproved(request, rows) {
  if (request.render_contract_version !== REUSE_VERSION || request.render_policy !== 'reuse_approved_only' || request.budget?.maximum_renders !== 0) throw new Error('RENDER_REUSE_ONLY');
  if (rows.length !== 1) throw new Error('OUTPUT_IDENTITY_AMBIGUOUS');
  const output = rows[0], manifest = JSON.parse(output.manifest_json);
  if (output.output_id !== request.content_output_id || output.story_object_id !== request.story_object_id || manifest.content_package_id !== request.content_package_id || manifest.media_set?.format !== request.requested_format || output.status !== 'VISUAL_APPROVED') throw new Error('APPROVED_RENDER_NOT_FOUND');
  const ids = JSON.parse(output.asset_ids_json);
  if (ids.length !== manifest.media_set.items.length || manifest.media_set.items.some((i, n) => i.order !== n + 1 || i.asset_id !== ids[n] || !i.render_id || !i.verification?.run_id || !i.visual_approval?.review_id)) throw new Error('RENDER_LINEAGE_INVALID');
  return { ...request, render_reuse: { contract_version: REUSE_VERSION, status: 'REUSED_APPROVED', asset_ids: ids, render_ids: manifest.media_set.items.map(i => i.render_id), hashes: manifest.media_set.items.map(i => i.sha256), approval_record_id: manifest.approval_record_id, provider_call_count: 0, render_call_count: 0, cache_hit_count: ids.length, retry_count: 0 } };
}
