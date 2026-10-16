import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_COMPANION, IDLE_GAP_MS, levelInfo, lineFor, periodOf, type CompanionState, type Interaction, type LineEvent } from '@shared/companion'
import { COLLECTIBLES, SEASON_LINES, moodFor, pickCollectible, seasonOf, type RoomItem } from '@shared/catlife'
import { unlockedAt } from '@shared/cosmetics'
import type { Outcome } from '@shared/overdo'
import { Sfx, type Sound } from '../audio/sfx'
import { PixelCat, SPRITE_PX, propUrl, type PixelCatHandle } from '../cat/PixelCat'
import type { AnimName } from '../cat/catSprites'
import { spriteSize, spriteUrl } from '../cat/items'
import { PET_SIZE, TUNING, clampPos, floorY, initialState, step, type Goal, type Mode, type PetState, type Platform } from '../pet/engine'

export type ReactionKind = 'idle' | 'pet' | 'treat' | 'play' | 'rest' | 'puke' | 'annoyed' | 'hyper' | 'tired'

const DRAG_THRESHOLD = 5
const REACTION_MS: Partial<Record<ReactionKind, number>> = { pet: 2600, treat: 3500, play: 6000, puke: 4500, annoyed: 3200, hyper: 6500, tired: 5000 }
const HOUR = 3_600_000
const LOW_POWER_FRAME = 1 / 12
/** pixel scale per piece, so the cat actually fits in the box and on the bed */
const SCALE_OF: Record<string, number> = { bed: 4, box: 5, post: 4, ball: 3, boxFront: 5 }
const MAX_FINDS = 3
/** how far the cat visually sinks into furniture it is using (px) */
const USE_OFFSET: Record<string, number> = { bed: 14, box: 10 }

interface Find { id: number; type: string; x: number; y: number }

/**
 * The transparent full-desktop overlay the cat lives on. The cat walks along the taskbar edge,
 * climbs the screen sides, crawls on the top edge, sits on top of open windows, visits furniture,
 * and falls when let go; you can drag it anywhere. Everything except the cat, its buttons, finds
 * and (while decorating) furniture is click-through (see data-hit + ui:capture).
 */
