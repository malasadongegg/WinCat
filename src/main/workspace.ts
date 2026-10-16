import { app } from 'electron'
import { randomUUID } from 'crypto'
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  EMPTY_WORKSPACE,
  deleteFolder,
  deleteItem,
  normalize,
  upsertFolder,
  upsertItem,
  type Folder,
  type Item,
  type ItemInput,
  type Workspace
} from '../shared/workspace'

const file = () => join(app.getPath('userData'), 'workspace.json')

/**
 * Notes + snippets on disk. Safety rules:
 *  - writes go to a temp file, then replace the real one (never a half-written file);
 *  - the previous version is kept as workspace.json.bak;
 *  - an unreadable file is never deleted or overwritten: it is renamed aside and the backup is tried.
 */
export class WorkspaceService {
  private ws: Workspace = EMPTY_WORKSPACE
  private timer: NodeJS.Timeout | null = null
  /** set when the main file was damaged at startup; the UI shows a one-line notice */
  recovery: string | null = null

  constructor(private onChange: (w: Workspace) => void) {}

  load(): void {
    const f = file()
    if (!existsSync(f) && !existsSync(f + '.bak')) return
    const tryRead = (p: string): Workspace | null => {
      try {
        return normalize(JSON.parse(readFileSync(p, 'utf8')))
      } catch {
        return null
      }
    }
    const main = existsSync(f) ? tryRead(f) : null
    if (main) {
      this.ws = main
      return
    }
    if (existsSync(f)) {
      try { renameSync(f, `${f}.corrupt-${Date.now()}`) } catch { /* keep going; backup below */ }
    }
    const bak = tryRead(f + '.bak')
    if (bak) {
      this.ws = bak
      this.recovery = 'Your notes file was damaged, so the last backup was restored. The damaged file was kept next to it.'
    } else {
      this.recovery = 'Your notes file could not be read. A copy was kept in the app data folder.'
    }
  }

  get(): Workspace {
    return this.ws
  }

  saveItem(input: ItemInput): Item {
    const r = upsertItem(this.ws, input, Date.now(), randomUUID)
    this.commit(r.ws)
    return r.item
  }

  removeItem(id: string): void {
    this.commit(deleteItem(this.ws, id))
  }

  saveFolder(input: { id?: string; name: string }): Folder {
    const r = upsertFolder(this.ws, input, randomUUID)
    this.commit(r.ws)
    return r.folder
  }

  removeFolder(id: string): void {
    this.commit(deleteFolder(this.ws, id))
  }

  private commit(next: Workspace): void {
    this.ws = next
    this.onChange(next)
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 300)
  }

  /** write now (also called on quit) */
  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    const f = file()
    try {
      if (existsSync(f)) copyFileSync(f, f + '.bak')
      const tmp = f + '.tmp'
      writeFileSync(tmp, JSON.stringify(this.ws))
      renameSync(tmp, f)
    } catch (e) {
      console.error('workspace save failed', (e as Error).message) // never log contents
    }
  }
}
