/**
 * Procedural chibi pixel-art black cat (side view, facing right) on a 32x32 grid.
 * Frames are drawn from shapes at startup, so there are no art assets to license or ship.
 * The ANIMS table at the bottom is the only thing the renderer depends on: it can be swapped
 * for PNG sprite sheets later without touching the pet logic.
 */
import { Grid, GRID, PALETTE, buildProps, paletteFor } from './pixelGrid'

export { Grid, GRID, PALETTE, buildProps, paletteFor }
export type { Cell } from './pixelGrid'

/** hat equipped while frames are being built (set by buildFrames) */
let HAT = 'none'

type Eyes = 'open' | 'blink' | 'happy' | 'closed' | 'wide' | 'angry' | 'sleepy' | 'surprised' | 'lookL' | 'lookR'
type Ears = 'up' | 'twitch' | 'back'
interface FaceOpts {
  blush?: boolean
  mouth?: 'open' | 'oh'
  ears?: Ears
}

/** one eye, 3px wide, top-left at (ex, ey) */
function eye(g: Grid, ex: number, ey: number, style: Eyes): void {
  switch (style) {
    case 'open':
      g.rect(ex, ey, 3, 3, 'E'); g.set(ex + 1, ey + 1, 'K'); g.set(ex + 1, ey + 2, 'K'); g.set(ex, ey, 'W'); break
    case 'lookL':
      g.rect(ex, ey, 3, 3, 'E'); g.set(ex, ey + 1, 'K'); g.set(ex, ey + 2, 'K'); break
    case 'lookR':
      g.rect(ex, ey, 3, 3, 'E'); g.set(ex + 2, ey + 1, 'K'); g.set(ex + 2, ey + 2, 'K'); g.set(ex, ey, 'W'); break
    case 'wide':
      g.rect(ex, ey - 1, 3, 4, 'E'); g.set(ex + 1, ey, 'K'); g.set(ex + 1, ey + 1, 'K'); g.set(ex, ey - 1, 'W'); break
    case 'surprised':
      g.rect(ex, ey - 1, 3, 4, 'E'); g.set(ex + 1, ey + 1, 'K'); g.set(ex, ey - 1, 'W'); g.set(ex + 2, ey - 1, 'W'); break
    case 'sleepy':
      g.rect(ex, ey, 3, 3, 'E'); g.rect(ex, ey, 3, 1, 'F'); g.set(ex + 1, ey + 2, 'K'); break
    case 'blink':
      g.rect(ex, ey + 2, 3, 1, 'S'); break
    case 'closed':
      g.set(ex, ey + 1, 'S'); g.set(ex + 1, ey + 2, 'S'); g.set(ex + 2, ey + 1, 'S'); break
    case 'happy':
      g.set(ex, ey + 2, 'E'); g.set(ex + 1, ey + 1, 'E'); g.set(ex + 2, ey + 2, 'E'); break
    case 'angry':
      g.rect(ex, ey + 1, 3, 2, 'X'); g.set(ex + 1, ey + 2, 'K'); g.rect(ex, ey, 3, 1, 'K'); break
  }
}

