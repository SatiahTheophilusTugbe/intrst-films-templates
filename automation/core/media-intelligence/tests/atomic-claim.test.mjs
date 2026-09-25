import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATOMIC_CLAIM_SQL,
  ATOMIC_CLAIM_CREDENTIAL_REF,
  createPostgresAtomicClaimBinding,
  createPostgresPublicationClaimBinding,
  publicationClaimIdentity
} from "../atomic-claim.mjs";

const valid = {
  operation_key: "transcript-operation:v1:fixture",
  run_id: "INT-RUN-FIXTURE",
  subject_id: "INT-SUB-FIXTURE",
  provider: "transcriptapi",
  task: "transcript_retrieval",
  requested_at: "2026-09-05T20:00:00Z",
  idempotency_key: "transcript-attempt:v1:fixture"
};

test("SQL uses one-statement insert-on-conflict atomic primitive", () => {
  assert.match(ATOMIC_CLAIM_SQL, /ON CONFLICT \(operation_key\) DO NOTHING/);
  assert.match(ATOMIC_CLAIM_SQL, /THEN 'CLAIMED' ELSE 'ALREADY_CLAIMED'/);
});

const publication = {
  output_id: 'SYNTHETIC-OUTPUT', platform: 'instagram', account_id: 'SYNTHETIC-ACCOUNT',
  instruction_version: 'v1', root_run_id: 'SYNTHETIC-ROOT', attempt_id: 'SYNTHETIC-ATTEMPT',
  media_set: { format: 'carousel', items: [
    { order: 1, asset_id: 'SYNTHETIC-A', sha256: 'a'.repeat(64) },
    { order: 2, asset_id: 'SYNTHETIC-B', sha256: 'b'.repeat(64) }
  ] }
};
function evidence(status = 'CLAIMED') {
  const state = status === 'PRIOR_SUCCESS' ? 'published' : status === 'PRIOR_OUTCOME_UNKNOWN' ? 'outcome_unknown' : 'claimed';
  return { ...publication, ...publicationClaimIdentity(publication), operation_type: 'publication', status,
    claim_status: state, terminal_outcome: state === 'claimed' ? null : state,
    reconciliation_state: state === 'published' ? 'resolved' : state === 'outcome_unknown' ? 'required' : 'not_required',
    claimed_at: '2026-09-25T12:00:00Z', created_at: '2026-09-25T12:00:00Z', updated_at: '2026-09-25T12:00:00Z' };
}

test('publication identity separates accounts, platforms, versions, bytes and ordered sets', () => {
  const base = publicationClaimIdentity(publication);
  assert.equal(base.idempotency_key, 'publish:SYNTHETIC-OUTPUT:instagram:SYNTHETIC-ACCOUNT:v1');
  for (const patch of [{ account_id: 'OTHER' }, { platform: 'facebook' }, { instruction_version: 'v2' }, { output_id: 'OTHER' },
    { media_set: { ...publication.media_set, items: publication.media_set.items.map((x,i) => ({ ...x, sha256: i ? 'c'.repeat(64) : x.sha256 })) } },
    { media_set: { ...publication.media_set, items: [...publication.media_set.items].reverse().map((x,i) => ({ ...x, order: i+1 })) } }]) {
    assert.notEqual(publicationClaimIdentity({ ...publication, ...patch }).operation_key, base.operation_key);
  }
  assert.equal(publicationClaimIdentity({ ...publication, attempt_id: 'OTHER', root_run_id: 'OTHER' }).operation_key, base.operation_key);
  assert.throws(() => publicationClaimIdentity({ ...publication, account_id: 'ambiguous:account' }));
});

test('carousel makes one write then independent durable read; prepared binding never enables transport', async () => {
  const calls = [];
  const claim = createPostgresPublicationClaimBinding({
    executeCommitted: async x => { calls.push(['commit', x]); return [{ claim: evidence() }]; },
    readCommitted: async x => { calls.push(['read', x]); return [{ claim: evidence() }]; }
  });
  const result = await claim(publication);
  assert.deepEqual(calls.map(x => x[0]), ['commit','read']);
  assert.equal(calls[0][1].params.length, 7);
  assert.equal(result.status, 'CLAIMED');
  assert.equal(result.durable, true);
  assert.equal(result.atomic, false);
  assert.equal(result.transport_prohibited, true);
});

