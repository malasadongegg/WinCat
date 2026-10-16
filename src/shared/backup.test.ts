import { describe, expect, it } from 'vitest'
import { decryptText, encryptText, isEnvelope } from '../main/backupCrypto'
import { buildBackup, mergeCompanion, mergeWorkspaces, parseBackup, resolveConflicts, summarize } from './backup'
import { DEFAULT_COMPANION } from './companion'
import { DEFAULT_UI } from './ui'
import { upsertFolder, upsertItem, EMPTY_WORKSPACE, type Workspace } from './workspace'

/** deterministic ids so two calls to sample() produce the same items */
const seq = () => {
  let k = 0
  return () => 'id' + ++k
}
const N1 = 'id2'
const S1 = 'id3'

function sample(): Workspace {
  const id = seq()
  let { ws } = upsertFolder(EMPTY_WORKSPACE, { name: 'Work' }, id)
  const f = ws.folders[0].id
  ws = upsertItem(ws, { kind: 'note', title: 'Plan', body: 'one', folderId: f }, 10, id).ws
  ws = upsertItem(ws, { kind: 'snippet', title: 'Hi', body: 'hello' }, 11, id).ws
  return ws
}

describe('backup format', () => {
  it('round-trips through JSON and summarizes', () => {
    const b = buildBackup(sample(), { ...DEFAULT_COMPANION, bond: 40, stats: {}, achievements: {}, collection: {}, room: [] }, DEFAULT_UI, 123)
    const back = parseBackup(JSON.parse(JSON.stringify(b)))
    expect(back).not.toBeNull()
    expect(summarize(back!)).toEqual({ createdAt: 123, notes: 1, snippets: 1, folders: 1, level: 3 })
    expect(back!.companion.lastSeen).toBe(0)
  })
  it('rejects things that are not backups and cleans hostile fields', () => {
    expect(parseBackup(null)).toBeNull()
    expect(parseBackup({ format: 'other', version: 1 })).toBeNull()
    const b = parseBackup({ format: 'wincat-backup', version: 1, workspace: 'junk', companion: { bond: -5, cosmetics: { fur: 'cream', hat: 'bogus' }, room: [{ id: 'x', type: 'bed', x: 0.5 }], stats: { a: 'b', ok: 2 } }, ui: { textScale: 99 } })!
    expect(b.workspace.items).toEqual([])
    expect(b.companion.bond).toBe(0)
    expect(b.companion.cosmetics.fur).toBe('black') // cream needs level 6
    expect(b.companion.cosmetics.hat).toBe('none')
    expect(b.companion.room).toEqual([]) // bed needs level 2
    expect(b.companion.stats).toEqual({ ok: 2 })
    expect(b.ui.textScale).toBe(1.5)
  })
})

describe('merge', () => {
  it('adds new items, keeps yours, and reports differing duplicates as conflicts', () => {
    const mine = sample()
    const edited = upsertItem(sample(), { id: N1, kind: 'note', body: 'two (edited)' }, 20, seq()).ws
    const theirs = upsertItem(edited, { kind: 'note', title: 'New' }, 21, () => 'fresh').ws
    const { ws, conflicts } = mergeWorkspaces(mine, theirs)
    expect(ws.items.map((i) => i.id).sort()).toEqual([N1, S1, 'fresh'].sort())
    expect(ws.items.find((i) => i.id === N1)!.body).toBe('one')
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].incoming.body).toBe('two (edited)')
  })
  it('resolves conflicts: mine / backup / both', () => {
    const mine = sample()
    const theirs = upsertItem(sample(), { id: N1, kind: 'note', body: 'theirs' }, 20, seq()).ws
    const { ws, conflicts } = mergeWorkspaces(mine, theirs)
    const nid = () => 'copy1'
    expect(resolveConflicts(ws, conflicts, {}, nid).items.find((i) => i.id === N1)!.body).toBe('one')
    expect(resolveConflicts(ws, conflicts, { [N1]: 'backup' }, nid).items.find((i) => i.id === N1)!.body).toBe('theirs')
    const both = resolveConflicts(ws, conflicts, { [N1]: 'both' }, nid)
    expect(both.items).toHaveLength(ws.items.length + 1)
    expect(both.items.some((i) => i.title.endsWith('(from backup)'))).toBe(true)
  })
  it('identical items are not conflicts', () => {
    expect(mergeWorkspaces(sample(), sample()).conflicts).toEqual([])
  })
  it('cat progress merges upward, never down', () => {
    const a = { ...DEFAULT_COMPANION, bond: 50, pets: 5, stats: { perch: 3 }, achievements: { x: 1 }, collection: { leaf: 2 }, room: [] }
    const b = { ...DEFAULT_COMPANION, bond: 20, pets: 9, stats: { perch: 1, nap: 4 }, achievements: { y: 2 }, collection: { leaf: 1, key: 1 }, room: [] }
    const m = mergeCompanion(a, b)
    expect(m.bond).toBe(50)
    expect(m.pets).toBe(9)
    expect(m.stats).toEqual({ perch: 3, nap: 4 })
    expect(Object.keys(m.achievements).sort()).toEqual(['x', 'y'])
    expect(m.collection).toEqual({ leaf: 2, key: 1 })
  })
})

describe('password encryption', () => {
  it('round-trips and never contains the plain text', () => {
    const env = encryptText('{"secret":"my notes"}', 'correct horse')
    expect(isEnvelope(env)).toBe(true)
    expect(JSON.stringify(env)).not.toContain('my notes')
    expect(decryptText(env, 'correct horse')).toBe('{"secret":"my notes"}')
  })
  it('wrong password or tampering fails cleanly', () => {
    const env = encryptText('hello', 'pw1')
    expect(() => decryptText(env, 'pw2')).toThrow('Wrong password or damaged file')
    const bad = { ...env, data: Buffer.from('tampered!').toString('base64') }
    expect(() => decryptText(bad, 'pw1')).toThrow('Wrong password or damaged file')
    expect(() => decryptText({ ...env, N: 1 << 30 }, 'pw1')).toThrow()
  })
  it('requires a password', () => {
    expect(() => encryptText('x', '')).toThrow()
  })
})