function drawHat(g: Grid, hx: number, hy: number): void {
  const ey = hy - 1
  const fx = hx + 2
  if (HAT === 'bow') {
    const px: Array<[number, number, string]> = [[2, -7, 'P'], [3, -7, 'P'], [2, -6, 'P'], [3, -6, 'P'], [4, -6, 'R'], [5, -6, 'P'], [6, -6, 'P'], [5, -7, 'P'], [6, -7, 'P'], [3, -5, 'P'], [5, -5, 'P']]
    for (const [x, y, k] of px) g.set(hx + x, hy + y, k)
  } else if (HAT === 'party') {
    g.poly([[hx - 3.5, hy - 5], [hx, hy - 13], [hx + 3.5, hy - 5]], 'P')
    for (const [x, y] of [[-2, -6], [0, -8], [1, -10], [-1, -11]] as Array<[number, number]>) g.set(hx + x, hy + y, 'Y')
    g.set(hx, hy - 13, 'Y'); g.set(hx + 1, hy - 13, 'Y'); g.set(hx, hy - 14, 'Y')
  } else if (HAT === 'crown') {
    g.rect(hx - 4, hy - 9, 9, 3, 'G')
    for (const x of [-4, 0, 4]) { g.set(hx + x, hy - 10, 'G'); g.set(hx + x, hy - 11, 'G') }
    g.set(hx, hy - 12, 'G'); g.set(hx, hy - 8, 'R'); g.set(hx - 2, hy - 7, 'W'); g.set(hx + 2, hy - 7, 'W')
  } else if (HAT === 'glasses') {
    for (const ex of [fx - 4, fx + 1]) {
      for (let i = -1; i <= 3; i++) { g.set(ex + i, ey - 1, 'W'); g.set(ex + i, ey + 3, 'W') }
      g.set(ex - 1, ey, 'W'); g.set(ex - 1, ey + 1, 'W'); g.set(ex - 1, ey + 2, 'W')
      g.set(ex + 3, ey, 'W'); g.set(ex + 3, ey + 1, 'W'); g.set(ex + 3, ey + 2, 'W')
    }
  } else if (HAT === 'sunglasses') {
    for (const ex of [fx - 4, fx + 1]) { g.rect(ex - 1, ey - 1, 5, 4, 'K'); g.set(ex, ey, 'W') }
    g.rect(fx - 1, ey, 2, 1, 'K')
    g.set(fx - 6, ey, 'K'); g.set(fx + 5, ey, 'K')
  } else if (HAT === 'flower') {
    const cols = ['P', 'Y', 'W', 'P', 'Y', 'W', 'P', 'Y']
    for (let i = 0; i < 8; i++) { g.set(hx - 6 + i * 1.7, hy - 6 - (i % 2), cols[i]); g.set(hx - 6 + i * 1.7, hy - 5, 'G') }
    g.set(hx, hy - 8, 'X')
  } else if (HAT === 'headphones') {
    for (let i = -6; i <= 6; i++) g.set(hx + i, hy - 6 - (Math.abs(i) < 5 ? 1 : 0), 'T')
    g.rect(hx - 8, hy - 2, 2, 5, 'T'); g.rect(hx + 6, hy - 2, 2, 5, 'T')
    g.set(hx - 7, hy - 3, 'T'); g.set(hx + 6, hy - 3, 'T')
  } else if (HAT === 'wizard') {
    g.poly([[hx - 4.5, hy - 5], [hx + 1.5, hy - 13], [hx + 5, hy - 5]], 'N')
    g.rect(hx - 7, hy - 6, 14, 1, 'N')
    g.set(hx, hy - 8, 'Y'); g.set(hx + 2, hy - 10, 'Y'); g.set(hx - 2, hy - 6, 'U'); g.set(hx + 1, hy - 12, 'W')
  } else if (HAT === 'santa') {
    g.poly([[hx - 5, hy - 5], [hx + 3, hy - 12], [hx + 5.5, hy - 5]], 'X')
    g.rect(hx - 6, hy - 6, 12, 2, 'W')
    g.set(hx + 3, hy - 13, 'W'); g.set(hx + 4, hy - 13, 'W'); g.set(hx + 4, hy - 12, 'W'); g.set(hx + 3, hy - 12, 'W')
  } else if (HAT === 'halo') {
    for (let i = -3; i <= 3; i++) { g.set(hx + i, hy - 11, 'G'); g.set(hx + i, hy - 9, 'G') }
    g.set(hx - 4, hy - 10, 'G'); g.set(hx + 4, hy - 10, 'G')
  }
}

