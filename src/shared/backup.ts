/**
 * Backup / restore logic (pure, no I/O). A backup holds the persistent workspace (notes, snippets,
 * folders), the cat's progress and look, the room, and appearance settings. It NEVER holds the
 * temporary clipboard history or anything suspected to be a secret: those are not stored anywhere
 * to begin with.
 */
import { PERSONALITIES, DEFAULT_COMPANION, levelInfo, type CompanionState } from './companion'
import { ROOM_DIMS, sanitizeRoom, sanitizeRoomStyle } from './catlife'
import { CATALOG, canEquip, type Slot } from './cosmetics'
import { sanitizeUi, type UiSettings } from './ui'
import { normalize, type Folder, type Item, type Workspace } from './workspace'

export const BACKUP_FORMAT = 'wincat-backup'

export interface BackupData {
  format: typeof BACKUP_FORMAT
  version: 1
  createdAt: number
  workspace: Workspace
  companion: CompanionState
  ui: UiSettings
}

export function buildBackup(workspace: Workspace, companion: CompanionState, ui: UiSettings, now = Date.now()): BackupData {
  return { format: BACKUP_FORMAT, version: 1, createdAt: now, workspace, companion: { ...companion, lastSeen: 0 }, ui }
}

const num = (v: unknown, max = 1e9): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0)

function numMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 300)) {
      if (k.length <= 64 && typeof val === 'number' && Number.isFinite(val)) out[k] = Math.max(0, val)
    }
  }
  return out
}

/** Read the cat's saved state from untrusted input, keeping only valid values. */
export function parseCompanion(raw: unknown): CompanionState {
  const r = (raw ?? {}) as Record<string, unknown>
  const base = DEFAULT_COMPANION
  const bond = num(r.bond)
  const level = levelInfo(bond).level
  const cos = { ...base.cosmetics }
  const rc = (r.cosmetics ?? {}) as Record<string, unknown>
  for (const slot of Object.keys(CATALOG) as Slot[]) {
    const id = rc[slot]
    if (typeof id === 'string' && canEquip(slot, id, level)) cos[slot] = id
  }
  return {
    ...base,
    personality: (PERSONALITIES as readonly string[]).includes(r.personality as string) ? (r.personality as CompanionState['personality']) : base.personality,
    bubbles: typeof r.bubbles === 'boolean' ? r.bubbles : base.bubbles,
    sound: typeof r.sound === 'boolean' ? r.sound : base.sound,
    volume: typeof r.volume === 'number' && Number.isFinite(r.volume) ? Math.min(1, Math.max(0, r.volume)) : base.volume,
    cosmetics: cos,
    perch: typeof r.perch === 'boolean' ? r.perch : base.perch,
    stats: numMap(r.stats),
    achievements: numMap(r.achievements),
    collection: numMap(r.collection),
    room: sanitizeRoom(r.room, level),
    roomMode: r.roomMode === true,
    roomOffer: r.roomOffer === 'accepted' || r.roomOffer === 'declined' ? r.roomOffer : 'unasked',
    roomStyle: sanitizeRoomStyle(r.roomStyle, level),
    roomSize: typeof r.roomSize === 'string' && r.roomSize in ROOM_DIMS ? (r.roomSize as CompanionState['roomSize']) : base.roomSize,
    roomPos:
      r.roomPos && typeof r.roomPos === 'object' && typeof (r.roomPos as { x?: unknown }).x === 'number' && typeof (r.roomPos as { y?: unknown }).y === 'number'
        ? { x: num((r.roomPos as { x: number }).x, 8000), y: num((r.roomPos as { y: number }).y, 8000) }
        : null,
    bond,
    pets: num(r.pets),
    treats: num(r.treats),
    plays: num(r.plays),
    lastSeen: 0
  }
}

/** Validate a parsed JSON value as a backup; null if it is not one. */
export function parseBackup(raw: unknown): BackupData | null {
  const r = raw as Partial<BackupData> | null
  if (!r || typeof r !== 'object' || r.format !== BACKUP_FORMAT || r.version !== 1) return null
  return {
    format: BACKUP_FORMAT,
    version: 1,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : 0,
    workspace: normalize(r.workspace),
    companion: parseCompanion(r.companion),
    ui: sanitizeUi(r.ui)
  }
}

