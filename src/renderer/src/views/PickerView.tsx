import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ClipItem } from '@shared/clipboard'
import { search } from '@shared/search'
import { fill, placeholders } from '@shared/template'
import type { Item } from '@shared/workspace'
import { applyUi, useClip, useUi, useWorkspace } from '../ui/hooks'

type Row = { kind: 'item'; item: Item } | { kind: 'clip'; clip: ClipItem }

/**
 * Quick picker (global hotkey): search snippets, notes and the temporary clipboard history from the
 * keyboard, press Enter to copy, and carry on. It only copies; pasting stays a separate, deliberate step.
 */
export function PickerView() {
  const { ws } = useWorkspace()
  const clip = useClip()
  const [ui] = useUi()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [fillFor, setFillFor] = useState<Item | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => applyUi(ui), [ui])

  const rows = useMemo<Row[]>(() => {
    const items = search(ws.items, { q }).slice(0, q ? 8 : 6)
    const recent = (clip?.items ?? [])
      .filter((c) => c.kind === 'text' && (!q || (c.text ?? '').toLowerCase().includes(q.toLowerCase())))
      .slice(0, q ? 5 : 5)
    return [...items.map((h): Row => ({ kind: 'item', item: h.item })), ...recent.map((c): Row => ({ kind: 'clip', clip: c }))]
  }, [ws.items, clip, q])

  // every time the picker is shown, start fresh
  useEffect(() => {
    const reset = () => {
      setQ('')
      setSel(0)
      setFillFor(null)
      setValues({})
      setDone(false)
      window.setTimeout(() => input.current?.focus(), 30)
    }
    window.addEventListener('focus', reset)
    reset()
    return () => window.removeEventListener('focus', reset)
  }, [])

  useEffect(() => setSel(0), [q])

  const finish = useCallback(async (text: string | null, clipId?: number) => {
    if (clipId !== undefined) await window.cat.clipCopy(clipId)
    else if (text !== null) await window.cat.copyText(text)
    setDone(true)
    window.setTimeout(() => window.cat.pickerHide(), 350)
  }, [])

  const choose = (row: Row) => {
    if (row.kind === 'clip') return finish(null, row.clip.id)
    const it = row.item
    if (it.kind === 'snippet' && placeholders(it.body).length) {
      setFillFor(it)
      return
    }
    return finish(it.body)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (fillFor) setFillFor(null)
      else window.cat.pickerHide()
    } else if (!fillFor && e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(rows.length - 1, s + 1))
    } else if (!fillFor && e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (fillFor) finish(fill(fillFor.body, values))
      else if (rows[sel]) choose(rows[sel])
    }
  }

  const names = fillFor ? placeholders(fillFor.body) : []

  return (
    <div className="picker" onKeyDown={onKey} role="dialog" aria-label="Quick picker">
      {fillFor ? (
        <div className="picker-fill">
          <h2>{fillFor.title || 'Snippet'}</h2>
          {names.map((n, i) => (
            <label key={n} className="row">
              <span className="slot-name">{n}</span>
              <input autoFocus={i === 0} value={values[n] ?? ''} onChange={(e) => setValues({ ...values, [n]: e.target.value })} aria-label={`Value for ${n}`} />
            </label>
          ))}
          <p className="hint">{fill(fillFor.body, values).slice(0, 120)}</p>
          <p className="hint">Enter to copy &middot; Esc to go back</p>
        </div>
      ) : (
        <>
          <input
            ref={input}
            className="picker-search"
            placeholder="Search snippets, notes and recent copies…"
            aria-label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <ul className="picker-list" role="listbox" aria-label="Results">
            {rows.map((r, i) => (
              <li key={r.kind + (r.kind === 'item' ? r.item.id : r.clip.id)}>
                <button role="option" aria-selected={i === sel} className={'prow' + (i === sel ? ' on' : '')} onMouseEnter={() => setSel(i)} onClick={() => choose(r)}>
                  <span className={'tag ' + (r.kind === 'item' ? r.item.kind : 'clip')}>{r.kind === 'item' ? r.item.kind : 'copied'}</span>
                  <span className="clip-text">
                    {r.kind === 'item' ? (r.item.favorite ? '★ ' : '') + (r.item.title || r.item.body.slice(0, 60) || 'Untitled') : (r.clip.text ?? '').replace(/\s+/g, ' ').slice(0, 80)}
                  </span>
                  {r.kind === 'item' && r.item.kind === 'snippet' && placeholders(r.item.body).length > 0 && <span className="hint">fill in</span>}
                </button>
              </li>
            ))}
            {rows.length === 0 && <li className="hint pad">{q ? 'Nothing found.' : 'Nothing saved yet. Add snippets in Cat’s Desk.'}</li>}
          </ul>
          <div className="picker-foot hint">
            {done ? 'Copied ✓' : '↑↓ choose · Enter copy · Esc close · pasting is up to you'}
          </div>
        </>
      )}
    </div>
  )
}
