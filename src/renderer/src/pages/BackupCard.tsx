import { useCallback, useEffect, useState } from 'react'
import type { BackupPick, Resolution, SnapshotList } from '@shared/backup'

const mb = (n: number) => (n / 1048576).toFixed(n < 10485760 ? 2 : 1)
const when = (t: number) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Export / import (optionally password-encrypted) and automatic local snapshots.
 * Temporary clipboard history is never part of a backup.
 */
export function BackupCard() {
  // ----- export -----
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  const doExport = async () => {
    setExportMsg(null)
    if (pw && pw !== pw2) return setExportMsg('The two passwords do not match.')
    const r = await window.cat.backupExport(pw)
    if (r.canceled) return
    setExportMsg(r.ok ? `Saved${r.encrypted ? ' (encrypted)' : ''}: ${r.path}` : `Could not save: ${r.error}`)
    if (r.ok) { setPw(''); setPw2('') }
  }

  // ----- import -----
  const [pick, setPick] = useState<BackupPick | null>(null)
  const [unlock, setUnlock] = useState('')
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [choices, setChoices] = useState<Record<string, Resolution>>({})
  const [sure, setSure] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const choose = async () => {
    setImportMsg(null)
    setChoices({})
    setSure(false)
    const r = await window.cat.backupPick()
    if (r.canceled) return
    setPick(r)
  }
  const doUnlock = async () => {
    const r = await window.cat.backupUnlock(unlock)
    setPick(r)
    if (r.summary) setUnlock('')
  }
  const cancel = () => {
    window.cat.backupCancel()
    setPick(null)
    setUnlock('')
  }
  const apply = async () => {
    const r = await window.cat.backupApply(mode, choices)
    setImportMsg(r.ok ? 'Restored. A safety copy of your previous data was saved first (see snapshots below).' : `Could not restore: ${r.error}`)
    setPick(null)
    refresh()
  }

  // ----- snapshots -----
  const [snaps, setSnaps] = useState<SnapshotList | null>(null)
  const [cap, setCap] = useState(1024)
  const [snapMsg, setSnapMsg] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const refresh = useCallback(() => {
    window.cat.snapshotsList().then((s) => { setSnaps(s); setCap(s.capMB) })
  }, [])
  useEffect(refresh, [refresh])

  const conflicts = pick?.conflicts ?? []
  const preview = pick?.summary

  return (
    <div className="card">
      <h2>Backup &amp; restore</h2>
      <p className="hint">
        Backups include your notes, snippets, folders, the cat&rsquo;s progress, look and room, and appearance settings. They never
        include clipboard history or anything flagged as a possible secret.
      </p>

      <h3>Export</h3>
      <div className="row wrap">
        <input type="password" placeholder="Password (optional)" aria-label="Backup password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        {pw && <input type="password" placeholder="Repeat password" aria-label="Repeat backup password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />}
        <button className="primary" onClick={doExport}>Export backup…</button>
      </div>
      {pw && <p className="hint warn">If you forget this password, the backup cannot be opened. There is no recovery.</p>}
      {exportMsg && <p className="hint" role="status">{exportMsg}</p>}

      <h3>Restore from a backup</h3>
      {!pick && <button onClick={choose}>Choose a backup file…</button>}
      {pick?.error && <p className="hint warn" role="alert">{pick.error}</p>}
      {pick?.needsPassword && (
        <div className="row wrap">
          <input type="password" placeholder="Backup password" aria-label="Password to open the backup" value={unlock} onChange={(e) => setUnlock(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doUnlock() }} autoFocus />
          <button className="primary" onClick={doUnlock}>Unlock</button>
          <button onClick={cancel}>Cancel</button>
        </div>
      )}
      {preview && (
        <div className="restore">
          <p>
            Backup from <b>{preview.createdAt ? when(preview.createdAt) : 'an unknown date'}</b>: {preview.notes} notes, {preview.snippets} snippets, {preview.folders} folders, cat level {preview.level}.
          </p>
          <label className="row"><input type="radio" name="rmode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> <span><b>Merge</b> &mdash; add what is missing and keep what you have. Differences are shown below for you to decide.</span></label>
          <label className="row"><input type="radio" name="rmode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> <span><b>Replace</b> &mdash; make everything exactly like the backup.</span></label>
          {mode === 'merge' && conflicts.length > 0 && (
            <ul className="conflicts" aria-label="Items that differ">
              {conflicts.map((c) => (
                <li key={c.id}>
                  <b>{c.title}</b>
                  <span className="hint">Yours ({when(c.mine)}): {c.mineText || '(empty)'}</span>
                  <span className="hint">Backup ({when(c.theirs)}): {c.theirText || '(empty)'}</span>
                  <select aria-label={`What to do with ${c.title}`} value={choices[c.id] ?? 'mine'} onChange={(e) => setChoices({ ...choices, [c.id]: e.target.value as Resolution })}>
                    <option value="mine">Keep mine</option>
                    <option value="backup">Use the backup&rsquo;s version</option>
                    <option value="both">Keep both</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
          {mode === 'merge' && conflicts.length === 0 && <p className="hint">Nothing differs, so only new items will be added.</p>}
          {mode === 'replace' && (
            <label className="row"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> I understand this replaces my current notes, snippets and cat progress. A safety copy is saved first.</label>
          )}
          <div className="row">
            <button className="primary" disabled={mode === 'replace' && !sure} onClick={apply}>{mode === 'merge' ? 'Merge backup' : 'Replace my data'}</button>
            <button onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}
      {importMsg && <p className="hint" role="status">{importMsg}</p>}

      <h3>Automatic snapshots</h3>
      <p className="hint">A snapshot is saved about once a day and before any restore, on this computer only. Older ones are removed to stay within the limit.</p>
      {snaps && (
        <>
          <progress value={Math.min(snaps.usedBytes, snaps.capMB * 1048576)} max={snaps.capMB * 1048576} aria-label="Snapshot storage used" />
          <p className="hint">{mb(snaps.usedBytes)} MB used of {snaps.capMB} MB</p>
          <div className="row wrap">
            <label className="row">Limit (MB) <input type="number" min={50} max={10240} step={50} value={cap} onChange={(e) => setCap(Number(e.target.value))} style={{ width: 90 }} /></label>
            <button onClick={async () => setSnaps(await window.cat.snapshotsSetCap(cap))}>Save limit</button>
            <button onClick={async () => { setSnaps(await window.cat.snapshotsCreate()); setSnapMsg('Snapshot saved.') }}>Create snapshot now</button>
          </div>
          {snapMsg && <p className="hint" role="status">{snapMsg}</p>}
          <ul className="snaps">
            {snaps.items.slice(0, 8).map((s) => (
              <li key={s.name} className="row">
                <span className="clip-text">{when(s.createdAt)} <span className="hint">&middot; {s.reason.replace(/-/g, ' ')} &middot; {mb(s.bytes)} MB</span></span>
                {confirmRestore === s.name ? (
                  <>
                    <span className="hint">Replace current data?</span>
                    <button className="danger" onClick={async () => { const r = await window.cat.snapshotsRestore(s.name); setConfirmRestore(null); setSnapMsg(r.ok ? 'Restored from that snapshot (your previous data was snapshotted first).' : `Could not restore: ${r.error}`); refresh() }}>Restore</button>
                    <button onClick={() => setConfirmRestore(null)}>No</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmRestore(s.name)}>Restore&hellip;</button>
                )}
              </li>
            ))}
            {snaps.items.length === 0 && <li className="hint">No snapshots yet.</li>}
          </ul>
        </>
      )}
    </div>
  )
}
