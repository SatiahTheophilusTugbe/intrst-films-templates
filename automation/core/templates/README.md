# AUT-003 — Versioned Template Fetcher

AUT-003 resolves an exact template ID and semantic version from the existing INTRST template registry. It keeps
selection and integrity rules in version control while allowing n8n to orchestrate calls without embedding template
logic in Code nodes.

## Guarantees

- exact `INT-TPL-NNN` identity and semantic version selection, with fallback only when callers provide an ordered list
- deny-by-default environment checks
- production use only for active canonical templates with Brand + Design and production approval
- immutable Git commit SHA requirement for repository-backed artifacts
- SHA-256 verification of fetched repository content
- declared provider capability checks before adapter calls
- logical credential references only; no credential IDs or values
- Canva entitlement failures represented as terminal capability blocks, not retryable provider errors

## Canva development fixture

`INT-TPL-900@0.1.0` records the noncanonical Canva smoke-test Brand Template `EAHUTRYq_Pw`. Dataset discovery is
verified for `HOOK_LINE_1`, `HOOK_LINE_2`, `BRAND_LABEL` and `SUBJECT_IMAGE`. Autofill generation remains blocked by
`CANVA_ENTERPRISE_REQUIRED`; the fetcher therefore refuses an Autofill-capability request before any provider call.

The fixture does not replace the Hayden Panettiere production design. Brand + Design must provide the immutable
production master ID, field contract and approval before a canonical production record is added.

## Validation

```text
node automation/core/templates/validate-template-registry.mjs
node automation/core/templates/tests/template-fetcher.test.mjs
```

AUT-003 does not create or modify n8n workflows, credentials, Canva designs or production assets.