export function PetView() {
  const [comp, setComp] = useState<CompanionState>(DEFAULT_COMPANION)
  const [kind, setKind] = useState<ReactionKind>('idle')
  const [look, setLook] = useState<{ mode: Mode; dir: 1 | -1; wall: -1 | 1; high: boolean; hop: boolean; use: string | null }>({ mode: 'fall', dir: 1, wall: 1, high: false, hop: false, use: null })
  const [bubble, setBubble] = useState<{ id: number; text: string } | null>(null)
  const [menu, setMenu] = useState(false)
  const [puddles, setPuddles] = useState<Array<{ id: number; x: number; y: number }>>([])
  const [finds, setFinds] = useState<Find[]>([])
  const [decorate, setDecorate] = useState(false)
  const [roomDrag, setRoomDrag] = useState<Record<string, number>>({})
  const [lowPower, setLowPower] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })

  const el = useRef<HTMLDivElement>(null)
  const sprite = useRef<HTMLDivElement>(null)
  const px = useRef<PixelCatHandle>(null)
  const tf = useRef({ rot: 0, sx: 1, sy: 1 })
  const pet = useRef<PetState | null>(null)
  const kindRef = useRef<ReactionKind>('idle')
  const compRef = useRef(comp)
  compRef.current = comp
  const lowRef = useRef(false)
  const platforms = useRef<Platform[]>([])
  const prev = useRef<{ mode: Mode; surface: number | null; use: string | null }>({ mode: 'fall', surface: null, use: null })
  const reactionTimer = useRef<number | undefined>(undefined)
  const bubbleTimer = useRef<number | undefined>(undefined)
  const menuTimer = useRef<number | undefined>(undefined)
  const clickTimer = useRef<number | undefined>(undefined)
  const lastClick = useRef(0)
  const menuRef = useRef(false)
  const dragging = useRef(false)
  const swing = useRef(0)
  const sfx = useRef(new Sfx())
  const mouse = useRef<{ x: number; y: number; at: number } | null>(null)
  const autoNap = useRef(false)
  const findId = useRef(1)

  const world = () => ({ width: window.innerWidth, height: window.innerHeight })

  /** sounds are opt-in; never while the overlay is hidden (e.g. a fullscreen app is up) */
  const sound = useCallback((name: Sound) => {
    const c = compRef.current
    if (!c.sound || document.hidden) return
    sfx.current.volume = c.volume
    sfx.current.play(name)
  }, [])

  const showBubble = useCallback((text: string, ms = 4000) => {
    setBubble({ id: Date.now(), text })
    window.clearTimeout(bubbleTimer.current)
    bubbleTimer.current = window.setTimeout(() => setBubble(null), ms)
  }, [])

  const say = useCallback((event: LineEvent) => {
    if (event === 'greet' || event === 'welcomeBack' || event === 'wake' || (event === 'idle' && Math.random() < 0.35)) sound('meow')
    if (!compRef.current.bubbles) return
    // now and then the cat comments on the season (local date only)
    if (event === 'idle' && Math.random() < 0.2) {
      const lines = SEASON_LINES[seasonOf(new Date())]
      return showBubble(lines[Math.floor(Math.random() * lines.length)])
    }
    showBubble(lineFor(event, compRef.current.personality, periodOf(new Date().getHours())))
  }, [sound, showBubble])

  const setReaction = useCallback((k: ReactionKind) => {
    kindRef.current = k
    setKind(k)
    window.clearTimeout(reactionTimer.current)
    const ms = REACTION_MS[k]
    if (ms) {
      reactionTimer.current = window.setTimeout(() => {
        const p = pet.current
        if (k === 'hyper') {
          // worn out after the zoomies
          kindRef.current = 'tired'
          setKind('tired')
          say('tired')
          sound('sigh')
          reactionTimer.current = window.setTimeout(() => { kindRef.current = 'idle'; setKind('idle') }, REACTION_MS.tired)
          return
        }
        if (k === 'annoyed' && p) pet.current = { ...p, mode: 'run', dir: Math.random() < 0.5 ? -1 : 1, timer: 4 } // stalks off
        kindRef.current = 'idle'
        setKind('idle')
      }, ms)
    }
  }, [say, sound])

  // interactions arrive from main (care menu here, or the Cat tab in the panel)
  useEffect(() => {
    return window.cat.onReact((k: Interaction, outcome: Outcome) => {
      autoNap.current = false // any interaction ends an automatic night nap
      const p = pet.current
      if (outcome === 'puke') {
        setReaction('puke')
        say('puke')
        sound('gag')
        const x = p?.x ?? 0
        const y = p?.y ?? 0
        // the mess appears a moment into the retch, stays a while, then fades away by itself (nothing to clean up)
        window.setTimeout(() => {
          const id = Date.now()
          setPuddles((l) => [...l, { id, x, y }])
          window.setTimeout(() => setPuddles((l) => l.filter((q) => q.id !== id)), 20_000)
        }, 1600)
      } else if (outcome === 'annoyed') {
        setReaction('annoyed')
        say('annoyed')
        sound('hiss')
      } else if (outcome === 'hyper') {
        setReaction('hyper')
        say('hyper')
        sound('squeak')
        if (p) pet.current = { ...p, mode: 'run', dir: Math.random() < 0.5 ? -1 : 1, timer: 3 }
      } else if (k === 'rest') {
        const waking = kindRef.current === 'rest'
        setReaction(waking ? 'idle' : 'rest')
        say(waking ? 'wake' : 'rest')
        if (!waking) sound('sigh')
      } else {
        setReaction(k)
        // a gentle heads-up before it gets to be too much
        if (outcome === 'warn') say(k === 'treat' ? 'warnTreat' : k === 'pet' ? 'warnPet' : 'warnPlay')
        else say(k)
        sound(k === 'pet' ? 'purr' : k === 'treat' ? 'munch' : 'squeak')
      }
    })
  }, [setReaction, say, sound])

  useEffect(() => {
    window.cat.getSettings().then((s) => { setLowPower(s.lowPower); lowRef.current = s.lowPower })
    window.cat.uiGet().then((u) => setReduceMotion(u.reduceMotion))
    const offUi = window.cat.onUi((u) => setReduceMotion(u.reduceMotion))
    const offLp = window.cat.onLowPower((on) => { setLowPower(on); lowRef.current = on })
    const offC = window.cat.onCompanion((c) => {
      const before = levelInfo(compRef.current.bond).level
      const after = levelInfo(c.bond).level
      setComp(c)
      compRef.current = c
      if (after > before) {
        // gentle level-up note (never blocks anything)
        const items = unlockedAt(after).map((i) => i.label).join(', ')
        if (c.bubbles) showBubble(`Level ${after}!${items ? ' New in the wardrobe: ' + items : ''}`, 6000)
        sound('chirp')
      }
    })
    const offA = window.cat.onAchievement((titles) => {
      showBubble(`\u{1F3C6} ${titles.join(', ')}`, 6000)
      sound('chirp')
    })
    const offP = window.cat.onPlatforms((p) => { platforms.current = p })
    window.cat.windowsOnScreen().then((p) => { platforms.current = p })
    const offD = window.cat.onDecorate((on) => setDecorate(on))
    window.cat.companionGet().then((c) => {
      setComp(c)
      compRef.current = c
      const away = c.lastSeen ? Date.now() - c.lastSeen : 0
      window.setTimeout(() => say(away > HOUR ? 'welcomeBack' : 'greet'), 1500) // friendly, never guilt
    })
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => { offLp(); offC(); offUi(); offA(); offP(); offD(); window.removeEventListener('resize', onResize) }
  }, [say, sound, showBubble])

  // furniture the cat can visit (positions in overlay pixels)
  const room = comp.room
  const goalsRef = useRef<Goal[]>([])
  goalsRef.current = useMemo(
    () => room.map((r): Goal => ({ id: r.id, type: r.type, x: r.x * size.width + (r.type === 'post' ? -46 : 0) })),
    [room, size.width]
  )

  // read-only peek at the cat's state (used by automated checks)
  useEffect(() => {
    ;(window as unknown as { __petState?: () => PetState | null }).__petState = () => pet.current
    ;(window as unknown as { __petDebug?: () => unknown }).__petDebug = () => ({ platforms: platforms.current, perch: compRef.current.perch })
  }, [])

  // main loop
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    let started = false
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      let dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (!started) {
        started = true
        window.cat.petHome().then((hx) => { pet.current = initialState(world(), hx) })
      }
      const p = pet.current
      if (!p) return
      acc += dt
      if (lowRef.current && acc < LOW_POWER_FRAME) return // low power: ~12 updates a second
      dt = acc
      acc = 0
      const w = world()
      const base = TUNING[compRef.current.personality]
      // time of day nudges energy: livelier mornings, sleepier nights
      const mood = moodFor(new Date().getHours())
      const tuning = { ...base, speed: base.speed * mood.speed, restless: base.restless * mood.restless }
      // pointer position is only known while it moves over the overlay; it is never stored or sent anywhere
      const m = mouse.current
      const target = m && performance.now() - m.at < 10_000 ? { x: m.x, y: m.y } : null
      const reacting = kindRef.current !== 'idle' && kindRef.current !== 'hyper' // hyper cats keep running
      const next = step(p, dt, w, tuning, reacting, Math.random, {
        target,
        platforms: compRef.current.perch ? platforms.current : [],
        goals: goalsRef.current
      })
      if (kindRef.current === 'hyper' && (next.mode === 'sit' || next.mode === 'lick' || next.mode === 'stretch' || next.mode === 'walk')) {
        next.mode = 'run'
        next.timer = 3
      }
      // count things the player might enjoy noticing (for achievements)
      const pv = prev.current
      if (next.mode === 'chase' && pv.mode !== 'chase') window.cat.statBump('chase')
      if (next.surface !== null && pv.surface === null) window.cat.statBump('perch')
      if (next.mode === 'use' && pv.mode !== 'use' && next.use) window.cat.statBump(({ bed: 'bedUse', box: 'boxUse', post: 'postUse', ball: 'ballUse' } as const)[next.use])
      prev.current = { mode: next.mode, surface: next.surface, use: next.mode === 'use' ? next.use : null }
      pet.current = next

      const sink = next.mode === 'use' && next.use ? USE_OFFSET[next.use] ?? 0 : 0
      if (el.current) el.current.style.transform = `translate3d(${next.x - PET_SIZE / 2}px, ${next.y - PET_SIZE / 2 + sink}px, 0)`
      if (sprite.current) {
        // the sprite faces right; derive orientation for walking, wall climbing and ceiling crawling
        const dir = next.mode === 'use' && next.use === 'post' ? 1 : next.dir // face the scratching post
        let rot = 0, sx = dir > 0 ? 1 : -1, sy = 1
        if (next.mode === 'climb') {
          if (next.wall === -1) { rot = 90; sx = -1 } else { rot = -90; sx = 1 }
        } else if (next.mode === 'ceiling') {
          if (next.dir > 0) { sy = -1 } else { rot = 180; sx = 1 }
        } else if (next.mode === 'drag') {
          rot = swing.current
        }
        tf.current = { rot, sx, sy }
        sprite.current.style.transform = `rotate(${rot}deg) scaleX(${sx}) scaleY(${sy})`
      }
      const use = next.mode === 'use' ? next.use : null
      setLook((l) => {
        const high = next.y < 190
        const hop = next.mode === 'fall' && next.hop
        return l.mode === next.mode && l.dir === next.dir && l.wall === next.wall && l.high === high && l.hop === hop && l.use === use
          ? l
          : { mode: next.mode, dir: next.dir, wall: next.wall, high, hop, use }
      })
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // tell main where the cat is (for placing the panel and remembering its spot)
  useEffect(() => {
    let lx = -1
    let ly = -1
    const id = window.setInterval(() => {
      const p = pet.current
      if (!p || (Math.abs(p.x - lx) < 2 && Math.abs(p.y - ly) < 2)) return
      lx = p.x
      ly = p.y
      window.cat.petPos(p.x, p.y, (p.mode === 'sit' || p.mode === 'walk') && p.surface === null)
    }, 500)
    return () => window.clearInterval(id)
  }, [])

  // occasional unprompted bubble; never while sleeping or being dragged
  useEffect(() => {
    let id: number
    const schedule = () => {
      const gap = IDLE_GAP_MS[compRef.current.personality] * (0.6 + Math.random() * 0.8)
      id = window.setTimeout(() => {
        if (kindRef.current === 'idle' && !dragging.current && !document.hidden) say('idle')
        schedule()
      }, gap)
    }
    schedule()
    return () => window.clearTimeout(id)
  }, [say])

  // Your cat sometimes finds a little treasure while wandering. It stays until you pick it up
  // (or is added to the collection automatically after a minute), so nothing is ever missed.
  const collect = useCallback((f: Find, byClick: boolean) => {
    setFinds((l) => l.filter((q) => q.id !== f.id))
    window.cat.collect(f.type)
    const label = COLLECTIBLES.find((c) => c.id === f.type)?.label ?? 'something'
    if (byClick) { showBubble(`Found: ${label}!`, 3000); sound('chirp') }
  }, [showBubble, sound])
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = pet.current
      if (!p || document.hidden || dragging.current || kindRef.current !== 'idle') return
      if (p.mode !== 'walk' && p.mode !== 'run') return
      if (Math.random() > 0.12) return // roughly one find every minute or two of wandering
      setFinds((l) => {
        if (l.length >= MAX_FINDS) return l
        const c = pickCollectible(seasonOf(new Date()))
        const f: Find = { id: findId.current++, type: c.id, x: p.x - p.dir * 36, y: p.y + PET_SIZE / 2 }
        window.setTimeout(() => {
          setFinds((cur) => {
            const mine = cur.find((q) => q.id === f.id)
            if (mine) window.cat.collect(mine.type) // quietly added to the collection
            return cur.filter((q) => q.id !== f.id)
          })
        }, 60_000)
        return [...l, f]
      })
    }, 5000)
    return () => window.clearInterval(id)
  }, [])

  // per-pixel hit test: undo the sprite's rotate/flip, then ask the sprite whether that pixel is opaque
  const spriteHit = (cx: number, cy: number, t: Element | null): boolean => {
    const el2 = sprite.current
    if (!el2 || !t || !el2.contains(t)) return false
    const r = el2.getBoundingClientRect()
    const px0 = cx - (r.left + r.width / 2)
    const py0 = cy - (r.top + r.height / 2)
    const { rot, sx, sy } = tf.current
    const a = (rot * Math.PI) / 180
    const x = (px0 * Math.cos(a) + py0 * Math.sin(a)) / sx
    const y = (-px0 * Math.sin(a) + py0 * Math.cos(a)) / sy
    return px.current?.hit(x + SPRITE_PX / 2, y + SPRITE_PX / 2) ?? false
  }

  // At night a calm cat may doze off by itself for a minute or two, then wake on its own.
  useEffect(() => {
    const id = window.setInterval(() => {
      const h = new Date().getHours()
      const night = h >= 22 || h < 6
      const c = compRef.current
      if (!night || c.personality === 'playful' || kindRef.current !== 'idle' || pet.current?.mode !== 'sit') return
      if (Math.random() > 0.3) return
      autoNap.current = true
      window.cat.statBump('nap')
      setReaction('rest')
      sound('sigh')
      window.setTimeout(() => {
        if (autoNap.current && kindRef.current === 'rest') { autoNap.current = false; setReaction('idle') }
      }, 60_000 + Math.random() * 60_000)
    }, 60_000)
    return () => window.clearInterval(id)
  }, [setReaction, sound])

  // click-through: capture the mouse only while it is over the cat or its buttons
  const captured = useRef(false)
  const setCapture = (over: boolean) => {
    if (over !== captured.current) {
      captured.current = over
      window.cat.uiCapture(over)
    }
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY, at: performance.now() }
      if (dragging.current) return
      const t = e.target as Element | null
      const over = !!t?.closest?.('[data-hit]') || spriteHit(e.clientX, e.clientY, t)
      setCapture(over)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // drag vs click on the cat
  const down = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean; px: number; py: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !pet.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    down.current = { sx: e.clientX, sy: e.clientY, ox: e.clientX - pet.current.x, oy: e.clientY - pet.current.y, moved: false, px: e.clientX, py: e.clientY }
    setCapture(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = down.current
    const p = pet.current
    if (!d || !p) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > DRAG_THRESHOLD) {
      d.moved = true
      dragging.current = true
    }
    if (d.moved) {
      const c = clampPos(e.clientX - d.ox, e.clientY - d.oy, world())
      const vx = e.clientX - d.px
      p.vx = p.vx * 0.6 + vx * 60 * 0.4
      swing.current = Math.max(-25, Math.min(25, p.vx / 14))
      d.px = e.clientX
      pet.current = { ...p, x: c.x, y: c.y, mode: 'drag', vy: 0, surface: null }
    }
  }
  const onPointerUp = () => {
    const d = down.current
    down.current = null
    if (!d) return
    if (d.moved && pet.current) {
      dragging.current = false
      swing.current = 0
      const p = pet.current
      // let go: fall from where it was released (it can land on a window), with a little sideways momentum
      pet.current = { ...p, mode: p.y >= floorY(world()) - 1 ? 'sit' : 'fall', vx: Math.max(-200, Math.min(200, p.vx * 0.5)), vy: 0, timer: 3, hop: false }
    } else {
      onCatClick()
    }
  }

  const useAnim: Record<string, AnimName> = { bed: 'sleep', post: 'scratch', box: 'sit', ball: 'play' }
  const anim: AnimName =
    kind === 'puke' ? 'puke'
    : kind === 'annoyed' ? 'hiss'
    : kind === 'tired' ? 'pant'
    : kind === 'hyper' ? 'run'
    : look.mode === 'sit' && kind !== 'idle' ? (kind === 'rest' ? 'sleep' : kind)
    : look.mode === 'chase' ? 'run'
    : look.mode === 'goto' ? 'walk'
    : look.mode === 'leap' ? 'hop'
    : look.mode === 'fall' && look.hop ? 'hop'
    : look.mode === 'use' ? useAnim[look.use ?? 'box'] ?? 'sit'
    : look.mode
  /** care menu: opens on a single click, closes by itself after a few seconds */
  const showMenu = (on: boolean) => {
    menuRef.current = on
    setMenu(on)
    window.clearTimeout(menuTimer.current)
    if (on) menuTimer.current = window.setTimeout(() => { menuRef.current = false; setMenu(false) }, 5000)
  }
  /** single click = care menu, double click = Cat's Desk */
  const onCatClick = () => {
    const now = performance.now()
    if (now - lastClick.current < 350) {
      window.clearTimeout(clickTimer.current)
      lastClick.current = 0
      showMenu(false)
      window.cat.panelToggle()
      return
    }
    lastClick.current = now
    clickTimer.current = window.setTimeout(() => showMenu(!menuRef.current), 350)
  }

  const care = (k: Interaction) => {
    showMenu(true) // keep the menu open while it is being used
    window.cat.companionInteract(k)
  }

  // ----- furniture rendering / decorating -----
  const itemX = (r: RoomItem) => (roomDrag[r.id] ?? r.x) * size.width
  const sizeOf = (type: string) => {
    const s = spriteSize(type === 'box' ? 'boxBack' : type)
    const k = SCALE_OF[type] ?? 3
    return { w: s.w * k, h: s.h * k }
  }
  const rollingBall = look.mode === 'use' && look.use === 'ball'
  const startDrag = (e: React.PointerEvent, r: RoomItem) => {
    if (!decorate) return
    e.currentTarget.setPointerCapture(e.pointerId)
    ;(e.currentTarget as HTMLElement).dataset.dragging = '1'
    setCapture(true)
    void r
  }
  const moveDrag = (e: React.PointerEvent, r: RoomItem) => {
    if ((e.currentTarget as HTMLElement).dataset.dragging !== '1') return
    setRoomDrag((d) => ({ ...d, [r.id]: Math.min(0.97, Math.max(0.03, e.clientX / size.width)) }))
  }
  const endDrag = (e: React.PointerEvent, r: RoomItem) => {
    const t = e.currentTarget as HTMLElement
    if (t.dataset.dragging !== '1') return
    delete t.dataset.dragging
    const x = roomDrag[r.id] ?? r.x
    setRoomDrag((d) => { const n = { ...d }; delete n[r.id]; return n })
    window.cat.companionConfig({ room: compRef.current.room.map((q) => (q.id === r.id ? { ...q, x } : q)) })
  }

  return (
    <div className={'overlay' + (decorate ? ' decorating' : '')}>
      {room.map((r) => {
        const s = sizeOf(r.type)
        const x = itemX(r)
        const style = { left: x - s.w / 2, bottom: 0, width: s.w, height: s.h }
        return (
          <div
            key={r.id}
            className={'furn furn-' + r.type + (decorate ? ' edit' : '')}
            style={style}
            data-hit={decorate ? '' : undefined}
            onPointerDown={(e) => startDrag(e, r)}
            onPointerMove={(e) => moveDrag(e, r)}
            onPointerUp={(e) => endDrag(e, r)}
            title={decorate ? 'Drag to move' : undefined}
          >
            <img
              className={r.type === 'ball' && rollingBall ? 'ball-roll' : ''}
              src={spriteUrl(r.type === 'box' ? 'boxBack' : r.type)}
              alt={r.type}
              draggable={false}
            />
            {decorate && (
              <button
                className="furn-x"
                aria-label={`Remove ${r.type}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => window.cat.companionConfig({ room: compRef.current.room.filter((q) => q.id !== r.id) })}
              >
                &times;
              </button>
            )}
          </div>
        )
      })}
      {puddles.map((q) => (
        <img key={q.id} className="puddle" src={propUrl('puddle', comp.cosmetics)} alt="" style={{ left: q.x - 18, top: q.y + PET_SIZE / 2 - 10, width: 36 }} />
      ))}
      {finds.map((f) => (
        <button
          key={f.id}
          className="find"
          data-hit
          aria-label={`Pick up ${COLLECTIBLES.find((c) => c.id === f.type)?.label ?? 'a find'}`}
          style={{ left: f.x - 12, top: f.y - 28 }}
          onClick={() => collect(f, true)}
        >
          <img src={spriteUrl(f.type)} alt="" draggable={false} />
        </button>
      ))}
      <div ref={el} className="pet" style={{ width: PET_SIZE, height: PET_SIZE }}>
        <div className={'ui' + (look.high ? ' below' : '')}>
          {bubble && (
            <div key={bubble.id} className="bubble" role="status" data-hit>
              {bubble.text}
            </div>
          )}
          <div className={'care' + (menu ? ' show' : '')} data-hit role="toolbar" aria-label="Care for your cat">
            <button onClick={() => care('pet')} aria-label="Pet" title="Pet">&#9995;</button>
            <button onClick={() => care('treat')} aria-label="Give a treat" title="Treat">&#128031;</button>
            <button onClick={() => care('play')} aria-label="Play with yarn" title="Play">&#129526;</button>
            <button onClick={() => care('rest')} aria-label={kind === 'rest' ? 'Wake up' : 'Let rest'} title={kind === 'rest' ? 'Wake' : 'Rest'}>
              &#128164;
            </button>
          </div>
        </div>
        <div
          ref={sprite}
          className="sprite"
          role="button"
          tabIndex={0}
          aria-label="Your cat. Click for the care menu, double-click to open Cat's Desk, drag to move."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') showMenu(!menuRef.current) }}
        >
          <PixelCat ref={px} anim={anim} effect={kind === 'idle' ? 'none' : kind} personality={comp.personality} cosmetics={comp.cosmetics} lowPower={lowPower || reduceMotion} />
        </div>
      </div>
      {/* the front of a cardboard box covers the cat sitting inside it */}
      {room.filter((r) => r.type === 'box').map((r) => {
        const s = spriteSize('boxFront')
        return (
          <img
            key={'bf' + r.id}
            className="box-front"
            src={spriteUrl('boxFront')}
            alt=""
            draggable={false}
            style={{ left: itemX(r) - (s.w * SCALE_OF.boxFront) / 2, bottom: 0, width: s.w * SCALE_OF.boxFront }}
          />
        )
      })}
    </div>
  )
}
