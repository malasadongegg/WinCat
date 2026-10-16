import { useEffect, useState } from 'react'
import type { VaultStatus } from '@shared/vault'
import { EMPTY_WORKSPACE, type Workspace } from '@shared/workspace'
import { Library, type LibApi } from './Library'

const VAULT_API: LibApi = {
  saveItem: (i) => window.cat.vaultSaveItem(i),
  deleteItem: (id) => window.cat.vaultDeleteItem(id),
  saveFolder: (f) => window.cat.vaultSaveFolder(f),
  deleteFolder: (id) => window.cat.vaultDeleteFolder(id),
  copyText: (t) => window.cat.vaultCopy(t) // auto-wiped from the clipboard after 30 s
}

/**
 * Private notes and snippets: encrypted on disk, locked until you unlock them, searchable only
 * while unlocked here (never in global search, the picker, backups or clipboard history).
 */
export function PrivatePage() {
  const [st, setSt] = useState<VaultStatus | null>(null)
  const [ws, setWs] = useState<Workspace>(EMPTY_WORKSPACE)
  useEffect(() => {
    window.cat.vaultStatus().then(setSt)
    window.cat.vaultGet().then((w) => w && setWs(w))
    const offS = window.cat.onVault(setSt)
    const offD = window.cat.onVaultData((w) => setWs(w ?? EMPTY_WORKSPACE))
    return () => { offS(); offD() }
  }, [])

  if (!st) return null
  return (
    <div>
      <div className="row page-head">
        <h1>Private</h1>
        {st.unlocked && <button className="grow-left" onClick={() => window.cat.vaultLock()}>{'\u{1F512}'} Lock now</button>}
      </div>
      {st.damaged && !st.exists && <div className="notice" role="alert">The private vault file could not be read, so it was set aside in the app data folder (not deleted). You can create a new vault.</div>}
      {!st.exists ? <Setup /> : st.unlocked ? <Unlocked st={st} ws={ws} /> : <Locked st={st} />}
    </div>
  )
}

// ---------------------------------------------------------------- setup
function Setup() {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [key, setKey] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  if (key) {
    return (
      <div className="card">
        <h2>Your recovery key</h2>
        <p className="recovery" aria-label="Recovery key">{key}</p>
        <p className="hint warn">
          Write this down or print it, and keep it somewhere safe that is NOT on this computer. If you forget your password,
          this key is the only way back in. It is shown only once and is not stored anywhere. If you lose both, your private
          notes can never be recovered.
        </p>
        <div className="row wrap">
          <button onClick={async () => { await window.cat.vaultCopy(key); setCopied(true) }}>{copied ? 'Copied (clears in 30 s)' : 'Copy key'}</button>
        </div>
        <label className="row"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved my recovery key</label>
        <button className="primary" disabled={!saved} onClick={() => setKey(null)}>Continue to my private notes</button>
      </div>
    )
  }

  const create = async () => {
    setErr(null)
    if (pw !== pw2) return setErr('The two passwords do not match.')
    const r = await window.cat.vaultCreate(pw)
    if (!r.ok) return setErr(r.error ?? 'Could not create the vault.')
    setKey(r.recoveryKey ?? null)
    setPw('')
    setPw2('')
  }
  return (
    <div className="card">
      <h2>Keep some notes truly private</h2>
      <p>
        Private notes and snippets are encrypted on this computer with your own password. They stay locked until you unlock them,
        lock again by themselves after a few idle minutes (and when Windows locks), and are never part of search, the quick picker,
        backups or clipboard history.
      </p>
      <p className="hint">This protects your notes if someone gets at your files. It cannot protect against malware already running on your PC while the vault is open.</p>
      <div className="row wrap">
        <input type="password" placeholder="Choose a password (8+ characters)" aria-label="Vault password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        <input type="password" placeholder="Repeat password" aria-label="Repeat vault password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create() }} autoComplete="new-password" />
        <button className="primary" onClick={create}>Create private vault</button>
      </div>
      {err && <p className="hint warn" role="alert">{err}</p>}
      <p className="hint warn">You will get a one-time recovery key. Without your password AND the recovery key, nobody can open the vault, not even me.</p>
    </div>
  )
}

