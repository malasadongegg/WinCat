import type { Personality } from '@shared/companion'

/** Square bounding box of the cat, in px. Position (x, y) is the box centre. */
export const PET_SIZE = 96

export type Mode =
  | 'sit' | 'walk' | 'run' | 'chase' | 'lick' | 'stretch'
  | 'fall' | 'leap' | 'climb' | 'ceiling' | 'drag' | 'goto' | 'use'

export type GoalType = 'bed' | 'post' | 'box' | 'ball'

/** The top edge of a window the cat can stand on (overlay coordinates). Geometry only. */
export interface Platform {
  id: number
  left: number
  right: number
  top: number
}

/** A piece of furniture standing on the floor that the cat may visit. */
export interface Goal {
  id: string
  type: GoalType
  x: number
}

export interface PetState {
  x: number
  y: number
  vx: number
  vy: number
  mode: Mode
  /** walking / crawling direction */
  dir: 1 | -1
  /** which wall is being climbed: -1 left, 1 right */
  wall: -1 | 1
  /** seconds left in the current mode (sit / walk / climb / ceiling / use ...) */
  timer: number
  /** id of the window the cat is standing on, or null for the floor */
  surface: number | null
  /** furniture being visited / used */
  goal: string | null
  use: GoalType | null
  /** a small hop: after landing the cat keeps walking */
  hop: boolean
}

export interface World {
  width: number
  height: number
}

export interface Tuning {
  /** walking speed multiplier */
  speed: number
  /** >1 = shorter rests, more adventurous; <1 = lazier */
  restless: number
  /** probability of climbing when a wall is reached */
  climb: number
  /** multiplier for how often zoomies / cursor-chasing / perching / furniture visits start */
  zoom: number
  chase: number
  perch: number
  visit: number
}

export const TUNING: Record<Personality, Tuning> = {
  balanced: { speed: 1, restless: 1.3, climb: 0.5, zoom: 1, chase: 1, perch: 1, visit: 1 },
  playful: { speed: 1.35, restless: 1.9, climb: 0.7, zoom: 2.5, chase: 2, perch: 1.6, visit: 1.2 },
  curious: { speed: 1.1, restless: 1.6, climb: 0.65, zoom: 1, chase: 2.5, perch: 2, visit: 1.5 },
  affectionate: { speed: 0.9, restless: 1.1, climb: 0.3, zoom: 0.6, chase: 1.3, perch: 0.8, visit: 1.2 },
  sleepy: { speed: 0.65, restless: 0.7, climb: 0.15, zoom: 0.2, chase: 0.3, perch: 0.4, visit: 1.4 }
}

export interface Ctx {
  /** where the mouse pointer is (overlay coordinates), or null when unknown */
  target?: { x: number; y: number } | null
  platforms?: Platform[]
  goals?: Goal[]
}

const WALK_SPEED = 55 // px/s
const CLIMB_SPEED = 38
const GRAVITY = 1800
const half = PET_SIZE / 2

export const floorY = (w: World) => w.height - half
export const rightX = (w: World) => w.width - half

export function initialState(w: World, homeX: number | null, rnd = Math.random): PetState {
  const x = Math.min(Math.max(homeX ?? w.width - 200, half), rightX(w))
  return { x, y: -half, vx: 0, vy: 0, mode: 'fall', dir: rnd() < 0.5 ? -1 : 1, wall: 1, timer: 0, surface: null, goal: null, use: null, hop: false }
}

const between = (a: number, b: number, rnd: () => number) => a + (b - a) * rnd()

function sit(n: PetState, t: Tuning, rnd: () => number): void {
  n.mode = 'sit'
  n.vx = 0
  n.vy = 0
  n.goal = null
  n.use = null
  n.timer = between(1.5, 5, rnd) / t.restless
}

/** the surface the cat is standing on right now */
function ground(n: PetState, w: World, platforms: Platform[]): { y: number; left: number; right: number } {
  if (n.surface !== null) {
    const p = platforms.find((q) => q.id === n.surface)
    if (p) return { y: p.top - half, left: p.left + half * 0.5, right: p.right - half * 0.5 }
  }
  return { y: floorY(w), left: half, right: rightX(w) }
}

function land(n: PetState, plat: Platform | null, w: World, t: Tuning, rnd: () => number): void {
  n.surface = plat ? plat.id : null
  n.y = plat ? plat.top - half : floorY(w)
  n.vy = 0
  n.vx = 0
  if (n.hop) {
    n.hop = false
    n.mode = 'walk'
    n.timer = between(2, 5, rnd)
  } else {
    sit(n, t, rnd)
  }
}