/** big round head with ears, big eyes, nose and mouth */
function head(g: Grid, hx: number, hy: number, eyes: Eyes, o: FaceOpts = {}): void {
  g.ellipse(hx, hy, 7, 6, 'B')
  const ears = o.ears ?? 'up'
  const tw = ears === 'twitch' ? [-1, 1] : [0, 0]
  const bk = ears === 'back'
  g.poly([[hx - 6.5, hy - 2], [hx - 5.5 + tw[0] - (bk ? 3 : 0), hy - 9 + tw[1] + (bk ? 1 : 0)], [hx - 0.5, hy - 5]], 'B')
  g.poly([[hx - 0.5, hy - 5], [hx + 4.5 + (bk ? 3 : 0), hy - 9 + (bk ? 1 : 0)], [hx + 6.5, hy - 2]], 'B')
  if (!bk) {
    for (const [x, y] of [[-5, -5], [-5, -4], [-4, -4], [4, -5], [4, -4], [3, -4]] as Array<[number, number]>) g.set(hx + x, hy + y, 'P')
  }
  const fx = hx + 2
  const ey = hy - 1
  eye(g, fx - 4, ey, eyes)
  eye(g, fx + 1, ey, eyes)
  g.set(fx - 1, hy + 3, 'P'); g.set(fx, hy + 3, 'P') // nose
  if (o.mouth === 'open') g.rect(fx - 1, hy + 4, 2, 2, 'L')
  else if (o.mouth === 'oh') g.rect(fx - 1, hy + 4, 2, 2, 'K')
  else { g.set(fx - 2, hy + 4, 'L'); g.set(fx - 1, hy + 5, 'L'); g.set(fx, hy + 5, 'L'); g.set(fx + 1, hy + 4, 'L') }
  if (o.blush) { g.set(fx - 5, hy + 3, 'L'); g.set(fx - 4, hy + 3, 'L'); g.set(fx + 3, hy + 3, 'L'); g.set(fx + 4, hy + 3, 'L') }
  drawHat(g, hx, hy)
}

/** neckwear equipped while frames are being built (set by buildFrames) */
let NECK = 'none'

function neckwear(g: Grid, hx: number, hy: number): void {
  if (NECK === 'scarf') {
    for (let x = -5; x <= 4; x++) for (let y = 5; y <= 7; y++) g.set(hx + x, hy + y, (x + y) % 3 === 0 ? 'W' : 'C')
    for (let y = 8; y <= 11; y++) { g.set(hx + 3, hy + y, y % 2 ? 'W' : 'C'); g.set(hx + 4, hy + y, 'C') }
  } else if (NECK === 'bandana') {
    g.poly([[hx - 5.5, hy + 5], [hx + 5.5, hy + 5], [hx, hy + 12]], 'X')
    g.set(hx - 3, hy + 6, 'W'); g.set(hx + 2, hy + 6, 'W'); g.set(hx, hy + 8, 'W')
  } else if (NECK === 'bowtie') {
    g.rect(hx - 4, hy + 5, 3, 3, 'U'); g.rect(hx + 2, hy + 5, 3, 3, 'U'); g.rect(hx - 1, hy + 6, 3, 2, 'N')
  } else if (NECK === 'medal') {
    g.set(hx - 3, hy + 5, 'C'); g.set(hx - 2, hy + 6, 'C'); g.set(hx + 3, hy + 5, 'C'); g.set(hx + 2, hy + 6, 'C')
    g.rect(hx - 1, hy + 7, 3, 3, 'G'); g.set(hx, hy + 8, 'Y')
  }
}

function collar(g: Grid, hx: number, hy: number): void {
  g.rect(hx - 4, hy + 5, 8, 2, 'R')
  g.set(hx, hy + 7, 'G'); g.set(hx + 1, hy + 7, 'G')
  neckwear(g, hx, hy)
}

const TAIL_UP: Array<Array<[number, number]>> = [
  [[6, 20], [3, 17], [2, 12], [3, 8]],
  [[6, 20], [3, 18], [1, 14], [1, 9]],
  [[6, 20], [4, 16], [4, 11], [6, 8]]
]

interface Leg { dx: number; lift: number }
const NO_LEGS: [Leg, Leg, Leg, Leg] = [{ dx: 0, lift: 0 }, { dx: 0, lift: 0 }, { dx: 0, lift: 0 }, { dx: 0, lift: 0 }]

interface StandOpts {
  /** back far, back near, front near, front far */
  legs?: [Leg, Leg, Leg, Leg]
  bob?: number
  tail?: 0 | 1 | 2
  eyes?: Eyes
  ears?: Ears
  crouch?: number
  spread?: boolean
  mouth?: FaceOpts['mouth']
  blush?: boolean
  /** front legs reaching far forward */
  stretch?: boolean
}