/** what the renderer is told about a chosen backup file */
export interface BackupPick {
  canceled?: boolean
  needsPassword?: boolean
  error?: string
  summary?: Summary
  conflicts?: Array<{ id: string; title: string; mine: number; theirs: number; mineText: string; theirText: string }>
}

export interface SnapshotList {
  items: Array<{ name: string; createdAt: number; bytes: number; reason: string }>
  usedBytes: number
  capMB: number
}

export interface Summary {
  createdAt: number
  notes: number
  snippets: number
  folders: number
  level: number
}

export function summarize(b: BackupData): Summary {
  return {
    createdAt: b.createdAt,
    notes: b.workspace.items.filter((i) => i.kind === 'note').length,
    snippets: b.workspace.items.filter((i) => i.kind === 'snippet').length,
    folders: b.workspace.folders.length,
    level: levelInfo(b.companion.bond).level
  }
}

// ---------- merge ----------
export interface ItemConflict {
  id: string
  current: Item
  incoming: Item
}

const sameContent = (a: Item, b: Item) =>
  a.title === b.title && a.body === b.body && a.format === b.format && a.folderId === b.folderId && a.favorite === b.favorite

/**
 * Merge a backup into the current workspace without losing anything: new items and folders are
 * added; items present on both sides with different content are NOT overwritten but reported as
 * conflicts for the user to review. `ws` already contains everything except the incoming side of conflicts.
 */
export function mergeWorkspaces(cur: Workspace, inc: Workspace): { ws: Workspace; conflicts: ItemConflict[] } {
  const folderIds = new Set(cur.folders.map((f) => f.id))
  const folders: Folder[] = [...cur.folders, ...inc.folders.filter((f) => !folderIds.has(f.id))]
  const byId = new Map(cur.items.map((i) => [i.id, i]))
  const conflicts: ItemConflict[] = []
  const added: Item[] = []
  for (const i of inc.items) {
    const mine = byId.get(i.id)
    if (!mine) added.push(i)
    else if (!sameContent(mine, i)) conflicts.push({ id: i.id, current: mine, incoming: i })
  }
  const validFolders = new Set(folders.map((f) => f.id))
  const fixed = added.map((i) => (i.folderId && !validFolders.has(i.folderId) ? { ...i, folderId: null } : i))
  return { ws: { version: 1, folders, items: [...cur.items, ...fixed] }, conflicts }
}

export type Resolution = 'mine' | 'backup' | 'both'

/** Apply the user's choice for each conflict ('mine' is the default and keeps the current item). */
export function resolveConflicts(ws: Workspace, conflicts: ItemConflict[], choices: Record<string, Resolution>, newId: () => string): Workspace {
  let items = ws.items
  for (const c of conflicts) {
    const choice = choices[c.id] ?? 'mine'
    if (choice === 'backup') items = items.map((i) => (i.id === c.id ? c.incoming : i))
    else if (choice === 'both') items = [...items, { ...c.incoming, id: newId(), title: (c.incoming.title || 'Untitled') + ' (from backup)' }]
  }
  return { ...ws, items }
}

/** Merge cat progress: nothing is ever lost, so every counter keeps its larger value. */
export function mergeCompanion(cur: CompanionState, inc: CompanionState): CompanionState {
  const maxMap = (a: Record<string, number>, b: Record<string, number>) => {
    const out = { ...a }
    for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v)
    return out
  }
  const winner = inc.bond > cur.bond ? inc : cur // look and room follow whichever cat has progressed further
  return {
    ...cur,
    cosmetics: winner.cosmetics,
    roomStyle: winner.roomStyle,
    room: winner.room.length >= cur.room.length ? winner.room : cur.room,
    bond: Math.max(cur.bond, inc.bond),
    pets: Math.max(cur.pets, inc.pets),
    treats: Math.max(cur.treats, inc.treats),
    plays: Math.max(cur.plays, inc.plays),
    stats: maxMap(cur.stats, inc.stats),
    achievements: maxMap(cur.achievements, inc.achievements),
    collection: maxMap(cur.collection, inc.collection)
  }
}
