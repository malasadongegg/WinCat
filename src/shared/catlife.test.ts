import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, COLLECTIBLES, MAX_ROOM_ITEMS, isStat, moodFor, newlyUnlocked, pickCollectible, sanitizeRoom, seasonOf } from './catlife'
import { DEFAULT_COMPANION, type CompanionState } from './companion'

const base = (over: Partial<CompanionState> = {}): CompanionState => ({ ...DEFAULT_COMPANION, stats: {}, achievements: {}, collection: {}, room: [], ...over })

describe('seasons & moods', () => {
  it('maps months to seasons', () => {
    expect(seasonOf(new Date(2026, 0, 5))).toBe('winter')
    expect(seasonOf(new Date(2026, 3, 5))).toBe('spring')
    expect(seasonOf(new Date(2026, 6, 5))).toBe('summer')
    expect(seasonOf(new Date(2026, 9, 5))).toBe('autumn')
  })
  it('nights are slower and lazier than mornings', () => {
    expect(moodFor(2).speed).toBeLessThan(moodFor(9).speed)
    expect(moodFor(2).restless).toBeLessThan(moodFor(9).restless)
    expect(moodFor(14).label).toBe('afternoon')
  })
})

describe('collectibles', () => {
  it('only offers seasonal finds in their season', () => {
    for (let i = 0; i < 300; i++) {
      const c = pickCollectible('winter', () => i / 300)
      expect(!c.season || c.season === 'winter').toBe(true)
    }
    expect(COLLECTIBLES.some((c) => c.season === 'autumn')).toBe(true)
  })
})

describe('room', () => {
  it('keeps only known, unlocked, unique pieces within bounds', () => {
    const raw = [
      { id: 'a', type: 'ball', x: 0.5 },
      { id: 'a', type: 'ball', x: 0.6 }, // duplicate id
      { id: 'b', type: 'post', x: 0.2 }, // needs level 4
      { id: 'c', type: 'sofa', x: 0.2 }, // unknown
      { id: 'd', type: 'bed', x: 9 } // clamped
    ]
    const r = sanitizeRoom(raw, 2)
    expect(r.map((x) => x.id)).toEqual(['a', 'd'])
    expect(r[1].x).toBe(0.97)
  })
  it('caps the number of items and rejects junk', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: 'i' + i, type: 'ball', x: 0.5 }))
    expect(sanitizeRoom(many, 1)).toHaveLength(MAX_ROOM_ITEMS)
    expect(sanitizeRoom('nope', 9)).toEqual([])
  })
})

describe('achievements', () => {
  it('unlock from stats and never repeat', () => {
    const c = base({ pets: 1, stats: { puke: 1 } })
    expect(newlyUnlocked(c).map((a) => a.id).sort()).toEqual(['first_pet', 'oops'])
    expect(newlyUnlocked({ ...c, achievements: { first_pet: 1, oops: 1 } })).toEqual([])
  })
  it('collection and level based ones work', () => {
    const coll = Object.fromEntries(COLLECTIBLES.slice(0, 8).map((x) => [x.id, 1]))
    expect(newlyUnlocked(base({ collection: coll })).some((a) => a.id === 'found_all')).toBe(true)
    expect(newlyUnlocked(base({ bond: 20 })).some((a) => a.id === 'level_3')).toBe(true)
  })
  it('every achievement has a unique id', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
  })
  it('only whitelisted stat names are accepted from the overlay', () => {
    expect(isStat('perch')).toBe(true)
    expect(isStat('__proto__')).toBe(false)
    expect(isStat(5)).toBe(false)
  })
})
