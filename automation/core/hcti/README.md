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

The controlled ten-output batch remains blocked before provider transport until
the canonical evidence fixture assets `source-photo.png` and
`source-caption.png` are acquired and registered. The existing v0.4 single-image
lock remains unchanged. No HCTI submission has been made for this batch.

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

Drive files are currently private/not shared. No sharing permission was changed,
so an approved HCTI-accessible delivery reference remains required before the
evidence output can be rendered. The LOC/photographer credit and existing
research/source rights review remain unchanged; reconstruction is not a new
publication-rights determination.
