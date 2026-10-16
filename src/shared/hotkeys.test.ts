import { describe, expect, it } from 'vitest'
import { DEFAULT_HOTKEYS, acceleratorFromEvent, isValidAccelerator, sanitizeHotkeys } from './hotkeys'

const ev = (key: string, mods: Partial<{ ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }> = {}) => ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods })

describe('hotkeys', () => {
  it('validates accelerators', () => {
    for (const ok of ['', 'Control+Alt+C', 'Alt+F4', 'Control+Shift+Space', 'Super+Up']) expect(isValidAccelerator(ok)).toBe(true)
    for (const bad of ['C', 'Control', 'Control+', 'Control+Control+C', 'Ctrl+Alt+C', 'Control+Alt+Shift+Super+X', 'Control+ab', 5, null]) expect(isValidAccelerator(bad)).toBe(false)
  })
  it('builds accelerators from key presses and ignores bare keys / modifiers', () => {
    expect(acceleratorFromEvent(ev('k', { ctrlKey: true, altKey: true }))).toBe('Control+Alt+K')
    expect(acceleratorFromEvent(ev(' ', { ctrlKey: true }))).toBe('Control+Space')
    expect(acceleratorFromEvent(ev('ArrowUp', { altKey: true }))).toBe('Alt+Up')
    expect(acceleratorFromEvent(ev('F5', { shiftKey: true }))).toBe('Shift+F5')
    expect(acceleratorFromEvent(ev('a'))).toBeNull() // no modifier: would break typing
    expect(acceleratorFromEvent(ev('Control', { ctrlKey: true }))).toBeNull()
  })
  it('sanitizes saved hotkeys and disables duplicates', () => {
    const h = sanitizeHotkeys({ panel: 'Control+Alt+X', picker: 'Control+Alt+X', pause: 'nonsense' })
    expect(h.panel).toBe('Control+Alt+X')
    expect(h.picker).toBe('') // duplicate of panel
    expect(h.pause).toBe(DEFAULT_HOTKEYS.pause)
  })
})
