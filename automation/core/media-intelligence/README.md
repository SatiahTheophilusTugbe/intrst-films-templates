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

No live provider call is made by this repository phase. The Dolly controlled-test fixture, credential health checks and
usage logging are used only through injected local test doubles. Janie remains the first live proof after explicit
authorization.

```text
node automation/core/media-intelligence/validate-media-intelligence.mjs
node automation/core/media-intelligence/tests/media-intelligence.test.mjs
node automation/n8n/validate-execution-conservation.mjs
node automation/n8n/tests/execution-conservation.test.mjs
node automation/n8n/data-tables/validate-inf-005-2.mjs
node automation/n8n/tests/inf-005-2-media-intelligence.test.mjs
```
