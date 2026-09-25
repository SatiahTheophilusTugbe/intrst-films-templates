# INTRST Media Intelligence Layer — Phase 1 Contract

## Publication atomic-claim infrastructure — 2026-09-25

Verdict: `BLOCKED — ATOMIC PUBLICATION CLAIM GUARANTEE UNPROVEN`.
Project-scoped inventory returned zero PostgreSQL credentials. The logical reference
remains `INT | PostgreSQL | Development | Atomic Claims`; no credential ownership,
database endpoint, database name, live migration or concurrency proof is claimed.
The proposed relation is `public.intrst_media_operation_claims` in the dedicated
development backend. The publication extension in `atomic-claim.postgres.sql` and
`atomic-claim.mjs` is **prepared, not deployed**. Legacy transcript rows and their
uniqueness remain intact. No alternate store is introduced.

Publication identity is `publish:<output_id>:<platform>:<account_id>:<instruction_version>`.
The operation key appends `:media:<ordered_media_set_hash>`. A partial unique index
enforces publication key plus hash; the legacy partial index preserves transcript
idempotency. The hash is SHA-256 of UTF-8 JSON
`["ordered-media-claim@1", format, [[order, asset_id, sha256], ...]]`.
Delivery URL rotation does not change the identity. Reordered or changed bytes do.
The complete carousel is one row and one transaction.

