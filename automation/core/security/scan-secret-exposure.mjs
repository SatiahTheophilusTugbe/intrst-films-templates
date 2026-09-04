const PLACEHOLDER_PREFIXES = ["<", "${", "[REDACTED]", "REDACTED", "EXAMPLE", "PLACEHOLDER", "YOUR_"];
const SECRET_PATTERNS = Object.freeze([
  { code: "PRIVATE_KEY", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { code: "BEARER_TOKEN", pattern: /authorization\s*[:=]\s*bearer\s+([^\s"']+)/gi },
  { code: "N8N_API_KEY", pattern: /x-n8n-api-key\s*[:=]\s*([^\s"']+)/gi },
  { code: "ASSIGNED_SECRET", pattern: /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?([^\s"']+)/gi }
]);

function isPlaceholder(value) {
  return PLACEHOLDER_PREFIXES.some((prefix) => value.toUpperCase().startsWith(prefix.toUpperCase()));
}

export function scanSecretExposure(text) {
  const findings = [];
  for (const { code, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1] ?? match[0];
      if (code !== "PRIVATE_KEY" && (candidate.length < 12 || isPlaceholder(candidate))) continue;
      findings.push({ code, index: match.index });
    }
  }
  return findings;
}