/** pick the next thing to do after sitting for a while */
function decide(n: PetState, w: World, t: Tuning, rnd: () => number, ctx: Ctx): void {
  const platforms = ctx.platforms ?? []
  const goals = ctx.goals ?? []
  const onFloor = n.surface === null
  const options: Array<[number, () => void]> = [
    [0.36, () => { n.mode = 'walk'; n.dir = rnd() < 0.5 ? -1 : 1; n.timer = between(3, 9, rnd) }],
    [0.07, () => { n.mode = 'lick'; n.timer = between(2.5, 4, rnd) }],
    [0.06, () => { n.mode = 'stretch'; n.timer = between(2, 3, rnd) }],
    [0.09 * t.restless, () => { n.mode = 'fall'; n.hop = true; n.vy = -340; n.vx = (rnd() < 0.5 ? -1 : 1) * 50; n.dir = n.vx > 0 ? 1 : -1 }],
    [0.05 * t.zoom, () => { n.mode = 'run'; n.dir = rnd() < 0.5 ? -1 : 1; n.timer = between(2, 4, rnd) }],
    [ctx.target ? 0.08 * t.chase : 0, () => { n.mode = 'chase'; n.timer = 8 }],
    [0.05, () => { n.timer = between(1.5, 4, rnd) / t.restless }] // stay put a little longer
  ]
  if (onFloor && goals.length) {
    options.push([0.1 * t.visit, () => {
      const g = goals[Math.floor(rnd() * goals.length)]
      n.mode = 'goto'
      n.goal = g.id
      n.timer = 20
    }])
  }
  // window perching: leap onto the top edge of a window that is within reach
  const reachable = platforms.filter((p) => {
    if (p.id === n.surface) return false
    const rise = n.y - (p.top - half)
    const tx = Math.min(Math.max(n.x, p.left + half * 0.7), p.right - half * 0.7)
    return rise > 30 && rise < 800 && Math.abs(tx - n.x) < 520
  })
  if (reachable.length) {
    options.push([0.09 * t.perch, () => {
      const p = reachable[Math.floor(rnd() * reachable.length)]
      const rise = n.y - (p.top - half) + 30
      const tx = Math.min(Math.max(n.x + (rnd() - 0.5) * 80, p.left + half * 0.7), p.right - half * 0.7)
      const vy0 = -Math.sqrt(2 * GRAVITY * rise)
      const T = -vy0 / GRAVITY + Math.sqrt((2 * 30) / GRAVITY)
      n.mode = 'leap'
      n.vy = vy0
      n.vx = (tx - n.x) / T
      n.dir = n.vx >= 0 ? 1 : -1
      n.surface = null
    }])
  }
  if (!onFloor) {
    // up on a window: sometimes hop down instead of staying
    options.push([0.12, () => { n.mode = 'fall'; n.vx = (rnd() < 0.5 ? -1 : 1) * 70; n.vy = 0; n.surface = null }])
  }
  const total = options.reduce((a, o) => a + o[0], 0)
  let r = rnd() * total
  for (const [wgt, act] of options) {
    r -= wgt
    if (r <= 0) { act(); return }
  }
  options[0][1]()
}

/**
 * Advance one tick. `frozen` is true while a reaction (petting, treat, play, sleep) owns the cat:
 * it will not wander, and anything off the floor drops down first.
 */