function stand(o: StandOpts = {}): Grid {
  const g = new Grid()
  const legs = o.legs ?? NO_LEGS
  const bob = o.bob ?? 0
  const cr = o.crouch ?? 0
  g.stroke(TAIL_UP[o.tail ?? 0].map(([x, y]) => [x, y + bob + cr] as [number, number]), 'F', 3)
  const X = [8, 11, 18, 21]
  const leg = (i: number, color: string) => {
    const top = 22 + bob + cr
    const bottom = 27 - legs[i].lift
    g.rect(X[i] + legs[i].dx, top, 2, Math.max(2, bottom - top + 1), color)
    g.set(X[i] + legs[i].dx + 2, bottom, color) // toe
  }
  if (o.spread) {
    g.stroke([[9, 21 + bob], [4, 25 + bob], [2, 27 + bob]], 'F', 2)
    g.stroke([[22, 21 + bob], [28, 23 + bob], [31, 21 + bob]], 'F', 2)
  } else {
    leg(0, 'F')
    leg(3, 'F')
  }
  g.ellipse(13.5, 19 + bob + cr * 0.6, 8, 5.2, 'B')
  if (o.spread) {
    g.stroke([[12, 22 + bob], [8, 26 + bob], [7, 27 + bob]], 'B', 2)
    g.stroke([[20, 22 + bob], [25, 25 + bob], [29, 25 + bob]], 'B', 2)
  } else {
    leg(1, 'B')
    leg(2, 'B')
  }
  if (o.stretch) { g.rect(21, 26, 10, 2, 'B'); g.set(31, 26, 'B') }
  const hy = 13.5 + bob + cr
  head(g, 22.5, hy, o.eyes ?? 'open', { mouth: o.mouth, ears: o.ears, blush: o.blush })
  collar(g, 22.5, hy)
  return g.finish()
}

interface SitOpts {
  tail?: 0 | 1 | 2
  eyes?: Eyes
  ears?: Ears
  /** raise the near front paw (play / swat), 0 = down */
  paw?: 0 | 1
  /** paw to mouth: 1 = paw up, 2 = tongue out */
  lick?: 0 | 1 | 2
  hdx?: number
  hdy?: number
  blush?: boolean
  mouth?: FaceOpts['mouth']
  /** 2 = a stream of sick falls to the floor */
  puke?: 0 | 2
}

const SIT_TAIL: Array<Array<[number, number]>> = [
  [[5, 27], [2, 27], [0, 26]],
  [[5, 27], [2, 26], [0, 23]],
  [[5, 27], [2, 25], [1, 20]]
]

function sit(o: SitOpts = {}): Grid {
  const g = new Grid()
  g.stroke(SIT_TAIL[o.tail ?? 0], 'F', 3)
  g.ellipse(12.5, 21, 8.5, 6.5, 'B')
  g.ellipse(17.5, 22, 4.5, 5.5, 'B')
  g.rect(21, 25, 2, 3, 'F') // far front paw
  g.rect(11, 26, 6, 2, 'B') // hind foot
  if (o.lick) {
    g.stroke([[18, 25], [20, 19], [22, 15]], 'B', 3)
  } else if (o.paw) {
    g.stroke([[19, 23], [24, 18], [27, 15]], 'B', 3)
    g.set(28, 14, 'B')
  } else {
    g.rect(17, 24, 3, 4, 'B')
    g.rect(20, 27, 2, 1, 'B')
  }
  const hx = 17.5 + (o.hdx ?? 0)
  const hy = 12.5 + (o.hdy ?? 0)
  head(g, hx, hy, o.eyes ?? 'open', { blush: o.blush, mouth: o.mouth, ears: o.ears })
  if (o.puke === 2) g.stroke([[hx + 2, hy + 5], [hx + 3, hy + 10], [hx + 3, 27]], 'V', 1)
  if (o.lick === 2) g.set(hx + 2, hy + 4, 'P')
  collar(g, hx, hy)
  return g.finish()
}

