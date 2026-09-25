export const PRODUCTION_VERSION = 'content-production@1.0.0';
export function validateProductionRequests(requests) {
  if (!Array.isArray(requests) || requests.length < 1 || requests.length > 4) throw new Error('REQUEST_COUNT_INVALID');
  const formats = new Set();
  for (const r of requests) {
    if (r.contract_version !== PRODUCTION_VERSION || !r.content_package_id || !r.story_object_id || !['single_image', 'carousel', 'archive', 'evidence'].includes(r.requested_format)) throw new Error('PRODUCTION_CONTRACT_INVALID');
    if (formats.has(r.requested_format)) throw new Error('DUPLICATE_FORMAT');
    formats.add(r.requested_format);
    if (r.content_package_id !== requests[0].content_package_id || r.story_object_id !== requests[0].story_object_id) throw new Error('MIXED_PACKAGE');
    if (r.render_policy !== 'reuse_approved_only' || r.distribution_mode !== 'preflight_only') throw new Error('LIVE_PRODUCTION_BLOCKED');
    if (!r.approval_context || r.approval_context.visual !== true || ['editorial', 'rights', 'publication'].some(k => typeof r.approval_context[k] !== 'boolean')) throw new Error('APPROVAL_CONTEXT_INVALID');
    for (const key of ['maximum_renders', 'maximum_publications', 'maximum_comment_mutations', 'automatic_retries']) if (r.budget?.[key] !== 0) throw new Error('ZERO_CALL_BUDGET_REQUIRED');
  }
  return requests;
}
export function resolveProductionOutputs(requests, outputs) {
  validateProductionRequests(requests);
  return requests.map(r => {
    const matches = outputs.filter(o => {
      const m = JSON.parse(o.manifest_json || '{}');
      return m.content_package_id === r.content_package_id && m.media_set?.format === r.requested_format && o.story_object_id === r.story_object_id;
    });
    if (matches.length !== 1) throw new Error('FORMAT_OUTPUT_MISSING_OR_AMBIGUOUS');
    return { ...r, contract_version: 'distribution-preflight@1.0.0', render_contract_version: 'hcti-reuse@1.0.0', content_output_id: matches[0].output_id, transport_disabled: true };
  });
}
