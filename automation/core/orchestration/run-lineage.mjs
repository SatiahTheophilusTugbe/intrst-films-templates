export function executionRunId(executionId, ordinal = 0) {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const encode = (number, width) => {
    let n = BigInt(number), text = '';
    for (let i = 0; i < width; i++) { text = alphabet[Number(n & 31n)] + text; n >>= 5n; }
    if (n !== 0n) throw new Error('RUN_ID_OVERFLOW');
    return text;
  };
  if (!/^\d+$/.test(String(executionId))) throw new Error('EXECUTION_ID_REQUIRED');
  return 'INT-RUN-' + encode(Date.now(), 10) + encode(BigInt(executionId) * 100n + BigInt(ordinal), 16);
}
export function lineageRow({ runId, rootRunId, parentRunId = '', workflowId, executionId, workflowKey, version, request, status, details, startedAt }) {
  const now = new Date().toISOString();
  return { run_id: runId, root_run_id: rootRunId || runId, parent_run_id: parentRunId, workflow_key: workflowKey, workflow_name: workflowKey, workflow_version: version, module: workflowKey === 'INT-AUT-015' ? 'orchestration' : workflowKey === 'INT-AUT-014' ? 'distribution' : 'render', environment: 'development', n8n_workflow_id: workflowId, n8n_execution_id: String(executionId), subject_id: details.subject_id || '', story_object_id: request.story_object_id, manifest_id: details.manifest_id || '', output_id: request.content_output_id || '', started_at: startedAt || now, completed_at: now, status, state_from: 'REQUEST_VALIDATED', state_to: status, attempt: 1, provider: '', input_ids_json: JSON.stringify([request.content_package_id, request.story_object_id].filter(Boolean)), output_ids_json: JSON.stringify(details.output_ids || [request.content_output_id].filter(Boolean)), source_ids_json: JSON.stringify(details.render_ids || []), claim_ids_json: '[]', asset_ids_json: JSON.stringify(details.asset_ids || []), human_review_required: true, review_status: 'visual_approved_later_gates_pending', error_class: '', error_message: JSON.stringify({ ...details, content_package_id: request.content_package_id, selected_format: request.requested_format || 'package', execution_count: 1, provider_call_count: 0, publication_call_count: 0, comment_call_count: 0, retry_count: 0, next_action_at: null, terminal_or_resume_state: status }), estimated_cost: 0, idempotency_key: 'run:' + runId + ':terminal', created_at: now, updated_at: now };
}
