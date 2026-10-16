/**
 * Persistent workspace: notes, snippets and folders. Pure functions only (no I/O) so the rules are
 * unit-testable; main/workspace.ts handles the file. Temporary clipboard history is deliberately
 * NOT part of this and is never saved or searched.
 */
export type ItemKind = 'note' | 'snippet'
export type ItemFormat = 'text' | 'markdown'

export interface Folder {
  id: string
  name: string
}

export interface Item {
  id: string
  kind: ItemKind
  title: string
  body: string
  /** notes can be plain text or Markdown; snippets are always plain */
  format: ItemFormat
  folderId: string | null
  favorite: boolean
  createdAt: number
  updatedAt: number
}

export interface Workspace {
  version: 1
  folders: Folder[]
  items: Item[]
}

export const EMPTY_WORKSPACE: Workspace = { version: 1, folders: [], items: [] }

export const LIMITS = { title: 200, body: 200_000, folderName: 60, items: 20_000, folders: 500 }

export interface ItemInput {
  id?: string
  kind: ItemKind
  title?: string
  body?: string
  format?: ItemFormat
  folderId?: string | null
  favorite?: boolean
}

const str = (v: unknown, max: number, fallback = ''): string => (typeof v === 'string' ? v.slice(0, max) : fallback)

/** Tolerant loader: drops anything malformed rather than failing, so a damaged file still opens. */
export function normalize(raw: unknown): Workspace {
  const r = (raw ?? {}) as { folders?: unknown; items?: unknown }
  const folders: Folder[] = []
  const folderIds = new Set<string>()
  if (Array.isArray(r.folders)) {
    for (const f of r.folders.slice(0, LIMITS.folders)) {
      const o = f as Partial<Folder>
      if (typeof o?.id === 'string' && o.id && !folderIds.has(o.id)) {
        folderIds.add(o.id)
        folders.push({ id: o.id, name: str(o.name, LIMITS.folderName, 'Folder') })
      }
    }
  }
  const items: Item[] = []
  const ids = new Set<string>()
  if (Array.isArray(r.items)) {
    for (const i of r.items.slice(0, LIMITS.items)) {
      const o = i as Partial<Item>
      if (typeof o?.id !== 'string' || !o.id || ids.has(o.id)) continue
      if (o.kind !== 'note' && o.kind !== 'snippet') continue
      ids.add(o.id)
      const now = Date.now()
      items.push({
        id: o.id,
        kind: o.kind,
        title: str(o.title, LIMITS.title),
        body: str(o.body, LIMITS.body),
        format: o.kind === 'note' && o.format === 'markdown' ? 'markdown' : 'text',
        folderId: typeof o.folderId === 'string' && folderIds.has(o.folderId) ? o.folderId : null,
        favorite: o.favorite === true,
        createdAt: typeof o.createdAt === 'number' ? o.createdAt : now,
        updatedAt: typeof o.updatedAt === 'number' ? o.updatedAt : now
      })
    }
  }
  return { version: 1, folders, items }
}

export function upsertItem(ws: Workspace, input: ItemInput, now: number, newId: () => string): { ws: Workspace; item: Item } {
  const existing = input.id ? ws.items.find((i) => i.id === input.id) : undefined
  const kind = existing?.kind ?? (input.kind === 'snippet' ? 'snippet' : 'note')
  const folderId =
    input.folderId === undefined
      ? existing?.folderId ?? null
      : input.folderId !== null && ws.folders.some((f) => f.id === input.folderId)
        ? input.folderId
        : null
  const format: ItemFormat = kind === 'note' ? (input.format ?? existing?.format ?? 'text') === 'markdown' ? 'markdown' : 'text' : 'text'
  const item: Item = {
    id: existing?.id ?? newId(),
    kind,
    title: str(input.title ?? existing?.title, LIMITS.title),
    body: str(input.body ?? existing?.body, LIMITS.body),
    format,
    folderId,
    favorite: input.favorite ?? existing?.favorite ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
  if (!existing && ws.items.length >= LIMITS.items) return { ws, item: ws.items[0] }
  const items = existing ? ws.items.map((i) => (i.id === item.id ? item : i)) : [item, ...ws.items]
  return { ws: { ...ws, items }, item }
}

export function deleteItem(ws: Workspace, id: string): Workspace {
  return { ...ws, items: ws.items.filter((i) => i.id !== id) }
}

export function upsertFolder(ws: Workspace, input: { id?: string; name: string }, newId: () => string): { ws: Workspace; folder: Folder } {
  const name = str(input.name, LIMITS.folderName).trim() || 'Folder'
  const existing = input.id ? ws.folders.find((f) => f.id === input.id) : undefined
  const folder = { id: existing?.id ?? newId(), name }
  if (!existing && ws.folders.length >= LIMITS.folders) return { ws, folder: ws.folders[0] ?? folder }
  const folders = existing ? ws.folders.map((f) => (f.id === folder.id ? folder : f)) : [...ws.folders, folder]
  return { ws: { ...ws, folders }, folder }
}

/** Deleting a folder never deletes its items: they move to "No folder". */
export function deleteFolder(ws: Workspace, id: string): Workspace {
  return {
    ...ws,
    folders: ws.folders.filter((f) => f.id !== id),
    items: ws.items.map((i) => (i.folderId === id ? { ...i, folderId: null } : i))
  }
}
