import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ATOMIC_CLAIM_SQL,
  ATOMIC_CLAIM_CREDENTIAL_REF,
  createPostgresAtomicClaimBinding
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
