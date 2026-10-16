import { describe, expect, it } from 'vitest'
import { excerpt, search } from './search'
import { builtinValue, fill, placeholders } from './template'
import { moveWidget, sanitizeUi, visibleWidgets, DEFAULT_UI } from './ui'
import { EMPTY_WORKSPACE, deleteFolder, deleteItem, normalize, upsertFolder, upsertItem, type Workspace } from './workspace'

let n = 0
const id = () => 'id' + ++n

describe('workspace', () => {
  it('creates, updates and deletes items', () => {
    let { ws, item } = upsertItem(EMPTY_WORKSPACE, { kind: 'note', title: 'Hi', body: 'x' }, 100, id)
    expect(ws.items).toHaveLength(1)
    ;({ ws, item } = upsertItem(ws, { id: item.id, kind: 'note', body: 'y' }, 200, id))
    expect(item.body).toBe('y')
    expect(item.title).toBe('Hi')
    expect(item.createdAt).toBe(100)
    expect(item.updatedAt).toBe(200)
    expect(deleteItem(ws, item.id).items).toHaveLength(0)
  })
  it('snippets are always plain text; unknown folders are ignored', () => {
    const { item } = upsertItem(EMPTY_WORKSPACE, { kind: 'snippet', format: 'markdown', folderId: 'nope' }, 1, id)
    expect(item.format).toBe('text')
    expect(item.folderId).toBeNull()
  })
  it('deleting a folder keeps its items', () => {
    let ws: Workspace = EMPTY_WORKSPACE
    const f = upsertFolder(ws, { name: 'Work' }, id)
    ws = f.ws
    ws = upsertItem(ws, { kind: 'note', title: 'a', folderId: f.folder.id }, 1, id).ws
    ws = deleteFolder(ws, f.folder.id)
    expect(ws.folders).toHaveLength(0)
    expect(ws.items[0].folderId).toBeNull()
  })
  it('normalize survives junk', () => {
    const ws = normalize({ folders: [{ id: 'f' }, 5, { id: 'f' }], items: [{ id: 'a', kind: 'note', folderId: 'zzz', title: 3 }, { id: 'b', kind: 'bad' }, null] })
    expect(ws.folders).toHaveLength(1)
    expect(ws.items).toHaveLength(1)
    expect(ws.items[0].folderId).toBeNull()
    expect(normalize('garbage')).toEqual(EMPTY_WORKSPACE)
  })
})

describe('search', () => {
  const mk = (over: object, i: number) => upsertItem(EMPTY_WORKSPACE, { kind: 'note', ...over }, i, () => 'k' + i).item
  const items = [
    mk({ title: 'Grocery list', body: 'milk eggs' }, 1),
    mk({ title: 'Ideas', body: 'grocery app idea', favorite: true }, 2),
    mk({ title: 'Snippet', kind: 'snippet', body: 'console.log' }, 3)
  ]
  it('ranks title matches above body matches', () => {
    expect(search(items, { q: 'grocery' }).map((h) => h.item.title)).toEqual(['Grocery list', 'Ideas'])
  })
  it('ANDs terms and applies filters', () => {
    expect(search(items, { q: 'grocery milk' })).toHaveLength(1)
    expect(search(items, { q: '', kind: 'snippet' })).toHaveLength(1)
    expect(search(items, { q: '', favoritesOnly: true })).toHaveLength(1)
    expect(search(items, { q: '', since: 3 })).toHaveLength(1)
  })
  it('makes excerpts', () => {
    expect(excerpt('a'.repeat(100) + ' needle ' + 'b'.repeat(100), 'needle')).toContain('needle')
  })
})

describe('templates', () => {
  it('finds user placeholders but not built-ins', () => {
    expect(placeholders('Hi {name}, today is {date}. {name} again, {{literal}}')).toEqual(['name'])
  })
  it('fills values, built-ins and literal braces', () => {
    const now = new Date(2026, 0, 2, 3, 4)
    expect(fill('Hi {name} {date} {{x}}', { name: 'Bo' }, now)).toBe(`Hi Bo ${builtinValue('date', now)} {x}`)
    expect(fill('Hi {missing}', {})).toBe('Hi {missing}')
  })
})

describe('ui settings', () => {
  it('sanitizes and clamps', () => {
    const u = sanitizeUi({ theme: 'weird', textScale: 9, density: 'compact', widgets: [{ id: 'notes', visible: false }, { id: 'bogus' }] })
    expect(u.theme).toBe('system')
    expect(u.textScale).toBe(1.5)
    expect(u.density).toBe('compact')
    expect(u.widgets).toHaveLength(DEFAULT_UI.widgets.length)
    expect(u.widgets.find((w) => w.id === 'notes')?.visible).toBe(false)
  })
  it('orders pinned first and moves widgets', () => {
    const w = DEFAULT_UI.widgets.map((x) => (x.id === 'notes' ? { ...x, pinned: true } : x))
    expect(visibleWidgets(w)[0].id).toBe('notes')
    expect(moveWidget(DEFAULT_UI.widgets, 'actions', 1)[1].id).toBe('actions')
    expect(moveWidget(DEFAULT_UI.widgets, 'actions', -1)).toBe(DEFAULT_UI.widgets)
  })
})
