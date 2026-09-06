# Distribution Executor

Status: repository implementation complete; n8n deployment blocked at the publisher-credential boundary.

The executor is subject-agnostic, output-driven and platform-adapter-based. Its only required runtime input is `content_output_id`, plus a controlled execution envelope:

```json
{
  "content_output_id": "INT-OUT-...",
  "run_id": "INT-RUN-...",
  "mode": "controlled_manual",
  "budget": {"max_publications": 1, "max_attempts": 1, "automatic_retries": 0}
}
```

It resolves the output, Story Object, asset, approval, platform-native copy and publisher adapter from canonical records. It fails closed for missing relationships, rights/identity/file gaps, missing approval, duplicate successful publication, missing credentials or adapter configuration. A controlled run permits one submission, zero automatic retries, no polling loop and explicit reconciliation for ambiguous provider outcomes.

The publisher is an adapter, not the executor contract. A Blotato adapter can be added without changing orchestration; no Blotato credential or existing publishing workflow currently exists in the authorized n8n project, so no runtime workflow or credential was created.
