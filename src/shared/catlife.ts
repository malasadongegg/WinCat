/**
 * "Cat life": seasons, moods, collectibles, furniture and achievements.
 * Everything here only ever adds things. There are no timers, streaks, expiries or penalties.
 */
import type { CompanionState } from './companion'
import { levelInfo } from './companion'

// ---------- seasons & time-of-day moods (local date and clock only, no network) ----------
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export function seasonOf(date: Date): Season {
  const m = date.getMonth() // 0 = Jan
  if (m >= 2 && m <= 4) return 'spring'
  if (m >= 5 && m <= 7) return 'summer'
  if (m >= 8 && m <= 10) return 'autumn'
  return 'winter'
}

export interface Mood {
  /** multiplies walking speed */
  speed: number
  /** multiplies how quickly it gets up to something new (lower = lazier) */
  restless: number
  label: 'morning' | 'afternoon' | 'evening' | 'night'
}

export function moodFor(hour: number): Mood {
  if (hour >= 5 && hour < 12) return { speed: 1.1, restless: 1.15, label: 'morning' }
  if (hour >= 12 && hour < 17) return { speed: 1, restless: 1, label: 'afternoon' }
  if (hour >= 17 && hour < 21) return { speed: 0.95, restless: 0.9, label: 'evening' }
  return { speed: 0.7, restless: 0.6, label: 'night' }
}

export const SEASON_LINES: Record<Season, string[]> = {
  spring: ['Smells like flowers!', 'Spring! Everything is blooming.'],
  summer: ['So warm... sunbeam time.', 'Summer days are the best.'],
  autumn: ['Crunchy leaves!', 'Cozy autumn weather.'],
  winter: ['Brrr... where is the blanket?', 'Winter nap weather.']
}

// ---------- collectibles ----------
export interface Collectible {
  id: string
  label: string
  rarity: 'common' | 'uncommon' | 'rare'
  /** only found in this season (otherwise any) */
  season?: Season
}

export const COLLECTIBLES: Collectible[] = [
  { id: 'button', label: 'Shiny button', rarity: 'common' },
  { id: 'feather', label: 'Little feather', rarity: 'common' },
  { id: 'bottlecap', label: 'Bottle cap', rarity: 'common' },
  { id: 'fishbone', label: 'Fish bone', rarity: 'common' },
  { id: 'pebble', label: 'Smooth pebble', rarity: 'common' },
  { id: 'ribbon', label: 'Red ribbon', rarity: 'uncommon' },
  { id: 'coin', label: 'Old coin', rarity: 'uncommon' },
  { id: 'key', label: 'Tiny key', rarity: 'rare' },
  { id: 'star', label: 'Fallen star', rarity: 'rare' },
  { id: 'flower', label: 'Spring flower', rarity: 'uncommon', season: 'spring' },
  { id: 'shell', label: 'Sea shell', rarity: 'uncommon', season: 'summer' },
  { id: 'leaf', label: 'Golden leaf', rarity: 'uncommon', season: 'autumn' },
  { id: 'snowflake', label: 'Snowflake', rarity: 'uncommon', season: 'winter' }
]

const WEIGHT = { common: 6, uncommon: 3, rare: 1 }

/** pick something to find; seasonal items only appear in their season */
export function pickCollectible(season: Season, rnd: () => number = Math.random): Collectible {
  const pool = COLLECTIBLES.filter((c) => !c.season || c.season === season)
  const total = pool.reduce((a, c) => a + WEIGHT[c.rarity], 0)
  let r = rnd() * total
  for (const c of pool) {
    r -= WEIGHT[c.rarity]
    if (r <= 0) return c
  }
  return pool[0]
}

// ---------- furniture ----------
export type FurnitureType = 'ball' | 'bed' | 'box' | 'post'

export interface FurnitureDef {
  type: FurnitureType
  label: string
  /** bond level needed */
  level: number
  hint: string
}

export const FURNITURE: FurnitureDef[] = [
  { type: 'ball', label: 'Yarn ball', level: 1, hint: 'Your cat bats it around.' },
  { type: 'bed', label: 'Cozy bed', level: 2, hint: 'A place for long naps.' },
  { type: 'box', label: 'Cardboard box', level: 3, hint: 'If it fits, it sits.' },
  { type: 'post', label: 'Scratching post', level: 4, hint: 'Good for stretching claws.' }
]

export interface RoomItem {
  id: string
  type: FurnitureType
  /** horizontal position as a fraction of the screen width (0..1), so it survives resolution changes */
  x: number
}

