import { useMemo, useState } from 'react'
import { excerpt, search } from '@shared/search'
import { placeholders } from '@shared/template'
import type { Item, ItemKind, Workspace } from '@shared/workspace'
import { ago } from '../ui/hooks'

interface Props {
  ws: Workspace
  q: string
  onOpen: (item: Item) => void
}

const RANGES = [
  { id: 'any', label: 'Any time', ms: 0 },
  { id: 'day', label: 'Past 24 hours', ms: 86_400_000 },
  { id: 'week', label: 'Past 7 days', ms: 7 * 86_400_000 },
  { id: 'month', label: 'Past 30 days', ms: 30 * 86_400_000 }
]

/** Global search across notes and snippets only. Clipboard history is never searched. */
export function SearchResults({ ws, q, onOpen }: Props) {
  const [kind, setKind] = useState<ItemKind | 'all'>('all')
  const [folder, setFolder] = useState('any')
  const [range, setRange] = useState('any')
  const [fav, setFav] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const hits = useMemo(() => {
    const ms = RANGES.find((r) => r.id === range)?.ms ?? 0
    return search(ws.items, {
      q,
      kind,
      folderId: folder === 'any' ? undefined : folder === 'none' ? null : folder,
      favoritesOnly: fav,
      since: ms ? Date.now() - ms : undefined
    })
  }, [ws.items, q, kind, folder, range, fav])

  const folderName = (id: string | null) => ws.folders.find((f) => f.id === id)?.name ?? 'No folder'

  return (
    <div>
      <div className="row filters" role="group" aria-label="Search filters">
        <select aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value as ItemKind | 'all')}>
          <option value="all">Notes &amp; snippets</option>
          <option value="note">Notes</option>
          <option value="snippet">Snippets</option>
        </select>
        <select aria-label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)}>
          <option value="any">Any folder</option>
          <option value="none">No folder</option>
          {ws.folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select aria-label="Date" value={range} onChange={(e) => setRange(e.target.value)}>
          {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <label className="row"><input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} /> Favorites</label>
      </div>
      <p className="hint">{hits.length} result{hits.length === 1 ? '' : 's'} &middot; searches saved notes and snippets only, never your clipboard history.</p>
      <ul className="results">
        {hits.slice(0, 100).map(({ item }) => (
          <li key={item.id} className="result">
            <button className="result-main" onClick={() => onOpen(item)}>
              <span className={'tag ' + item.kind}>{item.kind}</span>
              <span className="result-body">
                <span className="item-title">{item.favorite ? '★ ' : ''}{item.title || `Untitled ${item.kind}`}</span>
                <span className="item-sub">{excerpt(item.body, q)}</span>
              </span>
              <span className="hint">{folderName(item.folderId)} &middot; {ago(item.updatedAt)}</span>
            </button>
            {item.kind === 'snippet' && placeholders(item.body).length === 0 && (
              <button
                onClick={async () => { await window.cat.copyText(item.body); setCopied(item.id); window.setTimeout(() => setCopied(null), 1200) }}
              >
                {copied === item.id ? 'Copied ✓' : 'Copy'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
