import { useEffect, useState } from 'react'
import { DEFAULT_HOTKEYS, HOTKEY_LABELS, acceleratorFromEvent, type HotkeyId } from '@shared/hotkeys'

const pretty = (a: string) => (a ? a.replace(/Control/g, 'Ctrl').split('+').join(' + ') : 'Off')

/** Click a shortcut, press the new keys. Esc cancels, Backspace turns it off. */
export function ShortcutsCard() {
  const [keys, setKeys] = useState<Record<HotkeyId, string> | null>(null)
  const [failed, setFailed] = useState<HotkeyId[]>([])
  const [editing, setEditing] = useState<HotkeyId | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { window.cat.hotkeysGet().then((r) => { setKeys(r.hotkeys); setFailed(r.failed) }) }, [])

  const save = async (id: HotkeyId, accel: string) => {
    const r = await window.cat.hotkeysSet(id, accel)
    setKeys(r.hotkeys)
    setFailed(r.failed)
    setMsg(r.error ?? null)
  }

  const onKey = (e: React.KeyboardEvent, id: HotkeyId) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') return setEditing(null)
    if (e.key === 'Backspace' || e.key === 'Delete') { setEditing(null); return save(id, '') }
    const a = acceleratorFromEvent(e)
    if (a) { setEditing(null); save(id, a) }
  }

  if (!keys) return null
  return (
    <div className="card">
      <h2>Keyboard shortcuts</h2>
      {(Object.keys(HOTKEY_LABELS) as HotkeyId[]).map((id) => (
        <div key={id} className="field">
          <span>{HOTKEY_LABELS[id]}</span>
          <span className="row">
            {editing === id ? (
              <button className="on" autoFocus onKeyDown={(e) => onKey(e, id)} onBlur={() => setEditing(null)}>Press the new keys… (Esc cancels)</button>
            ) : (
              <button onClick={() => { setMsg(null); setEditing(id) }} aria-label={`Change shortcut for ${HOTKEY_LABELS[id]}`}>{pretty(keys[id])}</button>
            )}
            {failed.includes(id) && <span className="hint warn">in use elsewhere</span>}
            {keys[id] !== DEFAULT_HOTKEYS[id] && editing !== id && <button className="link" onClick={() => save(id, DEFAULT_HOTKEYS[id])}>reset</button>}
          </span>
        </div>
      ))}
      {msg && <p className="hint warn" role="alert">{msg}</p>}
      <p className="hint">Shortcuts work from any program. They need at least one of Ctrl, Alt or Shift. Backspace turns one off.</p>
    </div>
  )
}
