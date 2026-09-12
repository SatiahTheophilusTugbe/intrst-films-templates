import assert from "node:assert/strict";
import { BROWSER_PREFLIGHT_VERSION, inspectBrowserLayout, inspectPaintEvidence, REQUIRED_FONT_FACES } from "../browser-layout-preflight.mjs";

const nodes = new Map([
  [".photo", { tagName: "DIV", complete: true, naturalWidth: 1 }],
  [".source-photo", { tagName: "IMG", complete: true, naturalWidth: 1168 }],
]);
const document = {
  fonts: { status: "loaded", check: (face) => REQUIRED_FONT_FACES.includes(face) },
  defaultView: { getComputedStyle: (element) => element.tagName === "DIV" ? { backgroundImage: "url(https://example.test/a4.jpg)" } : { backgroundImage: "none" } },
  querySelector: (selector) => nodes.get(selector) ?? null,
};
assert.deepEqual(inspectBrowserLayout(document, { selectors: [".photo", ".source-photo"] }), []);
assert.ok(BROWSER_PREFLIGHT_VERSION.startsWith("browser-preflight@"));
assert.ok(inspectBrowserLayout({ fonts: { status: "loaded", check: () => false }, querySelector: () => null }).length > 0);
assert.ok(inspectBrowserLayout({ fonts: { status: "loaded", check: () => true }, defaultView: { getComputedStyle: () => ({ backgroundImage: "url(http://insecure.example/image.jpg)" }) }, querySelector: () => ({ tagName: "DIV" }) }).some((issue) => issue.includes("HTTPS")));
assert.ok(inspectBrowserLayout({ fonts: { status: "loaded", check: () => true }, defaultView: { getComputedStyle: () => ({ backgroundImage: "none" }) }, querySelector: () => ({ tagName: "DIV" }) }).some((issue) => issue.includes("did not parse")));
assert.ok(inspectBrowserLayout(document, { selectors: [".missing"] }).some((issue) => issue.includes("missing")));
assert.deepEqual(inspectPaintEvidence({ decoded: true, natural_width: 4288, natural_height: 2848, computed_background: "url(data:image/jpeg;base64,...)", changed_pixel_ratio: 0.72 }), []);
assert.equal(inspectPaintEvidence({ decoded: false, natural_width: 0, natural_height: 0, computed_background: "none", changed_pixel_ratio: 0 }).length, 3);
console.log("browser layout preflight tests: 7 passed");
