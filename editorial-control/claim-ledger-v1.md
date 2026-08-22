# INTRST Films — Claim Ledger v1

## Purpose
The Claim Ledger is the factual control layer for every INTRST output. It converts source material into atomic, auditable claims before any model is allowed to write carousel copy, captions, shorts, narration, or long-form scripts.

## Core Rule
No factual assertion may appear in publishable copy unless it is supported by one or more approved Claim IDs in the supplied ledger.

## Flow
Sources → Atomic Claims → Claim Review → Life File → Story Bible → Output Writing → Fact Check

## Claim Structure
Each claim should contain:
- `claim_id`
- `subject_id`
- `claim_text`
- `claim_type`
- `risk_tier`
- `confidence`
- `source_ids`
- `source_excerpt_refs`
- `date_verified`
- `verification_status`
- `interpretive_basis_claim_ids` when applicable
- `notes`

## Claim Types
- `fact` — directly verifiable assertion.
- `quote` — exact or closely controlled quotation tied to a source.
- `interpretation` — editorial synthesis supported by approved fact claims.
- `unknown` — explicitly unresolved or not yet confirmed.

## Risk Tiers
### Tier 1 — Critical
Requires direct verification and normally 2+ strong sources where practical:
- death and cause/manner of death
- criminal allegations or convictions
- abuse or violence
- medical or mental-health claims
- addiction/substance-use claims
- sexuality or intimate-life claims
- children/family custody
- financial/estate/net-worth claims
- lawsuits
- political or religious beliefs
- disputed quotes

### Tier 2 — Biographical
Normally requires at least one authoritative or highly reliable source:
- dates
- roles and employment
- awards
- schools
- career milestones
- public appearances
- releases/publications

### Tier 3 — Interpretive
May be editorial synthesis, but must point to the factual Claim IDs that justify the interpretation:
- legacy
- cultural significance
- career arc
- public-image analysis
- narrative contradiction

## Confidence Levels
- `high` — directly confirmed by authoritative/reliable evidence.
- `medium` — supported but interpretive, indirect, or less complete.
- `low` — insufficient for publication; retain only for further research.

## Verification Status
- `approved`
- `needs_review`
- `rejected`
- `unresolved`

Only `approved` claims may be supplied to a publishing model.

## Writing Constraint
A writing model receives only:
1. approved Claim Ledger entries,
2. approved Story Bible,
3. output format/platform rules.

The model must not introduce new biographical facts from memory or general knowledge.

## Interpretation Rule
Interpretive language is permitted only when:
1. it is clearly framed as synthesis rather than hidden fact, and
2. `interpretive_basis_claim_ids` points to approved factual claims.

Example:
- Allowed interpretation: “She spent almost her entire life being watched.”
- Basis: began work at 11 months + continuous public career through adulthood.

Not allowed without source support:
- “She secretly hated fame throughout childhood.”

## Post-Writing Fact Check
Every output must pass a second-model verification stage.

The checker receives:
- final output,
- Claim Ledger,
- Story Bible.

Expected result:
- `PASS`, or
- `FAIL` with unsupported statement, location, and nearest relevant Claim IDs.

## Slide/Paragraph Provenance
For internal records, every slide, caption paragraph, short-form beat, and long-form narration block should store the Claim IDs used to generate it.

Example:
```text
slide_02_claims: [CLM-001]
caption_p3_claims: [CLM-007, CLM-011]
longform_scene_14_claims: [CLM-019, CLM-020, CLM-024]
```

## Publication Gate
Publishable content requires:
- no unsupported factual claims,
- no low-confidence claims,
- Tier 1 claims reviewed,
- all unresolved information described accurately as unresolved,
- source provenance retained internally.

This ledger is the factual source of truth for all downstream INTRST storytelling.
