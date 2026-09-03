# INTRST Premium Derivative Factory — Codex Engineering Prebuild Spec v1.0

Status: PREBUILD / IMPLEMENTATION CONTRACT

This specification implements the approved Flagship automation build brief without replacing AUT-001–AUT-008 or the existing Life File schema. It defines the engineering boundary that must exist before production n8n workflows are built.

## 1. Governing architecture

Canonical flow:

Approved Subject → Source/Claim System → Life File → Story Bible → INTRST Story Object → Derivative Generators → Render → Automated QC → Human Approval → Publishing Adapter → Performance Ingestion → Learning.

Rules:
- n8n is orchestration and workflow state, not the container for all business logic.
- Codex-owned code modules hold schemas, validators, adapters, rendering helpers, tests, fixtures, migrations and deterministic transforms.
- Editorial evidence and approval remain upstream authorities.
- No derivative generator performs independent factual research.
- Claims, quotes, source references, rights state and uncertainty travel with the Story Object.
- No production publish occurs without explicit approval state.

## 2. Modular boundaries

### n8n orchestration workflows
- `wf_story_object_ingest`
- `wf_single_image_factory`
- `wf_carousel_factory`
- `wf_archive_factory`
- `wf_motion_factory`
- `wf_approval_gate`
- `wf_publish`
- `wf_performance_ingest`

Each workflow should primarily coordinate service calls, persist state, route approvals and handle recoverable execution errors.

### Codex-owned modules
Recommended repository structure for the engineering codebase:

```text
automation/
  core/
    ids/
    state/
    validation/
    observability/
    errors/
  adapters/
    drive/
    openai/
    canva/
    elevenlabs/
    blotato/
    platform-native/
  derivative/
    single-image/
    carousel/
    archive/
    motion/
  render/
    remotion/
    ffmpeg/
  schemas/
  tests/
    unit/
    contract/
    regression/
  fixtures/
    dolly/
  migrations/
  n8n/
    workflows/
    subworkflows/
    examples/
```

The public template repo may contain non-sensitive schemas/specs/test shapes. Secrets, private production logic where required, credentials and production assets remain outside the public repo.

## 3. Story Object contract

The Story Object is the only approved editorial input to derivative generators. Minimum required fields are formalized in `schemas/story-object.schema.json`.

Core groups:
- identity: subject ID/name and trigger
- narrative: central question, thesis, contradiction, emotional question, chronology
- evidence: verified claims, attributed claims, prohibited/uncertain claims, quote extracts, source IDs/URLs
- assets: archive assets, rights state, identity state
- derivative policy: derivative-safe facts, platform constraints, visual mode
- governance: editorial version, approval state

No factual output may be emitted from fields outside the evidence-bound contract.

## 4. Derivative manifest contract

Each generator emits a derivative manifest before rendering. The shared envelope is formalized in `schemas/derivative-manifest.schema.json`.

Required concepts:
- manifest ID and version
- Story Object ID/version
- derivative type
- Claim IDs used
- source IDs inherited
- approved asset IDs
- platform targets
- generated copy/layout/scene payload
- QC result
- approval state
- render state
- publish state
- prompt/template/model/version audit metadata

A render cannot proceed if required claim, rights or identity checks fail.

## 5. State model

### Story Object state
`draft → evidence_ready → editorial_review → approved → superseded | blocked`

Only `approved` Story Objects may feed production derivative workflows.

### Derivative state
`queued → generating → validation → render_ready → rendering → qc → approval_required → approved → publish_queued → publishing → published`

Exception states:
`blocked`, `failed_recoverable`, `failed_terminal`, `rejected`, `superseded`.

### State transition rules
- State transitions are explicit and validated.
- No workflow may infer approval from successful execution.
- `approved` requires a human approval actor/time.
- `published` requires provider post ID/URL or an explicitly recorded native fallback result.
- Successful platform publishes are immutable for retry purposes; retries operate only on failed targets.

## 6. Error and retry strategy

Normalized error classes:
- `RATE_LIMIT`
- `TEMPORARY_PROVIDER`
- `NETWORK`
- `MALFORMED_MODEL_OUTPUT`
- `SCHEMA_VALIDATION`
- `MISSING_SOURCE`
- `CLAIM_BLOCK`
- `RIGHTS_BLOCK`
- `IDENTITY_BLOCK`
- `RENDER_FAILURE`
- `PUBLISH_FAILURE`
- `CREDENTIAL_FAILURE`
- `HUMAN_REVIEW_BLOCK`
- `UNKNOWN`

Retry policy:
- transient provider/network/rate-limit failures: bounded exponential backoff with jitter
- malformed model output: bounded regeneration attempts, then human/terminal route
- schema/claim/rights/identity failures: never blind retry; block and surface cause
- credential failure: stop immediately and alert operator
- publishing: per-platform idempotency key; retry failed platform targets only

Every retry must preserve original run ID lineage plus attempt count.

## 7. Idempotency

Minimum keys:
- Story Object ingest: `subject_id + editorial_version`
- derivative manifest: `story_object_id + derivative_type + derivative_version`
- render: `manifest_id + render_version`
- publish: `output_id + platform + publish_instruction_version`
- source ingest: canonical URL/content hash where applicable

Duplicate prevention is enforced outside prompts.

## 8. API adapter boundary

Every external provider sits behind an adapter interface so workflow logic is provider-agnostic.

Minimum adapter methods:

```text
healthcheck()
validate_config()
submit(payload, idempotency_key)
get_status(job_id)
normalize_result(raw)
normalize_error(raw)
```

Additional publishing adapter methods:

