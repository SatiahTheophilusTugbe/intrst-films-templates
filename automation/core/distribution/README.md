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

The publisher is an adapter, not the executor contract. The development runtime uses `blotato-http` for Facebook/Instagram and `blotato-native` for Threads/YouTube/X and other platforms where the installed native node is sufficient. The executor never owns platform copy rules.

`engagement_intent` is the canonical editorial primitive. Renderers map it to a first comment for Facebook/Instagram, a closing paragraph for Threads/YouTube, or an optional concise rendering for X. Hashtags are contextual, capped at three and placed by the renderer.

The inactive n8n counterpart is `INT-AUT-014 — Distribution Executor — DEV`. It reads the canonical `content_outputs`, `story_objects`, `asset_registry` and `approval_queue` tables, renders the platform payload and stops at `READY_FOR_CREDENTIAL_BINDING`. It does not contain HTTP, native Blotato, credential, polling or activation capability until the approved logical credential and account IDs are bound.

Development binding surface:

```text
logical credential: INT | Blotato | Development | Distribution
credential type: blotatoApi
api_key: __SET_IN_N8N__
facebook: __FACEBOOK_BLOTATO_ACCOUNT_ID__
instagram: __INSTAGRAM_BLOTATO_ACCOUNT_ID__
threads: __THREADS_BLOTATO_ACCOUNT_ID__
youtube: __YOUTUBE_BLOTATO_ACCOUNT_ID__
x: __X_BLOTATO_ACCOUNT_ID__
```

The authorized n8n project has no Blotato credential yet. No external publication is attempted until the credential and destination account IDs are supplied in n8n.
