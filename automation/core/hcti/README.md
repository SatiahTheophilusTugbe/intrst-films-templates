# HCTI Editorial Render Bridge

Development-only bridge for the pinned `hcti/editorial-portrait-v01` prototype.

- source branch: `design/hcti-editorial-v01`
- source commit: `1a383d02e4d306deb0fd0543b05e850f6b2b38a7`
- source lock: `hcti/editorial-portrait-v01/render-lock-v0.4.json`
- locked template blob: `7bf754b1dacecda0d371597290be1f987ad5d514`
- locked fixture blob: `984f4210204c7bba53c85893aa833c5a436bb843`
- template version: `editorial-portrait-v01`
- fixed geometry: 1080x1350
- request pins `viewport_width=1080`, `viewport_height=1350`, and `device_scale=1`
- provider: HCTI `POST https://hcti.io/v1/image`
- authentication: logical n8n reference `INT | HCTI | Development | Production Renderer`
- transport attempts: exactly one; automatic retries: zero
- workflow state: inactive development bridge

The bridge stores only sanitized render metadata. It never stores credentials,
request headers, raw provider payloads, or private production data. The source
fixture is loaded from the locked Git source and permits only the runtime image
substitution. The bridge fails closed while the approved full-color Dolly asset
delivery URL remains unresolved; the reserved one-render authorization is not
consumed automatically when that dependency is later satisfied.

The locked v0.4 contract maps `subject_image`, `image_position_x`,
`image_position_y`, `subject`, `story_label`, `kicker`, `headline_html`,
`source_line`, `cta_display`, and `cta_text`. Supporting-paragraph/dek
injection is prohibited. Headline markup is limited to approved `<br>` and
`<span class="accent-word">` tags. Dimension, crop, color, and effect controls
are not caller-configurable.

## Four-format validation integration

The four-format source mirror under `hcti/` is pinned to design commit
`29e89dea8ec36ee35102117a5790bf804a2e24fc` and is verified against all 15
recorded Git blob and SHA-256 values before use. `four-format-bridge.mjs`
validates the single image, seven-slide carousel, archive card, and evidence
spread, substitutes only approved runtime image URLs, preserves raw HTML/CSS,
and emits 1080x1350 PNG requests with device scale 1 and zero retries.

All eight canonical source images required by the ten-output batch are present
in the existing private EP003 `03 Verified Stills` folder. The repository
private-delivery adapter validates downloaded PNG/JPEG bytes against canonical
MIME type, dimensions, byte size, and SHA-256 before constructing a transient
data URI. Sanitized evidence excludes image bytes and encoded payloads.

The project-owned `googleDriveOAuth2Api` binding
`INT | Google Drive | Development | HCTI Asset Read` is installed on all eight
private-asset reads. Runtime execution `36218` verified the locked assets and
all ten measured request bodies with transport disabled. No encoded image bytes
are saved in execution data, workflow records, deployment evidence, or Git.

Official HCTI documentation does not publish a request-body ceiling
(`https://docs.htmlcsstoimage.com/getting-started/using-the-api`, checked
2026-09-11). The controlled authorization therefore designated the largest
measured request, Carousel 4 at 7,029,917 bytes, as the one-attempt canary.
Execution `36219` opened that transport path but ended without a sanctioned
terminal result. Its outcome is durably recorded as `outcome_unknown`; no retry
or remaining batch submission is permitted until provider reconciliation. The
workflow has been returned to inactive, transport-disabled state. The existing
v0.4 single-image lock remains unchanged.

Read-only reconciliation execution `36226` used the project-owned HCTI Basic
Auth credential against the documented `GET /v1/images?count=50` inventory
surface. HCTI returned HTTP 404, so the request could not be attributed to zero,
one, or multiple provider records. Workflow-run rows 78–80 preserve the bounded
read and reaffirm `outcome_unknown`; they do not infer provider rejection and do
not authorize a retry.

Local reconstruction of the exact Carousel 4 request proved that the complete
Open Book bytes were present: 5,264,182-byte JPEG, 4288x2848, SHA-256
`16849bf7ef5fa0860deb2c5c92efa65fac0e86116988ebb90d8934204b630f62`.
The 7,029,917-byte request hashed to
`b0c3bf7d6f3f3d6e853d618c9d9ef15f54407489d5bfbdc95e539f8200249a45`.
Chromium decoded the same data URI successfully when used as an image source,
but dropped the oversized CSS `background-image` declaration: computed style
was `none` and the required image region had zero changed pixels versus a
no-background control. The current CSS-background delivery mode therefore fails
browser image-paint validation. A versioned locked-template/runtime binding that
uses a browser-safe image element is required before another HCTI submission.

Bridge version `hcti-bridge@1.2.0` adds immutable pre-transport request evidence
and immediate transport-settled evidence before download or normalization-
dependent terminal handling. It classifies documented 4xx rejection, ambiguous
5xx/network outcomes, malformed 2xx responses, download/geometry failure, and
post-render visual-QA failure without retries. Transport cannot be enabled unless
both terminal postflight persistence and browser image-paint verification are
explicitly true. No credential, raw HTML, response body, image bytes, or data URI
enters the durable evidence rows.

## THE PROOF source-crop recovery

The two missing evidence derivatives were reconstructed from the locked source
`https://www.loc.gov/lcm/pdf/LCM_2018_0506.pdf`, SHA-256
`72a5b625d943476d1ab0a37319a61fb973016a334cc4ba53db54a510024de519`, PDF page
26 / printed page 24. Coordinates use the source proof's top-left PDF-point
rectangle convention: `source-photo.png` `(0,25,350,260)` at 3x, and
`source-caption.png` `(62,479,274,520)` at 4x. Poppler `pdftoppm` 26.07.0 was
used for deterministic rasterization. The resulting derivatives are 1050x705
and 848x164 PNGs with hashes recorded in the deployment record; they are
registered in the existing EP003 `03 Verified Stills` folder as reconstructed
source derivatives, not byte-identical originals.

Drive files are private/not shared and remain downloadable by the authenticated
Drive account. No sharing permission was changed. The intended runtime delivery
mode is authenticated n8n Drive download, byte verification, and in-memory data
URI substitution; data URIs must never be pinned, logged, or persisted. The
LOC/photographer credit and existing research/source rights review remain
unchanged; reconstruction is not a new publication-rights determination.
