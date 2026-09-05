# INTRST Media Intelligence Layer — Phase 1 Contract

Status: INF-005.2 deployed and verified in development; runtime adapter is local/captured-response only and provider calls remain disabled.

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

No live provider call is made by this repository phase. The Dolly controlled-test fixture, credential metadata binding and
usage logging are used only through injected local test doubles. The approved Dolly controlled test remains
unexecuted pending explicit one-call authorization.

AUT-013 remains production-blocked. The proposed inactive mock artifact is
`automation/n8n/workflows/INT-TST-013-dolly-transcriptapi-controlled-test-dev.workflow.json`, named
`INT-AUT-013 — Media Intelligence Layer Phase 1 — DEV`. It uses mock transport only, exact provider_usage
idempotency-key lookup, persist-and-exit execution, and no polling. It is approval-gated, fixed to the approved
source, and limited to one real transport attempt with zero automatic retries. No execution or Data Table mutation
is part of this preparation phase.

The captured-response adapter is implemented, but the paid path requires a separately bound atomic operation claim
before it can run. Lookup, insert, upsert, workflow concurrency, static data, waits and polling are not locks; an
unproven claim backend fails closed. `ProviderUsageLedger` separates atomic claims from immutable provider outcomes,
projects application events to the deployed physical row (`downstream_usage_json`), and fails closed on scope,
duplicate, lookup, corruption or persistence errors. Application projection is being implemented and the n8n paid
provider workflow is not deployable until the atomic claim binding is proven. No provider call or credit has occurred.

The approved AUT-013 controlled source is Library of Congress / @loc, “Dolly Parton Interview,”
`https://www.youtube.com/watch?v=PIa6Vot1XcM` (canonical ID `PIa6Vot1XcM`). It is fixed in the
inactive test-only workflow with `approval_pending: true`, a provider-call budget of one, one
maximum real transport attempt and zero automatic retries. The logical credential reference is
`INT | TranscriptAPI | Development | Media Intelligence`; credential values and immutable IDs are
never stored in Git. The live HTTP node is unreachable while approval remains pending. Any later
raw transcript is restricted to the existing private Dolly research/source location (`01 Research & Life File`);
Git and provider_usage retain only sanctioned metadata, hashes, timings, counts and provenance.
Research/source access does not confer production visual, audio or quotation rights. The next gate is
explicit authorization for exactly one TranscriptAPI call; no execution has occurred.

```text
node automation/core/media-intelligence/validate-media-intelligence.mjs
node automation/core/media-intelligence/tests/media-intelligence.test.mjs
node automation/n8n/validate-execution-conservation.mjs
node automation/n8n/tests/execution-conservation.test.mjs
node automation/n8n/data-tables/validate-inf-005-2.mjs
node automation/n8n/tests/inf-005-2-media-intelligence.test.mjs
```
