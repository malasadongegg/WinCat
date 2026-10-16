import type { ClipState } from './clipboard'
import type { Cosmetics } from './cosmetics'
import type { RoomItem, RoomOffer, RoomSize, RoomStyle } from './catlife'
import type { Outcome } from './overdo'
import type { UiSettings } from './ui'
import type { Folder, Item, ItemInput, Workspace } from './workspace'
import { DEFAULT_UI } from './ui'
import { DEFAULT_COMPANION, type CompanionState, type Interaction, type Personality } from './companion'

export interface Settings {
  lowPower: boolean
  catHidden: boolean
  /** preferred cat window position, keyed by display id */
  placement: Record<string, { x: number; y: number }>
  companion: CompanionState
  ui: UiSettings
}

export const DEFAULT_SETTINGS: Settings = { lowPower: false, catHidden: false, placement: {}, companion: DEFAULT_COMPANION, ui: DEFAULT_UI }

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
}
