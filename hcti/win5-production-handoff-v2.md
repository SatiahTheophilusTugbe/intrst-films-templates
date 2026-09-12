# WIN 5 → WIN 4: four-format render handoff

2026-09-11. Design review / runtime validation pending. No publication authorization.

Use repository SatiahTheophilusTugbe/intrst-films-templates, branch design/hcti-editorial-v01. Resolve a single immutable commit containing this handoff, then fetch every template, contract and fixture from that commit. Do not use saved HCTI templates. Record the commit and asset hashes with every output.

| Format | Existing template folder under hcti/ | Fixture | Review state |
|---|---|---|---|
| Single image | editorial-portrait-v01 | fixture-dolly-literacy.json | Existing v0.4 benchmark, no design changes |
| THE SECOND STORY | narrative-carousel-v01 | fixture-dolly-seven-slides.json | Full seven-slide v2.6 design accepted; scrim opacity 0.78 |
| FROM THE RECORD | archive-card-v01 | fixture-dolly-ownership.json | Verdigris/Brass and cleaner portrait approved |
| THE PROOF | evidence-spread-v01 | fixture-dolly-loc.json | Composition approved; larger supporting type rendered for review |

## Inputs and execution

1. Use existing INTRST | HCTI | Editorial Render Bridge | v1 and credential INTRST | HCTI | Production Renderer. Credentials stay in n8n. Render raw HTML/CSS, one 1080×1350 PNG per slide, pixel ratio 1; ten image outputs total (one + seven + one + one).
2. Replace local asset paths in fixtures with runtime-accessible verified asset URLs. Resolve all placeholders before calling HCTI. No empty required fields, arbitrary CSS or unescaped text. Allow only the explicitly needed br/span/em markup in rich text; reject scripts, attributes and unknown tags. Optional unused legacy detail fields may be empty and hidden.
3. Supply Cormorant Garamond 600/700, Manrope 500/600/700/800 and Inter 400/500/600/700. Wait for font and image loading. Reject fallback-font or missing-image output. No image synthesis or source substitution.
4. Validate fixture against its current contract. Carousel must contain unique slide numbers 1–7 in role order. Evidence v2 implements one source-first composition; legacy claim-first/detail-first are not v2 modes. Archive approved fixture uses artifact_protagonist; legacy artifact_interpretation changes geometry and is excluded.
5. Preserve the single-image v0.4 template/fixture blob lock. Its approval/render status is separate from this comparison reproduction.
6. Compare each output against the corresponding local Chromium proof: exact dimensions; visible assets; no clipping/overlap; correct palette, font hierarchy and footer. Carousel spine x=0, 10px wide, cumulative n/7, no segment gaps; ghost opacity .09; handle only slide 7: @watchintrstfilms. Archive face and hair remain clear of broad tinted overlays. Evidence highlight matches the original caption text, with separate interpretation.
7. Persist outputs and report execution ID, source commit, dimensions, hashes and comparison results. Return proofs for final review. Do not activate publishing or change idempotency state.

## Verified assets / source boundaries

A4: Curtis Hilbun, Dolly Parton accepting Liseberg Applause Award, 2010. Original JPEG 2400×3530, 2,201,083 bytes. WIN 5 already acquired and stored it: Drive 1FEpzAp4GI_i3zu8-AawepKxIqTNWq4_Y. Preserve the 500×735 reference separately.
Source: https://commons.wikimedia.org/wiki/File:Dolly_Parton_accepting_Liseberg_Applause_Award_2010_portrait.jpg
License: https://creativecommons.org/licenses/by/3.0/
Editorial crops and CSS overlays only. The portrait is subject context, not evidence of literacy or the interview.

THE PROOF: https://www.loc.gov/lcm/pdf/LCM_2018_0506.pdf, printed p.24 / PDF page 26. Photo credit Shawn Miller / Library of Congress. Crop coordinates in PDF points: photo (0,25,350,260), caption (62,479,274,520); rendered at 3× and 4× respectively. Use the supplied source-photo.png and source-caption.png. The highlighted caption documents the February 27, 2018 event; it does not establish total program reach. Highlight coordinates are fixture-specific and must be visually verified for every new source.

FROM THE RECORD: PS-001, The Big Interview with Dan Rather, 2014; short typeset interview excerpt, explicitly labelled. It is not a facsimile or interview still. Exact source/timecode and release review remain editorial dependencies.

## Editorial boundary and remaining gates