// ---------------------------------------------------------------- locked
function Locked({ st }: { st: VaultStatus }) {
  const [pw, setPw] = useState('')
  const [rk, setRk] = useState('')
  const [useKey, setUseKey] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true)
    setErr(null)
    const r = useKey ? await window.cat.vaultUnlockRecovery(rk) : await window.cat.vaultUnlock(pw)
    setBusy(false)
    if (!r.ok) setErr(r.error ?? 'Could not unlock.')
    else { setPw(''); setRk('') }
  }
  return (
    <div className="card">
      <h2>{'\u{1F512}'} Locked</h2>
      {st.names.length > 0 && <p className="hint">Folders: {st.names.join(', ')}</p>}
      <div className="row wrap">
        {useKey ? (
          <input autoFocus placeholder="Recovery key (XXXX-XXXX-…)" aria-label="Recovery key" value={rk} onChange={(e) => setRk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go() }} style={{ minWidth: 280 }} />
        ) : (
          <input autoFocus type="password" placeholder="Vault password" aria-label="Vault password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go() }} />
        )}
        <button className="primary" disabled={busy} onClick={go}>{busy ? 'Opening…' : 'Unlock'}</button>
        {st.osEnabled && !useKey && <button onClick={async () => { const r = await window.cat.vaultUnlockOs(); if (!r.ok) setErr(r.error ?? 'Windows could not unlock it.') }}>Unlock with Windows</button>}
      </div>
      <button className="link" onClick={() => { setUseKey(!useKey); setErr(null) }}>{useKey ? 'Use my password instead' : 'Forgot my password — use my recovery key'}</button>
      {err && <p className="hint warn" role="alert">{err}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- unlocked
function Unlocked({ st, ws }: { st: VaultStatus; ws: Workspace }) {
  const [tab, setTab] = useState<'note' | 'snippet'>('note')
  const [show, setShow] = useState(false)
  return (
    <div>
      <p className="hint">
        Unlocked. It locks itself after {st.autoLockMin} idle minute{st.autoLockMin === 1 ? '' : 's'}. Copying from here clears your clipboard after 30 seconds.
      </p>
      <div className="row">
        <div className="seg" role="tablist" aria-label="Private content">
          <button role="tab" aria-selected={tab === 'note'} className={tab === 'note' ? 'on' : ''} onClick={() => setTab('note')}>Notes</button>
          <button role="tab" aria-selected={tab === 'snippet'} className={tab === 'snippet' ? 'on' : ''} onClick={() => setTab('snippet')}>Snippets</button>
        </div>
        <button className="grow-left" aria-pressed={show} onClick={() => setShow(!show)}>Vault settings</button>
      </div>
      {show && <VaultSettings st={st} />}
      <div className="vault-lib">
        <Library key={tab} kind={tab} ws={ws} openId={null} onOpened={() => {}} api={VAULT_API} />
      </div>
    </div>
  )
}

function VaultSettings({ st }: { st: VaultStatus }) {
  const [minutes, setMinutes] = useState(st.autoLockMin)
  const [npw, setNpw] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [del, setDel] = useState('')
  return (
    <div className="card">
      <h2>Vault settings</h2>
      <label className="field">
        <span>Lock after being idle for (minutes)</span>
        <span className="row">
          <input type="number" min={1} max={120} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} style={{ width: 70 }} />
          <button onClick={() => window.cat.vaultSetOptions({ autoLockMin: minutes })}>Save</button>
        </span>
      </label>
      <label className="row"><input type="checkbox" checked={st.showNames} onChange={(e) => window.cat.vaultSetOptions({ showNames: e.target.checked })} /> Show folder names while locked</label>
      <label className="row">
        <input type="checkbox" checked={st.osEnabled} disabled={!st.osAvailable} onChange={async (e) => { const r = await window.cat.vaultSetOs(e.target.checked); setMsg(r.ok ? null : r.error ?? 'Could not change that.') }} />
        Allow unlocking with my Windows account (no password typing on this PC) {!st.osAvailable && <span className="hint">(not available here)</span>}
      </label>
      <p className="hint">Anyone signed in to this Windows account could then open the vault. Your password and recovery key keep working either way.</p>
      <h3>Change password</h3>
      <div className="row wrap">
        <input type="password" placeholder="New password (8+ characters)" aria-label="New vault password" value={npw} onChange={(e) => setNpw(e.target.value)} autoComplete="new-password" />
        <button onClick={async () => { const r = await window.cat.vaultChangePassword(npw); setMsg(r.ok ? 'Password changed. Your recovery key still works.' : r.error ?? 'Could not change it.'); if (r.ok) setNpw('') }}>Change</button>
      </div>
      {msg && <p className="hint" role="status">{msg}</p>}
      <h3>Delete the vault</h3>
      <p className="hint warn">This permanently deletes all private notes. It cannot be undone.</p>
      <div className="row wrap">
        <input placeholder="Type DELETE to confirm" aria-label="Type DELETE to confirm" value={del} onChange={(e) => setDel(e.target.value)} />
        <button className="danger" disabled={del !== 'DELETE'} onClick={async () => { const r = await window.cat.vaultDestroy(del); if (!r.ok) setMsg(r.error ?? 'Could not delete.') }}>Delete vault</button>
      </div>
    </div>
  )
}