function loaf(breath: 0 | 1): Grid {
  const g = new Grid()
  g.ellipse(14.5, 23.5 - breath * 0.6, 11, 4.5 + breath * 0.7, 'B')
  g.stroke([[4, 26], [8, 27], [16, 27], [22, 27]], 'F', 1)
  head(g, 23.5, 21.5, 'closed')
  g.rect(27, 26, 3, 2, 'B')
  g.rect(17, 25, 4, 2, 'R')
  return g.finish()
}

function dangle(tail: 0 | 1, eyes: Eyes = 'wide'): Grid {
  const g = new Grid()
  g.stroke(tail ? [[16, 24], [18, 26], [17, 27]] : [[16, 24], [14, 26], [15, 27]], 'F', 2)
  g.rect(12, 23, 2, 5, 'F'); g.rect(18, 23, 2, 5, 'F')
  g.ellipse(16, 20, 5, 5.5, 'B')
  g.rect(10, 17, 2, 6, 'B'); g.rect(20, 17, 2, 6, 'B')
  head(g, 15, 10, eyes, { mouth: 'oh' })
  collar(g, 15, 10)
  return g.finish()
}

/** one frame of the 6-frame walk cycle: diagonal leg pairs swing and lift, body bobs, tail sways */
function walkFrame(i: number): Grid {
  const phase = i / 6
  const leg = (offset: number): Leg => {
    const a = 2 * Math.PI * (phase + offset)
    return { dx: Math.round(Math.sin(a) * 1.5), lift: Math.max(0, Math.round(Math.cos(a) * 2.4)) }
  }
  const bob = Math.cos(4 * Math.PI * phase) > 0.4 ? -1 : 0
  return stand({ legs: [leg(0.5), leg(0), leg(0.5), leg(0)], bob, tail: (i % 3) as 0 | 1 | 2 })
}

export type Sheet = Record<string, Grid>

export function buildFrames(hat = 'none', neck = 'none'): Sheet {
  HAT = hat
  NECK = neck
  const f: Sheet = {}
  for (let i = 0; i < 6; i++) f['walk' + i] = walkFrame(i)
  ;([0, 1, 2] as const).forEach((t) => { f['sit' + t] = sit({ tail: t }) })
  f.sitBlink = sit({ tail: 1, eyes: 'blink' })
  f.sitSleepy = sit({ tail: 0, eyes: 'sleepy' })
  f.sitTwitch = sit({ tail: 1, ears: 'twitch' })
  f.sitLookL = sit({ tail: 1, eyes: 'lookL' })
  f.sitLookR = sit({ tail: 2, eyes: 'lookR' })
  f.sitSurprised = sit({ tail: 2, eyes: 'surprised', mouth: 'oh' })
  f.settleA = stand({ crouch: 2, tail: 0 })
  f.settleB = sit({ hdy: 2, tail: 0 })
  f.petA = sit({ tail: 1, eyes: 'happy', blush: true })
  f.petB = sit({ tail: 2, eyes: 'happy', blush: true })
  f.eatA = sit({ hdx: 4, hdy: 8, eyes: 'closed', tail: 0 })
  f.eatB = sit({ hdx: 4, hdy: 9, eyes: 'closed', mouth: 'open', tail: 1 })
  f.swatA = sit({ paw: 0, eyes: 'wide', tail: 2 })
  f.swatB = sit({ paw: 1, eyes: 'wide', tail: 1 })
  f.crouch = stand({ crouch: 3, eyes: 'wide', tail: 2 })
  f.lickA = sit({ lick: 1, eyes: 'closed', tail: 0 })
  f.lickB = sit({ lick: 2, eyes: 'closed', tail: 1 })
  f.stretchA = stand({ crouch: 4, stretch: true, eyes: 'closed', tail: 2 })
  f.stretchB = stand({ crouch: 5, stretch: true, eyes: 'closed', tail: 1, mouth: 'open' })
  f.pukeA = sit({ hdx: 4, hdy: 8, eyes: 'closed', mouth: 'open', tail: 0 })
  f.pukeB = sit({ hdx: 4, hdy: 8, eyes: 'closed', mouth: 'open', tail: 1, puke: 2 })
  f.hissA = stand({ eyes: 'angry', mouth: 'open', tail: 2, crouch: 1, ears: 'back' })
  f.hissB = stand({ eyes: 'angry', mouth: 'open', tail: 1, bob: -2, ears: 'back' })
  f.pantA = sit({ eyes: 'closed', mouth: 'open', tail: 0, hdy: 1 })
  f.pantB = sit({ eyes: 'closed', mouth: 'open', tail: 0 })
  f.sleepA = loaf(0)
  f.sleepB = loaf(1)
  f.fallA = stand({ spread: true, eyes: 'wide', bob: -1, mouth: 'oh', tail: 2 })
  f.fallB = stand({ spread: true, eyes: 'wide', bob: 0, mouth: 'oh', tail: 0 })
  f.dangleA = dangle(0)
  f.dangleB = dangle(1)
  f.scratchA = stand({ legs: [{ dx: 0, lift: 0 }, { dx: 0, lift: 0 }, { dx: 2, lift: 6 }, { dx: 3, lift: 3 }], bob: -1, eyes: 'closed', tail: 1 })
  f.scratchB = stand({ legs: [{ dx: 0, lift: 0 }, { dx: 0, lift: 0 }, { dx: 3, lift: 3 }, { dx: 2, lift: 6 }], bob: -1, eyes: 'closed', tail: 2 })
  f.hopA = stand({ legs: [{ dx: -1, lift: 3 }, { dx: -1, lift: 3 }, { dx: 1, lift: 3 }, { dx: 1, lift: 3 }], bob: -3, eyes: 'wide', tail: 2 })
  return f
}

