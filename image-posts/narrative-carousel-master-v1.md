# INTRST Films — Narrative Carousel Master v1

Status: v1 story doctrine preserved; v2 visual revision WORKING / REVIEW. Coral/Saffron is a candidate, not an approved palette.

Revision: 2026-09-09. Existing canonical path retained; candidate on design/hcti-editorial-v01.

## Purpose
A swipeable editorial story system designed for retention, elegant progression, and visual variation. It must not behave like seven copies of a single-image card.

## Exactly 7-slide arc
### Slide 1 — Tension / Hook
- Job: stop scroll and create an unanswered question.
- Copy: 6–18 words; 0–1 support line.
- Visual: closest to Single-Image Editorial; full bleed; strongest crop.
- No CTA.

### Slide 2 — Scene / Origin
- Job: ground the story in person/place/object/circumstance.
- Copy: 20–40 words.
- Visual: image-dominant; optional date/location.
- End with forward pressure or a visual mini-hook.

### Slide 3 — Context / Build
- Job: deliver necessary comprehension without losing pace.
- Copy: 20–45 words.
- Visual: full-bleed image, lower/bottom-third headline and short paragraph; restrained source marker allowed.

### Slide 4 — Complication
- Job: raise stakes and deepen contradiction.
- Copy: 20–45 words.
- Visual: tighter crop, darker compression, quote or difficult fact where appropriate.

### Slide 5 — Reveal / Pivot
- Job: deliver the central reframing or transformation.
- Copy: 12–35 words.
- Visual: second-strongest slide after Slide 1; one controlled color-emphasis moment allowed.

### Slide 6 — Consequence
- Job: show what changed, spread, endured, or followed.
- Copy: 20–45 words.
- Visual: escalation through a dominant consequential fact/statistic headline with selective accent; reflective paragraph beneath. Preserve its distinct hierarchy.

### Slide 7 — Residue / Takeaway / Soft CTA
- Job: leave meaning and close the sequence gracefully.
- Copy: 8–22 words.
- Visual: full-bleed magazine back page; large reflective statement, second residue line, breathing room, subtle rule, handle and soft CTA.
- Handle/CTA allowed here only.

## Narrative rules
- Every slide must perform a distinct story job.
- Every swipe must provide either new information, deeper emotion, proof, or a reframe.
- Use mini-hooks sparingly and elegantly: contradiction, delay, reframe, specificity, escalation, intimacy, callback.
- The strongest mini-hook usually sits at the end of Slides 2–4 and points toward the next beat.
- Avoid formulaic suspense language. Forward pressure can be visual.

## Visual zones
1. Identity zone — INTRST FILMS / subject or franchise eyebrow.
2. Headline zone — main beat.
3. Support copy zone — explanation when required.
4. Image zone — full bleed or dominant image.
5. Metadata zone — source/date/location when meaningful.
6. Closure zone — only on closing slide for CTA/handle.

## Visual family variants
- Portrait-led — human/identity/emotional stories.
- Object-led — meaningful object, institution, book, place, award, artifact.
- Evidence-led — document, source fragment, timeline, record, proof.

## Color behavior — candidate under test
- Editorial Coral `#F06F61`: publisher, eyebrow, spine, selective headline emphasis, closing handle.
- Soft Saffron `#E6B85C`: role label, small rules and secondary metadata.
- Warm Ivory `#F1EEE6`: headline/body; navy/black scrims.
- Contemporary atmospheric bleed remains controlled. Do not retouch the source portrait.
- Single Image stays blue/gold. Do not lock this palette until the anchor review.

## Page-spine rail
Flush absolute left edge at x=0, top=0, full 1350px height; 10px wide at 1080px output.
Seven mathematically equal tracks (1350/7 CSS px), zero gap. Activate the first n tracks on slide n.
Slide 7 joins into one uninterrupted strip: the closed-book-spine payoff.
Publisher remains at x=58px / y=52px; eyebrow remains top right. Hierarchy: spine → publisher → story.

## Composition and review gate
Slides 1–5 default to full-bleed narrative magazine composition with text in the lower/bottom third.
An interior gallery variation may be proposed only when the story benefits; it is not implemented in this candidate.
Slide 6 must retain consequence/statistical hierarchy; Slide 7 must retain distinct reflective back-page closure.
Render only 1, 6, 7 first. Check image crop, copy fit, typography, rail geometry, attribution and ending contrast.
User approval of these anchors precedes Slides 2–5; production promotion remains separate.
The canonical hook is retained in the handoff; any division across headline/support to fit the existing word limits requires editorial review. Do not silently rewrite facts or final wording.

## CTA rule
Slides 1–6: no CTA/handle by default.
Slide 7: optional publication-style CTA, e.g. "Follow INTRST Films for stories worth remembering." No engagement-bait language.

## QA
Reject if:
- repeated layout makes slides feel templated;
- copy density overwhelms image;
- the reveal arrives too early or not at all;
- no slide creates forward pressure;
- every slide uses the same accent color behavior;
- the close is merely promotional instead of editorial.

## Implementation checkpoint — 2026-09-09
Existing HCTI HTML and render contract updated in place on the working branch. Canonical doctrine files brought forward from main at their existing paths, then revised as candidates; main is not promoted.
Static contract/selector checks pass. No HCTI calls or image proofs were produced in this session. Local browser verification was unavailable because the browser executable is not installed.
WIN 4 dependency: deliver and verify the exact A4 2400×3530 JPEG per the existing acquisition handoff, bind it to carousel background_image (the portrait template uses subject_image), and run only slides 1, 6, 7 through the existing Editorial Render Bridge. Credentials remain in n8n.
Check brand fonts loaded, real-copy fit and face crop, consequence escalation, reflective closure, source attribution and equal cumulative rail. Return the three proof URLs and execution/source revision evidence for user review. Do not silently substitute a different renderer or promote a low-resolution reference as production QA.
TPL-003 remains In Progress. No publication, distribution activation or idempotency changes.
