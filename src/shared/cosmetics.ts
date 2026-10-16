/**
 * Wardrobe catalogue. Items unlock purely by bond level (no purchases, timers or streaks),
 * and anything unlocked stays unlocked. Default look is the signature black cat with a red collar.
 */
export type Slot = 'collar' | 'eyes' | 'fur' | 'hat'

export interface Item {
  id: string
  label: string
  /** bond level required */
  level: number
  /** hex colour for collar / eyes / fur items (unused for hats) */
  color?: string
}

export const CATALOG: Record<Slot, Item[]> = {
  collar: [
    { id: 'red', label: 'Red', level: 1, color: '#d64545' },
    { id: 'blue', label: 'Blue', level: 1, color: '#4a90e2' },
    { id: 'green', label: 'Green', level: 2, color: '#4caf6a' },
    { id: 'pink', label: 'Pink', level: 3, color: '#ff7eb6' },
    { id: 'purple', label: 'Purple', level: 4, color: '#9b6bff' }
  ],
  eyes: [
    { id: 'green', label: 'Green', level: 1, color: '#9be15d' },
    { id: 'amber', label: 'Amber', level: 2, color: '#ffc247' },
    { id: 'blue', label: 'Blue', level: 3, color: '#6ec6ff' },
    { id: 'violet', label: 'Violet', level: 5, color: '#c58cff' }
  ],
  fur: [
    { id: 'black', label: 'Black', level: 1, color: '#2d2a3a' },
    { id: 'midnight', label: 'Midnight', level: 2, color: '#22304f' },
    { id: 'gray', label: 'Gray', level: 3, color: '#6b6f7d' },
    { id: 'cocoa', label: 'Cocoa', level: 4, color: '#5c3d2e' },
    { id: 'cream', label: 'Cream', level: 6, color: '#d9c7a3' }
  ],
  hat: [
    { id: 'none', label: 'None', level: 1 },
    { id: 'bow', label: 'Bow', level: 2 },
    { id: 'glasses', label: 'Glasses', level: 3 },
    { id: 'party', label: 'Party hat', level: 4 },
    { id: 'crown', label: 'Crown', level: 6 }
  ]
}

export interface Cosmetics {
  collar: string
  eyes: string
  fur: string
  hat: string
}

export const DEFAULT_COSMETICS: Cosmetics = { collar: 'red', eyes: 'green', fur: 'black', hat: 'none' }

export const itemOf = (slot: Slot, id: string): Item | undefined => CATALOG[slot].find((i) => i.id === id)

/** true when the item exists and the player's level allows it */
export function canEquip(slot: Slot, id: string, level: number): boolean {
  const it = itemOf(slot, id)
  return !!it && it.level <= level
}

/** items that become available exactly at this level (for the level-up message) */
export function unlockedAt(level: number): Item[] {
  return (Object.keys(CATALOG) as Slot[]).flatMap((s) => CATALOG[s].filter((i) => i.level === level && level > 1))
}
