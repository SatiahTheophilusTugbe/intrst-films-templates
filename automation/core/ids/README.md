# INF-006 — Immutable IDs and Naming

Status: DEVELOPMENT CONTRACT

All newly created operational records use:

```text
INT-{TYPE}-{ULID}
```

Example:

```text
INT-SUB-01K4A6M8E7D3Q5N9RT2VWX0YBZ
```

The 26-character ULID is uppercase Crockford Base32, contains a millisecond timestamp and 80 bits of entropy, and is
sortable without requiring a shared sequential counter. IDs are immutable: updates, retries and new versions retain the
original record ID. Version and idempotency fields remain separate.

## Subject identity decision

`subject_id` is the canonical operational field. The existing Life File v1 schema is not rewritten: its `person_id`
field stores the same `INT-SUB-*` value. At every adapter boundary:

```text
life_file.person_id === operational.subject_id
```

A mismatch fails closed. A future Life File major schema version may rename the field through a formal migration.

## Legacy references

Existing local references such as `SUBJ-001`, `SRC-001`, `CLM-001`, `AST-001`, `VID-001`, episode-local numbers and
subject slugs remain readable for historical artifacts. They are not globally unique and must never be generated as new
primary keys. Preserve them as `legacy_id` metadata or inside the unchanged legacy payload while linking the record to a
canonical typed ID.

## Human-readable names

Record identity is separate from display names and filenames:

- Image files retain `FirstName_LastName_NNN.ext`.
- Production folders use `{story_id} — {working_title}`.
- Workflows use `INT-{CLASS}-{NNN} — {human_name} — {ENV}`.
- Template catalog entries use `INT-TPL-{NNN}` with a separate semantic version.
- Provider IDs and n8n immutable IDs are external references; they never replace INTRST record IDs.

## Observability decision

`run_id` uses the `RUN` type. A `workflow_runs` Data Table is required as a formal INF-005 minor extension before the
first orchestration workflow is deployed. n8n execution IDs remain external references on those records. This decision
closes the design ambiguity without silently modifying the already-deployed eight-table INF-005 baseline.

Run validation with:

```text
node automation/core/ids/tests/ids.test.mjs
```
