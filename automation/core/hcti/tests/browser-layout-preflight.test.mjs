import assert from "node:assert/strict";
import { BROWSER_PREFLIGHT_VERSION, inspectBrowserLayout, inspectPaintEvidence, REQUIRED_FONT_FACES } from "../browser-layout-preflight.mjs";

const nodes = new Map([
  [".photo", { tagName: "IMG", complete: true, naturalWidth: 2400, naturalHeight: 3530 }],
  [".source-photo", { tagName: "IMG", complete: true, naturalWidth: 1168, naturalHeight: 731 }],
]);
const document = {
  fonts: { status: "loaded", check: (face) => REQUIRED_FONT_FACES.includes(face) },
  defaultView: { getComputedStyle: () => ({ backgroundImage: "none" }) },
  querySelector: (selector) => nodes.get(selector) ?? null,
};
assert.deepEqual(inspectBrowserLayout(document, { selectors: [".photo", ".source-photo"] }), []);
assert.ok(BROWSER_PREFLIGHT_VERSION.startsWith("browser-preflight@"));
assert.ok(inspectBrowserLayout({ fonts: { status: "loaded", check: () => false }, querySelector: () => null }).length > 0);
assert.ok(inspectBrowserLayout({ fonts: { status: "loaded", check: () => true }, defaultView: { getComputedStyle: () => ({ backgroundImage: "none" }) }, querySelector: () => ({ tagName: "DIV" }) }).some((issue) => issue.includes("not an IMG")));
assert.ok(inspectBrowserLayout({ fonts: { status: "loaded", check: () => true }, defaultView: { getComputedStyle: () => ({ backgroundImage: "url(data:image/jpeg;base64,AAAA)" }) }, querySelector: () => ({ tagName: "IMG", complete: true, naturalWidth: 1, naturalHeight: 1 }) }).some((issue) => issue.includes("CSS image-byte")));
assert.ok(inspectBrowserLayout(document, { selectors: [".missing"] }).some((issue) => issue.includes("missing")));
assert.deepEqual(inspectPaintEvidence({ decoded: true, semantic_img: true, natural_width: 4288, natural_height: 2848, changed_pixel_ratio: 0.72 }), []);
assert.equal(inspectPaintEvidence({ decoded: false, semantic_img: false, natural_width: 0, natural_height: 0, changed_pixel_ratio: 0 }).length, 3);
console.log("browser layout preflight tests: 7 passed");
