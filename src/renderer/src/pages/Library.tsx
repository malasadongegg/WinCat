import { useEffect, useMemo, useRef, useState } from 'react'
import { fill, placeholders } from '@shared/template'
import { search } from '@shared/search'
import type { Item, ItemKind, Workspace } from '@shared/workspace'
import { Markdown } from '../ui/Markdown'
import { ago } from '../ui/hooks'

interface Props {
  kind: ItemKind
  ws: Workspace
  /** item to open (from search / home); cleared by the parent after use */
  openId: string | null
  onOpened: () => void
}

type FolderFilter = 'all' | 'none' | string

/** Shared list + editor for notes and snippets: folders, favorites, autosave. */
export function Library({ kind, ws, openId, onOpened }: Props) {
  const [folder, setFolder] = useState<FolderFilter>('all')
  const [favOnly, setFavOnly] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null)
  const [preview, setPreview] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newFolder, setNewFolder] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [copied, setCopied] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  const noun = kind === 'note' ? 'note' : 'snippet'
  const current = ws.items.find((i) => i.id === selected && i.kind === kind) ?? null

  const list = useMemo(
    () =>
      search(ws.items, {
        q: '',
        kind,
        folderId: folder === 'all' ? undefined : folder === 'none' ? null : folder,
        favoritesOnly: favOnly
      }).map((h) => h.item),
    [ws.items, kind, folder, favOnly]
  )

  // open an item requested from elsewhere
  useEffect(() => {
    if (openId && ws.items.some((i) => i.id === openId)) {
      setSelected(openId)
      setFolder('all')
      onOpened()
    }
  }, [openId, ws.items, onOpened])

  // load the draft when the selection changes
  useEffect(() => {
    setDraft(current ? { title: current.title, body: current.body } : null)
    setPreview(false)
    setValues({})
    setConfirmDelete(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  // autosave shortly after typing stops
  useEffect(() => {
    if (!current || !draft) return
    if (draft.title === current.title && draft.body === current.body) return
    const id = window.setTimeout(() => { window.cat.wsSaveItem({ id: current.id, kind, title: draft.title, body: draft.body }) }, 500)
    return () => window.clearTimeout(id)
  }, [draft, current, kind])

  const create = async () => {
    const it = await window.cat.wsSaveItem({ kind, title: '', body: '', folderId: folder !== 'all' && folder !== 'none' ? folder : null })
    if (it) {
      setSelected(it.id)
      window.setTimeout(() => titleRef.current?.focus(), 50)
    }
  }
  const patch = (p: Partial<Item>) => current && window.cat.wsSaveItem({ id: current.id, kind, ...p })

  // deleting is forgiving: a short "Undo" bar re-creates the item exactly as it was
  const [undo, setUndo] = useState<Item | null>(null)
  const undoTimer = useRef<number | undefined>(undefined)
  const remove = async () => {
    if (!current) return
    const gone = { ...current, title: draft?.title ?? current.title, body: draft?.body ?? current.body }
    await window.cat.wsDeleteItem(current.id)
    setSelected(null)
    setUndo(gone)
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndo(null), 10_000)
  }
  const restore = async () => {
    if (!undo) return
    const it = await window.cat.wsSaveItem({ kind: undo.kind, title: undo.title, body: undo.body, format: undo.format, folderId: undo.folderId, favorite: undo.favorite })
    setUndo(null)
    if (it) setSelected(it.id)
  }

  const addFolder = async () => {
    const name = (newFolder ?? '').trim()
    const renameId = renaming ? folder : undefined
    setNewFolder(null)
    setRenaming(false)
    if (!name) return
    const f = await window.cat.wsSaveFolder({ id: renameId, name })
    if (f) setFolder(f.id)
  }

  const names = draft && kind === 'snippet' ? placeholders(draft.body) : []
  const filled = draft && kind === 'snippet' ? fill(draft.body, values) : ''
  const copy = async () => {
    await window.cat.copyText(filled)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="library">
      <div className="lib-list">
        <div className="row">
          <button className="primary" onClick={create}>+ New {noun}</button>
          <button aria-pressed={favOnly} className={favOnly ? 'on' : ''} onClick={() => setFavOnly(!favOnly)} title="Favorites only">
            {favOnly ? '★' : '☆'}
          </button>
        </div>
        <div className="row">
          <select aria-label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="all">All folders</option>
            <option value="none">No folder</option>
            {ws.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {newFolder === null ? (
            <button onClick={() => setNewFolder('')} title="New folder" aria-label="New folder">+&#128193;</button>
          ) : null}
        </div>
        {newFolder !== null && (
          <div className="row">
            <input
              autoFocus
              aria-label="Folder name"
              placeholder="Folder name"
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') { e.stopPropagation(); setNewFolder(null); setRenaming(false) } }}
            />
            <button onClick={addFolder}>{renaming ? 'Save' : 'Add'}</button>
          </div>
        )}
        {folder !== 'all' && folder !== 'none' && (
          <div className="row hint">
            <button className="link" onClick={() => { setRenaming(true); setNewFolder(ws.folders.find((x) => x.id === folder)?.name ?? '') }}>Rename</button>
            <button className="link" onClick={async () => { await window.cat.wsDeleteFolder(folder); setFolder('all') }} title="Items move to No folder">
              Delete folder
            </button>
          </div>
        )}
        <ul className="items" role="listbox" aria-label={kind === 'note' ? 'Notes' : 'Snippets'}>
          {list.map((i) => (
            <li key={i.id}>
              <button role="option" aria-selected={i.id === selected} className={'item' + (i.id === selected ? ' on' : '')} onClick={() => setSelected(i.id)}>
                <span className="item-title">{i.favorite ? '★ ' : ''}{i.title || `Untitled ${noun}`}</span>
                <span className="item-sub">{i.body.replace(/\s+/g, ' ').slice(0, 60) || 'Empty'}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="hint pad">{ws.items.some((i) => i.kind === kind) ? 'Nothing matches this filter.' : `No ${noun}s yet. Create your first one!`}</li>}
        </ul>
      </div>

      {undo && (
        <div className="undo-bar" role="status">
          Deleted &ldquo;{undo.title || 'Untitled'}&rdquo;
          <button onClick={restore}>Undo</button>
          <button className="link" onClick={() => setUndo(null)} aria-label="Dismiss">&times;</button>
        </div>
      )}
      <div className="lib-editor">
        {current && draft ? (
          <>
            <div className="row">
              <input
                ref={titleRef}
                className="title-input"
                aria-label="Title"
                placeholder={`${noun[0].toUpperCase() + noun.slice(1)} title`}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <button aria-pressed={current.favorite} onClick={() => patch({ favorite: !current.favorite })} title="Favorite" aria-label="Favorite">
                {current.favorite ? '★' : '☆'}
              </button>
            </div>
            {kind === 'note' && (
              <div className="row">
                <select aria-label="Format" value={current.format} onChange={(e) => patch({ format: e.target.value as 'text' | 'markdown' })}>
                  <option value="text">Plain text</option>
                  <option value="markdown">Markdown</option>
                </select>
                {current.format === 'markdown' && (
                  <div className="seg" role="group" aria-label="Mode">
                    <button className={!preview ? 'on' : ''} onClick={() => setPreview(false)}>Edit</button>
                    <button className={preview ? 'on' : ''} onClick={() => setPreview(true)}>Preview</button>
                  </div>
                )}
              </div>
            )}
            {preview && current.format === 'markdown' ? (
              <div className="preview"><Markdown text={draft.body} /></div>
            ) : (
              <textarea
                aria-label="Content"
                className={kind === 'snippet' ? 'mono' : ''}
                value={draft.body}
                placeholder={kind === 'snippet' ? 'Snippet text. Use {name} for fill-in placeholders, {date} and {time} are automatic.' : 'Write something…'}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              />
            )}
            {kind === 'snippet' && (
              <div className="fill">
                {names.map((n) => (
                  <label key={n} className="row">
                    <span className="slot-name">{n}</span>
                    <input value={values[n] ?? ''} onChange={(e) => setValues({ ...values, [n]: e.target.value })} aria-label={`Value for ${n}`} />
                  </label>
                ))}
                <div className="row">
                  <button className="primary" onClick={copy}>{copied ? 'Copied ✓' : names.length ? 'Copy filled' : 'Copy'}</button>
                  {names.length > 0 && <span className="hint clip-text">{filled.slice(0, 80)}</span>}
                </div>
              </div>
            )}
            <div className="row foot">
              <select aria-label="Move to folder" value={current.folderId ?? ''} onChange={(e) => patch({ folderId: e.target.value || null })}>
                <option value="">No folder</option>
                {ws.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <span className="hint grow">Saved {ago(current.updatedAt)}</span>
              {confirmDelete ? (
                <>
                  <span className="hint">Delete this {noun}?</span>
                  <button className="danger" onClick={remove}>Delete</button>
                  <button onClick={() => setConfirmDelete(false)}>Keep</button>
                </>
              ) : (
                <button onClick={() => setConfirmDelete(true)}>Delete</button>
              )}
            </div>
          </>
        ) : (
          <div className="empty">
            <p className="big">{kind === 'note' ? '📝' : '✂️'}</p>
            <p>{kind === 'note' ? 'Pick a note, or start a new one.' : 'Pick a snippet to copy it, or save a new one.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
