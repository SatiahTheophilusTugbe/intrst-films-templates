export const REQUIRED_FONT_FACES = Object.freeze([
  "600 92px Cormorant Garamond",
  "700 92px Cormorant Garamond",
  "400 16px Inter",
  "500 16px Inter",
  "600 16px Inter",
  "700 16px Inter",
  "600 16px Manrope",
  "700 16px Manrope",
  "800 16px Manrope",
]);

export const BROWSER_PREFLIGHT_VERSION = "browser-preflight@1.1.0";

export function inspectBrowserLayout(document, { selectors = [".photo", ".source-photo", ".detail-caption"], expectedFonts = REQUIRED_FONT_FACES } = {}) {
  const issues = [];
  if (!document?.fonts || document.fonts.status !== "loaded") issues.push("Fonts not ready");
  for (const face of expectedFonts) if (!document?.fonts?.check?.(face)) issues.push(`Required font face unavailable: ${face}`);
  for (const selector of selectors) {
    const element = document?.querySelector?.(selector);
    if (!element) {
      issues.push(`Required image element is missing: ${selector}`);
      continue;
    }
    const style = document.defaultView?.getComputedStyle?.(element);
    const background = style?.backgroundImage ?? "none";
    if (element.tagName !== "IMG" && background === "none") issues.push(`Background image did not parse or load: ${selector}`);
    if (background !== "none" && !/^url\(["']?(?:https:\/\/|data:image\/(?:png|jpe?g|webp);base64,)/i.test(background)) issues.push(`Background image is not an approved HTTPS URL or image data URI: ${selector}`);
    if (element.tagName === "IMG" && (!element.complete || !element.naturalWidth)) issues.push(`Image not loaded: ${selector}`);
  }
  return issues;
}

export function inspectPaintEvidence(evidence, selector = ".photo") {
  const issues = [];
  if (evidence?.decoded !== true || !Number.isFinite(evidence?.natural_width) || evidence.natural_width <= 0 || !Number.isFinite(evidence?.natural_height) || evidence.natural_height <= 0) {
    issues.push(`Image bytes did not decode in browser: ${selector}`);
  }
  if (evidence?.computed_background === "none") issues.push(`Computed background image is none: ${selector}`);
  if (!Number.isFinite(evidence?.changed_pixel_ratio) || evidence.changed_pixel_ratio <= 0) issues.push(`Image produced no visible pixels in its required region: ${selector}`);
  return issues;
}
