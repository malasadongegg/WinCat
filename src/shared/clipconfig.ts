/** User-adjustable clipboard privacy settings. */
export interface ClipConfig {
  /** largest single image kept, in MB */
  perImageMB: number
  /** all temporary images together, in MB */
  totalImagesMB: number
  /** built-in detection categories the user switched OFF (by name) */
  disabled: string[]
  /** extra patterns: plain text, with * as a wildcard. Matching text is treated as possibly sensitive. */
  patterns: string[]
}

/** names of the built-in detection categories (kept in sync with main/clipboard/sensitive.ts by a test) */
export const DETECTION_CATEGORIES = ['private key', 'AWS access key', 'GitHub token', 'JSON web token', 'API key / secret assignment', 'Slack token']

export const DEFAULT_CLIP_CONFIG: ClipConfig = { perImageMB: 5, totalImagesMB: 50, disabled: [], patterns: [] }

export const LIMITS = { perImageMB: [1, 50], totalImagesMB: [5, 500], patterns: 30, patternLength: 80 }

const clamp = (v: unknown, [lo, hi]: number[], fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fallback)

export function sanitizeClipConfig(raw: unknown, base: ClipConfig = DEFAULT_CLIP_CONFIG): ClipConfig {
  const r = (raw ?? {}) as Record<string, unknown>
  const patterns = Array.isArray(r.patterns)
    ? [...new Set((r.patterns as unknown[]).filter((p): p is string => typeof p === 'string').map((p) => p.trim().slice(0, LIMITS.patternLength)).filter((p) => p.length >= 3))].slice(0, LIMITS.patterns)
    : base.patterns
  const perImageMB = clamp(r.perImageMB, LIMITS.perImageMB, base.perImageMB)
  return {
    perImageMB,
    totalImagesMB: Math.max(perImageMB, clamp(r.totalImagesMB, LIMITS.totalImagesMB, base.totalImagesMB)),
    disabled: Array.isArray(r.disabled) ? (r.disabled as unknown[]).filter((d): d is string => typeof d === 'string').slice(0, 20) : base.disabled,
    patterns
  }
}
