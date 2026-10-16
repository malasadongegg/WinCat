import { describe, expect, it } from 'vitest'
import { TUNING, floorY, initialState, step, type PetState } from './engine'

describe('simulation with real randomness', () => {
  it('a curious cat perches on a tall-ish window within a few minutes', () => {
    const w = { width: 2560, height: 1400 }
    const win = { id: 1, left: 707, right: 1593, top: 700 }
    let landings = 0
    let leaps = 0
    const modes: Record<string, number> = {}
    for (let trial = 0; trial < 20; trial++) {
      let s: PetState = initialState(w, 1200)
      let wasOn = false
      for (let i = 0; i < 60 * 180; i++) {
        s = step(s, 1 / 60, w, TUNING.curious, false, Math.random, { platforms: [win] })
        modes[s.mode] = (modes[s.mode] ?? 0) + 1
        if (s.mode === 'leap' && !wasOn) leaps++
        const on = s.surface === 1
        if (on && !wasOn) landings++
        wasOn = on
      }
    }
    console.log('SIM landings', landings, 'leaps', leaps, JSON.stringify(modes))
    expect(floorY(w)).toBe(1352)
    expect(landings).toBeGreaterThan(0)
  })
})
