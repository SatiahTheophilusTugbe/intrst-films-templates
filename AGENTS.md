# INTRST Films Engineering Guardrails

These instructions apply to the entire repository.

## Operating Model

- Inspect the relevant canonical artifacts before writing: root documentation, feature specs, schemas, fixtures, tests, and any existing implementation in the target area.
- Execute canonical-artifact-first. Treat approved schemas, fixtures, tests, registries, and governing specs as the source of truth.
- Update existing canonical artifacts when they exist. Do not create parallel versions, duplicate specs, or replacement files unless a versioned migration is explicitly required.
- Preserve Git history. Do not rewrite history, discard user changes, or make destructive Git operations without explicit instruction.
- Record every material contract, template, workflow, fixture, schema, or infrastructure change in `INTRST Master Build Tracker - Canonical`.
- Repository registries and specifications may support that tracker but do not replace it.
- If the canonical tracker is inaccessible, report the pending tracker update; never create a parallel tracker.
- Do not redefine another workstream's doctrine. Flagship/Editorial owns evidence and narrative approval; Brand + Design owns visual standards; Distribution owns cadence, scheduling, optimization, and publishing policy; Automation owns schemas, workflows, integrations, retries, logging, tests, and adapter behavior.
- Inspect before writing and verify after writing.

## Repository Boundaries

- This repository stores public, version-controlled template specifications, schemas, layout rules, rendering instructions, fixtures, and test contracts.
- Do not commit production brand assets, logos, portraits, exports, source media, credentials, tokens, secret headers, or private production data.
- All credential handling must comply with `automation/core/security/inf-007.credential-policy.json`; repository and
  workflow artifacts use logical references and sanitized metadata only, never credential IDs or values.
- Keep testable business logic in version control. n8n coordinates execution; it is not the durable home for validators, adapters, deterministic transforms, rendering helpers, or contract logic.
- Prefer modular code and modular workflows. Do not build monolithic orchestration.

## n8n Boundaries

- n8n project name: `INTRST Films`
- n8n project ID: `o8RQQQgne2c6jXr5`
- Reserved workflow namespace: `INT-`
- Required workflow tag: `project:intrst`
- Never inspect, modify, archive, publish, test, or otherwise operate on unrelated projects in the shared n8n instance.
- Use project-scoped n8n operations whenever available. Avoid instance-wide discovery or mutation when it could expose unrelated project metadata.
- New or materially changed workflows must remain inactive and development-scoped until their schemas, fixtures, tests, approvals, and rollback path pass review.
- Every material n8n workflow change must have a sanitized, version-controlled engineering counterpart or deployment record in Git. Never export credentials, secret headers, tokens, or private production data.
- Publishing, activation, production promotion, and destructive operations require explicit user authorization.
- Before every n8n mutation, confirm project ID, artifact ID, environment, expected current version, and idempotency key where applicable.
- Do not modify n8n unless the user explicitly asks for n8n changes.

## Hard Scope Isolation — Deny by Default

* This repository authorizes work only for INTRST Films. Access is deny-by-default for every other local project, repository, n8n project, workflow, folder, Data Table, credential, execution, tag, and production resource.
* Local filesystem operations must remain inside the repository root returned by `git rev-parse --show-toplevel`. Do not read, write, move, rename, or delete files outside that root unless the user explicitly identifies a required canonical artifact and authorizes access.
* The only authorized n8n project is `INTRST Films`, project ID `o8RQQQgne2c6jXr5`.
* Never rely on a workflow name alone. Before reading, executing, testing, updating, publishing, unpublishing, archiving, restoring, moving, or deleting an n8n workflow, verify that its immutable workflow ID belongs to project ID `o8RQQQgne2c6jXr5`.
* Use project-scoped listing and lookup operations. Do not use instance-wide workflow, folder, Data Table, credential, execution, or tag discovery when the operation could expose unrelated project metadata.
* Instance-wide node-type metadata and public n8n documentation may be inspected only when they contain no customer project data.
* If an MCP response omits project ownership, returns multiple project matches, or cannot prove that a target belongs to `o8RQQQgne2c6jXr5`, stop immediately and report a scope-verification failure. Do not infer ownership.
* Never move an artifact into or out of the authorized n8n project.
* Never operate on a workflow ID, folder ID, Data Table ID, credential ID, or execution ID obtained from another project or an unscoped search.
* A request involving another project must be handled in a separate repository and separate Codex session with its own governing `AGENTS.md`. This repository's authorization never expands implicitly.
* Before every n8n mutation, record the verified project ID, target artifact ID, current version, intended environment, requested operation, and rollback method.
* After every authorized mutation, re-fetch the target through a project-scoped operation and confirm that it remains inside project ID `o8RQQQgne2c6jXr5`.
* Any ambiguity, scope mismatch, or failed verification is a hard stop. Do not proceed partially and do not attempt a workaround.

## Required Automation Controls

- Schema validation is mandatory at Story Object, derivative manifest, adapter boundary, render, QC, approval, and publishing boundaries.
- Idempotency is mandatory for ingest, derivative generation, render jobs, and per-platform publishing.
- Observability is mandatory for critical execution paths, including run IDs, parent lineage, versions, state transitions, attempts, provider/model/template metadata, input/output IDs, claims, assets, approvals, errors, latency, and cost where available.
- Retries must be bounded, preserve lineage, and distinguish transient failures from terminal policy blocks.
- Sensitive gates fail closed. Claim, evidence, identity, rights, human approval, credential, and publishing approval failures must block progression rather than infer success.
- Human editorial, identity, rights, and publishing approvals cannot be inferred from successful workflow execution. Required human approval actor/time fields must be explicit.

## Execution Conservation — Shared n8n Instance

- Workflows are event-driven and persist-and-exit by default. Fetch only the data required for the current state, persist the result, and terminate the execution.
- Continuous, interval, high-frequency cron, broad monitoring, and indefinite-wait polling are deny-by-default.
- Deferred work records `next_action_at` and a resumable state, exits cleanly, and is re-entered only by a targeted due-work trigger.
- Check canonical caches before every provider request. Duplicate paid retrieval is prohibited unless an explicit refresh policy authorizes it.
- Provider calls and retries must remain within the execution budget carried by the request. Budget exhaustion is a terminal policy block for that execution.
- Reconciliation is recovery-only, project-scoped, low-frequency, and limited to due records. It must not become a general polling loop.
- Every workflow and provider call records cache outcome, execution count, provider-call count, retry count, and next-action state where applicable.
- Apply `automation/n8n/execution-conservation.policy.json` and its validator before creating or materially changing any n8n workflow.
