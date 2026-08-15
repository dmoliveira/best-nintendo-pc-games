const PUBLIC_TEXT_ARTIFACT_EXTENSIONS = new Set([".html", ".js", ".css", ".xml", ".txt", ".json"]);
const PUBLIC_SECRET_PATTERN = /(?:\bsk-[A-Za-z0-9_-]{20,}\b|\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9_]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|["']?\b(?:api[_-]?key|authorization|bearer)\b["']?\s*[:=]\s*["']?(?:bearer\s+)?[A-Za-z0-9._~+\/=-]{12,})/i;

export function publicArtifactCredentialIssue(relativePath, text) {
  if (!PUBLIC_TEXT_ARTIFACT_EXTENSIONS.has(relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase())) return undefined;
  return PUBLIC_SECRET_PATTERN.test(text) ? `credential-like value found in ${relativePath}` : undefined;
}