The function uses INSERT ON CONFLICT and a separate locked read under READ COMMITTED.
It requires synchronous commits, bounds lock waits to five seconds, and performs no
retry. Separate commands in a VOLATILE function obtain fresh snapshots, avoiding
the invisible-conflict problem of a same-statement SELECT after DO NOTHING.
References: [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
and [function volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html).
Terminal published/unknown states cannot be reclaimed, changed or deleted through
ordinary DML. No automatic reconciliation or reset is provided.

The dedicated runtime role needs narrowly scoped function and relation privileges;
it must not own the schema/table, disable triggers, truncate, or reset claims.
The migration must be applied by the separate migration owner in one transaction.
Configure READ COMMITTED, synchronous_commit=on and statement_timeout <= 10s.
Executor completion must mean COMMIT acknowledged. Independent readback must use a
separate database connection. A failed commit/readback/credential blocks transport
without retry. The prepared adapter always returns atomic=false and
transport_prohibited=true, including successful synthetic reads. Unit-test mocks
are adapter-contract checks, never evidence of a PostgreSQL guarantee.

Required live proof after secure provisioning:

1. Record the actual backend/database/schema/role and project-owned logical credential.
   Apply the migration; inspect constraints and privileges, then rerun to check idempotence.
2. Use two independent sessions and distinct attempt IDs for one new synthetic
   publication identity. Overlap transactions deliberately; hold the first insert
   uncommitted while starting the second, then commit. Expect exactly CLAIMED and
   ALREADY_CLAIMED. Read the single committed row from a third connection.
3. Mark synthetic winners published and outcome_unknown with the terminal statement.
   Reclaim attempts must return PRIOR_SUCCESS and PRIOR_OUTCOME_UNKNOWN. Verify the
   terminal state cannot regress and each path prohibits transport.
4. Vary output, account, platform, instruction version and ordered media hash. Read
   distinct durable rows; verify a carousel stores one complete-set operation.
5. Inject database/credential/commit/readback failures. Assert no provider invocation,
   automatic retry, or ambiguous claim reuse. Preserve all synthetic evidence.
6. Only then complete runtime binding/guarantee, keeping transport disabled; rerun
   AUT-014 and AUT-015 zero-call validation and repository/runtime parity. Do not
   promote the prepared binding based on unit tests or migration success alone.

Rollback is keep transport disabled and revert adapter wiring; retain the additive
schema and every claim row. Do not drop publication columns/indexes or reset history.
Current session: no migration or claim executions, provider/render/publication/comment
calls or retries. Existing AUT-012, AUT-013 (claim owner) and AUT-015 tracker rows are
used; no new tracker row is needed.

Status: INF-005.2 deployed and verified in development; the supervised AUT-013 controlled test completed successfully, while unattended runtime remains production-blocked.

Deployment: `d56f20cb142008d8be2b46095c9321f122fbcf90` created the three empty project-scoped Data Tables in `INTRST Films` (`o8RQQQgne2c6jXr5`): `media_sources` (`MtW6eqUyU7oiPRB0`), `media_intelligence` (`fPb1OwJbFPbFmqRk`), and `provider_usage` (`WFeE982gMt0XfiIm`).

Routing is cache-first and uses the cheapest sufficient source. TranscriptAPI is the primary routine YouTube research
provider. ScrapeCreators is a free-tier specialist provider and requires an explicit intelligence gap, a stated reason,
a known credit balance and enough capacity to remain at or above the protected 20-credit reserve after the call.

Every request prohibits polling and carries a provider-call budget of zero to three. A cache hit is served even when the
provider budget is exhausted; a cache miss cannot call a provider without budget. TranscriptAPI transcript retrieval is
exactly one transport attempt per authorized operation: timeout, interruption, ECONNRESET and HTTP 5xx outcomes become
manual-reconciliation `OUTCOME_UNKNOWN` records and are never automatically retried. Deferred work records its next
action and exits rather than retaining an idle execution.

The contract keeps three object classes separate:

- media sources preserve provider provenance, canonical platform IDs, rights state and cache state;
- research moments, audience signals and intelligence gaps are normalized Media Intelligence objects;
- provider usage events meter endpoint, purpose, credits, cost, cache behavior and downstream value.

Audience signals and comments are never eligible as factual claims. Transcript material can create research candidates,
but only corroborated material may be routed toward the Claim Ledger. Source discovery never grants reuse rights.

Credential values are not stored here. The approved logical references are declared in
`media-intelligence.policy.json` and resolve through n8n Credentials at runtime.

`providers.mjs` supplies a development-only, dependency-injected TranscriptAPI adapter and a non-networked
ScrapeCreators stub. TranscriptAPI is cache-first, event-driven, bounded to the request budget, uses only its approved
logical credential reference, normalizes errors/responses, meters one immutable attempt per paid operation, canonicalizes
YouTube IDs and writes/replays transcript cache entries. Cached output retains only hashes, timing, token counts and
approved metadata; captured fixtures are sanitized and contain no raw copyrighted transcript.

The immutable `provider_usage.idempotency_key` stores the deterministic operation identity for the first attempt. Any
later attempt must use a new authorized run-scoped identity after explicit reconciliation and approval; the deployed
INF-005.2 table therefore requires no schema migration.

The AUT-013 controlled-test exception permits exactly one supervised live TranscriptAPI request for the fixed Dolly source.
The workflow remains inactive, Manual Trigger only, one-attempt, zero-retry and development-only; production/unattended
paid-provider execution remains blocked pending a proven atomic/idempotent claim backend.

AUT-013 remains production-blocked. The proposed inactive mock artifact is
`automation/n8n/workflows/INT-TST-013-dolly-transcriptapi-controlled-test-dev.workflow.json`, named
`INT-AUT-013 — Media Intelligence Layer Phase 1 — DEV`. It uses a fixed, development-only TranscriptAPI transport path for this supervised exception, exact provider_usage
idempotency-key lookup, persist-and-exit execution, and no polling. It is approval-gated, fixed to the approved
source, and limited to one real transport attempt with zero automatic retries. Its cache, provider_usage, media_sources
and workflow_runs paths use exact project-scoped Data Table operations; no PostgreSQL dependency is used for this test.

The captured-response adapter is implemented, but the paid path requires a separately bound atomic operation claim
before it can run. Lookup, insert, upsert, workflow concurrency, static data, waits and polling are not locks; an
unproven claim backend fails closed. `ProviderUsageLedger` separates atomic claims from immutable provider outcomes,
projects application events to the deployed physical row (`downstream_usage_json`), and fails closed on scope,
duplicate, lookup, corruption or persistence errors. Application projection is being implemented and the n8n paid
provider workflow is not deployable for unattended/concurrent use until the atomic claim binding is proven. The controlled
test exception does not generalize that production rule.

The approved AUT-013 controlled source is Library of Congress / @loc, “Dolly Parton Interview,”
`https://www.youtube.com/watch?v=PIa6Vot1XcM` (canonical ID `PIa6Vot1XcM`). It is fixed in the
inactive test-only workflow with `approval_status: controlled_test_authorized`, a provider-call budget of one, one
maximum real transport attempt and zero automatic retries. The logical credential reference is
`INT | TranscriptAPI | Development | Media Intelligence`; credential values and immutable IDs are
never stored in Git. The live HTTP node is reachable only after the fixed controlled-test authorization gate. Any later
raw transcript is restricted to the existing private Dolly research/source location (`01 Research & Life File`);
Git and provider_usage retain only sanctioned metadata, hashes, timings, counts and provenance.
Research/source access does not confer production visual, audio or quotation rights. The authorized operation remains
exactly `AUT-013-DOLLY-002` for `PIa6Vot1XcM`; no other source/provider is authorized.

The successful controlled execution `34896` was a cache miss and completed with HTTP 200, one provider transport attempt, one provider call and zero retries. The provider account evidence supplied by the operator reconciles one billed credit; no credit value was inferred from the transcript payload. It produced one workflow_runs start row and one terminal persist-and-exit row, one immutable provider_usage row, one sanitized media_sources row and zero media_intelligence rows. Executions `34893` and `34895` were preserved and reconciled with appended known-safe pre-provider terminal rows. The public API reference exposes no programmatic usage/balance endpoint, so credits_used/credits_remaining remain nullable in the physical usage row and reconciliation metadata is retained in the application/deployment record. The workflow remains inactive.

The live contract is TranscriptAPI `GET https://transcriptapi.com/api/v2/youtube/transcript` with `video_url` and `language` query parameters and Bearer authentication. The immutable provider_usage row from execution `34896` is preserved as written (including its nullable credit fields and historical endpoint value); the canonical adapter and workflow now use the proven v2 contract, and the operator's authenticated account evidence reconciles one billed credit without creating a second usage event.

```text
node automation/core/media-intelligence/validate-media-intelligence.mjs
node automation/core/media-intelligence/tests/media-intelligence.test.mjs
node automation/n8n/validate-execution-conservation.mjs
node automation/n8n/tests/execution-conservation.test.mjs
node automation/n8n/data-tables/validate-inf-005-2.mjs
node automation/n8n/tests/inf-005-2-media-intelligence.test.mjs
```
