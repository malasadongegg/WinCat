import { describe, expect, it } from 'vitest'
import { PET_SIZE, TUNING, clampPos, floorY, initialState, step, type PetState, type World } from './engine'

const w: World = { width: 1000, height: 700 }
const t = TUNING.balanced
const half = PET_SIZE / 2
const base: PetState = { x: 500, y: floorY(w), vx: 0, vy: 0, mode: 'sit', dir: 1, wall: 1, timer: 5, surface: null, goal: null, use: null, hop: false }

function run(s: PetState, secs: number, frozen = false, rnd = () => 0.5): PetState {
  for (let i = 0; i < secs * 60; i++) s = step(s, 1 / 60, w, t, frozen, rnd)
  return s
}

describe('pet engine', () => {
  it('a spawned cat falls to the floor and sits', () => {
    const s = run(initialState(w, 500), 3)
    expect(s.y).toBe(floorY(w))
    expect(s.mode).toBe('sit')
  })
  it('stays on screen while walking', () => {
    let s: PetState = { ...base, mode: 'walk', timer: 600 }
    for (let i = 0; i < 60 * 120; i++) {
      s = step(s, 1 / 60, w, t, false, () => 0.99) // never climbs: bounces off walls
      expect(s.x).toBeGreaterThanOrEqual(half)
      expect(s.x).toBeLessThanOrEqual(w.width - half)
    }
  })
  it('climbs a wall, then ends up falling or on the ceiling, never off-screen', () => {
    let s: PetState = { ...base, mode: 'walk', x: half + 1, dir: -1, timer: 600 }
    s = step(s, 0.1, w, t, false, () => 0) // rnd 0 < climb prob => climbs
    expect(s.mode).toBe('climb')
    for (let i = 0; i < 60 * 40; i++) {
      s = step(s, 1 / 60, w, t, false, () => 0.9)
      expect(s.y).toBeGreaterThanOrEqual(half)
      expect(s.y).toBeLessThanOrEqual(floorY(w))
    }
    expect(s.mode).not.toBe('climb') // it let go and came back down
  })
  it('a frozen (reacting) cat does not wander and drops from walls', () => {
    const still = run({ ...base, timer: 0.01 }, 5, true)
    expect(still.mode).toBe('sit')
    expect(still.x).toBe(500)
    const climbing = run({ ...base, mode: 'climb', x: half, y: 300, wall: -1, timer: 5 }, 4, true)
    expect(climbing.mode).toBe('sit')
  })
  it('drag mode is left alone and clampPos keeps the cat on screen', () => {
    const d = step({ ...base, mode: 'drag', y: 100 }, 1, w, t, false)
    expect(d.y).toBe(100)
    expect(clampPos(-50, 9999, w)).toEqual({ x: half, y: floorY(w) })
  })
  it('chases the pointer then pounces and lands', () => {
    let s: PetState = { ...base, mode: 'chase', x: 200, timer: 8 }
    const target = { x: 700, y: 300 }
    let pounced = false
    for (let i = 0; i < 60 * 12 && s.mode !== 'sit'; i++) {
      s = step(s, 1 / 60, w, t, false, () => 0.5, { target })
      if (s.mode === 'fall' && s.vy < 0) pounced = true
    }
    expect(pounced).toBe(true)
    expect(s.mode).toBe('sit')
    expect(s.x).toBeGreaterThan(500)
  })
  it('gives up chasing when the pointer is gone', () => {
    const s = step({ ...base, mode: 'chase', timer: 8 }, 1 / 60, w, t, false, () => 0.5, { target: null })
    expect(s.mode).toBe('sit')
  })
  it('licking and stretching end back in sit; zoomies stay on screen', () => {
    for (const mode of ['lick', 'stretch'] as const) expect(run({ ...base, mode, timer: 1 }, 2).mode).toBe('sit')
    let s: PetState = { ...base, mode: 'run', timer: 500 }
    for (let i = 0; i < 60 * 60; i++) {
      s = step(s, 1 / 60, w, t, false, () => 0.5)
      expect(s.x).toBeGreaterThanOrEqual(half)
      expect(s.x).toBeLessThanOrEqual(w.width - half)
    }
  })
})

