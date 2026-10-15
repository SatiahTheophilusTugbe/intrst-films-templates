# The Christmas Invoice — Studio v2 Property Runtime Package v1.0

Status: **PROPERTY RUNTIME PREPARED — GENERATION BLOCKED**

This directory is the first property-specific implementation of the additive STU-004 architecture. It binds the locked ten-episode STU-006 v1.1 canon without copying the private scripts into Git, changes no publication workflow, and performs no generation or provider call.

## What is instantiated

- One Signal and one Series, three Characters, three Relationships and two Locations.
- Ten locked Episodes and twelve conservative Scene containers.
- Eleven immutable continuity snapshots: one genesis plus one episode-out state for each episode.
- Zero Shot objects, Generation Jobs or provider attempts. Those cannot exist until WIN 5 supplies the locked shot manifests and visual canon.

Production identities use `INT-{TYPE}-{ULID}`. `H26-01` and `SIG-H26-001` remain searchable development aliases only.

## Runtime boundary

The property extends the existing modular Studio v2 layers. It does not create a property-sized monolithic n8n workflow:

1. Studio object intake
2. Continuity compiler and gate
3. Shot-manifest intake
4. Model router
5. Atomic claim and budget gate
6. One-attempt provider adapter
7. Reconciler
8. Technical and continuity QC
9. Human creative review
10. Episode assembly and approved-output bridge

Every module must persist and exit. Automatic paid retries are zero. A submitted ambiguous outcome is terminal `outcome_unknown` until manual reconciliation.

## Canon and continuity

`continuity-deltas.json` preserves the machine-readable STU-006 v1.1 deltas as narrative inputs. The compiler adds emotional, location, timeline, wardrobe and explicit state-delta dimensions without replacing the source deltas. Wardrobe is intentionally `awaiting_STU-007` in every snapshot.

The locked script text is not duplicated in this repository. Scenes carry the canonical Drive document/revision and episode script hash.

## Budget and analytics

The only opened budget is the WIN 0 Episodes 1–3 incremental generation/API ceiling: **USD 600.00**. It is one global proof-gate pool, not three invented episode allocations. Current reserved and actual cost are zero. Episodes 4–10 cannot reserve or spend.

Telemetry joins production and future publication/audience events through stable IDs from Series through Generation Attempt and platform publication. Titles and filenames are never join keys.

## Deterministic story evidence

The invoice, transfers, house expenses, realtor material, care calendar and final agreement states must be rendered through versioned deterministic templates and composited. Generative video cannot be trusted to create plot-critical readable text.

## Deployment truth

Repository contracts and fixtures are prepared. No n8n workflow, Data Table, Neon/PostgreSQL database, `workflow_runs` row, provider, AUT-014 or AUT-015 runtime was changed. The generation-claim SQL is a prepared proposal, not an applied migration.

Run focused verification with:

```bash
node --test automation/core/studio-v2/properties/christmas-invoice/tests/christmas-invoice.test.mjs
node automation/core/studio-v2/properties/christmas-invoice/validate-property-runtime.mjs
```
