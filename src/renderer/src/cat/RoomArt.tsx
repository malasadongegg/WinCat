import type { CSSProperties, ReactNode } from 'react'
import type { RoomStyle } from '@shared/catlife'
import { spriteSize, spriteUrl } from './items'

/** frame thickness, height of the floor band and how far above the bottom the cat's feet rest */
export const ROOM_BORDER = 6
export const FLOOR_H = 84
export const FEET_ABOVE_BOTTOM = 18

/** the cat's walking area inside a room box of this size */
export function roomWorld(w: number, h: number): { width: number; height: number } {
  return { width: w - ROOM_BORDER * 2, height: h - ROOM_BORDER - FEET_ABOVE_BOTTOM }
}

const WALLS: Record<string, CSSProperties> = {
  cream: { background: '#f3e6cf' },
  mint: { background: '#cfe9d8' },
  sky: { background: '#cfe6f7' },
  blush: { background: '#f8d9de' },
  stripes: { background: 'repeating-linear-gradient(90deg, #f3e6cf 0 22px, #ead8b8 22px 44px)' },
  dots: { background: 'radial-gradient(circle, #c9b6e6 3px, transparent 4px) 0 0 / 28px 28px, #e5d9f2' },
  night: { background: 'radial-gradient(circle, #ffe9a8 1.5px, transparent 2px) 0 0 / 37px 29px, radial-gradient(circle, #cfd8ff 1px, transparent 1.5px) 14px 12px / 23px 31px, #2a2f5a' },
  forest: { background: 'repeating-linear-gradient(100deg, #3f6b4f 0 16px, #46785a 16px 32px)' }
}
const FLOORS: Record<string, CSSProperties> = {
  wood: { background: 'repeating-linear-gradient(90deg, #b9854e 0 38px, #a97741 38px 40px)' },
  light: { background: 'repeating-linear-gradient(90deg, #e0c08f 0 38px, #d3b27c 38px 40px)' },
  tile: { background: 'conic-gradient(#d9d4e3 25%, #c5bfd2 0 50%, #d9d4e3 0 75%, #c5bfd2 0) 0 0 / 40px 40px' },
  carpet: { background: 'repeating-linear-gradient(0deg, #7a8fb8 0 3px, #7186b0 3px 6px)' },
  dark: { background: 'repeating-linear-gradient(90deg, #5a4332 0 38px, #4d3829 38px 40px)' }
}

/** window view: sky colour + cloud/star colour */
const VIEWS: Record<string, { s: string; c: string }> = {
  day: { s: '#9fd8ff', c: '#ffffff' },
  sunset: { s: '#ff9a62', c: '#ffd9a0' },
  night: { s: '#1b2447', c: '#ffe9a8' },
  snow: { s: '#cfe3f5', c: '#ffffff' }
}

export type Lighting = 'day' | 'sunset' | 'night'

/** what the window shows and how bright the room is, given the style and the time of day */
export function lightingFor(style: RoomStyle, hour: number): { view: string; light: Lighting } {
  const night = hour < 6 || hour >= 19
  const view = style.window === 'auto' ? (night ? 'night' : hour >= 17 ? 'sunset' : 'day') : style.window
  return { view, light: view === 'night' ? 'night' : view === 'sunset' ? 'sunset' : 'day' }
}

const px = (name: string, scale: number, over?: Record<string, string>) => {
  const s = spriteSize(name)
  return { src: spriteUrl(name, over), width: s.w * scale, height: s.h * scale }
}

/**
 * The framed room: wall, floor, window, rug, wall art, plant and lamp, all drawn in pixel style.
 * Furniture and the cat are added by the caller (children) so the same art serves the desktop
 * overlay and the live preview in Cat's Desk. Everything here ignores the mouse.
 */
export function RoomArt({ style, w, h, hour, children, className }: { style: RoomStyle; w: number; h: number; hour: number; children?: ReactNode; className?: string }) {
  const k = w >= 700 ? 4 : 3
  const { view, light } = lightingFor(style, hour)
  const v = VIEWS[view] ?? VIEWS.day
  const wallH = h - FLOOR_H - ROOM_BORDER
  const win = px('window', k, { s: v.s, c: v.c })
  const art = style.art === 'none' ? null : px(({ fish: 'artFish', frame: 'artFrame', clock: 'artClock', garland: 'artGarland' } as Record<string, string>)[style.art], k)
  const plant = style.plant === 'none' ? null : px(({ sprout: 'plantSprout', cactus: 'plantCactus', fern: 'plantFern' } as Record<string, string>)[style.plant], k)
  const lamp = style.lamp === 'none' ? null : px('lampDesk', k)
  const feetY = h - ROOM_BORDER - FEET_ABOVE_BOTTOM // y (inside the box) where the cat's feet rest
  return (
    <div className={'room-box ' + (className ?? '')} style={{ width: w, height: h }} aria-hidden>
      <div className="room-wall" style={{ ...(WALLS[style.wall] ?? WALLS.cream), height: wallH }} />
      <div className="room-floor" style={{ ...(FLOORS[style.floor] ?? FLOORS.wood), height: FLOOR_H }} />
      <div className="room-base" style={{ top: wallH - 6 }} />
      <img className="rpx" src={win.src} style={{ left: 36 * (k / 3), top: 20 * (k / 3), width: win.width, height: win.height }} alt="" draggable={false} />
      {art && <img className="rpx" src={art.src} style={{ left: w * 0.55, top: style.art === 'garland' ? 12 : 26, width: art.width, height: art.height }} alt="" draggable={false} />}
      {style.rug !== 'none' && (
        <div
          className={'room-rug rug-' + style.rug}
          style={{ left: w * 0.5 - w * 0.22, top: feetY - 26, width: w * 0.44, height: 34 }}
        >
          {style.rug === 'paw' && <span>{'\u{1F43E}'}</span>}
        </div>
      )}
      {plant && <img className="rpx" src={plant.src} style={{ left: 20, top: feetY - plant.height + 4, width: plant.width, height: plant.height }} alt="" draggable={false} />}
      {lamp && <img className="rpx" src={lamp.src} style={{ left: w - 20 - lamp.width - ROOM_BORDER, top: feetY - lamp.height + 6, width: lamp.width, height: lamp.height }} alt="" draggable={false} />}
      {children}
      {light !== 'day' && <div className={'room-tint tint-' + light} />}
      {light !== 'day' && lamp && (
        <div className="room-glow" style={{ left: w - 20 - lamp.width / 2 - ROOM_BORDER - 110, top: feetY - lamp.height - 70 }} />
      )}
    </div>
  )
}
