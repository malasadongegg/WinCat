import { app, powerMonitor, safeStorage } from 'electron'
import { randomUUID } from 'crypto'
import { copyFileSync, existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { VaultStatus } from '../shared/vault'
import { deleteFolder, deleteItem, EMPTY_WORKSPACE, normalize, upsertFolder, upsertItem, type Folder, type Item, type ItemInput, type Workspace } from '../shared/workspace'
import {
  createVault,
  openWithMaster,
  openWithPassword,
  openWithRecovery,
  resealBody,
  rewrapPassword,
  validateVaultFile,
  type VaultFile
} from './vaultCrypto'

const file = () => join(app.getPath('userData'), 'vault.json')

/**
 * The private vault: notes and snippets that stay encrypted on disk and are only readable after the
 * user unlocks them. While locked nothing is held in memory except the encrypted file; the master
 * key is wiped on lock. It locks itself after inactivity and when Windows locks or sleeps.
 *
 * Limits (also written in docs/SECURITY.md): it cannot protect against malware running as you while
 * the vault is unlocked, or against someone watching your screen; decrypted text exists in memory
 * while unlocked (JavaScript strings cannot be wiped).
 */
export class VaultService {
  private vault: VaultFile | null = null
  private master: Buffer | null = null
  private ws: Workspace = EMPTY_WORKSPACE
  private timer: NodeJS.Timeout | null = null
  private damaged = false
  autoLockMin = 5
  showNames = false

  constructor(private onStatus: (s: VaultStatus) => void, private onData: (w: Workspace | null) => void) {}

  load(): void {
    const f = file()
    if (!existsSync(f)) return
    try {
      this.vault = validateVaultFile(JSON.parse(readFileSync(f, 'utf8')))
    } catch {
      this.vault = null
    }
    if (!this.vault) {
      // never delete what we cannot read: set it aside so it can be recovered by hand
      this.damaged = true
      try { renameSync(f, `${f}.unreadable-${Date.now()}`) } catch { /* ignore */ }
    }
    // lock when the Windows session locks or the PC sleeps
    powerMonitor.on('lock-screen', () => this.lock())
    powerMonitor.on('suspend', () => this.lock())
  }

  status(): VaultStatus {
    const unlocked = !!this.master
    return {
      exists: !!this.vault,
      unlocked,
      damaged: this.damaged,
      osAvailable: safeStorage.isEncryptionAvailable(),
      osEnabled: !!this.vault?.wrapOs,
      names: unlocked ? this.ws.folders.map((f) => f.name) : this.showNames ? this.vault?.names ?? [] : [],
      autoLockMin: this.autoLockMin,
      showNames: this.showNames
    }
  }

  data(): Workspace | null {
    return this.master ? this.ws : null
  }

  private emit(): void {
    this.onStatus(this.status())
    this.onData(this.data())
  }

  /** every vault action counts as activity and restarts the inactivity timer */
  touch(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = this.master ? setTimeout(() => this.lock(), this.autoLockMin * 60_000) : null
  }

  lock(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.master) this.master.fill(0)
    this.master = null
    this.ws = EMPTY_WORKSPACE
    this.emit()
  }

  private open(master: Buffer, body: string): void {
    this.master = master
    try {
      this.ws = normalize((JSON.parse(body) as { workspace?: unknown }).workspace)
    } catch {
      this.ws = EMPTY_WORKSPACE
    }
    this.touch()
    this.emit()
  }

  private bodyText(): string {
    return JSON.stringify({ version: 1, workspace: this.ws })
  }

  private persist(): void {
    if (!this.vault || !this.master) return
    const names = this.showNames ? this.ws.folders.map((f) => f.name) : undefined
    this.vault = resealBody(this.vault, this.master, this.bodyText(), names)
    this.write()
  }

  private write(): void {
    if (!this.vault) return
    const f = file()
    if (existsSync(f)) copyFileSync(f, f + '.bak')
    const tmp = f + '.tmp'
    writeFileSync(tmp, JSON.stringify(this.vault))
    renameSync(tmp, f)
  }

  // ---------- lifecycle ----------
  create(password: string): { recoveryKey: string } {
    if (this.vault) throw new Error('A private vault already exists')
    const made = createVault(password, JSON.stringify({ version: 1, workspace: EMPTY_WORKSPACE }))
    this.vault = made.file
    this.damaged = false
    this.write()
    this.open(made.master, JSON.stringify({ version: 1, workspace: EMPTY_WORKSPACE }))
    return { recoveryKey: made.recoveryKey }
  }

  unlock(password: string): void {
    if (!this.vault) throw new Error('There is no private vault yet')
    const r = openWithPassword(this.vault, password)
    this.open(r.master, r.body)
  }

  unlockRecovery(key: string): void {
    if (!this.vault) throw new Error('There is no private vault yet')
    const r = openWithRecovery(this.vault, key)
    this.open(r.master, r.body)
  }

  unlockOs(): void {
    if (!this.vault?.wrapOs) throw new Error('Unlocking with Windows is not turned on')
    try {
      const master = Buffer.from(safeStorage.decryptString(Buffer.from(this.vault.wrapOs, 'base64')), 'base64')
      this.open(master, openWithMaster(this.vault, master))
    } catch {
      throw new Error('Windows could not unlock the vault. Use your password.')
    }
  }

  changePassword(newPassword: string): void {
    if (!this.vault || !this.master) throw new Error('Unlock the vault first')
    this.vault = rewrapPassword(this.vault, this.master, newPassword)
    this.write()
    this.touch()
  }

  /** optional convenience: let Windows (this user account, via DPAPI) unlock the vault without typing */
  setOs(on: boolean): void {
    if (!this.vault || !this.master) throw new Error('Unlock the vault first')
    if (on) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows protection is not available here')
      this.vault = { ...this.vault, wrapOs: safeStorage.encryptString(this.master.toString('base64')).toString('base64') }
    } else {
      const { wrapOs: _gone, ...rest } = this.vault
      void _gone
      this.vault = rest as VaultFile
    }
    this.write()
    this.touch()
    this.emit()
  }

  setOptions(o: { autoLockMin?: number; showNames?: boolean }): void {
    if (typeof o.autoLockMin === 'number' && Number.isFinite(o.autoLockMin)) this.autoLockMin = Math.round(Math.min(120, Math.max(1, o.autoLockMin)))
    if (typeof o.showNames === 'boolean') this.showNames = o.showNames
    if (this.master) this.persist() // refreshes the readable names header
    this.touch()
    this.emit()
  }

  /** irreversible: the encrypted file is deleted */
  destroy(): void {
    this.lock()
    for (const p of [file(), file() + '.bak']) {
      try { if (existsSync(p)) unlinkSync(p) } catch { /* ignore */ }
    }
    this.vault = null
    this.damaged = false
    this.emit()
  }

  // ---------- contents (only while unlocked) ----------
  private need(): void {
    if (!this.master) throw new Error('The vault is locked')
    this.touch()
  }

  saveItem(input: ItemInput): Item {
    this.need()
    const r = upsertItem(this.ws, input, Date.now(), randomUUID)
    this.ws = r.ws
    this.persist()
    this.onData(this.ws)
    return r.item
  }

  removeItem(id: string): void {
    this.need()
    this.ws = deleteItem(this.ws, id)
    this.persist()
    this.onData(this.ws)
  }

  saveFolder(input: { id?: string; name: string }): Folder {
    this.need()
    const r = upsertFolder(this.ws, input, randomUUID)
    this.ws = r.ws
    this.persist()
    this.onData(this.ws)
    return r.folder
  }

  removeFolder(id: string): void {
    this.need()
    this.ws = deleteFolder(this.ws, id)
    this.persist()
    this.onData(this.ws)
  }
}
