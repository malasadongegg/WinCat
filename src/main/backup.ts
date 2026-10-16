import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { parseBackup, type BackupData } from '../shared/backup'

/**
 * Local safety snapshots of the persistent workspace and cat progress. They are plain JSON files in
 * the app data folder (the same sensitivity as workspace.json), never include clipboard history,
 * and are trimmed oldest-first to stay under a user-configurable size cap (default 1 GB).
 */
const dir = () => join(app.getPath('userData'), 'snapshots')
const NAME = /^snapshot-\d{8}-\d{6}-[a-z-]{1,24}\.json$/

export interface SnapshotInfo {
  name: string
  createdAt: number
  bytes: number
  reason: string
}

const two = (n: number) => String(n).padStart(2, '0')

export function createSnapshot(data: BackupData, reason: string): string {
  mkdirSync(dir(), { recursive: true })
  const tag = reason.replace(/[^a-z-]/g, '').slice(0, 24) || 'manual'
  const stampOf = (t: number) => {
    const d = new Date(t)
    return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`
  }
  // two snapshots in the same second must not overwrite each other: nudge the timestamp forward
  let t = data.createdAt || Date.now()
  let name = `snapshot-${stampOf(t)}-${tag}.json`
  while (existsSync(join(dir(), name))) {
    t += 1000
    name = `snapshot-${stampOf(t)}-${tag}.json`
  }
  const file = join(dir(), name)
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(data))
  renameSync(tmp, file)
  return name
}

export function listSnapshots(): SnapshotInfo[] {
  if (!existsSync(dir())) return []
  const out: SnapshotInfo[] = []
  for (const name of readdirSync(dir())) {
    if (!NAME.test(name)) continue
    try {
      const st = statSync(join(dir(), name))
      const m = /^snapshot-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-([a-z-]+)/.exec(name)
      const createdAt = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : st.mtimeMs
      out.push({ name, createdAt, bytes: st.size, reason: m?.[7] ?? 'manual' })
    } catch {
      /* skip unreadable entries */
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}

export const snapshotBytes = (): number => listSnapshots().reduce((a, s) => a + s.bytes, 0)

/** Delete the oldest snapshots until under the cap. The newest few are always kept. */
export function trimSnapshots(capBytes: number, keepNewest = 3, maxCount = 200): number {
  const all = listSnapshots() // newest first
  let removed = 0
  let total = all.reduce((a, s) => a + s.bytes, 0)
  for (let i = all.length - 1; i >= keepNewest; i--) {
    if (total <= capBytes && all.length - removed <= maxCount) break
    try {
      unlinkSync(join(dir(), all[i].name))
      total -= all[i].bytes
      removed++
    } catch {
      /* ignore */
    }
  }
  return removed
}

/** Read a snapshot by name (names are validated, so no path tricks). */
export function readSnapshot(name: string): BackupData | null {
  if (!NAME.test(name)) return null
  try {
    return parseBackup(JSON.parse(readFileSync(join(dir(), name), 'utf8')))
  } catch {
    return null
  }
}
