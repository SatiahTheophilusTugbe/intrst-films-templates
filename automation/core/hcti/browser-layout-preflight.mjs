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

export const BROWSER_PREFLIGHT_VERSION = "browser-preflight@1.0.0";

export function inspectBrowserLayout(document, { selectors = [".photo", ".source-photo", ".detail-caption"], expectedFonts = REQUIRED_FONT_FACES } = {}) {
  const issues = [];
  if (!document?.fonts || document.fonts.status !== "loaded") issues.push("Fonts not ready");
  for (const face of expectedFonts) if (!document?.fonts?.check?.(face)) issues.push(`Required font face unavailable: ${face}`);
  for (const selector of selectors) {
    const element = document?.querySelector?.(selector);
    if (!element) continue;
    const style = document.defaultView?.getComputedStyle?.(element);
    const background = style?.backgroundImage ?? "none";
    if (background !== "none" && !/^url\(["']?https:\/\//i.test(background)) issues.push(`Background image is not an HTTPS URL: ${selector}`);
    if (element.tagName === "IMG" && (!element.complete || !element.naturalWidth)) issues.push(`Image not loaded: ${selector}`);
  }
  return issues;
}