export const MAX_ROOM_ITEMS = 8

/** Validate a room from untrusted input: known types, unlocked at this level, clamped, capped. */
export function sanitizeRoom(raw: unknown, level: number): RoomItem[] {
  if (!Array.isArray(raw)) return []
  const out: RoomItem[] = []
  const ids = new Set<string>()
  for (const r of raw) {
    const o = r as Partial<RoomItem>
    const def = FURNITURE.find((f) => f.type === o?.type)
    if (!def || def.level > level) continue
    if (typeof o.id !== 'string' || !o.id || o.id.length > 64 || ids.has(o.id)) continue
    ids.add(o.id)
    const x = typeof o.x === 'number' && Number.isFinite(o.x) ? Math.min(0.97, Math.max(0.03, o.x)) : 0.5
    out.push({ id: o.id, type: def.type, x })
    if (out.length >= MAX_ROOM_ITEMS) break
  }
  return out
}

// ---------- the cat's own room (opt-in) ----------
export type RoomSlot = 'wall' | 'floor' | 'window' | 'rug' | 'art' | 'plant' | 'lamp'

export interface RoomOption {
  id: string
  label: string
  /** bond level needed */
  level: number
}

export const ROOM_OPTIONS: Record<RoomSlot, RoomOption[]> = {
  wall: [
    { id: 'cream', label: 'Cream', level: 1 },
    { id: 'mint', label: 'Mint', level: 1 },
    { id: 'sky', label: 'Sky blue', level: 2 },
    { id: 'blush', label: 'Blush', level: 2 },
    { id: 'stripes', label: 'Stripes', level: 3 },
    { id: 'dots', label: 'Polka dots', level: 4 },
    { id: 'night', label: 'Starry night', level: 5 },
    { id: 'forest', label: 'Forest', level: 6 }
  ],
  floor: [
    { id: 'wood', label: 'Wood', level: 1 },
    { id: 'light', label: 'Light wood', level: 2 },
    { id: 'tile', label: 'Tiles', level: 3 },
    { id: 'carpet', label: 'Carpet', level: 4 },
    { id: 'dark', label: 'Dark wood', level: 5 }
  ],
  window: [
    { id: 'auto', label: 'Follows the clock', level: 1 },
    { id: 'day', label: 'Sunny day', level: 1 },
    { id: 'sunset', label: 'Sunset', level: 2 },
    { id: 'night', label: 'Night sky', level: 2 },
    { id: 'snow', label: 'Snowfall', level: 4 }
  ],
  rug: [
    { id: 'none', label: 'None', level: 1 },
    { id: 'red', label: 'Red rug', level: 2 },
    { id: 'blue', label: 'Blue rug', level: 3 },
    { id: 'paw', label: 'Paw rug', level: 5 }
  ],
  art: [
    { id: 'none', label: 'None', level: 1 },
    { id: 'fish', label: 'Fish poster', level: 2 },
    { id: 'frame', label: 'Picture', level: 3 },
    { id: 'clock', label: 'Wall clock', level: 4 },
    { id: 'garland', label: 'Garland', level: 5 }
  ],
  plant: [
    { id: 'none', label: 'None', level: 1 },
    { id: 'sprout', label: 'Sprout', level: 2 },
    { id: 'cactus', label: 'Cactus', level: 3 },
    { id: 'fern', label: 'Fern', level: 5 }
  ],
  lamp: [
    { id: 'none', label: 'None', level: 1 },
    { id: 'desk', label: 'Cozy lamp', level: 3 }
  ]
}

export type RoomStyle = Record<RoomSlot, string>

export const DEFAULT_ROOM_STYLE: RoomStyle = { wall: 'cream', floor: 'wood', window: 'auto', rug: 'none', art: 'none', plant: 'none', lamp: 'none' }

export type RoomSize = 'small' | 'medium' | 'large'
export const ROOM_DIMS: Record<RoomSize, { w: number; h: number }> = {
  small: { w: 420, h: 260 },
  medium: { w: 560, h: 320 },
  large: { w: 720, h: 380 }
}

/** the cat is asked once whether it may have its own room; never nagged afterwards */
export type RoomOffer = 'unasked' | 'accepted' | 'declined'
export const ROOM_OFFER_LEVEL = 2

