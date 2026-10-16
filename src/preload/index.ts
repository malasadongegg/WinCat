import { contextBridge, ipcRenderer } from 'electron'
import type { CompanionState, Interaction } from '../shared/companion'
import type { Outcome } from '../shared/overdo'
import type { UiSettings } from '../shared/ui'
import type { Workspace } from '../shared/workspace'
import type { VaultStatus } from '../shared/vault'
import type { ClipState } from '../shared/clipboard'
import type { CatApi } from '../shared/types'

const api: CatApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setLowPower: (on) => ipcRenderer.invoke('settings:lowPower', on),
  setPanel: (s) => ipcRenderer.invoke('panel:set', s),
  panelToggle: () => ipcRenderer.invoke('panel:toggle'),
  petPos: (x, y, f) => ipcRenderer.send('pet:pos', x, y, f),
  petHome: () => ipcRenderer.invoke('pet:home'),
  onReact: (cb) => {
    const h = (_: unknown, k: Interaction, o: Outcome) => cb(k, o)
    ipcRenderer.on('react', h)
    return () => ipcRenderer.removeListener('react', h)
  },
  onCompanion: (cb) => {
    const h = (_: unknown, c: CompanionState) => cb(c)
    ipcRenderer.on('companion', h)
    return () => ipcRenderer.removeListener('companion', h)
  },
  getMetrics: () => ipcRenderer.invoke('metrics:get'),
  pickerShow: () => ipcRenderer.send('picker:show'),
  pickerHide: () => ipcRenderer.send('picker:hide'),
  backupExport: (pw) => ipcRenderer.invoke('backup:export', pw),
  backupPick: () => ipcRenderer.invoke('backup:pick'),
  backupUnlock: (pw) => ipcRenderer.invoke('backup:unlock', pw),
  backupApply: (mode, choices) => ipcRenderer.invoke('backup:apply', mode, choices),
  backupCancel: () => ipcRenderer.send('backup:cancel'),
  snapshotsList: () => ipcRenderer.invoke('snapshots:list'),
  snapshotsCreate: () => ipcRenderer.invoke('snapshots:create'),
  snapshotsRestore: (name) => ipcRenderer.invoke('snapshots:restore', name),
  snapshotsSetCap: (mb) => ipcRenderer.invoke('snapshots:setCap', mb),
  loginGet: () => ipcRenderer.invoke('login:get'),
  loginSet: (on) => ipcRenderer.invoke('login:set', on),
  hotkeysGet: () => ipcRenderer.invoke('hotkeys:get'),
  hotkeysSet: (id, a) => ipcRenderer.invoke('hotkeys:set', id, a),
  clipConfigGet: () => ipcRenderer.invoke('clipcfg:get'),
  clipConfigSet: (p) => ipcRenderer.invoke('clipcfg:set', p),
  vaultStatus: () => ipcRenderer.invoke('vault:status'),
  vaultCreate: (pw) => ipcRenderer.invoke('vault:create', pw),
  vaultUnlock: (pw) => ipcRenderer.invoke('vault:unlock', pw),
  vaultUnlockRecovery: (k) => ipcRenderer.invoke('vault:unlockRecovery', k),
  vaultUnlockOs: () => ipcRenderer.invoke('vault:unlockOs'),
  vaultLock: () => ipcRenderer.invoke('vault:lock'),
  vaultGet: () => ipcRenderer.invoke('vault:get'),
  vaultSaveItem: (i) => ipcRenderer.invoke('vault:saveItem', i),
  vaultDeleteItem: (id) => ipcRenderer.invoke('vault:deleteItem', id),
  vaultSaveFolder: (f) => ipcRenderer.invoke('vault:saveFolder', f),
  vaultDeleteFolder: (id) => ipcRenderer.invoke('vault:deleteFolder', id),
  vaultChangePassword: (pw) => ipcRenderer.invoke('vault:changePassword', pw),
  vaultSetOs: (on) => ipcRenderer.invoke('vault:setOs', on),
  vaultSetOptions: (o) => ipcRenderer.invoke('vault:setOptions', o),
  vaultDestroy: (c) => ipcRenderer.invoke('vault:destroy', c),
  vaultCopy: (t) => ipcRenderer.invoke('vault:copy', t),
  onVault: (cb) => {
    const h = (_: unknown, s: VaultStatus) => cb(s)
    ipcRenderer.on('vault', h)
    return () => ipcRenderer.removeListener('vault', h)
  },
  onVaultData: (cb) => {
    const h = (_: unknown, w: Workspace | null) => cb(w)
    ipcRenderer.on('vaultData', h)
    return () => ipcRenderer.removeListener('vaultData', h)
  },
  statBump: (n) => ipcRenderer.send('stat:bump', n),
  collect: (id) => ipcRenderer.send('collect', id),
  windowsOnScreen: () => ipcRenderer.invoke('windows:get'),
  onPlatforms: (cb) => {
    const h = (_: unknown, p: Array<{ id: number; left: number; right: number; top: number }>) => cb(p)
    ipcRenderer.on('platforms', h)
    return () => ipcRenderer.removeListener('platforms', h)
  },
  decorateSet: (on) => ipcRenderer.send('decorate:set', on),
  onDecorate: (cb) => {
    const h = (_: unknown, on: boolean) => cb(on)
    ipcRenderer.on('decorate', h)
    return () => ipcRenderer.removeListener('decorate', h)
  },
  onAchievement: (cb) => {
    const h = (_: unknown, t: string[]) => cb(t)
    ipcRenderer.on('achievement', h)
    return () => ipcRenderer.removeListener('achievement', h)
  },
  companionGet: () => ipcRenderer.invoke('companion:get'),
  companionInteract: (k) => ipcRenderer.invoke('companion:interact', k),
  companionConfig: (c) => ipcRenderer.invoke('companion:config', c),
  uiCapture: (over) => { ipcRenderer.sendSync('ui:capture', over) }, // synchronous: the window is click-through-free before the click lands
  wsGet: () => ipcRenderer.invoke('ws:get'),
  wsSaveItem: (i) => ipcRenderer.invoke('ws:saveItem', i),
  wsDeleteItem: (id) => ipcRenderer.invoke('ws:deleteItem', id),
  wsSaveFolder: (f) => ipcRenderer.invoke('ws:saveFolder', f),
  wsDeleteFolder: (id) => ipcRenderer.invoke('ws:deleteFolder', id),
  onWorkspace: (cb) => {
    const h = (_: unknown, w: Workspace) => cb(w)
    ipcRenderer.on('ws', h)
    return () => ipcRenderer.removeListener('ws', h)
  },
  copyText: (t) => ipcRenderer.invoke('clip:copyText', t),
  uiGet: () => ipcRenderer.invoke('ui:get'),
  uiSet: (p) => ipcRenderer.invoke('ui:set', p),
  onUi: (cb) => {
    const h = (_: unknown, u: UiSettings) => cb(u)
    ipcRenderer.on('ui', h)
    return () => ipcRenderer.removeListener('ui', h)
  },
  clipState: () => ipcRenderer.invoke('clip:state'),
  clipCopy: (id) => ipcRenderer.invoke('clip:copy', id),
  clipPause: (p) => ipcRenderer.invoke('clip:pause', p),
  clipClear: () => ipcRenderer.invoke('clip:clear'),
  clipPin: (id) => ipcRenderer.invoke('clip:pin', id),
  clipRemove: (id) => ipcRenderer.invoke('clip:remove', id),
  clipResolve: (id, keep) => ipcRenderer.invoke('clip:resolve', id, keep),
  clipImage: (id) => ipcRenderer.invoke('clip:image', id),
  onClip: (cb) => {
    const h = (_: unknown, s: ClipState) => cb(s)
    ipcRenderer.on('clip', h)
    return () => ipcRenderer.removeListener('clip', h)
  },
  focusSet: (on) => ipcRenderer.invoke('focus:set', on),
  onFocus: (cb) => {
    const h = (_: unknown, on: boolean) => cb(on)
    ipcRenderer.on('focus', h)
    return () => ipcRenderer.removeListener('focus', h)
  },
  onLowPower: (cb) => {
    const h = (_: unknown, on: boolean) => cb(on)
    ipcRenderer.on('lowPower', h)
    return () => ipcRenderer.removeListener('lowPower', h)
  },
}
contextBridge.exposeInMainWorld('cat', api)