```text
publish(platform_payload, idempotency_key)
lookup_existing(idempotency_key)
get_metrics(post_id)
```

Preferred publishing implementation is Blotato only after acceptance tests. Platform-native fallbacks remain isolated behind the same interface.

Canva, Remotion, FFmpeg and ElevenLabs similarly receive normalized internal manifests rather than ad hoc n8n payloads.

## 9. Observability

Every critical execution emits a structured run event containing:
- run_id
- parent_run_id
- workflow/module
- version
- story_object_id
- derivative_manifest_id
- subject_id
- start/end timestamps
- state_from/state_to
- attempt
- provider
- model/template/prompt version where applicable
- input IDs
- output IDs
- claim IDs
- asset IDs
- approval actor/time
- error class/message
- latency
- estimated cost where available

Do not log credentials, secret headers or raw sensitive tokens.

## 10. Automated quality gates

`G1_SCHEMA` — valid Story Object / manifest and no orphan Claim IDs.

`G2_EVIDENCE` — every factual assertion maps to approved Claim IDs/source state.

`G3_RIGHTS` — assets requiring rights clearance are publishable.

`G4_BRAND` — only approved template IDs, type modes and visual modes.

`G5_COPY` — platform length/native-writing constraints pass.

`G6_VISUAL` — no overflow, crop failure, low-resolution asset, duplicate slide or identity mismatch.

`G7_HUMAN` — explicit approval required before production publishing.

`G8_PUBLISH` — idempotent per-platform publishing and retry isolation.

`G9_AUDIT` — Story Object version, prompt/template/model version, asset IDs and approval actor/time present.

Any failed blocking gate prevents progression.

## 11. Dolly regression fixture strategy

Dolly is the known-good fixture. Production assets and copy remain in canonical Drive locations and are not copied into the public repository.

Fixture tests operate from a structured fixture manifest that references logical expected outputs:
1. approved single-image package
2. approved seven-slide carousel
3. approved 29-second carousel-motion master
4. approved Reel 01 reference

Regression comparison dimensions:
- factual/claim inheritance
- copy depth and platform-native rewrite behavior
- design/layout mode selection
- asset/rights binding
- render dimensions/duration
- text overflow/crop/duplication checks
- required audit metadata

Quality comparison failure blocks Janie live promotion.

## 12. Test strategy

### Unit tests
IDs, validators, state transitions, error normalization, retry policy, copy constraints, hashtag/keyword rules.

### Contract tests
Story Object schema, derivative manifest schema, adapter request/response normalization, n8n-to-service payloads.

### Regression tests
Dolly known-good outputs.

### Integration tests
Provider sandboxes/test endpoints where available: Drive, OpenAI, Canva, ElevenLabs, Blotato, Remotion/FFmpeg job runner.

### Failure-injection tests
429, 5xx, timeout, malformed JSON, missing claim, unresolved rights, identity mismatch, duplicate publish, partial multi-platform publish.

No live Janie promotion until required Dolly regression tests pass.

## 13. Version control and release policy

Semantic version schemas/contracts independently from workflow implementations.

Recommended conventions:
- schema: `story-object@1.0.0`
- manifest: `derivative-manifest@1.0.0`
- workflow: `wf-single-image@1.0.0`
- adapter: `blotato-adapter@1.0.0`
- fixture baseline: `dolly-regression@1.0.0`

Breaking contract changes require a major version and migration file.

Branch pattern:
`automation/<feature>-vN`

Commit groups should separate:
- contract/schema
- implementation
- tests/fixtures
- migration
- n8n workflow export

Production n8n workflow JSON is version-controlled after sanitization; credential IDs/tokens/secrets must not be committed.

## 14. Build sequence

Gate A — foundation:
1. INF-005 Data Tables finalized
2. INF-006 IDs finalized
3. INF-007 credential policy finalized
4. AUT-003 versioned template fetcher implemented

Gate B — contracts:
5. AUT-009 Story Object schema validated
6. derivative manifest schema validated
7. state/retry/error contracts tested
8. adapter interfaces stubbed
9. observability event contract tested

Gate C — regression:
10. single-image generator
11. carousel generator
12. motion generator
13. Dolly regression suite AUT-010

Gate D — live proof:
14. approval queue
15. publishing adapter acceptance tests
16. Janie AUT-011 only after Dolly gates pass
17. performance ingestion

## 15. Cross-workstream boundaries

Flagship/Editorial owns evidence, approved Story Object editorial fields and narrative approval.
Brand + Design owns programmable master templates and visual QC thresholds.
Distribution owns cadence, scheduling, optimization and publishing policy.
Automation owns schemas, workflows, integrations, retries, logging, tests and adapter behavior.

Any proposed doctrine change is recorded as a dependency; Automation does not silently alter another workstream's standard.

## 16. Machine-enforced n8n scope

Repository policy is defined in `automation/n8n/project-scope.json` and validated by
`automation/n8n/validate-project-scope.mjs`. The policy is deny-by-default and authorizes only the
`INTRST Films` n8n project (`o8RQQQgne2c6jXr5`).

Before an n8n project-data operation, construct a request envelope containing the project identity,
project-scoped lookup confirmation, operation, immutable target ownership, environment and required
authorization evidence. Mutation envelopes also carry the expected current version, rollback method
and idempotency key. A denied envelope is a hard stop; it must not be bypassed with an unscoped lookup.

Run the dependency-free contract tests with:

```text
node automation/n8n/tests/project-scope.test.mjs
```

The validator is a precondition for orchestration code and sanitized n8n workflow deployment. It does
not itself grant authorization to modify, activate, publish or delete n8n resources.