describe('engine v2: windows, furniture, hops', () => {
  const win = { id: 7, left: 300, right: 900, top: 400 }
  const rise = floorY(w) - (win.top - PET_SIZE / 2)

  it('leaps onto a window top and stands on it', () => {
    // force the perch decision: make every other option unlikely by driving rnd to the last bucket
    let s: PetState = { ...base, x: 600, timer: 0 }
    let landed = false
    for (let i = 0; i < 60 * 20 && !landed; i++) {
      s = step(s, 1 / 60, w, t, false, () => 0.97, { platforms: [win] })
      if (s.surface === 7) landed = true
    }
    expect(rise).toBeGreaterThan(30)
    expect(landed).toBe(true)
    expect(s.y).toBe(win.top - PET_SIZE / 2)
    expect(s.x).toBeGreaterThanOrEqual(win.left)
    expect(s.x).toBeLessThanOrEqual(win.right)
  })
  it('falls when the window it stands on disappears or moves away', () => {
    const on: PetState = { ...base, x: 500, y: win.top - PET_SIZE / 2, surface: 7, mode: 'sit', timer: 99 }
    expect(step(on, 1 / 60, w, t, false, () => 0.5, { platforms: [win] }).mode).toBe('sit')
    const gone = run2(on, 3, { platforms: [] })
    expect(gone.surface).toBeNull()
    expect(gone.y).toBe(floorY(w))
    const moved = run2(on, 3, { platforms: [{ ...win, left: 700, right: 1100 }] })
    expect(moved.surface).toBeNull()
  })
  it('walks on a window without leaving its edges (turning or hopping off)', () => {
    let s: PetState = { ...base, x: 400, y: win.top - PET_SIZE / 2, surface: 7, mode: 'walk', timer: 500, dir: 1 }
    for (let i = 0; i < 60 * 40; i++) {
      s = step(s, 1 / 60, w, t, false, () => 0.1, { platforms: [win] })
      if (s.surface === 7) {
        expect(s.x).toBeGreaterThanOrEqual(win.left)
        expect(s.x).toBeLessThanOrEqual(win.right)
      }
    }
  })
  it('walks to furniture and uses it, then goes back to sitting', () => {
    const goals = [{ id: 'b1', type: 'bed' as const, x: 200 }]
    let s: PetState = { ...base, x: 600, mode: 'goto', goal: 'b1', timer: 20 }
    let used = false
    for (let i = 0; i < 60 * 60; i++) {
      s = step(s, 1 / 60, w, t, false, () => 0.5, { goals })
      if (s.mode === 'use') { used = true; expect(s.use).toBe('bed'); expect(Math.abs(s.x - 200)).toBeLessThan(1) }
    }
    expect(used).toBe(true)
    expect(s.mode).not.toBe('use')
  })
  it('a reaction interrupts furniture use', () => {
    const s = step({ ...base, mode: 'use', use: 'bed', goal: 'b1', timer: 30 }, 1 / 60, w, t, true)
    expect(s.mode).toBe('sit')
  })
  it('hops: leaves the ground, lands, then keeps strolling', () => {
    let s: PetState = { ...base, mode: 'fall', hop: true, vy: -340, vx: 50 }
    let airborne = false
    for (let i = 0; i < 60; i++) {
      s = step(s, 1 / 60, w, t, false, () => 0.5)
      if (s.y < floorY(w) - 5) airborne = true
    }
    expect(airborne).toBe(true)
    expect(s.mode).toBe('walk')
  })
  it('rests are short enough that the cat keeps doing things', () => {
    // from sitting, within 10 simulated seconds it should have started something else at least once
    let s: PetState = { ...base, timer: 0 }
    let acted = false
    for (let i = 0; i < 60 * 10 && !acted; i++) {
      s = step(s, 1 / 60, w, t, false, () => 0.5)
      if (s.mode !== 'sit') acted = true
    }
    expect(acted).toBe(true)
  })
})

function run2(s: PetState, secs: number, ctx: Parameters<typeof step>[6]): PetState {
  for (let i = 0; i < secs * 60; i++) s = step(s, 1 / 60, w, t, false, () => 0.5, ctx)
  return s
}

describe('engine v2: dropping onto windows from the ceiling', () => {
  it('crawling above a window, the cat drops onto it and stands there', () => {
    const win = { id: 9, left: 500, right: 900, top: 600 }
    let s: PetState = { ...base, mode: 'ceiling', x: 700, y: PET_SIZE / 2, dir: 1, timer: 60, surface: null }
    let onWindow = false
    let k = 0
    const cycling = () => (k++ % 100) / 100 // a spread of values, including very small ones
    for (let i = 0; i < 60 * 15 && !onWindow; i++) {
      s = step(s, 1 / 60, w, t, false, cycling, { platforms: [win] })
      if (s.surface === 9) onWindow = true
    }
    expect(onWindow).toBe(true)
    expect(s.y).toBe(win.top - PET_SIZE / 2)
  })
})
