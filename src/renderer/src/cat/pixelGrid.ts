/**
 * Pixel toolkit: grid + palette + small prop sprites (hearts, fish, yarn, puddle...).
 * Frames are drawn from shapes at startup, so there are no art assets to license or ship.
 * The animation table at the bottom is the only thing the renderer depends on: it can be
 * swapped for PNG sprite sheets later without touching the pet logic.
 */
export const GRID = 32
/** vertical shift so every pose rests on row 29 with a 1px outline below */
export const OY = 2

export const PALETTE: Record<string, string> = {
  B: '#2d2a3a', // fur
  H: '#4a4666', // fur highlight (top edges)
  F: '#1a1822', // far-side limbs / tail shadow
  O: '#0d0c12', // outline
  E: '#9be15d', // eye
  S: '#6fae45', // closed eye
  K: '#0b0b0f', // pupil / mouth
  W: '#ffffff',
  P: '#ff9db4', // nose + inner ear
  L: '#ff7f9c', // blush
  R: '#d64545', // collar
  G: '#f4c542', // bell
  Y: '#ffd166', // yarn
  Q: '#e0a53a', // yarn line
  A: '#f08a4b', // fish
  D: '#cfd8ff', // Z
  M: '#ff6b8b', // heart
  V: '#a9c75a', // sick
  X: '#ff5a4a', // angry / bandana
  C: '#4fc3f7', // cyan accent (scarf)
  U: '#7e57c2', // violet accent (wizard, bow tie)
  T: '#26a69a', // teal accent (headphones)
  N: '#1b2a6b' // navy (wizard hat)
}

import { itemOf, type Cosmetics } from '@shared/cosmetics'

const hexToRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return '#' + c(r1, r2) + c(g1, g2) + c(b1, b2)
}

/** palette with the equipped fur / eye / collar colours applied */
export function paletteFor(c: Cosmetics): Record<string, string> {
  const fur = itemOf('fur', c.fur)?.color ?? PALETTE.B
  const eye = itemOf('eyes', c.eyes)?.color ?? PALETTE.E
  const collar = itemOf('collar', c.collar)?.color ?? PALETTE.R
  return { ...PALETTE, B: fur, H: mix(fur, '#ffffff', 0.25), F: mix(fur, '#000000', 0.4), E: eye, S: mix(eye, '#000000', 0.35), R: collar }
}

export type Cell = string | null

export class Grid {
  w: number
  h: number
  cells: Cell[]
  constructor(w = GRID, h = GRID, private oy = OY) {
    this.w = w
    this.h = h
    this.cells = new Array(w * h).fill(null)
  }
  set(x: number, y: number, k: Cell): void {
    x = Math.round(x)
    y = Math.round(y) + this.oy
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y * this.w + x] = k
  }
  get(x: number, y: number): Cell {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.cells[y * this.w + x] : null
  }
  rect(x: number, y: number, w: number, h: number, k: Cell): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, k)
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, k: Cell): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx
        const dy = (y + 0.5 - cy) / ry
        if (dx * dx + dy * dy <= 1) this.set(x, y, k)
      }
  }
  poly(pts: Array<[number, number]>, k: Cell): void {
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        let inside = false
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i]
          const [xj, yj] = pts[j]
          if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside
        }
        if (inside) this.set(x, y, k)
      }
  }
  /** 2px-thick polyline through the points */
  stroke(pts: Array<[number, number]>, k: Cell, thick = 2): void {
    for (let s = 0; s < pts.length - 1; s++) {
      const [x0, y0] = pts[s]
      const [x1, y1] = pts[s + 1]
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n
        const y = y0 + ((y1 - y0) * i) / n
        for (let t = 0; t < thick; t++) this.set(x, y - t, k)
      }
    }
  }
  /** top-edge highlight, then a 1px dark outline around everything */
  finish(): this {
    const src = [...this.cells]
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (src[y * this.w + x] === 'B' && !src[(y - 1) * this.w + x]) this.cells[y * this.w + x] = 'H'
    const filled = [...this.cells]
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (filled[y * this.w + x]) continue
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const nx = x + dx
          const ny = y + dy
          return nx >= 0 && ny >= 0 && nx < this.w && ny < this.h && filled[ny * this.w + nx]
        })
        if (n) this.cells[y * this.w + x] = 'O'
      }
    return this
  }
}

export function buildProps(): Record<string, Grid> {
  const p = (rows: string[], map: Record<string, string>): Grid => {
    const g = new Grid(rows[0].length, rows.length, 0)
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (map[c]) g.cells[y * g.w + x] = map[c] }))
    return g
  }
  return {
    heart: p(['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'], { x: 'M' }),
    fish: p(['..........x.', '.xxxxxxx.xx.', 'xxxxwxxxxxxx', '.xxxxxxx.xx.', '..........x.'], { x: 'A', w: 'W' }),
    yarn: p(['..xxxx..', '.xxqxxx.', 'xxqxxxxx', 'xqxxqxxx', 'xxxqxxqx', 'xxxxqqxx', '.xxxxxx.', '..xxxx..'], { x: 'Y', q: 'Q' }),
    puddle: p(['..xxxxxx....', 'xxxxxxxxxxx.', '.xxxxxxxxx..'], { x: 'V' }),
    bang: p(['xx.xx', 'xxxxx', '.xxx.', 'xxxxx', 'xx.xx'], { x: 'X' }),
    z: p(['xxxxx', '...x.', '..x..', '.x...', 'xxxxx'], { x: 'D' })
  }
}
