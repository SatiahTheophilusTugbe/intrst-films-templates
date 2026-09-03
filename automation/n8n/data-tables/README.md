# INF-005 — n8n Data Tables v1

Status: DEVELOPMENT CONTRACT

This directory implements the eight Data Tables approved in the canonical Premium Derivative Factory build brief:

- `people_queue`
- `life_files`
- `story_objects`
- `content_outputs`
- `approval_queue`
- `publishing_log`
- `performance`
- `asset_registry`

The deployable contract is `inf-005.data-tables.json`. It is deliberately bound to the `INTRST Films` n8n project,
project ID `o8RQQQgne2c6jXr5`, and to the development environment.

## Storage boundary

Google Drive remains authoritative for documents, research narratives, media and rights documentation. Data Tables
store filterable operational state and compact schema-validated payloads. Because n8n Data Tables support `string`,
`number`, `boolean` and `date` columns, nested arrays and objects are serialized into explicitly named `*_json`
string columns only when workflows require the full payload.

No credential, token, secret header or private key may enter these tables.

## Integrity boundary

n8n Data Tables do not replace application validation. Before a write, workflow/service code must:

1. validate the source object against its canonical JSON Schema;
2. calculate and query the declared idempotency key;
3. reject duplicate logical keys;
4. validate enum/status/state-transition rules;
5. preserve explicit approval actor and timestamp fields;
6. serialize nested JSON deterministically and record its hash;
7. write UTC timestamps;
8. emit a structured run event without secrets.

## Deployment gate

The repository contract remains `planned` until a project-scoped n8n operation proves that no conflicting table exists,
creates each table inside the authorized project, and re-fetches each immutable table ID with matching ownership and
column definitions. If project ownership is absent or ambiguous, deployment stops.

Rollback is limited to the table IDs created by that exact deployment and requires project-scoped ownership
verification before archival. Existing tables are never overwritten or renamed implicitly.

## Open canonical dependencies

Operational tables use `subject_id`; the existing Life File schema still carries `person_id` inside `payload_json`.
INF-006 must formally resolve that alias before production promotion. This contract does not modify the Life File schema.

The approved build brief names exactly eight tables and does not include a `workflow_runs` table. This implementation
does not silently add a ninth table. Production observability persistence must be assigned to an existing canonical
system or approved as a formal INF-005 extension before orchestration goes live.

Run validation with:

```text
node automation/n8n/tests/inf-005-data-tables.test.mjs
```
