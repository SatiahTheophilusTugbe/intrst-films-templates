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

export const BROWSER_PREFLIGHT_VERSION = "browser-preflight@2.0.0";

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
    if (element.tagName !== "IMG") issues.push(`Required semantic image element is not an IMG: ${selector}`);
    if (background !== "none" && /data:image\//i.test(background)) issues.push(`CSS image-byte binding is prohibited: ${selector}`);
    if (element.tagName === "IMG" && (!element.complete || !element.naturalWidth || !element.naturalHeight)) issues.push(`Image not loaded: ${selector}`);
  }
  return issues;
}

export function inspectPaintEvidence(evidence, selector = ".photo") {
  const issues = [];
  if (evidence?.decoded !== true || !Number.isFinite(evidence?.natural_width) || evidence.natural_width <= 0 || !Number.isFinite(evidence?.natural_height) || evidence.natural_height <= 0) {
    issues.push(`Image bytes did not decode in browser: ${selector}`);
  }
  if (evidence?.semantic_img !== true) issues.push(`Image binding is not semantic img src: ${selector}`);
  if (!Number.isFinite(evidence?.changed_pixel_ratio) || evidence.changed_pixel_ratio <= 0.01) issues.push(`Image did not differ materially from its blank control: ${selector}`);
  return issues;
}