test('duplicate and terminal outcomes prohibit transport without another attempt', async () => {
  for (const status of ['ALREADY_CLAIMED','PRIOR_SUCCESS','PRIOR_OUTCOME_UNKNOWN']) {
    let writes = 0;
    const claim = createPostgresPublicationClaimBinding({ executeCommitted: async () => { writes++; return [{ claim: evidence(status) }]; }, readCommitted: async () => [{ claim: evidence(status) }] });
    const result = await claim(publication);
    assert.equal(result.status, status);
    assert.equal(result.transport_prohibited, true);
    assert.equal(result.automatic_retries, 0);
    assert.equal(writes, 1);
  }
});

test('missing, inconsistent, multiple and failed readbacks fail closed', async () => {
  for (const readCommitted of [async () => [], async () => [{ claim: evidence() },{ claim: evidence() }],
    async () => [{ claim: { ...evidence(), attempt_id: 'OTHER' } }],
    async () => [{ claim: { ...evidence(), terminal_outcome: 'published' } }],
    async () => { throw new Error('private connection details'); }]) {
    const claim = createPostgresPublicationClaimBinding({ executeCommitted: async () => [{ claim: evidence() }], readCommitted });
    const result = await claim(publication);
    assert.equal(result.atomic, false);
    assert.equal(result.durable, false);
    assert.equal(result.transport_prohibited, true);
    assert.doesNotMatch(JSON.stringify(result), /private connection/);
  }
});

test('database and credential failure make no readback or automatic retry', async () => {
  let writes = 0, reads = 0;
  const claim = createPostgresPublicationClaimBinding({ executeCommitted: async () => { writes++; throw new Error('secret'); }, readCommitted: async () => { reads++; } });
  const result = await claim(publication);
  assert.equal(result.status, 'CLAIM_BACKEND_UNAVAILABLE');
  assert.equal(writes, 1); assert.equal(reads, 0);
  assert.equal(result.automatic_retries, 0);
  assert.doesNotMatch(JSON.stringify(result), /secret/);
  assert.throws(() => createPostgresPublicationClaimBinding({ credentialRef: 'other' }));
});

test("binding returns claimed and passes only logical credential ref", async () => {
  let call;
  const claim = createPostgresAtomicClaimBinding({
    execute: async (input) => {
      call = input;
      return [{ status: "CLAIMED", atomic: true }];
    }
  });
  assert.deepEqual(await claim(valid), { status: "CLAIMED", atomic: true });
  assert.equal(call.credential_ref, ATOMIC_CLAIM_CREDENTIAL_REF);
  assert.equal(call.params.length, 7);
});

test("duplicate operation is blocked", async () => {
  const claim = createPostgresAtomicClaimBinding({
    execute: async () => ({ status: "ALREADY_CLAIMED", atomic: true })
  });
  assert.deepEqual(await claim({ ...valid, run_id: "INT-RUN-FIXTURE-2" }), { status: "ALREADY_CLAIMED", atomic: true });
});

test("backend failure fails closed", async () => {
  const claim = createPostgresAtomicClaimBinding({
    execute: async () => {
      throw new Error("down");
    }
  });
  const result = await claim(valid);
  assert.equal(result.status, "CLAIM_BACKEND_UNAVAILABLE");
  assert.equal(result.atomic, false);
});

test("rejects wrong logical credential and malformed input", async () => {
  assert.throws(
    () => createPostgresAtomicClaimBinding({ execute: async () => {}, credentialRef: "wrong" }),
    /CREDENTIAL_REF_INVALID/
  );
  const claim = createPostgresAtomicClaimBinding({ execute: async () => ({ status: "CLAIMED", atomic: true }) });
  await assert.rejects(() => claim({}), /INPUT_INVALID/);
});