export interface Anim {
  frames: string[]
  fps: number
  /** frames played once when arriving from a different kind of movement */
  intro?: string[]
}

export type AnimName = 'sit' | 'walk' | 'run' | 'climb' | 'ceiling' | 'fall' | 'drag' | 'sleep' | 'pet' | 'treat' | 'play' | 'lick' | 'stretch' | 'puke' | 'hiss' | 'pant' | 'hop' | 'surprised' | 'scratch'

const WALK6 = ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5']

export const ANIMS: Record<AnimName, Anim> = {
  // slow tail wag with ear twitches, sleepy and normal blinks and glances around
  sit: {
    frames: ['sit0', 'sit0', 'sit0', 'sit0', 'sitTwitch', 'sit0', 'sit0', 'sit1', 'sit1', 'sit1', 'sitSleepy', 'sitBlink', 'sit0', 'sit0', 'sitLookL', 'sitLookL', 'sitLookR', 'sitLookR', 'sit0', 'sit2', 'sit2', 'sit1'],
    fps: 3.5,
    intro: ['settleA', 'settleB']
  },
  walk: { frames: WALK6, fps: 10 },
  run: { frames: WALK6, fps: 18 },
  puke: { frames: ['pukeA', 'pukeA', 'pukeA', 'pukeB', 'pukeB', 'pukeB', 'pukeA'], fps: 3 },
  hiss: { frames: ['hissA', 'hissB'], fps: 6 },
  pant: { frames: ['pantA', 'pantB'], fps: 5 },
  lick: { frames: ['lickA', 'lickB', 'lickA', 'lickB'], fps: 3 },
  stretch: { frames: ['crouch', 'stretchA', 'stretchA', 'stretchB', 'stretchB', 'stretchA'], fps: 3 },
  climb: { frames: WALK6, fps: 6 },
  ceiling: { frames: WALK6, fps: 6 },
  fall: { frames: ['fallA', 'fallB'], fps: 10 },
  hop: { frames: ['hopA'], fps: 1 },
  scratch: { frames: ['scratchA', 'scratchB'], fps: 5 },
  surprised: { frames: ['sitSurprised'], fps: 1 },
  drag: { frames: ['dangleA', 'dangleB'], fps: 3 },
  sleep: { frames: ['sleepA', 'sleepA', 'sleepB', 'sleepB'], fps: 1.2 },
  pet: { frames: ['petA', 'petB'], fps: 3 },
  treat: { frames: ['eatA', 'eatB'], fps: 4 },
  play: { frames: ['crouch', 'swatA', 'swatB', 'swatA', 'swatB'], fps: 4 }
}
