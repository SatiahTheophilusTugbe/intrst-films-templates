# Distribution Executor

Status: repository contract implemented; generic n8n executor deployed inactive with HTTP/native transport branches bound in development. The first controlled five-target pass was attempted once per eligible target and ended without a published post; no automatic retries or second submissions occurred.

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

The publisher is an adapter, not the executor contract. The development runtime uses `blotato-http` for Facebook/Instagram/TikTok and `blotato-native` for Threads/YouTube/X. LinkedIn is not an INTRST production platform. The executor never owns platform copy rules.

`engagement_intent` is the canonical editorial primitive. Renderers map it to a first comment for Facebook/Instagram, a closing paragraph for Threads/YouTube, or an optional concise rendering for X. Hashtags are contextual, capped at three and placed by the renderer.

The inactive n8n counterpart is `INT-AUT-014 — Distribution Executor — DEV` (`AknakVMx2prJrsZw`). It reads the canonical `content_outputs`, `story_objects`, `asset_registry` and `approval_queue` tables, renders the platform payload and routes to the bound development transports. It remains inactive and development-only. The controlled run recorded: Facebook known failure (`Account 101607426321841 not found`), Instagram submission later failed during provider media inspection, Threads rejected the payload at the 500-character limit, and X/TikTok submissions later failed during provider media inspection. No public post was verified.

The provider-neutral first-comment adapter is implemented in `first-comment-adapter.mjs`. It is invoked only after a Facebook/Instagram main post is confirmed published, resolves the published Blotato `postId` from the submission through the connected MCP list-posts capability, and submits a top-level comment with no parent ID. No first-comment mutation was issued in the controlled pass because neither Facebook nor Instagram reached a published state.

Development binding surface:

```text
logical credential: INT | Blotato | Development | Distribution
HTTP credential type: httpHeaderAuth; current Blotato REST header: `blotato-api-key`
native credential type: blotatoApi
api_key: __SET_IN_N8N__
facebook: __FACEBOOK_BLOTATO_ACCOUNT_ID__
instagram: __INSTAGRAM_BLOTATO_ACCOUNT_ID__
threads: __THREADS_BLOTATO_ACCOUNT_ID__
youtube: __YOUTUBE_BLOTATO_ACCOUNT_ID__
x: __X_BLOTATO_ACCOUNT_ID__
tiktok: __TIKTOK_BLOTATO_ACCOUNT_ID__
```

The installed native Blotato node uses `blotatoApi`. The raw HTTP adapter uses n8n `httpHeaderAuth`; the operator enters the current `blotato-api-key` header credential manually. The same underlying secret may be entered by the operator, but n8n treats these as different credential types. Both logical development credentials are now bound in n8n; their values and immutable IDs remain excluded from Git. No workflow activation or production promotion occurred.

The generic executor is deployed inactive as `AknakVMx2prJrsZw` with Facebook/Instagram/TikTok HTTP and Threads/YouTube/X native branches downstream of the binding gate. The existing Dolly output was backfilled in its sanctioned `manifest_json` surface from the approved EP003 v1.2 package; zero-call execution `35137` passed resolution/rendering and terminal exit after the HTTP-expression repair (`external_calls: 0`). Live executions `35138`, `35140`, and `35141` used one attempt per selected target and zero retries; no target produced a verified public post. Future Content Production outputs must emit `engagement_intent` and structured contextual hashtags. Production promotion remains blocked pending durable publication persistence, provider-media accessibility, and a controlled reconciliation path for submitted outcomes.
