import assert from "node:assert/strict";
import { BROWSER_PREFLIGHT_VERSION, inspectBrowserLayout, REQUIRED_FONT_FACES } from "../browser-layout-preflight.mjs";

const nodes = new Map([
  [".photo", { tagName: "DIV", complete: true, naturalWidth: 1 }],
  [".source-photo", { tagName: "IMG", complete: true, naturalWidth: 1168 }],
]);
const document = {
  fonts: { status: "loaded", check: (face) => REQUIRED_FONT_FACES.includes(face) },
  defaultView: { getComputedStyle: (element) => element.tagName === "DIV" ? { backgroundImage: "url(https://example.test/a4.jpg)" } : { backgroundImage: "none" } },
  querySelector: (selector) => nodes.get(selector) ?? null,
};
assert.deepEqual(inspectBrowserLayout(document), []);
assert.ok(BROWSER_PREFLIGHT_VERSION.startsWith("browser-preflight@"));
assert.ok(inspectBrowserLayout({ fonts: { status: "loaded", check: () => false }, querySelector: () => null }).length > 0);
assert.ok(inspectBrowserLayout({ fonts: { status: "loaded", check: () => true }, defaultView: { getComputedStyle: () => ({ backgroundImage: "url(http://insecure.example/image.jpg)" }) }, querySelector: () => ({ tagName: "DIV" }) }).some((issue) => issue.includes("HTTPS")));
console.log("browser layout preflight tests: 3 passed");
