import { describe, expect, it } from 'vitest'
import { DEFAULT_CLIP_CONFIG, DETECTION_CATEGORIES, sanitizeClipConfig } from '../../shared/clipconfig'
import { BUILTIN_RULES, detectSensitive, isUsablePattern, matchesPattern } from './sensitive'

describe('user patterns', () => {
  it('match literally with * as a wildcard, case-insensitively', () => {
    expect(detectSensitive('my card is 4111-1111', [], [], ['card is *'])).toBe('your pattern')
    expect(detectSensitive('Project ORCHID launch', [], [], ['project orchid'])).toBe('your pattern')
    expect(detectSensitive('harmless text', [], [], ['project orchid'])).toBeNull()
  })
  it('regex characters in a pattern are not special', () => {
    expect(detectSensitive('price (a+b) = 3', [], [], ['(a+b)'])).toBe('your pattern')
    expect(detectSensitive('aab', [], [], ['(a+b)'])).toBeNull()
  })
  it('rejects too-short, too-long or too-wild patterns', () => {
    expect(isUsablePattern('ab')).toBe(false)
    expect(isUsablePattern('x'.repeat(81))).toBe(false)
    expect(isUsablePattern('a*b*c*d*e')).toBe(false)
    expect(isUsablePattern('**')).toBe(false)
    expect(isUsablePattern('card *')).toBe(true)
  })
  it('wildcards span a limited gap only', () => {
    expect(matchesPattern('card ' + 'x'.repeat(50) + ' 4111', 'card*4111')).toBe(true)
    expect(matchesPattern('card ' + 'x'.repeat(500) + ' 4111', 'card*4111')).toBe(false)
  })
  it('cannot be made to hang by hostile text (no catastrophic backtracking)', () => {
    const t0 = Date.now()
    expect(detectSensitive('a'.repeat(100_000), [], [], ['a*a*a*b'])).toBeNull()
    expect(detectSensitive('ab'.repeat(50_000), [], [], ['a*b*a*b', '*a*a*a*c'])).toBe('your pattern')
    expect(Date.now() - t0).toBeLessThan(2000)
  })
})

describe('categories', () => {
  it('can be switched off by name', () => {
    const t = '-----BEGIN RSA PRIVATE KEY-----'
    expect(detectSensitive(t)).toBe('private key')
    expect(detectSensitive(t, [], ['private key'])).toBeNull()
  })
  it('the settings list matches the real rules', () => {
    expect(DETECTION_CATEGORIES).toEqual(BUILTIN_RULES.map((r) => r.name))
  })
})

describe('clipboard config', () => {
  it('clamps limits, cleans patterns and keeps total >= per-image', () => {
    const c = sanitizeClipConfig({ perImageMB: 999, totalImagesMB: 1, patterns: ['  ok pattern  ', 'ab', 5, 'ok pattern'], disabled: ['x', 3] })
    expect(c.perImageMB).toBe(50)
    expect(c.totalImagesMB).toBe(50)
    expect(c.patterns).toEqual(['ok pattern'])
    expect(c.disabled).toEqual(['x'])
    expect(sanitizeClipConfig(null)).toEqual(DEFAULT_CLIP_CONFIG)
  })
})
