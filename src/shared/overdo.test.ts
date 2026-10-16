import { describe, expect, it } from 'vitest'
import { OverdoTracker, awardsBond } from './overdo'

describe('overdo tracker', () => {
  it('treats: fine, fine, warn, then puke on the 4th within 5 minutes', () => {
    const t = new OverdoTracker()
    expect([0, 1, 2, 3].map((i) => t.record('treat', i * 1000))).toEqual(['ok', 'ok', 'warn', 'puke'])
  })
  it('treats spaced out over time never upset the cat', () => {
    const t = new OverdoTracker()
    for (let i = 0; i < 10; i++) expect(t.record('treat', i * 6 * 60_000)).toBe('ok')
  })
  it('the cat recovers after an over-do', () => {
    const t = new OverdoTracker()
    for (let i = 0; i < 4; i++) t.record('treat', i)
    expect(t.record('treat', 10)).toBe('ok')
  })
  it('rapid petting makes the cat grumpy; play makes it hyper; rest is never an issue', () => {
    const t = new OverdoTracker()
    const pets = Array.from({ length: 12 }, (_, i) => t.record('pet', i * 500))
    expect(pets[7]).toBe('warn')
    expect(pets[11]).toBe('annoyed')
    expect([0, 1, 2, 3].map((i) => t.record('play', i * 2000))).toEqual(['ok', 'ok', 'warn', 'hyper'])
    expect(t.record('rest', 0)).toBe('ok')
  })
  it('only normal interactions award bond', () => {
    expect(awardsBond('ok')).toBe(true)
    expect(awardsBond('warn')).toBe(true)
    for (const o of ['puke', 'annoyed', 'hyper'] as const) expect(awardsBond(o)).toBe(false)
  })
})
