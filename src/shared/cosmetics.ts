/**
 * Wardrobe catalogue. Items unlock purely by bond level (no purchases, timers or streaks),
 * and anything unlocked stays unlocked. Default look is the signature black cat with a red collar.
 */
export type Slot = 'collar' | 'eyes' | 'fur' | 'hat' | 'neck'

export interface Item {
  id: string
  label: string
  /** bond level required */
  level: number
  /** hex colour for collar / eyes / fur items (unused for hats and neckwear) */
  color?: string
}

export const CATALOG: Record<Slot, Item[]> = {
  collar: [
    { id: 'red', label: 'Red', level: 1, color: '#d64545' },
    { id: 'blue', label: 'Blue', level: 1, color: '#4a90e2' },
    { id: 'green', label: 'Green', level: 2, color: '#4caf6a' },
    { id: 'yellow', label: 'Sunny', level: 2, color: '#f2c230' },
    { id: 'pink', label: 'Pink', level: 3, color: '#ff7eb6' },
    { id: 'teal', label: 'Teal', level: 3, color: '#26a69a' },
    { id: 'purple', label: 'Purple', level: 4, color: '#9b6bff' },
    { id: 'white', label: 'Snow', level: 5, color: '#eeeeee' },
    { id: 'orange', label: 'Tangerine', level: 6, color: '#ff8a3d' }
  ],
  eyes: [
    { id: 'green', label: 'Green', level: 1, color: '#9be15d' },
    { id: 'amber', label: 'Amber', level: 2, color: '#ffc247' },
    { id: 'blue', label: 'Blue', level: 3, color: '#6ec6ff' },
    { id: 'teal', label: 'Teal', level: 4, color: '#4dd0c8' },
    { id: 'violet', label: 'Violet', level: 5, color: '#c58cff' },
    { id: 'copper', label: 'Copper', level: 6, color: '#e08a35' },
    { id: 'rose', label: 'Rose', level: 8, color: '#ff8fb1' }
  ],
  fur: [
    { id: 'black', label: 'Black', level: 1, color: '#2d2a3a' },
    { id: 'midnight', label: 'Midnight', level: 2, color: '#22304f' },
    { id: 'gray', label: 'Gray', level: 3, color: '#6b6f7d' },
    { id: 'cocoa', label: 'Cocoa', level: 4, color: '#5c3d2e' },
    { id: 'silver', label: 'Silver', level: 5, color: '#aeb4c4' },
    { id: 'cream', label: 'Cream', level: 6, color: '#d9c7a3' },
    { id: 'ginger', label: 'Ginger', level: 7, color: '#c8682d' },
    { id: 'white', label: 'Snowy', level: 8, color: '#e8e6ee' },
    { id: 'lilac', label: 'Lilac', level: 9, color: '#a58fc2' }
  ],
  hat: [
    { id: 'none', label: 'None', level: 1 },
    { id: 'bow', label: 'Bow', level: 2 },
    { id: 'glasses', label: 'Glasses', level: 3 },
    { id: 'party', label: 'Party hat', level: 4 },
    { id: 'flower', label: 'Flower crown', level: 4 },
    { id: 'headphones', label: 'Headphones', level: 5 },
    { id: 'sunglasses', label: 'Sunglasses', level: 5 },
    { id: 'crown', label: 'Crown', level: 6 },
    { id: 'wizard', label: 'Wizard hat', level: 7 },
    { id: 'santa', label: 'Santa hat', level: 7 },
    { id: 'halo', label: 'Halo', level: 8 }
  ],
  neck: [
    { id: 'none', label: 'None', level: 1 },
    { id: 'scarf', label: 'Scarf', level: 2 },
    { id: 'bandana', label: 'Bandana', level: 3 },
    { id: 'bowtie', label: 'Bow tie', level: 4 },
    { id: 'medal', label: 'Medal', level: 6 }
  ]
}

export interface Cosmetics {
  collar: string
  eyes: string
  fur: string
  hat: string
  neck: string
}

export const DEFAULT_COSMETICS: Cosmetics = { collar: 'red', eyes: 'green', fur: 'black', hat: 'none', neck: 'none' }

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
