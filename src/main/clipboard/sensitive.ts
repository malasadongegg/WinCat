export interface Rule {
  name: string
  re: RegExp
}

/** Built-in heuristics. Detection is imperfect: it will miss secrets and flag harmless text. */
export const BUILTIN_RULES: Rule[] = [
  { name: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'AWS access key', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { name: 'JSON web token', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { name: 'API key / secret assignment', re: /\b(api[_-]?key|secret|token|passwd|password)\b\s*[:=]\s*\S{8,}/i },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ }
]

/** Returns the reason label of the first matching rule, or null. Never returns the matched text. */
export function detectSensitive(text: string, extra: Rule[] = []): string | null {
  for (const r of [...BUILTIN_RULES, ...extra]) if (r.re.test(text)) return r.name
  return null
}
