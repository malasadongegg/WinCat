import { useEffect, useState } from 'react'
import type { ClipCategory, ClipItem, ClipState } from '@shared/clipboard'

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
