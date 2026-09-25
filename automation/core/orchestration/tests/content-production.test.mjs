import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionRequests, resolveProductionOutputs } from '../content-production.mjs';
import { executionRunId } from '../run-lineage.mjs';
import { isCanonicalId } from '../../ids/ids.mjs';
import { reuseApproved } from '../../hcti/reuse-approved.mjs';
import { preflightMedia } from '../../distribution/media-preflight.mjs';

const formats = ['single_image', 'carousel', 'archive', 'evidence'];
function fixture(format) {
  const count = format === 'carousel' ? 7 : 1;
  const request = { contract_version: 'content-production@1.0.0', content_package_id: 'synthetic-package', story_object_id: 'synthetic-story', requested_format: format, render_policy: 'reuse_approved_only', distribution_mode: 'preflight_only', approval_context: { editorial: false, rights: false, visual: true, publication: false }, budget: { maximum_renders: 0, maximum_publications: 0, maximum_comment_mutations: 0, automatic_retries: 0 } };
  const items = Array.from({ length: count }, (_, i) => { const sha256 = String(i + 1).padStart(64, '0'), url = `https://example.com/${i}.png`; return { order: i + 1, asset_id: 'asset-' + i, render_id: 'render-' + i, delivery_url: url, mime_type: 'image/png', width: 1080, height: 1350, sha256, verification: { run_id: 'historical-render', sha256, width: 1080, height: 1350, mime_type: 'image/png' }, visual_approval: { review_id: 'review', actor: 'project owner', date: '2026-09-18', status: 'VISUAL_APPROVED' }, delivery_verification: { url, sha256, provider_accessible: true, checked_at: '2026-09-18' } }; });
  const output = { output_id: 'output-' + format, subject_id: 'subject', story_object_id: request.story_object_id, status: 'VISUAL_APPROVED', version: '1.0.0', editorial_approval: false, rights_clearance: false, publish_clearance: false, asset_ids_json: JSON.stringify(items.map(i => i.asset_id)), manifest_json: JSON.stringify({ content_package_id: request.content_package_id, media_set: { format, items }, approval_record_id: 'review' }) };
  const assets = items.map(i => ({ asset_id: i.asset_id, file_hash: i.sha256, mime_type: i.mime_type, identity_status: 'verified', identity_subject_id: 'subject', story_object_id: request.story_object_id, technical_status: 'technically_verified', rights_status: 'pending', drive_url: 'https://drive.example/test' }));
  const approvals = [{ review_id: 'review', entity_id: output.output_id, review_type: 'visual_only', status: 'approved', decision: 'VISUAL_APPROVED', decision_actor: 'project owner', reviewed_at: '2026-09-18T00:00:00Z' }];
  return { request, output, assets, approvals };
}
for (const format of formats) test(`${format}: reuse and preflight retain media and later approval gates`, () => {
  const f = fixture(format), [r] = resolveProductionOutputs([f.request], [f.output]);
  const reused = reuseApproved(r, [f.output]);
  const result = preflightMedia({ ...f, request: reused, platform: 'instagram', accountId: 'test' });
  assert.equal(result.media_urls.length, format === 'carousel' ? 7 : 1);
  assert.equal(result.media_eligibility.eligible, true);
  assert.equal(result.external_call, false);
  assert.equal(result.publication_call_count, 0);
  assert.equal(result.atomic_claim_binding.guarantee, false);
  assert.ok(result.pending_gates.includes('RIGHTS_CLEARANCE_REQUIRED'));
  assert.ok(result.pending_gates.includes('PUBLICATION_APPROVAL_REQUIRED'));
});
test('all four formats resolve once and preserve carousel identity', () => {
  const f = formats.map(fixture), resolved = resolveProductionOutputs(f.map(x => x.request), f.map(x => x.output));
  assert.deepEqual(resolved.map(r => r.requested_format), formats);
  assert.throws(() => resolveProductionOutputs(f.map(x => x.request), [f[0].output]), /MISSING_OR_AMBIGUOUS/);
});
test('caller assertions cannot substitute for canonical visual approval', () => {
  const f = fixture('carousel'), [request] = resolveProductionOutputs([f.request], [f.output]);
  request.approval_context.publication = true;
  assert.throws(() => preflightMedia({ ...f, request, approvals: [], platform: 'instagram' }), /CANONICAL_VISUAL/);
  const result = preflightMedia({ ...f, request, platform: 'instagram' });
  assert.ok(result.pending_gates.includes('PUBLICATION_APPROVAL_REQUIRED'));
});
test('positive budgets, retries, render_missing and controlled_publish fail closed', () => {
  for (const key of Object.keys(fixture('single_image').request.budget)) { const f = fixture('single_image'); f.request.budget[key] = 1; assert.throws(() => validateProductionRequests([f.request]), /ZERO_CALL/); }
  for (const [key, value] of [['render_policy', 'render_missing'], ['distribution_mode', 'controlled_publish']]) { const f = fixture('single_image'); f.request[key] = value; assert.throws(() => validateProductionRequests([f.request]), /LIVE_PRODUCTION_BLOCKED/); }
});
test('execution-derived run IDs are canonical and distinct', () => {
  const a = executionRunId('12345', 1), b = executionRunId('12345', 2);
  assert.ok(isCanonicalId(a, 'run')); assert.notEqual(a, b);
});
