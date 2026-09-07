# Distribution Executor

Status: repository contract implemented; generic n8n executor deployed inactive with transport branches installed and fail-closed at credential/account binding.

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

The inactive n8n counterpart is `INT-AUT-014 â€” Distribution Executor â€” DEV`. It reads the canonical `content_outputs`, `story_objects`, `asset_registry` and `approval_queue` tables, renders the platform payload and stops at `READY_FOR_CREDENTIAL_BINDING`. Its transport branches are present but unreachable until the approved HTTP credential/account IDs are bound; it remains inactive, development-only and non-publishing.

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

The installed native Blotato node uses `blotatoApi`. The raw HTTP adapter uses n8n `httpHeaderAuth`; the operator enters the current `blotato-api-key` header credential manually. The same underlying secret may be entered by the operator, but n8n treats these as different credential types. If both modes are deployed, the native mode uses `INT | Blotato Native | Development | Distribution`. The authorized n8n project currently has only the native credential; the HTTP Header Auth credential remains pending. No external publication is attempted until the HTTP credential and destination account IDs are supplied in n8n.

The generic executor is deployed inactive as `AknakVMx2prJrsZw` with Facebook/Instagram/TikTok HTTP and Threads/YouTube/X native branches downstream of the binding gate. The existing Dolly output was backfilled in its sanctioned `manifest_json` surface from the approved EP003 v1.2 package; zero-call execution `34923` rendered the Facebook first comment and stopped before transport (`external_calls: 0`). Future Content Production outputs must emit `engagement_intent` and structured contextual hashtags.