export function step(
  s: PetState,
  dt: number,
  w: World,
  t: Tuning,
  frozen: boolean,
  rnd: () => number = Math.random,
  ctx: Ctx = {}
): PetState {
  const n = { ...s }
  const platforms = ctx.platforms ?? []
  const goals = ctx.goals ?? []
  if (n.mode === 'drag') {
    n.surface = null
    return n
  }

  // the window under our paws moved or went away
  if (n.surface !== null && n.mode !== 'fall' && n.mode !== 'leap') {
    const p = platforms.find((q) => q.id === n.surface)
    const expected = p ? p.top - half : 0
    if (!p || n.x < p.left - half * 0.3 || n.x > p.right + half * 0.3 || Math.abs(n.y - expected) > 60) {
      n.surface = null
      n.mode = 'fall'
      n.vx = 0
      n.vy = 0
    } else {
      n.y = expected
    }
  }

  if (frozen && (n.mode === 'walk' || n.mode === 'run' || n.mode === 'chase' || n.mode === 'climb' || n.mode === 'ceiling' || n.mode === 'goto')) {
    n.hop = false
    if (n.surface !== null) {
      n.mode = 'sit' // up on a window: just stop
      n.vx = 0
    } else if (n.mode === 'walk' || n.mode === 'run' || n.mode === 'chase' || n.mode === 'goto') {
      n.mode = 'sit' // already on the floor
      n.vx = 0
    } else {
      n.mode = 'fall' // wall / ceiling: drop down first
      n.vx = 0
      n.vy = 0
    }
  }
  if (frozen && (n.mode === 'lick' || n.mode === 'stretch' || n.mode === 'use')) sit(n, t, rnd)

  const g = ground(n, w, platforms)

  switch (n.mode) {
    case 'fall':
    case 'leap': {
      const prevBottom = n.y + half
      n.vy += GRAVITY * dt
      n.y += n.vy * dt
      n.x = Math.min(Math.max(n.x + n.vx * dt, half), rightX(w))
      if (n.vy > 0) {
        for (const p of platforms) {
          if (n.x >= p.left && n.x <= p.right && prevBottom <= p.top + 1 && n.y + half >= p.top) {
            land(n, p, w, t, rnd)
            return n
          }
        }
      }
      if (n.y >= floorY(w)) land(n, null, w, t, rnd)
      break
    }
    case 'sit': {
      n.y = g.y
      if (frozen) break
      n.timer -= dt
      if (n.timer <= 0) decide(n, w, t, rnd, ctx)
      break
    }
    case 'lick':
    case 'stretch': {
      n.y = g.y
      n.timer -= dt
      if (n.timer <= 0) sit(n, t, rnd)
      break
    }
    case 'run': {
      n.y = g.y
      n.x += n.dir * WALK_SPEED * 2.8 * t.speed * dt
      n.timer -= dt
      if (n.x <= g.left || n.x >= g.right) {
        n.x = Math.min(Math.max(n.x, g.left), g.right)
        n.dir = (n.dir * -1) as 1 | -1 // zoomies bounce off the walls
      }
      if (n.timer <= 0) sit(n, t, rnd)
      break
    }
    case 'chase': {
      n.y = g.y
      n.timer -= dt
      if (!ctx.target || n.timer <= 0) {
        sit(n, t, rnd) // lost interest
        break
      }
      const dx = ctx.target.x - n.x
      n.dir = dx >= 0 ? 1 : -1
      if (Math.abs(dx) < 45) {
        // pounce!
        n.mode = 'fall'
        n.vy = -520
        n.vx = n.dir * 150
        break
      }
      n.x = Math.min(Math.max(n.x + n.dir * WALK_SPEED * 2.4 * t.speed * dt, g.left), g.right)
      break
    }
    case 'goto': {
      n.y = g.y
      n.timer -= dt
      const goal = goals.find((q) => q.id === n.goal)
      if (!goal || n.timer <= 0) { sit(n, t, rnd); break }
      const dx = goal.x - n.x
      n.dir = dx >= 0 ? 1 : -1
      if (Math.abs(dx) < 6) {
        n.x = goal.x
        n.mode = 'use'
        n.use = goal.type
        n.timer = goal.type === 'bed' ? between(14, 28, rnd) : goal.type === 'box' ? between(10, 20, rnd) : goal.type === 'post' ? 4 : 6
      } else {
        n.x += n.dir * WALK_SPEED * 1.4 * t.speed * dt
      }
      break
    }
    case 'use': {
      n.y = g.y
      n.timer -= dt
      if (n.timer <= 0) sit(n, t, rnd)
      break
    }
    case 'walk': {
      n.y = g.y
      n.x += n.dir * WALK_SPEED * t.speed * dt
      n.timer -= dt
      const atLeft = n.x <= g.left
      const atRight = n.x >= g.right
      if (atLeft || atRight) {
        n.x = atLeft ? g.left : g.right
        const side: -1 | 1 = atLeft ? -1 : 1
        if (n.surface !== null) {
          // edge of a window: hop down or turn around
          if (rnd() < 0.4) { n.mode = 'fall'; n.vx = side * 60; n.vy = 0; n.surface = null }
          else n.dir = (n.dir * -1) as 1 | -1
        } else if (rnd() < t.climb) {
          n.mode = 'climb'
          n.wall = side
          n.timer = between(4, 9, rnd)
        } else {
          n.dir = (n.dir * -1) as 1 | -1
        }
      } else if (n.timer <= 0) {
        sit(n, t, rnd)
      }
      break
    }
    case 'climb': {
      n.x = n.wall === -1 ? half : rightX(w)
      n.y -= CLIMB_SPEED * t.speed * dt
      n.timer -= dt
      if (n.y <= half) {
        n.y = half
        if (rnd() < 0.5) {
          n.mode = 'ceiling'
          n.dir = (n.wall * -1) as 1 | -1 // crawl away from the wall we came up
          n.timer = between(4, 10, rnd)
        } else {
          n.mode = 'fall'
          n.vx = n.wall * -70
          n.vy = 0
        }
      } else if (n.timer <= 0) {
        n.mode = 'fall' // lets go
        n.vx = n.wall * -40
        n.vy = 0
      }
      break
    }
    case 'ceiling': {
      n.y = half
      n.x += n.dir * WALK_SPEED * 0.8 * t.speed * dt
      n.timer -= dt
      if (n.x <= half || n.x >= rightX(w)) {
        n.x = Math.min(Math.max(n.x, half), rightX(w))
        n.dir = (n.dir * -1) as 1 | -1
      }
      // crawling above an open window: drop down onto it
      const below = platforms.find((p) => n.x >= p.left + half * 0.6 && n.x <= p.right - half * 0.6 && p.top > n.y + half + 60)
      if (below && rnd() < dt * 0.8) {
        n.mode = 'fall'
        n.vx = 0
        n.vy = 0
      }
      if (n.timer <= 0) {
        n.mode = 'fall'
        n.vx = 0
        n.vy = 0
      }
      break
    }
  }
  return n
}

/** Clamp a dragged position so the whole cat stays on screen. */
export function clampPos(x: number, y: number, w: World): { x: number; y: number } {
  return { x: Math.min(Math.max(x, half), rightX(w)), y: Math.min(Math.max(y, half), floorY(w)) }
}
