# STU-004 — Studio v2 Production OS Architecture

Status: **ARCHITECTURE COMPLETE — RUNTIME NOT DEPLOYED**
Contract version: `studio-v2@1.0.0`

This directory defines the additive production domain authorized by STU-004. It does not replace the documentary Story Object, existing Data Tables, AUT-009 contracts, AUT-014 distribution, AUT-015 orchestration, HCTI rendering, or the publication-claim work. It adds the machine-readable contracts needed to develop original serialized microdrama after property greenlight.

## Architecture decision

The system remains layered:

```text
Signal / greenlight package
  -> Studio objects (Series -> Episode -> Scene -> Shot)
  -> Continuity validation
  -> Model routing and budget reservation
  -> Generation job / provider adapter
  -> Technical + continuity QC
  -> Human creative approval
  -> asset_registry + approved episode master
  -> content_outputs
  -> AUT-015
  -> AUT-014
```

The documentary `story_objects` contract remains unchanged. Studio v2 objects use a separate versioned envelope and may reference a Story Object only through an explicit adaptation/reference relationship. Research facts cannot silently become fictional assertions.

## Preserved canonical capabilities

| Existing capability | Studio v2 use |
| --- | --- |
| INF-006 typed IDs | Extended by the proposed Studio type codes in `studio-v2.object-model.json`; no ID is reused on retry or version change. |
| INF-007 credential policy | Provider credentials remain logical project/environment references; no secret enters Git, payloads, or logs. |
| AUT-009 validation/error/adapter doctrine | Reused at every object, route, generation, QC, approval, and output boundary. Studio errors add generation-specific classes without weakening the existing taxonomy. |
| `workflow_runs` | Remains the durable execution lineage ledger. Studio entity references use existing input/output ID arrays; job and attempt detail lives in generation records. |
| `asset_registry` | Stores immutable generated media provenance only after retrieval and technical verification. |
| `approval_queue` | Stores explicit greenlight, character/world lock, shot creative review, episode lock, and release decisions. |
| `content_outputs` | Receives approved episode masters and promotional derivatives; raw takes never enter it. |
| AUT-015 | Future approved-output coordinator. It does not become the generation engine. |
| AUT-014 | Remains the publication boundary. Studio v2 cannot call it before existing editorial, rights, publication, delivery, and atomic-claim gates pass. |

## Modular runtime boundaries

No workflow in this design owns the whole production chain. Future inactive development workflows should be small, callable modules:

1. `Studio Object Intake` — validate and persist versioned envelopes.
2. `Continuity Compiler` — materialize an immutable continuity snapshot.
3. `Continuity Gate` — compare a scene/shot manifest against a pinned snapshot.
4. `Model Router` — make a deterministic, provider-neutral selection; no provider mutation.
5. `Generation Claim + Budget Gate` — reserve budget and acquire one durable attempt claim.
6. `Provider Adapter` — submit exactly one authorized attempt and normalize the receipt.
7. `Generation Reconciler` — read-only status recovery for due/unknown attempts.
8. `Technical + Continuity QC` — record machine findings without granting creative approval.
9. `Creative Review Bridge` — create/read explicit human review decisions.
10. `Episode Assembly Bridge` — deterministic assembly and final-output registration.

Each module persists and exits. Deferred provider work records `next_action_at`; continuous polling and indefinite waits are prohibited.

## Canonical contracts

- `studio-v2.object-model.json` — object types, ownership, identities, relationships, persistence mapping, and legacy bridge.
- `model-router.contract.json` — provider-neutral route request/decision and deterministic scoring doctrine.
- `continuity-engine.contract.json` — immutable snapshots, assertions, mutations, validation, and conflict handling.
- `generation-job.state-machine.json` — job and attempt states, allowed transitions, claim/idempotency rules, and terminal semantics.
- `cost-accounting.contract.json` — append-only reservations, actuals, refunds, and unit-economics derivations in integer minor units.
- `resilience-and-migration.plan.json` — error normalization, retry/reconciliation policy, table proposal, modular rollout, rollback, and test gates.
- `schemas/studio-v2-*.schema.json` — boundary schemas for envelopes, routes, continuity, generation jobs, and ledger entries.
- `studio-v2.mjs` — deterministic validation/routing/state/cost helpers suitable for n8n adapters without making n8n the source of business logic.

## Data persistence proposal

The existing twelve development tables remain untouched. STU-004 proposes six additive tables for later review/deployment:

| Table | Purpose |
| --- | --- |
| `studio_objects` | Versioned Signal, Series, Character, Relationship, Location, Episode, Scene, and Shot envelopes. |
| `continuity_states` | Immutable continuity snapshots plus parent/hash/head metadata. |
| `generation_jobs` | Job/attempt state, route, claims, checkpoints, provider receipt, and reconciliation state. |
| `model_evaluations` | Versioned capability observations, route score evidence, QC outcomes, and acceptance signals. |
| `cost_ledger` | Append-only budget reservation, settlement, release, refund, and adjustment entries. |
| `qc_results` | Machine and human QC findings bound to immutable artifact hashes. |

`workflow_runs`, `asset_registry`, `approval_queue`, `content_outputs`, and `provider_usage` are reused. Atomic generation claims require a separately reviewed PostgreSQL migration and concurrent database proof; n8n Data Tables are not an atomic claim backend.

## Human gates

Automation cannot infer:

- property greenlight;
- character/world canonical lock;
- season/script lock;
- retry approval after an expensive attempt;
- creative acceptance of a generated take;
- episode picture lock;
- rights, publication, or final release approval.

All such decisions require actor, timestamp, decision scope, version/hash, and approval record ID.

## Architecture-phase exclusions

- No property-specific Series, Character, Episode, Scene, Shot, prompt, or fixture data.
- No paid generation, HCTI, Blotato, model, voice, or publishing calls.
- No n8n workflow creation, mutation, activation, or execution.
- No Data Table or PostgreSQL migration.
- No change to AUT-009, AUT-014, or AUT-015 runtime behavior.

Run the architecture checks with:

```text
node --test automation/core/studio-v2/tests/studio-v2.test.mjs
node automation/core/studio-v2/validate-studio-v2.mjs
```
