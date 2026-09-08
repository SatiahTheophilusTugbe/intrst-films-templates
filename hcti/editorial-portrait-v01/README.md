# INTRST HCTI Editorial Portrait v0.4

Status: **WORKING / REVIEW ONLY**. Not canonical doctrine and not approved for automated publishing.

Purpose: direct-render prototype for the emerging INTRST single-image editorial system using HTML/CSS as design source and HCTI as intended renderer.

## Current visual direction
The approved review direction from WIN 5 is now encoded as:

- 1080×1350 (4:5)
- true full-bleed photography as default
- glossy, luminous, contemporary magazine/feature-opener treatment
- no sepia, faux archival aging, distressed paper, vintage wash, or period styling by default
- strong art-directed crop with independent X/Y focal controls
- visible but restrained Signal Blue atmospheric bleed integrated into the photography/background
- controlled dark scrim only where needed for typography legibility
- bright subject separation and richer tonal contrast rather than muddy cinematic blacks
- minimal editorial typography; image remains dominant

## Working color-role system
These roles are **working direction pending cross-subject validation**:

- Midnight Navy `#0B1723` — structural dark field / scrim
- Deep Slate `#182938` — secondary structural dark
- Horizon Blue `#375A72` — quieter legacy structural blue
- Warm Ivory `#F1EEE6` — primary narrative typography
- Dawn Gold `#C79A58` — emotional signature/tagline + micro-rule
- Cinematic Black `#080A0C` — deepest contrast
- Signal Blue `#3497FF` — proposed identifier/accent color

### Proposed Signal Blue role
Signal Blue is the current candidate for the recurring INTRST identifier color:
- `INTRST FILMS`
- subject/franchise eyebrow labels
- small brand rules/markers
- selective narrative emphasis (one word/phrase only when earned)
- atmospheric blue bleed in photography

Do not use Signal Blue indiscriminately. The composition should still be dominated by photography, black/navy, and ivory.

## Typography
- Display / narrative headline: Cormorant Garamond 700
- Brand + eyebrow + tagline: Manrope 700–800
- Metadata / source line: Inter 600

## Current hierarchy
1. Photograph
2. Narrative headline
3. Dawn Gold tagline: `STORIES WORTH REMEMBERING.`
4. Signal Blue brand + subject/franchise eyebrow labels
5. Source/date metadata

## CTA / handle rule
CTA support exists in the template but is hidden by default.

Working doctrine:
- single-image editorial: no CTA / handle by default
- carousel opener/interiors: no CTA / handle
- carousel closing slide: CTA + platform handle may be used
- archive/evidence post: provenance takes precedence; no marketing CTA by default
- Shorts/Reels end card: CTA + handle appropriate
- YouTube thumbnail: never

Do not surface CTA on this master unless an asset-specific distribution contract explicitly enables it.

## Runtime variables
- `subject_image`
- `image_position_x`
- `image_position_y`
- `blue_bleed_opacity`
- `scrim_strength`
- `subject`
- `story_label`
- `kicker`
- `headline_html`
- `source_line`
- `cta_display`
- `cta_text`

## Intended render flow
GitHub template source → n8n variable substitution → authenticated HCTI render → visual QA → approved export → existing distribution pipeline.

HCTI credentials belong in n8n's secure credential store. Never commit HCTI credentials, authorization headers, or secrets to this repository.

## Controlled fixture
`fixture-dolly-literacy.json` uses the Dolly literacy story and the cleared 1977 publicity portrait or an approved provider-accessible copy/data URI.

Current fixture intent:
- strong right-biased facial crop
- editorial negative space on left
- Signal Blue visible in both identifier typography and atmospheric bleed
- Dawn Gold tagline
- no CTA

## Review gate
Before promotion into canonical doctrine:
1. Render the template through HCTI.
2. Verify exact font loading and crop behavior.
3. Compare actual output against the approved glossy visual reference.
4. Tune crop/scrim/blue-bleed variables without altering core grammar unless necessary.
5. Test the same master on at least one second subject.
6. Only then promote or revise the canonical WIN 5 design doctrine.

Do not automate unresolved visual direction.