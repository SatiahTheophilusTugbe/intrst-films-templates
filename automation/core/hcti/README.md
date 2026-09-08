# HCTI Editorial Render Bridge

Development-only bridge for the pinned `hcti/editorial-portrait-v01` prototype.

- source branch: `design/hcti-editorial-v01`
- source commit: `9aa50d2994a90e08221c93e4417d0cdb4550ed23`
- template version: `editorial-portrait-v01`
- fixed geometry: 1080x1350
- request pins `viewport_width=1080`, `viewport_height=1350`, and `device_scale=1`
- provider: HCTI `POST https://hcti.io/v1/image`
- authentication: logical n8n reference `INT | HCTI | Development | Production Renderer`
- transport attempts: exactly one; automatic retries: zero
- workflow state: inactive development bridge

The bridge stores only sanitized render metadata. It never stores credentials,
request headers, raw provider payloads, or private production data. The source
fixture is synthetic/canonical editorial metadata and uses the existing approved
Dolly asset's public delivery URL only at runtime.

The template contract maps every handoff field: `subject_image`,
`image_position`, `subject`, `story_label`, `kicker`, `headline_html`, `dek`,
and `source_line`. Headline markup is limited to approved `<br>` and `<em>`
tags. Dimension and accent controls are not caller-configurable.
