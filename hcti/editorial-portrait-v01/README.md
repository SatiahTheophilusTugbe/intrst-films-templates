# INTRST HCTI Editorial Portrait v0.1

Status: WORKING / REVIEW ONLY. Not canonical doctrine and not approved for automation.

Purpose: first direct-render prototype for a premium magazine-style INTRST single-image editorial treatment using HTML/CSS as the design source and HCTI as the intended renderer.

## Design intent
- 1080×1350 (4:5)
- Full-bleed photography is the default
- Photography carries the composition
- Strong editorial crop with image focal-point control
- Midnight Navy / Cinematic Black scrim behavior
- Warm Ivory typography
- Horizon Blue structural accent
- Dawn Gold micro-accent only
- Cormorant Garamond display, Manrope labels/dek, Inter metadata
- Minimal branding; no generic social-card framing

## Runtime variables
- subject_image
- image_position
- subject
- story_label
- kicker
- headline_html
- dek
- source_line

## Intended render flow
GitHub template source → n8n/Codex variable substitution → POST https://hcti.io/v1/image → visual QA → approved export → existing distribution pipeline.

HCTI credentials must live in a secure credential store/environment. Do not commit credentials to this repository.

## Test fixture
`fixture-dolly-literacy.json` uses the controlled Dolly literacy story. The subject image should resolve to the already-cleared 1977 publicity portrait or an approved provider-accessible copy/data URI.

## Review gate
This prototype must beat the existing Hayden/Canva quality floor before promotion into canonical masters. Do not automate until visual direction is approved.