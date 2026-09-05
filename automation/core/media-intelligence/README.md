# INTRST Media Intelligence Layer — Phase 1 Contract

Status: architecture complete; runtime adapters, Data Tables and provider calls are not deployed.

Routing is cache-first and uses the cheapest sufficient source. TranscriptAPI is the primary routine YouTube research
provider. ScrapeCreators is a free-tier specialist provider and requires an explicit intelligence gap, a stated reason,
a known credit balance and enough capacity to remain at or above the protected 20-credit reserve after the call.

The contract keeps three object classes separate:

- media sources preserve provider provenance, canonical platform IDs, rights state and cache state;
- research moments, audience signals and intelligence gaps are normalized Media Intelligence objects;
- provider usage events meter endpoint, purpose, credits, cost, cache behavior and downstream value.

Audience signals and comments are never eligible as factual claims. Transcript material can create research candidates,
but only corroborated material may be routed toward the Claim Ledger. Source discovery never grants reuse rights.

Credential values are not stored here. The approved logical references are declared in
`media-intelligence.policy.json` and resolve through n8n Credentials at runtime.

`providers.mjs` supplies non-networked TranscriptAPI and ScrapeCreators adapter stubs that satisfy the shared AUT-009
adapter interface. They fail closed until credential validation and captured Dolly response fixtures support endpoint
implementation and normalization.

No provider call should occur until the Dolly controlled-test fixture, credential health checks and usage logging are
ready. Janie remains the first live proof after Dolly passes.

```text
node automation/core/media-intelligence/validate-media-intelligence.mjs
node automation/core/media-intelligence/tests/media-intelligence.test.mjs
```
