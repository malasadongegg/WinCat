/** What the renderer is told about the private vault. Never includes any secret. */
export interface VaultStatus {
  exists: boolean
  unlocked: boolean
  /** the file could not be read and was set aside */
  damaged: boolean
  /** Windows can protect an "unlock without typing" key for this account */
  osAvailable: boolean
  osEnabled: boolean
  /** folder names: always shown when unlocked; when locked only if the user allowed it */
  names: string[]
  autoLockMin: number
  showNames: boolean
}

export const VAULT_LIMITS = { autoLockMin: [1, 120] as const }
