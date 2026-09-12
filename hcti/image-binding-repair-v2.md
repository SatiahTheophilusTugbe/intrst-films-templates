# WIN 5 — Browser-safe image-binding repair

Implementation: semantic-image-v2. Design/crop geometry: approved-crop-v1.

All four formats now have versioned `template-image-v2.html` and `render-contract-image-v2.json` files in their existing folders. Existing templates and historical locks are retained. Select `four-format-master-lock-v2.json`; single-image v0.5 lock supersedes v0.4 for binding only. Do not mix old locks with new templates.

Portrait, carousel and archive images use semantic img src bindings underneath existing design layers. Each image fills its viewport with width/height 100%, object-fit cover and versioned object-position. Landscape and book retain their exact prior zoom through a clipped image wrapper and transform origin. Evidence already used semantic images; its versioned template retains contain fitting and the caption's intrinsic aspect ratio to preserve the complete source material. Hidden, unused legacy image placeholders are not instantiated.

## Source and derivative decisions

No new render derivatives were necessary. The six photographic masters remain byte-for-byte unchanged, including the full Open Book JPEG: 4288×2848, 5,264,182 bytes, SHA-256 16849bf7ef5fa0860deb2c5c92efa65fac0e86116988ebb90d8934204b630f62. Existing deterministic LOC PDF photo/caption crops are reused unchanged. The manifest records canonical IDs, source/render/derivative hashes, dimensions, MIME, transformations and crop controls. Future derivatives may use deterministic resize, crop, sRGB normalization, optimization or orientation normalization with the same required provenance fields. No generative transformations are permitted.

## Validation

Ten exact 1080×1350 semantic-image screenshots cover single, all seven carousel slides, archive and evidence. Eleven required image elements (evidence has two) are checked for complete/natural dimensions, decoded-byte SHA-256, computed visibility and pixel differences in their clipped image regions against independent blank controls. Pixel checks require more than 1% of the image region to change by over 8 channel levels. DOM geometry and headline/collision gates run on all ten cases. Incorrect hash controls must reject.

Parity reference: the locked CSS templates using working local file URLs, with identical original image bytes and fonts. This measures preservation of the intended design without depending on the broken CSS data-URI binding. Maximum whole-image mean absolute channel difference is below 1/255; small rasterization differences are not treated as redesign. No HCTI parity is claimed.

The approved visual designs are preserved: typography, text, scrims (including carousel .78), bleeds, colors, credits, ghost numbers, spine and crop intent remain unchanged. Intentional off-canvas archive crop and image zoom are clipped as before; text remains within its approved layout.

## WIN 4 handoff

Use the new master lock and each new contract/template path, preserving the existing fixtures and registering exact image hashes. Escape attribute values and allow only registered URLs or validated MIME/base64 image data. Decode images, await fonts, run image-binding-gate-v2.js plus the layout preflight, and perform blank-control and screenshot checks before any later provider run. Hidden/missing required images or mismatched bytes reject the render. The gate helper alone does not replace screenshot validation.

This repair makes zero HCTI calls, does not authorize a retry of execution 36219, does not publish, and does not modify AUT-014.
