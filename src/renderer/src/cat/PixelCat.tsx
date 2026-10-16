import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import type { Cosmetics } from '@shared/cosmetics'
import { ANIMS, GRID, buildFrames, buildProps, paletteFor, type AnimName, type Grid } from './catSprites'
import './pixelCat.css'

export const SCALE = 3
export const SPRITE_PX = GRID * SCALE

export interface PixelCatHandle {
  /** is the sprite opaque at this point (px, relative to the unrotated sprite box)? used for click-through */
  hit(x: number, y: number): boolean
}

interface Props {
  anim: AnimName
  lowPower: boolean
  personality: string
  cosmetics: Cosmetics
  /** reaction effects shown around the cat */
  effect: 'none' | 'pet' | 'treat' | 'play' | 'rest' | 'puke' | 'annoyed' | 'hyper' | 'tired'
}

function toCanvas(g: Grid, pal: Record<string, string>): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = g.w
  c.height = g.h
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(g.w, g.h)
  g.cells.forEach((k, i) => {
    if (!k) return
    const hex = pal[k]
    img.data.set([parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255], i * 4)
  })
  ctx.putImageData(img, 0, 0)
  return c
}

type Sheet = { frames: Record<string, HTMLCanvasElement>; grids: Record<string, Grid>; props: Record<string, string> }
const cache = new Map<string, Sheet>()
function sheet(c: Cosmetics): Sheet {
  const key = `${c.fur}|${c.eyes}|${c.collar}|${c.hat}|${c.neck}`
  let hit = cache.get(key)
  if (!hit) {
    const pal = paletteFor(c)
    const grids = buildFrames(c.hat, c.neck)
    const frames: Record<string, HTMLCanvasElement> = {}
    for (const k of Object.keys(grids)) frames[k] = toCanvas(grids[k], pal)
    const props: Record<string, string> = {}
    const pg = buildProps()
    for (const k of Object.keys(pg)) props[k] = toCanvas(pg[k], pal).toDataURL()
    hit = { frames, grids, props }
    cache.set(key, hit)
  }
  return hit
}

/** data URL of a small prop sprite (e.g. the puddle) in the current colours */
export function propUrl(name: string, c: Cosmetics): string {
  return sheet(c).props[name] ?? ''
}

/** Pixel-art cat: swaps pre-drawn frames on a timer. Nothing here triggers React renders per frame. */
export const PixelCat = forwardRef<PixelCatHandle, Props>(function PixelCat({ anim, lowPower, personality, cosmetics, effect }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const current = useRef<string>('sit0')
  const prevAnim = useRef<string>('sit')
  const s = useMemo(() => sheet(cosmetics), [cosmetics.fur, cosmetics.eyes, cosmetics.collar, cosmetics.hat, cosmetics.neck]) // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    hit(x, y) {
      const g = s.grids[current.current]
      if (!g) return false
      const gx = Math.floor(x / SCALE)
      const gy = Math.floor(y / SCALE)
      // forgiving: any opaque pixel within 3 sprite pixels (~9 screen px) counts, so clicks a hair
      // off the cat's outline still hit the cat instead of leaking through to the app behind it
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (g.get(gx + dx, gy + dy)) return true
      return false
    }
  }))

  useEffect(() => {
    const a = ANIMS[anim]
    // arriving from walking / falling etc: play the sit-down transition once first
    const calm = ['sit', 'lick', 'stretch', 'pet', 'treat', 'play', 'sleep', 'pant', 'surprised']
    const intro = a.intro && !calm.includes(prevAnim.current) ? a.intro : []
    prevAnim.current = anim
    let i = 0
    const draw = () => {
      const name = i < intro.length ? intro[i] : a.frames[(i - intro.length) % a.frames.length]
      current.current = name
      const c = canvas.current
      if (c) {
        const ctx = c.getContext('2d')!
        ctx.clearRect(0, 0, GRID, GRID)
        ctx.drawImage(s.frames[name], 0, 0)
      }
      i++
    }
    draw()
    // low power: ambient animation slows right down; reactions keep their pace
    const slow = lowPower && (anim === 'sit' || anim === 'sleep')
    const fps = slow ? 0.5 : a.fps * (anim === 'sit' ? 1 : 1)
    const id = window.setInterval(draw, 1000 / fps)
    return () => window.clearInterval(id)
  }, [anim, lowPower, s])

  return (
    <div className={`px fx-${effect} p-${personality}`} style={{ width: SPRITE_PX, height: SPRITE_PX }}>
      <canvas ref={canvas} width={GRID} height={GRID} className="px-canvas" />
      <img className="prop yarn" src={s.props.yarn} alt="" style={{ width: 8 * SCALE }} />
      <img className="prop fish" src={s.props.fish} alt="" style={{ width: 12 * SCALE }} />
      <img className="prop bang" src={s.props.bang} alt="" style={{ width: 5 * SCALE }} />
      {[1, 2, 3].map((n) => (
        <img key={'h' + n} className={`prop heart h${n}`} src={s.props.heart} alt="" style={{ width: 7 * SCALE }} />
      ))}
      {[1, 2, 3].map((n) => (
        <img key={'z' + n} className={`prop zz z${n}`} src={s.props.z} alt="" style={{ width: (3 + n) * 2 + 3 }} />
      ))}
    </div>
  )
})
