/**
 * Global hotkeys. Accelerators use Electron's format, e.g. "Control+Alt+C".
 * A hotkey needs at least one modifier so it can never swallow ordinary typing.
 */
export type HotkeyId = 'panel' | 'picker' | 'pause' | 'focus'

export const HOTKEY_LABELS: Record<HotkeyId, string> = {
  panel: "Open / close Cat's Desk",
  picker: 'Quick picker',
  pause: 'Pause / resume clipboard capture',
  focus: 'Focus mode (quiet cat)'
}

export const DEFAULT_HOTKEYS: Record<HotkeyId, string> = {
  panel: 'Control+Alt+C',
  picker: 'Control+Alt+V',
  pause: 'Control+Alt+P',
  focus: 'Control+Alt+F'
}

const MODS = new Set(['Control', 'Alt', 'Shift', 'Super'])
const SPECIAL = new Set(['Space', 'Tab', 'Enter', 'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown', 'Up', 'Down', 'Left', 'Right'])

/** true for "" (hotkey turned off) or a well-formed accelerator with a modifier */
export function isValidAccelerator(a: unknown): a is string {
  if (typeof a !== 'string') return false
  if (a === '') return true
  const parts = a.split('+')
  if (parts.length < 2 || parts.length > 4) return false
  const key = parts[parts.length - 1]
  const mods = parts.slice(0, -1)
  if (!mods.every((m) => MODS.has(m)) || new Set(mods).size !== mods.length) return false
  return /^[A-Z0-9]$/.test(key) || /^F([1-9]|1\d|2[0-4])$/.test(key) || SPECIAL.has(key)
}

/** Turn a key press into an accelerator, or null if it is only a modifier / has no modifier. */
export function acceleratorFromEvent(e: { key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): string | null {
  const mods: string[] = []
  if (e.ctrlKey) mods.push('Control')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  if (e.metaKey) mods.push('Super')
  let key = e.key
  if (['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'].includes(key)) return null
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  else if (key.startsWith('Arrow')) key = key.slice(5)
  const accel = [...mods, key].join('+')
  return isValidAccelerator(accel) && mods.length > 0 ? accel : null
}

export function sanitizeHotkeys(raw: unknown, base: Record<HotkeyId, string> = DEFAULT_HOTKEYS): Record<HotkeyId, string> {
  const r = (raw ?? {}) as Record<string, unknown>
  const out = { ...base }
  for (const id of Object.keys(DEFAULT_HOTKEYS) as HotkeyId[]) if (isValidAccelerator(r[id])) out[id] = r[id] as string
  // the same key cannot do two things: later duplicates are switched off
  const seen = new Set<string>()
  for (const id of Object.keys(out) as HotkeyId[]) {
    if (out[id] && seen.has(out[id])) out[id] = ''
    else if (out[id]) seen.add(out[id])
  }
  return out
}
