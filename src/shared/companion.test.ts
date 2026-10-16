import { describe, expect, it } from 'vitest'
import { DEFAULT_COMPANION, applyInteraction, levelInfo, lineFor, periodOf } from './companion'

describe('companion', () => {
  it('only ever increases bond', () => {
    let c = DEFAULT_COMPANION
    for (const k of ['pet', 'treat', 'play', 'rest'] as const) {
      const n = applyInteraction(c, k)
      expect(n.bond).toBeGreaterThanOrEqual(c.bond)
      c = n
    }
    expect(c.bond).toBe(5)
    expect(c.pets).toBe(1)
  })
  it('computes levels', () => {
    expect(levelInfo(0)).toEqual({ level: 1, into: 0, needed: 5 })
    expect(levelInfo(5).level).toBe(2)
    expect(levelInfo(20).level).toBe(3)
  })
  it('maps hours to periods', () => {
    expect(periodOf(8)).toBe('morning')
    expect(periodOf(13)).toBe('afternoon')
    expect(periodOf(19)).toBe('evening')
    expect(periodOf(2)).toBe('night')
  })
  it('picks lines deterministically with injected rnd', () => {
    expect(lineFor('pet', 'balanced', 'morning', () => 0)).toBe('*purr*')
    expect(lineFor('greet', 'balanced', 'morning', () => 0)).toBe('Good morning!')
  })
})
