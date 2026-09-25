import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

export function normalizeWorkflow(w) {
  const sort = v => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v;
  return sort({ name: w.name, active: w.active, settings: w.settings, tags: w.tags.map(t => typeof t === 'string' ? t : t.name).sort(), connections: w.connections,
    nodes: w.nodes.map(n => ({ name: n.name, type: n.type, typeVersion: n.typeVersion, parameters: n.parameters, disabled: !!n.disabled, retryOnFail: !!n.retryOnFail, executeOnce: !!n.executeOnce, alwaysOutputData: !!n.alwaysOutputData, onError: n.onError || null, maxTries: n.maxTries || null })).sort((a, b) => a.name.localeCompare(b.name)) });
}
export function workflowFingerprint(w) { return crypto.createHash('sha256').update(JSON.stringify(normalizeWorkflow(w))).digest('hex'); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
  const parent = read('../../n8n/workflows/INT-AUT-015-content-production-orchestrator-dev.workflow.json');
  const hcti = read('../../n8n/workflows/INT-HCTI-editorial-render-bridge-dev.workflow.json');
  const dist = read('../../n8n/workflows/INT-AUT-014-distribution-executor-dev.workflow.json');
  const source = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8').trimEnd().replace(/^import .*\r?\n/gm, '').replace(/^export /gm, '');
  for (const w of [parent, hcti, dist]) { assert.equal(w.active, false); assert.ok(w.tags.some(t => (t.name || t) === 'project:intrst')); assert.ok(!w.nodes.some(n => /scheduleTrigger|webhook|\.wait$/.test(n.type))); }
  assert.ok(!parent.nodes.some(n => /httpRequest|blotato/.test(n.type)));
  assert.deepEqual(parent.nodes.filter(n => n.type === 'n8n-nodes-base.executeWorkflow').map(n => n.parameters.workflowId.value), ['XHjJBrSOoBaFrHYk', 'AknakVMx2prJrsZw']);
  for (const child of [hcti, dist]) { assert.equal(child.settings.callerPolicy, 'workflowsFromAList'); assert.equal(child.settings.callerIds, '07pRK9XWNiRXHWN9'); }
  assert.ok(parent.nodes.find(n => n.name === 'Validate Production Package').parameters.jsCode.includes(source('./content-production.mjs')));
  assert.ok(hcti.nodes.find(n => n.name === 'Verify Reuse Contract').parameters.jsCode.includes(source('../hcti/reuse-approved.mjs')));
  assert.ok(dist.nodes.find(n => n.name === 'Render platform-native payload').parameters.jsCode.includes(source('../distribution/media-preflight.mjs')));
  const gate = dist.nodes.find(n => n.name === 'Credential and account binding gate').parameters.jsCode;
  assert.match(gate, /external_call:false/);
  for (const w of [parent, hcti, dist]) console.log(w.name + ': sha256:' + workflowFingerprint(w));
  console.log('Content production contracts, source parity and inactive zero-call graph valid');
}
