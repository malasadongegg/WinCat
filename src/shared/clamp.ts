export interface Rect { x: number; y: number; width: number; height: number }

/** Keep a window rect fully inside a display's work area. */
export function clampToArea(r: Rect, area: Rect): Rect {
  const width = Math.min(r.width, area.width)
  const height = Math.min(r.height, area.height)
  const x = Math.min(Math.max(r.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(r.y, area.y), area.y + area.height - height)
  return { x, y, width, height }
}
