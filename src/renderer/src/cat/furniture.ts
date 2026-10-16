import { spriteSize } from './items'

/** pixel scale per piece, so the cat actually fits in the box and on the bed */
export const SCALE_OF: Record<string, number> = { bed: 4, box: 5, post: 4, ball: 3, boxFront: 5 }

export const spriteKey = (type: string) => (type === 'box' ? 'boxBack' : type)

export function furnitureSize(type: string): { w: number; h: number } {
  const s = spriteSize(spriteKey(type))
  const k = SCALE_OF[type] ?? 3
  return { w: s.w * k, h: s.h * k }
}
