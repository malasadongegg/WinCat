import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs'
import { DEFAULT_ROOM_STYLE, sanitizeRoomStyle } from '../shared/catlife'
import { DEFAULT_UI, sanitizeUi } from '../shared/ui'
import { DEFAULT_COSMETICS } from '../shared/cosmetics'
import { DEFAULT_COMPANION } from '../shared/companion'
import { DEFAULT_SETTINGS, type Settings } from '../shared/types'

const file = () => join(app.getPath('userData'), 'settings.json')

export function loadSettings(): Settings {
  try {
    if (existsSync(file())) {
      const raw = JSON.parse(readFileSync(file(), 'utf8'))
      // merge nested companion so settings files from older versions gain new fields safely
      return { ...DEFAULT_SETTINGS, ...raw, ui: sanitizeUi(raw.ui), companion: { ...DEFAULT_COMPANION, ...(raw.companion ?? {}), cosmetics: { ...DEFAULT_COSMETICS, ...(raw.companion?.cosmetics ?? {}) }, stats: { ...(raw.companion?.stats ?? {}) }, achievements: { ...(raw.companion?.achievements ?? {}) }, collection: { ...(raw.companion?.collection ?? {}) }, room: Array.isArray(raw.companion?.room) ? raw.companion.room : [], roomStyle: sanitizeRoomStyle(raw.companion?.roomStyle, 99) } }
    }
  } catch {
    /* corrupt file: fall back to defaults; original is left untouched until the next save */
  }
  return { ...DEFAULT_SETTINGS, ui: DEFAULT_UI, placement: {}, companion: { ...DEFAULT_COMPANION, cosmetics: { ...DEFAULT_COSMETICS }, stats: {}, achievements: {}, collection: {}, room: [], roomStyle: { ...DEFAULT_ROOM_STYLE } } }
}

/** Atomic write: temp file then rename, so a crash never leaves a half-written file. */
export function saveSettings(s: Settings): void {
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(s, null, 2))
  renameSync(tmp, file())
}