/** Keep only known options unlocked at this level; anything else keeps its previous value. */
export function sanitizeRoomStyle(raw: unknown, level: number, base: RoomStyle = DEFAULT_ROOM_STYLE): RoomStyle {
  const r = (raw ?? {}) as Record<string, unknown>
  const out: RoomStyle = { ...base }
  for (const slot of Object.keys(ROOM_OPTIONS) as RoomSlot[]) {
    const id = r[slot]
    const opt = typeof id === 'string' ? ROOM_OPTIONS[slot].find((o) => o.id === id) : undefined
    if (opt && opt.level <= level) out[slot] = opt.id
  }
  return out
}

// ---------- stats & achievements ----------
export const STAT_NAMES = [
  'puke', 'annoyed', 'hyper', 'perch', 'chase', 'nap', 'found',
  'bedUse', 'boxUse', 'postUse', 'ballUse', 'noteCreated', 'snippetCreated', 'furniturePlaced', 'roomMoved', 'roomStyled'
] as const
export type StatName = (typeof STAT_NAMES)[number]

export const isStat = (v: unknown): v is StatName => typeof v === 'string' && (STAT_NAMES as readonly string[]).includes(v)

export interface Achievement {
  id: string
  title: string
  desc: string
  done: (c: CompanionState) => boolean
}

const st = (c: CompanionState, k: StatName) => c.stats?.[k] ?? 0
const lvl = (c: CompanionState) => levelInfo(c.bond).level

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_pet', title: 'First pets', desc: 'Pet your cat for the first time.', done: (c) => c.pets >= 1 },
  { id: 'pet_50', title: 'Cuddle expert', desc: 'Pet your cat 50 times.', done: (c) => c.pets >= 50 },
  { id: 'treat_10', title: 'Snack time', desc: 'Give 10 treats.', done: (c) => c.treats >= 10 },
  { id: 'play_10', title: 'Playmates', desc: 'Play 10 times.', done: (c) => c.plays >= 10 },
  { id: 'level_3', title: 'Good friends', desc: 'Reach bond level 3.', done: (c) => lvl(c) >= 3 },
  { id: 'level_6', title: 'Best friends', desc: 'Reach bond level 6.', done: (c) => lvl(c) >= 6 },
  { id: 'oops', title: 'Oops!', desc: 'Give too many treats.', done: (c) => st(c, 'puke') >= 1 },
  { id: 'grumpy', title: 'Personal space', desc: 'Pet your cat a bit too much.', done: (c) => st(c, 'annoyed') >= 1 },
  { id: 'zoomies', title: 'Zoomies!', desc: 'Play until your cat gets hyper.', done: (c) => st(c, 'hyper') >= 1 },
  { id: 'perch_1', title: 'Top of the world', desc: 'See your cat sit on a window.', done: (c) => st(c, 'perch') >= 1 },
  { id: 'perch_10', title: 'Rooftop regular', desc: 'Your cat perched on windows 10 times.', done: (c) => st(c, 'perch') >= 10 },
  { id: 'hunter', title: 'The hunt', desc: 'Your cat chased your cursor.', done: (c) => st(c, 'chase') >= 1 },
  { id: 'nap', title: 'Night owl', desc: 'Your cat dozed off at night.', done: (c) => st(c, 'nap') >= 1 },
  { id: 'found_5', title: 'Little treasures', desc: 'Collect 5 things your cat found.', done: (c) => st(c, 'found') >= 5 },
  { id: 'found_all', title: 'Curator', desc: 'Collect 8 different kinds of finds.', done: (c) => Object.keys(c.collection ?? {}).length >= 8 },
  { id: 'writer', title: 'Note to self', desc: 'Write your first note.', done: (c) => st(c, 'noteCreated') >= 1 },
  { id: 'snipper', title: 'Handy snippets', desc: 'Save 5 snippets.', done: (c) => st(c, 'snippetCreated') >= 5 },
  { id: 'decorator', title: 'Interior designer', desc: 'Place some furniture.', done: (c) => st(c, 'furniturePlaced') >= 1 },
  { id: 'cozy', title: 'Cozy corner', desc: 'Watch your cat use its bed.', done: (c) => st(c, 'bedUse') >= 1 },
  { id: 'box', title: 'If it fits', desc: 'Watch your cat sit in a box.', done: (c) => st(c, 'boxUse') >= 1 },
  { id: 'home', title: 'Home sweet home', desc: 'Give your cat its own room.', done: (c) => st(c, 'roomMoved') >= 1 },
  { id: 'designer', title: 'Cozy designer', desc: 'Redecorate the cat room 5 times.', done: (c) => st(c, 'roomStyled') >= 5 }
]

/** ids newly satisfied (not already unlocked) */
export function newlyUnlocked(c: CompanionState): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !c.achievements?.[a.id] && a.done(c))
}
