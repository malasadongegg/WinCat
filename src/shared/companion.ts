import { DEFAULT_COSMETICS, type Cosmetics } from './cosmetics'
import type { RoomItem } from './catlife'

export const PERSONALITIES = ['balanced', 'playful', 'curious', 'affectionate', 'sleepy'] as const
export type Personality = (typeof PERSONALITIES)[number]

export type Interaction = 'pet' | 'treat' | 'play' | 'rest'

/**
 * Persistent companion state. Everything here only ever goes UP: there are no needs,
 * hunger, decay or penalties, and nothing changes while the app is closed.
 */
export interface CompanionState {
  personality: Personality
  bubbles: boolean
  /** sounds are OFF until the user turns them on */
  sound: boolean
  /** 0..1 */
  volume: number
  cosmetics: Cosmetics
  /** the cat may sit on top of open windows (only window positions are read) */
  perch: boolean
  /** counters behind achievements */
  stats: Record<string, number>
  /** achievement id -> unlocked at (ms epoch) */
  achievements: Record<string, number>
  /** collectible id -> how many found */
  collection: Record<string, number>
  /** placed furniture */
  room: RoomItem[]
  bond: number
  pets: number
  treats: number
  plays: number
  /** ms epoch of the previous session's end (0 = first run); used only for a friendly greeting */
  lastSeen: number
}

export const DEFAULT_COMPANION: CompanionState = {
  personality: 'balanced',
  bubbles: true,
  sound: false,
  volume: 0.4,
  cosmetics: DEFAULT_COSMETICS,
  perch: true,
  stats: {},
  achievements: {},
  collection: {},
  room: [],
  bond: 0,
  pets: 0,
  treats: 0,
  plays: 0,
  lastSeen: 0
}

export const BOND_GAIN: Record<Interaction, number> = { pet: 1, treat: 2, play: 2, rest: 0 }

export function levelInfo(bond: number): { level: number; into: number; needed: number } {
  // level n starts at 5*(n-1)^2 bond
  const level = Math.floor(Math.sqrt(bond / 5)) + 1
  const start = 5 * (level - 1) ** 2
  const next = 5 * level ** 2
  return { level, into: bond - start, needed: next - start }
}

export type Period = 'morning' | 'afternoon' | 'evening' | 'night'

export function periodOf(hour: number): Period {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export type LineEvent = Interaction | 'wake' | 'idle' | 'greet' | 'welcomeBack' | 'warnTreat' | 'warnPet' | 'warnPlay' | 'puke' | 'annoyed' | 'hyper' | 'tired'

const COMMON: Record<Exclude<LineEvent, 'idle' | 'greet'>, string[]> = {
  pet: ['*purr*', 'Mrrp!', 'That feels nice.', '*happy squint*'],
  treat: ['Nom nom nom!', 'Delicious!', 'Yum, thank you!'],
  play: ['Got it!', 'Wheee!', 'Again, again!', 'Pounce!'],
  rest: ['Zzz...', '*curls up*', 'Nap time...'],
  wake: ['*stretch* Mrrow.', 'Oh, hello!'],
  welcomeBack: ['Welcome back!', 'There you are!', 'I was napping. Hi!'],
  warnTreat: ["I'm getting full...", 'Maybe no more treats?'],
  warnPet: ['Okay okay, that is plenty...', 'Mrr... a little much.'],
  warnPlay: ['Getting... too excited...!', 'My paws are tingling!'],
  puke: ['Blegh... too many treats.', '*hurk* ...oops.'],
  annoyed: ['Hsss! Enough!', 'Too much petting!'],
  hyper: ['ZOOMIES!!', "Can't... stop... running!"],
  tired: ['*pant pant*', 'Phew... that was a lot.']
}

const GREET: Record<Period, string[]> = {
  morning: ['Good morning!', 'Morning! Sunny today?'],
  afternoon: ['Good afternoon!', 'Hope the day is going well.'],
  evening: ['Good evening!', 'Winding down?'],
  night: ['Still up? Take it easy.', 'Quiet night...']
}

const IDLE: Record<Personality, string[]> = {
  balanced: ['*looks around*', 'Mrrp.', 'Nice room, huh?'],
  playful: ['Want to play?', 'Where did my ball go?', '*tail wiggle*'],
  curious: ['What is that over there?', 'Ooh, the window!', '*sniff sniff*'],
  affectionate: ['I like it when you are near.', 'Pets later?', '*slow blink*'],
  sleepy: ['*yawn*', 'So cozy...', 'Five more minutes...']
}

/** Average gap between unprompted speech bubbles, per personality (ms). Sleepy cats talk least. */
export const IDLE_GAP_MS: Record<Personality, number> = {
  playful: 50_000,
  curious: 65_000,
  affectionate: 80_000,
  balanced: 90_000,
  sleepy: 150_000
}

export function lineFor(event: LineEvent, personality: Personality, period: Period, rnd: () => number = Math.random): string {
  const pool = event === 'idle' ? [...IDLE[personality], ...IDLE.balanced.slice(0, 1)] : event === 'greet' ? GREET[period] : COMMON[event]
  return pool[Math.floor(rnd() * pool.length)]
}

export function applyInteraction(c: CompanionState, kind: Interaction): CompanionState {
  const n = { ...c, bond: c.bond + BOND_GAIN[kind] }
  if (kind === 'pet') n.pets++
  if (kind === 'treat') n.treats++
  if (kind === 'play') n.plays++
  return n
}
