import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompanionState, Interaction } from '@shared/companion'
import type { ConfigPatch, Metrics } from '@shared/types'
import type { UiSettings } from '@shared/ui'
import type { Item, Workspace } from '@shared/workspace'
import { CatTab } from './CatTab'
import { ClipboardTab } from './ClipboardTab'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { SearchResults } from './pages/SearchResults'
import { SettingsPage } from './pages/SettingsPage'
import { PixelCat } from './cat/PixelCat'
import { useClip } from './ui/hooks'

interface Props {
  ws: Workspace
  recovery: string | null
  ui: UiSettings
  onUi: (p: Partial<UiSettings>) => void
  lowPower: boolean
  metrics: Metrics | null
  companion: CompanionState
  onInteract: (k: Interaction) => void
  onConfig: (c: ConfigPatch) => void
  onLowPower: (on: boolean) => void
  onClose: () => void
}

const PAGES = [
  { id: 'home', label: 'Home', icon: '\u{1F3E0}' },
  { id: 'clipboard', label: 'Clipboard', icon: '\u{1F4CB}' },
  { id: 'notes', label: 'Notes', icon: '\u{1F4DD}' },
  { id: 'snippets', label: 'Snippets', icon: '✂️' },
  { id: 'cat', label: 'Cat', icon: '\u{1F43E}' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
] as const
type Page = (typeof PAGES)[number]['id']

export function Dashboard(p: Props) {
  const [page, setPage] = useState<Page>('home')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const clip = useClip()
  const searchRef = useRef<HTMLInputElement>(null)

  // Ctrl+K focuses search; Esc clears a search first, otherwise the panel closes (handled by the window)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const open = useCallback((item: Item) => {
    setQ('')
    setOpenId(item.id)
    setPage(item.kind === 'note' ? 'notes' : 'snippets')
  }, [])

  const create = useCallback(async (kind: 'note' | 'snippet') => {
    const it = await window.cat.wsSaveItem({ kind, title: '', body: '' })
    if (it) open(it)
  }, [open])

  const searching = q.trim().length > 0
  const clearOpen = useCallback(() => setOpenId(null), [])

  return (
    <div className="app" data-hit>
      <aside className="side" aria-label="Sections">
        <div className="brand">&#128008; Cat&rsquo;s Desk</div>
        <nav>
          {PAGES.map((x) => (
            <button
              key={x.id}
              className={'nav' + (page === x.id && !searching ? ' on' : '')}
              aria-current={page === x.id && !searching ? 'page' : undefined}
              onClick={() => { setQ(''); setPage(x.id) }}
            >
              <span className="ico" aria-hidden>{x.icon}</span>
              {x.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="mini-cat" aria-hidden>
            <PixelCat anim="sit" effect="none" personality={p.companion.personality} cosmetics={p.companion.cosmetics} lowPower={p.lowPower || p.ui.reduceMotion} />
          </div>
          <span className="hint">Level {Math.floor(Math.sqrt(p.companion.bond / 5)) + 1} &middot; {p.companion.bond} bond</span>
        </div>
      </aside>

      <main className="main">
        <header className="top">
          <input
            ref={searchRef}
            className="search"
            type="search"
            placeholder="Search notes & snippets   (Ctrl+K)"
            aria-label="Search notes and snippets"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' && q) { e.stopPropagation(); setQ('') } }}
          />
          <button className="x" onClick={p.onClose} aria-label="Close panel" title="Close (Esc)">&times;</button>
        </header>

        {p.recovery && <div className="notice" role="status">{p.recovery}</div>}

        <div className="page" role="region" aria-label={searching ? 'Search results' : PAGES.find((x) => x.id === page)?.label}>
          {searching ? (
            <SearchResults ws={p.ws} q={q} onOpen={open} />
          ) : page === 'home' ? (
            <Home
              ws={p.ws}
              clip={clip}
              ui={p.ui}
              onUi={p.onUi}
              metrics={p.metrics}
              lowPower={p.lowPower}
              onLowPower={p.onLowPower}
              onInteract={p.onInteract}
              onOpen={open}
              goto={setPage}
              create={create}
            />
          ) : page === 'clipboard' ? (
            <ClipboardTab />
          ) : page === 'notes' ? (
            <Library kind="note" ws={p.ws} openId={openId} onOpened={clearOpen} />
          ) : page === 'snippets' ? (
            <Library kind="snippet" ws={p.ws} openId={openId} onOpened={clearOpen} />
          ) : page === 'cat' ? (
            <CatTab companion={p.companion} onInteract={p.onInteract} onConfig={p.onConfig} />
          ) : (
            <SettingsPage ui={p.ui} onUi={p.onUi} lowPower={p.lowPower} onLowPower={p.onLowPower} />
          )}
        </div>
      </main>
    </div>
  )
}
