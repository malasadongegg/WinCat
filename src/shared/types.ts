import type { ClipState } from './clipboard'
import type { Cosmetics } from './cosmetics'
import type { RoomItem, RoomOffer, RoomSize, RoomStyle } from './catlife'
import type { BackupPick, Resolution, SnapshotList } from './backup'
import { DEFAULT_CLIP_CONFIG, type ClipConfig } from './clipconfig'
import { DEFAULT_HOTKEYS, type HotkeyId } from './hotkeys'
import type { Outcome } from './overdo'
import type { VaultStatus } from './vault'
import type { UiSettings } from './ui'
import type { Folder, Item, ItemInput, Workspace } from './workspace'
import { DEFAULT_UI } from './ui'
import { DEFAULT_COMPANION, type CompanionState, type Interaction, type Personality } from './companion'

export interface Settings {
  lowPower: boolean
  /** quiet mode: the cat naps in place, no bubbles, sounds or finds */
  focusMode: boolean
  catHidden: boolean
  /** size cap for automatic local snapshots */
  snapshotCapMB: number
  hotkeys: Record<HotkeyId, string>
  clipboard: ClipConfig
  vaultAutoLockMin: number
  /** the cat has already introduced itself */
  welcomed: boolean
  vaultShowNames: boolean
  /** preferred cat window position, keyed by display id */
  placement: Record<string, { x: number; y: number }>
  companion: CompanionState
  ui: UiSettings
}

export const DEFAULT_SETTINGS: Settings = { lowPower: false, focusMode: false, catHidden: false, snapshotCapMB: 1024, hotkeys: DEFAULT_HOTKEYS, clipboard: DEFAULT_CLIP_CONFIG, vaultAutoLockMin: 5, vaultShowNames: false, welcomed: false, placement: {}, companion: DEFAULT_COMPANION, ui: DEFAULT_UI }

export interface ConfigPatch {
  personality?: Personality
  bubbles?: boolean
  sound?: boolean
  volume?: number
  cosmetics?: Partial<Cosmetics>
  perch?: boolean
  room?: RoomItem[]
  roomMode?: boolean
  roomOffer?: RoomOffer
  roomStyle?: Partial<RoomStyle>
  roomSize?: RoomSize
  roomPos?: { x: number; y: number } | null
}

export type PanelState = 'collapsed' | 'expanded'

export interface Metrics {
  /** summed CPU % across all app processes (Electron reports per-core-relative %) */
  cpuPercent: number
  /** summed working set across all app processes, MB */
  memoryMB: number
}

/** Whitelisted API exposed to the renderer by the preload script. */
export interface CatApi {
  getSettings(): Promise<Settings>
  setLowPower(on: boolean): Promise<void>
  setPanel(state: PanelState): Promise<void>
  panelToggle(): Promise<void>
  petPos(x: number, y: number, onFloor: boolean): void
  petHome(): Promise<number | null>
  onReact(cb: (k: Interaction, outcome: Outcome) => void): () => void
  onCompanion(cb: (c: CompanionState) => void): () => void
  getMetrics(): Promise<Metrics>
  companionGet(): Promise<CompanionState>
  backupExport(password: string): Promise<{ ok: boolean; canceled?: boolean; path?: string; encrypted?: boolean; error?: string }>
  backupPick(): Promise<BackupPick>
  backupUnlock(password: string): Promise<BackupPick>
  backupApply(mode: 'merge' | 'replace', choices: Record<string, Resolution>): Promise<{ ok: boolean; error?: string }>
  backupCancel(): void
  snapshotsList(): Promise<SnapshotList>
  snapshotsCreate(): Promise<SnapshotList>
  snapshotsRestore(name: string): Promise<{ ok: boolean; error?: string }>
  snapshotsSetCap(mb: number): Promise<SnapshotList>
  loginGet(): Promise<{ available: boolean; enabled: boolean }>
  loginSet(on: boolean): Promise<{ available: boolean; enabled: boolean }>
  hotkeysGet(): Promise<{ hotkeys: Record<HotkeyId, string>; failed: HotkeyId[] }>
  hotkeysSet(id: HotkeyId, accelerator: string): Promise<{ hotkeys: Record<HotkeyId, string>; failed: HotkeyId[]; error?: string }>
  clipConfigGet(): Promise<ClipConfig>
  clipConfigSet(patch: Partial<ClipConfig>): Promise<ClipConfig>
  vaultStatus(): Promise<VaultStatus>
  vaultCreate(password: string): Promise<{ ok: boolean; recoveryKey?: string; error?: string }>
  vaultUnlock(password: string): Promise<{ ok: boolean; error?: string }>
  vaultUnlockRecovery(key: string): Promise<{ ok: boolean; error?: string }>
  vaultUnlockOs(): Promise<{ ok: boolean; error?: string }>
  vaultLock(): Promise<void>
  vaultGet(): Promise<Workspace | null>
  vaultSaveItem(input: ItemInput): Promise<Item | null>
  vaultDeleteItem(id: string): Promise<void>
  vaultSaveFolder(input: { id?: string; name: string }): Promise<Folder | null>
  vaultDeleteFolder(id: string): Promise<void>
  vaultChangePassword(password: string): Promise<{ ok: boolean; error?: string }>
  vaultSetOs(on: boolean): Promise<{ ok: boolean; error?: string }>
  vaultSetOptions(o: { autoLockMin?: number; showNames?: boolean }): Promise<void>
  vaultDestroy(confirm: string): Promise<{ ok: boolean; error?: string }>
  vaultCopy(text: string): Promise<void>
  onVault(cb: (s: VaultStatus) => void): () => void
  onVaultData(cb: (w: Workspace | null) => void): () => void
  statBump(name: string): void
  pickerHide(): void
  pickerShow(): void
  collect(id: string): void
  windowsOnScreen(): Promise<Array<{ id: number; left: number; right: number; top: number }>>
  onPlatforms(cb: (p: Array<{ id: number; left: number; right: number; top: number }>) => void): () => void
  decorateSet(on: boolean): void
  onDecorate(cb: (on: boolean) => void): () => void
  onAchievement(cb: (titles: string[]) => void): () => void
  companionInteract(kind: Interaction): Promise<CompanionState>
  companionConfig(c: ConfigPatch): Promise<CompanionState>
  uiCapture(over: boolean): void
  wsGet(): Promise<{ ws: Workspace; recovery: string | null }>
  wsSaveItem(input: ItemInput): Promise<Item | null>
  wsDeleteItem(id: string): Promise<void>
  wsSaveFolder(input: { id?: string; name: string }): Promise<Folder | null>
  wsDeleteFolder(id: string): Promise<void>
  onWorkspace(cb: (w: Workspace) => void): () => void
  copyText(text: string): Promise<void>
  uiGet(): Promise<UiSettings>
  uiSet(patch: Partial<UiSettings>): Promise<UiSettings>
  onUi(cb: (u: UiSettings) => void): () => void
  clipState(): Promise<ClipState>
  clipCopy(id: number): Promise<void>
  clipPause(paused: boolean): Promise<void>
  clipClear(): Promise<void>
  clipPin(id: number): Promise<void>
  clipRemove(id: number): Promise<void>
  clipResolve(pendingId: number, keep: boolean): Promise<void>
  clipImage(id: number): Promise<string | null>
  onClip(cb: (s: ClipState) => void): () => void
  onLowPower(cb: (on: boolean) => void): () => void
  welcomeDone(): void
  focusSet(on: boolean): Promise<void>
  onFocus(cb: (on: boolean) => void): () => void
}
