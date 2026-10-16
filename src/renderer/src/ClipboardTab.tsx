import { useEffect, useState } from 'react'
import type { ClipCategory, ClipItem, ClipState } from '@shared/clipboard'
import { DETECTION_CATEGORIES, LIMITS, type ClipConfig } from '@shared/clipconfig'

const FILTERS: Array<'all' | ClipCategory> = ['all', 'text', 'code', 'link', 'image']

function ImageThumb({ id }: { id: number }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    window.cat.clipImage(id).then((s) => live && setSrc(s))
    return () => { live = false }
  }, [id])
  return src ? <img src={src} alt="Copied image" className="thumb" /> : <span className="hint">Image</span>
}

function Row({ item }: { item: ClipItem }) {
  const [saved, setSaved] = useState(false)
  const copy = () => window.cat.clipCopy(item.id)
  const saveAsSnippet = async () => {
    const text = item.text ?? ''
    await window.cat.wsSaveItem({ kind: 'snippet', title: text.split('\n')[0].slice(0, 40), body: text })
    setSaved(true)
  }
  return (
    <li className="clip">
      <button className="clip-main" onClick={copy} title="Copy this item back to the clipboard (does not paste)">
        <span className={'tag ' + item.category}>{item.category}</span>
        {item.kind === 'image' ? (
          item.overLimit ? (
            <span className="hint">Image over the retention limit &mdash; not kept ({Math.round(item.bytes / 1024)} KB)</span>
          ) : (
            <ImageThumb id={item.id} />
          )
        ) : (
          <span className="clip-text">{item.text}</span>
        )}
        {item.count > 1 && <span className="count">&times;{item.count}</span>}
      </button>
      {item.kind === 'text' && (
        <button className="mini" onClick={saveAsSnippet} disabled={saved} title="Save as a permanent snippet" aria-label="Save as snippet">
          {saved ? '\u2713' : '\u{1F4BE}'}
        </button>
      )}
      <button className="mini" aria-pressed={item.pinned} onClick={() => window.cat.clipPin(item.id)} title="Pin">
        {item.pinned ? '★' : '☆'}
      </button>
      <button className="mini" onClick={() => window.cat.clipRemove(item.id)} aria-label="Remove item" title="Remove">
        &times;
      </button>
    </li>
  )
}


/** Sensitive-content categories, your own patterns and image limits. Detection is imperfect and says so. */
function ClipPrivacy() {
  const [cfg, setCfg] = useState<ClipConfig | null>(null)
  const [pattern, setPattern] = useState('')
  const [per, setPer] = useState(5)
  const [total, setTotal] = useState(50)
  useEffect(() => { window.cat.clipConfigGet().then((c) => { setCfg(c); setPer(c.perImageMB); setTotal(c.totalImagesMB) }) }, [])
  if (!cfg) return null
  const save = async (patch: Partial<ClipConfig>) => setCfg(await window.cat.clipConfigSet(patch))
  const addPattern = () => {
    const p = pattern.trim()
    if (p.length >= 3 && !cfg.patterns.includes(p)) save({ patterns: [...cfg.patterns, p] })
    setPattern('')
  }
  return (
    <details className="clip-privacy">
      <summary>Privacy settings</summary>
      <h3>Warn me when something copied looks like&hellip;</h3>
      <div className="chips-col">
        {DETECTION_CATEGORIES.map((name) => (
          <label key={name} className="row">
            <input type="checkbox" checked={!cfg.disabled.includes(name)} onChange={(e) => save({ disabled: e.target.checked ? cfg.disabled.filter((d) => d !== name) : [...cfg.disabled, name] })} />
            {name}
          </label>
        ))}
      </div>
      <h3>Your own patterns</h3>
      <p className="hint">Anything containing one of these is held for your decision. Plain text; use * for &ldquo;anything&rdquo; (e.g. <code>card number*</code>). Case does not matter.</p>
      <div className="row wrap">
        <input value={pattern} placeholder="e.g. project orchid" aria-label="New pattern" maxLength={LIMITS.patternLength} onChange={(e) => setPattern(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPattern() }} />
        <button onClick={addPattern} disabled={pattern.trim().length < 3}>Add</button>
      </div>
      <ul className="mini-list">
        {cfg.patterns.map((p) => (
          <li key={p} className="row"><span className="clip-text">{p}</span><button onClick={() => save({ patterns: cfg.patterns.filter((x) => x !== p) })} aria-label={`Remove pattern ${p}`}>Remove</button></li>
        ))}
      </ul>
      <p className="hint">Detection is a helpful guess, not a guarantee: it can miss secrets and flag harmless text.</p>
      <h3>Temporary images</h3>
      <div className="row wrap">
        <label className="row">Each image up to <input type="number" min={LIMITS.perImageMB[0]} max={LIMITS.perImageMB[1]} value={per} onChange={(e) => setPer(Number(e.target.value))} style={{ width: 70 }} /> MB</label>
        <label className="row">All images up to <input type="number" min={LIMITS.totalImagesMB[0]} max={LIMITS.totalImagesMB[1]} value={total} onChange={(e) => setTotal(Number(e.target.value))} style={{ width: 70 }} /> MB</label>
        <button onClick={() => save({ perImageMB: per, totalImagesMB: total })}>Save</button>
      </div>
    </details>
  )
}

export function ClipboardTab() {
  const [st, setSt] = useState<ClipState | null>(null)
  const [filter, setFilter] = useState<'all' | ClipCategory>('all')

  useEffect(() => {
    window.cat.clipState().then(setSt)
    return window.cat.onClip(setSt)
  }, [])

  if (!st) return null
  const items = st.items.filter((i) => filter === 'all' || i.category === filter)
  return (
    <div className="clipboard">
      <div className="row page-head"><h1>Clipboard</h1></div>
      <div className="row bar">
        <span className={'status ' + (st.paused ? 'off' : 'on')} role="status">
          {st.paused ? 'Capture is OFF' : 'Capturing'}
        </span>
        <button onClick={() => window.cat.clipPause(!st.paused)}>{st.paused ? 'Turn capture on' : 'Pause capture'}</button>
        <button onClick={() => window.cat.clipClear()} disabled={st.items.length === 0}>Clear</button>
        <span className="hint grow">{st.items.length}/500 &middot; images {(st.imageBytes / 1048576).toFixed(1)} MB</span>
      </div>

      {st.pending.map((p) => (
        <div key={p.id} className="alert" role="alertdialog" aria-label="Possible secret copied">
          <p>
            Something you copied may be sensitive (<b>{p.reason}</b>). It has not been saved. Keep it in your temporary
            history? Detection is imperfect.
          </p>
          <button onClick={() => window.cat.clipResolve(p.id, true)}>Keep</button>
          <button onClick={() => window.cat.clipResolve(p.id, false)}>Discard</button>
        </div>
      ))}

      <p className="hint">Temporary: kept only for this session, never searched or backed up. Save an item as a snippet to keep it.</p>
      <ClipPrivacy />
      <div className="row chips" role="group" aria-label="Filter">
        {FILTERS.map((f) => (
          <button key={f} aria-pressed={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="hint">
          {st.paused
            ? 'Turn capture on, then copy something. History is kept only for this session and is cleared when you quit.'
            : 'Nothing here yet. Copy something!'}
        </p>
      ) : (
        <ul className="cliplist">{items.map((i) => <Row key={i.id} item={i} />)}</ul>
      )}
    </div>
  )
}
