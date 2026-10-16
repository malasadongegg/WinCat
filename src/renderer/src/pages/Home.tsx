import { useState } from 'react'
import type { ClipState } from '@shared/clipboard'
import type { Interaction } from '@shared/companion'
import { placeholders } from '@shared/template'
import { WIDGET_IDS, moveWidget, visibleWidgets, type UiSettings, type WidgetId } from '@shared/ui'
import type { Item, Workspace } from '@shared/workspace'
import type { Metrics } from '@shared/types'
import { ago } from '../ui/hooks'

interface Props {
  ws: Workspace
  clip: ClipState | null
  ui: UiSettings
  onUi: (p: Partial<UiSettings>) => void
  metrics: Metrics | null
  lowPower: boolean
  onLowPower: (on: boolean) => void
  onInteract: (k: Interaction) => void
  onOpen: (item: Item) => void
  goto: (page: 'clipboard' | 'notes' | 'snippets') => void
  create: (kind: 'note' | 'snippet') => void
}

const TITLES: Record<WidgetId, string> = {
  actions: 'Quick actions',
  clipboard: 'Recent clipboard',
  snippets: 'Snippets',
  notes: 'Recent notes',
  performance: 'Performance'
}

export function Home(p: Props) {
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const prefs = p.ui.widgets
  const shown = editing ? [...prefs.filter((w) => w.pinned), ...prefs.filter((w) => !w.pinned)] : visibleWidgets(prefs)

  const setPref = (id: WidgetId, change: { visible?: boolean; pinned?: boolean }) =>
    p.onUi({ widgets: prefs.map((w) => (w.id === id ? { ...w, ...change } : w)) })

  const copySnippet = async (it: Item) => {
    if (placeholders(it.body).length) return p.onOpen(it) // needs values first
    await window.cat.copyText(it.body)
    setCopied(it.id)
    window.setTimeout(() => setCopied(null), 1200)
  }

  const notes = p.ws.items.filter((i) => i.kind === 'note').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)
  const snippets = p.ws.items
    .filter((i) => i.kind === 'snippet')
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt)
    .slice(0, 5)

  const body = (id: WidgetId) => {
    switch (id) {
      case 'actions':
        return (
          <div className="row wrap">
            <button className="primary" onClick={() => p.create('note')}>+ Note</button>
            <button className="primary" onClick={() => p.create('snippet')}>+ Snippet</button>
            <button onClick={() => window.cat.clipPause(!(p.clip?.paused ?? true))}>
              {p.clip?.paused === false ? 'Pause clipboard' : 'Capture clipboard'}
            </button>
            <button onClick={() => window.cat.pickerShow()} title="Ctrl+Alt+V from anywhere">Quick picker</button>
            <button onClick={() => p.onInteract('pet')}>&#9995; Pet</button>
            <button onClick={() => p.onInteract('treat')}>&#128031; Treat</button>
          </div>
        )
      case 'clipboard':
        return (
          <>
            {p.clip?.paused && <p className="hint">Capture is off. <button className="link" onClick={() => window.cat.clipPause(false)}>Turn on</button></p>}
            <ul className="mini-list">
              {(p.clip?.items ?? []).slice(0, 5).map((c) => (
                <li key={c.id}>
                  <button className="mini-item" onClick={() => window.cat.clipCopy(c.id)} title="Copy back to clipboard">
                    <span className={'tag ' + c.category}>{c.category}</span>
                    <span className="clip-text">{c.kind === 'image' ? 'Image' : c.text}</span>
                  </button>
                </li>
              ))}
            </ul>
            {(p.clip?.items.length ?? 0) === 0 && !p.clip?.paused && <p className="hint">Nothing copied yet.</p>}
            <button className="link" onClick={() => p.goto('clipboard')}>Open clipboard &rarr;</button>
          </>
        )
      case 'snippets':
        return (
          <>
            <ul className="mini-list">
              {snippets.map((s) => (
                <li key={s.id}>
                  <button className="mini-item" onClick={() => copySnippet(s)} title="Click to copy">
                    <span className="clip-text">{s.favorite ? '★ ' : ''}{s.title || s.body.slice(0, 40) || 'Untitled'}</span>
                    <span className="hint">{copied === s.id ? 'Copied ✓' : placeholders(s.body).length ? 'fill in' : 'copy'}</span>
                  </button>
                </li>
              ))}
            </ul>
            {snippets.length === 0 && <p className="hint">No snippets yet.</p>}
            <button className="link" onClick={() => p.goto('snippets')}>All snippets &rarr;</button>
          </>
        )
      case 'notes':
        return (
          <>
            <ul className="mini-list">
              {notes.map((n) => (
                <li key={n.id}>
                  <button className="mini-item" onClick={() => p.onOpen(n)}>
                    <span className="clip-text">{n.title || n.body.slice(0, 40) || 'Untitled note'}</span>
                    <span className="hint">{ago(n.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {notes.length === 0 && <p className="hint">No notes yet.</p>}
            <button className="link" onClick={() => p.goto('notes')}>All notes &rarr;</button>
          </>
        )
      case 'performance':
        return (
          <>
            <label className="row">
              <input type="checkbox" checked={p.lowPower} onChange={(e) => p.onLowPower(e.target.checked)} /> Low-power mode
            </label>
            <dl>
              <dt>App CPU</dt><dd>{p.metrics ? `${p.metrics.cpuPercent.toFixed(1)} %` : '…'}</dd>
              <dt>App memory</dt><dd>{p.metrics ? `${Math.round(p.metrics.memoryMB)} MB` : '…'}</dd>
            </dl>
          </>
        )
    }
  }

  return (
    <div>
      <div className="row page-head">
        <h1>Home</h1>
        <button className="grow-left" onClick={() => setEditing(!editing)} aria-pressed={editing}>{editing ? 'Done' : 'Customize'}</button>
      </div>
      <div className="widgets">
        {shown.map((w) => (
          <section key={w.id} className={'card widget' + (w.visible ? '' : ' off')} aria-label={TITLES[w.id]}>
            <div className="row widget-head">
              <h2>{TITLES[w.id]}</h2>
              {editing && (
                <span className="row tools">
                  <button onClick={() => p.onUi({ widgets: moveWidget(prefs, w.id, -1) })} aria-label={`Move ${TITLES[w.id]} up`} title="Move earlier">&uarr;</button>
                  <button onClick={() => p.onUi({ widgets: moveWidget(prefs, w.id, 1) })} aria-label={`Move ${TITLES[w.id]} down`} title="Move later">&darr;</button>
                  <button aria-pressed={w.pinned} className={w.pinned ? 'on' : ''} onClick={() => setPref(w.id, { pinned: !w.pinned })} title="Pin to top">&#128204;</button>
                  <button onClick={() => setPref(w.id, { visible: !w.visible })}>{w.visible ? 'Hide' : 'Show'}</button>
                </span>
              )}
            </div>
            {w.visible && body(w.id)}
          </section>
        ))}
        {!editing && shown.length === 0 && (
          <p className="hint">All widgets are hidden. Use Customize to bring them back ({WIDGET_IDS.length} available).</p>
        )}
      </div>
    </div>
  )
}