New carousel interiors use the current WIN 5 handoff's literacy spine (father → 1995 Sevier County launch → regular books before school age → 2018 milestone). Connective wording is proposed, not silently promoted to canonical editorial copy. The older EP003 publishing package follows a different life-story/death framing and was not reused. Editorial must reconcile it separately before publication; this handoff verifies no current death/health claims.

Open gates: final editorial wording/source release; HCTI runtime parity; production approval. Existing design approvals remain valid within their recorded scope. These are production-source candidates, not a declaration of runtime completion.

## v2.4 image-sequence update

Six distinct source images now replace the repeated-portrait layout proof. Read narrative-carousel-v01/asset-manifest-dolly-v2.json for Drive IDs, source links, original dimensions, hashes and per-slide context. Preserve original images; local asset paths resolve to those exact Drive objects. Carousel fixture modes now include place, book_detail and documentary. Slides1/7 remain unchanged; slide6 retains consequence hierarchy with 96px headline to accommodate the actual milestone photograph. New image treatment on2–6 requires visual review. Do not mistake contextual landscape/book imagery for historical program documentation.

Frontend Design by anthropics/skills installed at user request. Its general guidance remains subordinate to INTRST approved tokens and doctrine; no other third-party skills installed.


## Production hardening / 2026-09-11

The user's go-ahead authorizes locking the four-format design package and handing it to WIN 4. This records a design baseline, not evidence that the inactive runtime has executed it. Existing single-image v0.4 lock remains untouched.

Read `four-format-master-lock-v1.json`: compare every listed Git blob SHA and SHA-256 before rendering. Fetch all listed files from the immutable final handoff commit. Abort on mismatch. Palette, image treatments, typography and placements are pinned by the template bytes; no saved-template IDs or ad hoc style overrides. Carousel v2.6 uses shared 96px/.94 Cormorant headlines, 32px supporting text, y=600 copy origin, 0.78 scrim-layer opacity and 0.09 ghost numerals.

### Layout acceptance

Run `layout-preflight-v1.js` in the local browser after decoding images and loading fonts. Call `intrstLayoutPreflight(format)` with single/carousel/archive/evidence. Any returned issue rejects the payload before provider submission. Repeat geometry checks in a browser matching the provider as closely as available; compare actual HCTI output visually. The helper does not itself integrate with n8n, validate CSS background downloads, verify editorial claims or assess facial crops.

Headline limits: single and carousel 4 rendered lines; archive and evidence 2 rendered lines. Retain approved font sizes. If copy exceeds a line limit or collides with a protected section, request a shorter editorial payload; never silently rewrite, shrink or clip. Credits must remain inside the canvas and clear of the deck name. Word counts alone cannot guarantee fit.

### Stress-test evidence

16 local Chromium cases: four formats × baseline, 89-character headline, extended attribution and wide documentary photograph. All four baseline cases passed measured geometry. The long single-image headline exceeded 4 lines; archive and evidence long headlines also collided with protected content. The new preflight rejected all three. Carousel's long headline and all extended-credit cases passed these checks. Wide images fit their containers; this is not approval of their crop or use. Test copy and substitute images are deliberately synthetic layout probes and must never become editorial payloads. Baseline designs remain unchanged.

### WIN 4 execution checklist

Use existing bridge ID XHjJBrSOoBaFrHYk; inspect its actual current name/configuration and existing credential binding, rather than creating duplicates based on historical labels above. Keep it inactive. Integrate the lock and preflight, then run a controlled ten-output raw-HTML render. Return execution ID, immutable source commit, per-output dimensions and SHA-256, font/image-load evidence and comparison against the supplied references. No publishing or AUT-014 changes. If provider/browser layout differs, return the failed case to WIN 5 rather than modifying design tokens.


## Superseding image-binding repair — 2026-09-12

Use `four-format-master-lock-v2.json`, `image-binding-repair-v2.md`, and each format's `template-image-v2.html` / `render-contract-image-v2.json`. These supersede prior CSS-image binding instructions; single-image now uses render-lock-v0.5.json. Historical templates and locks remain untouched. Source implementation commit: 80ae0490e10abeda0b0cd11c3935fd9b6bb1bab1. All 16 v2 lock entries verified against that commit. Ten browser proofs and eleven required image elements pass decoded-byte, visibility, blank-control and layout checks. Approved design composition preserved. No new photographic derivatives; original source hashes retained. Evidence's existing PDF crops remain unchanged. This repair authorizes no HCTI call or retry of unknown execution 36219, no publication, and no AUT-014 modification.
