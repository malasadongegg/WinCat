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

const MAX_GAP = 200

/** Patterns must be 3-80 characters, have at most 3 wildcards and at least 2 real characters. */
export function isUsablePattern(pattern: string): boolean {
  const p = pattern.trim()
  return p.length >= 3 && p.length <= 80 && (p.match(/\*/g)?.length ?? 0) <= 3 && p.replace(/\*/g, '').length >= 2
}

/**
 * Case-insensitive "contains" match where `*` means "up to 200 other characters". Implemented
 * with plain string search (no regular expressions), so the worst case is linear in the text:
 * a pattern can never make the app hang, whatever is copied.
 */
export function matchesPattern(text: string, pattern: string): boolean {
  if (!isUsablePattern(pattern)) return false
  const parts = pattern.trim().toLowerCase().split('*').filter((x) => x.length > 0)
  if (!parts.length) return false
  const t = text.toLowerCase()
  let from = 0
  for (;;) {
    const start = t.indexOf(parts[0], from)
    if (start < 0) return false
    let pos = start + parts[0].length
    let ok = true
    for (let i = 1; i < parts.length; i++) {
      const k = t.slice(pos, pos + MAX_GAP + parts[i].length).indexOf(parts[i])
      if (k < 0) { ok = false; break }
      pos += k + parts[i].length
    }
    if (ok) return true
    from = start + 1
  }
}

/** Only the start of very long text is scanned. */
const SCAN_LIMIT = 20_000

/**
 * Returns the reason label of the first matching rule, or null. Never returns the matched text.
 * @param disabled built-in categories the user switched off
 * @param patterns the user's own wildcard patterns
 */
export function detectSensitive(text: string, extra: Rule[] = [], disabled: string[] = [], patterns: string[] = []): string | null {
  const t = text.length > SCAN_LIMIT ? text.slice(0, SCAN_LIMIT) : text
  for (const r of BUILTIN_RULES) if (!disabled.includes(r.name) && r.re.test(t)) return r.name
  for (const r of extra) if (r.re.test(t)) return r.name
  for (const p of patterns) if (matchesPattern(t, p)) return 'your pattern'
  return null
}
