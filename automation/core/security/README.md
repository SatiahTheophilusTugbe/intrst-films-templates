# INF-007 — Credentials and Secrets

Status: DEVELOPMENT CONTRACT

The machine-readable policy is `inf-007.credential-policy.json`. It consolidates the existing INTRST repository,
n8n-project, Data Table, observability and adapter guardrails without storing any credential value or immutable n8n
credential ID.

## Runtime boundary

- n8n runtime secrets stay in n8n Credentials and workflows receive references only.
- Codex connects to n8n through managed MCP authentication; raw values never enter prompts or chat.
- Dedicated deployment keys, if needed, stay in an approved environment secret store and must never be echoed, logged,
  written to an artifact or committed.
- Repository artifacts may declare provider, type, environment, purpose, required scopes and a logical
  `credential_ref`. They may not contain credential IDs, values, token fragments, authorization headers, private keys
  or raw OAuth payloads.

Credential references use:

```text
INT | {Provider} | {Environment} | {Purpose}
```

Development, Staging and Production resolve separate references. A lower environment cannot use or fall back to a
Production credential.

## Failure boundary

A credential failure is terminal until an operator resolves it: classify as `CREDENTIAL_FAILURE`, stop, alert and do
not retry or silently select another credential or environment. Secret material is redacted before logging.

## Lifecycle

Static secrets rotate within 90 days and immediately after suspected or confirmed exposure. Emergency access requires
explicit authorization, is time-bounded and triggers post-event rotation and review.

## Validation

Run:

```text
node automation/core/security/tests/credential-policy.test.mjs
```

`scan-secret-exposure.mjs` provides a dependency-free inspection helper for text that is about to be persisted. It is
defense in depth and does not replace provider secret scanning or human review.
