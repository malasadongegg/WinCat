import { app, BrowserWindow, Menu, Tray, dialog, globalShortcut, ipcMain, nativeImage, screen } from 'electron'
import { randomUUID } from 'crypto'
import { readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { clampToArea } from '../shared/clamp'
import type { Settings } from '../shared/types'
import type { ItemInput } from '../shared/workspace'
import { CATALOG, canEquip, type Slot } from '../shared/cosmetics'
import { PERSONALITIES, applyInteraction, levelInfo } from '../shared/companion'
import { ClipboardService } from './clipboard/service'
import { isFullscreenAppActive } from './fullscreen'
import { loadSettings, saveSettings } from './settings'
import { OverdoTracker, awardsBond } from '../shared/overdo'
import { COLLECTIBLES, ROOM_DIMS, isStat, newlyUnlocked, sanitizeRoom, sanitizeRoomStyle, type StatName } from '../shared/catlife'
import { listWindowTops, type WinTop } from './windows'
import { WorkspaceService } from './workspace'
import { buildBackup, mergeCompanion, mergeWorkspaces, parseBackup, resolveConflicts, summarize, type BackupData, type BackupPick, type Resolution, type SnapshotList } from '../shared/backup'
import { createSnapshot, listSnapshots, readSnapshot, snapshotBytes, trimSnapshots } from './backup'
import { decryptText, encryptText, isEnvelope, type Envelope } from './backupCrypto'
import { TRAY_ICON_PNG_BASE64 } from './trayIcon'
import { VaultService } from './vault'
import { hashOf } from './clipboard/history'
import { sanitizeClipConfig } from '../shared/clipconfig'
import { HOTKEY_LABELS, isValidAccelerator, sanitizeHotkeys, type HotkeyId } from '../shared/hotkeys'
import { sanitizeUi } from '../shared/ui'

const PANEL_SIZE = { width: 900, height: 600 }

/** Two windows: a transparent click-through overlay the cat roams on, and the Cat's Desk panel. */
let petWin: BrowserWindow | null = null
let panelWin: BrowserWindow | null = null
let pickerWin: BrowserWindow | null = null
let tray: Tray | null = null
let settings: Settings
let autoHidden = false
let quitting = false
let prevSeen = 0
let clip: ClipboardService
let work: WorkspaceService
let vault: VaultService
let vaultClearTimer: NodeJS.Timeout | null = null
const overdo = new OverdoTracker()
let lastPlatforms = '[]'
/** hotkeys that another program already owns */
let hotkeyFailed: HotkeyId[] = []
/** a backup file the user picked and is reviewing (kept in memory only until applied or cancelled) */
let pendingBackup: BackupData | null = null
let pendingEnvelope: Envelope | null = null
/** last cat position reported by the overlay, in screen coordinates */
let catPos: { x: number; y: number } | null = null
let lastSaved = { x: -9999 }

const displayKey = (id: number) => String(id)
const primary = () => screen.getPrimaryDisplay()

function loadView(win: BrowserWindow, view: 'pet' | 'panel' | 'picker'): void {
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(`${process.env.ELECTRON_RENDERER_URL}?view=${view}`)
  else win.loadFile(join(__dirname, '../renderer/index.html'), { query: { view } })
}

function baseWindowOptions() {
  return {
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required' as const // the cat may purr without a click (only if sounds are on)
    }
  }
}

function lockDown(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  // if a window's renderer ever crashes, bring it straight back; data lives in the main process and on disk
  let reloads = 0
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('renderer gone:', details.reason)
    if (details.reason !== 'clean-exit' && reloads++ < 5 && !win.isDestroyed()) setTimeout(() => win.webContents.reload(), 500)
  })
}

function createPetWindow(): void {
  const wa = primary().workArea
  petWin = new BrowserWindow({ ...baseWindowOptions(), ...wa, focusable: false })
  petWin.setAlwaysOnTop(true, 'floating')
  // Transparent areas pass clicks through; the overlay re-enables capture only over the cat and its buttons.
  petWin.setIgnoreMouseEvents(true, { forward: true })
  petWin.on('ready-to-show', () => {
    if (!settings.catHidden) petWin?.showInactive() // never steals focus
  })
  lockDown(petWin)
  loadView(petWin, 'pet')
}

function createPanelWindow(): void {
  panelWin = new BrowserWindow({ ...baseWindowOptions(), ...PANEL_SIZE })
  panelWin.setAlwaysOnTop(true, 'floating')
  // Closing the panel only hides it; quitting is explicit.
  panelWin.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      panelWin?.hide()
    }
  })
  lockDown(panelWin)
  loadView(panelWin, 'panel')
}

function broadcast(channel: string, ...args: unknown[]): void {
  for (const w of [petWin, panelWin, pickerWin]) if (w && !w.isDestroyed()) w.webContents.send(channel, ...args)
}

const PICKER_SIZE = { width: 560, height: 420 }

/** the quick picker is created the first time it is needed, then just hidden and shown */
function showPicker(): void {
  if (!pickerWin || pickerWin.isDestroyed()) {
    pickerWin = new BrowserWindow({ ...baseWindowOptions(), ...PICKER_SIZE, alwaysOnTop: true })
    pickerWin.setAlwaysOnTop(true, 'pop-up-menu')
    pickerWin.on('blur', () => pickerWin?.hide()) // transient: clicking elsewhere dismisses it
    pickerWin.on('close', (e) => {
      if (!quitting) { e.preventDefault(); pickerWin?.hide() }
    })
    lockDown(pickerWin)
    loadView(pickerWin, 'picker')
  }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  pickerWin.setBounds({
    x: Math.round(area.x + (area.width - PICKER_SIZE.width) / 2),
    y: Math.round(area.y + area.height * 0.18),
    ...PICKER_SIZE
  })
  pickerWin.show()
  pickerWin.focus()
}

function showPanel(): void {
  if (!panelWin) return
  const area = screen.getDisplayNearestPoint(catPos ?? primary().workArea).workArea
  // sit beside the cat, on whichever side has room, then keep inside the display
  const c = catPos ?? { x: area.x + area.width - 60, y: area.y + area.height - 60 }
  const onRight = c.x > area.x + area.width / 2
  const x = onRight ? c.x - 70 - PANEL_SIZE.width : c.x + 70
  const y = c.y - PANEL_SIZE.height / 2
  panelWin.setBounds(clampToArea({ x, y, ...PANEL_SIZE }, area))
  panelWin.show()
  panelWin.focus() // focus the existing window, never create a duplicate
}

function togglePanel(): void {
  if (!panelWin) return
  if (panelWin.isVisible() && panelWin.isFocused()) panelWin.hide()
  else {
    if (settings.catHidden) showCat()
    showPanel()
  }
}

function showCat(): void {
  autoHidden = false
  settings.catHidden = false
  saveSettings(settings)
  petWin?.showInactive()
  refreshTray()
}

function hideCat(): void {
  settings.catHidden = true
  saveSettings(settings)
  petWin?.hide()
  refreshTray()
}

function setFocus(on: boolean): void {
  settings.focusMode = on
  saveSettings(settings)
  broadcast('focus', on)
  refreshTray()
}

function setLowPower(on: boolean): void {
  settings.lowPower = on
  saveSettings(settings)
  broadcast('lowPower', on)
  refreshTray()
}

function refreshTray(): void {
  if (!tray) return
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Cat's Desk", click: showPanel },
      { label: settings.catHidden ? 'Show cat' : 'Hide cat', click: () => (settings.catHidden ? showCat() : hideCat()) },
      { label: `Quick picker${settings.hotkeys.picker ? ' (' + settings.hotkeys.picker.replace('Control', 'Ctrl') + ')' : ''}`, click: showPicker },
      { label: 'Pause clipboard capture (off until enabled)', type: 'checkbox', checked: clip?.paused ?? false, click: (i) => clip.setPaused(i.checked) },
      { label: 'Sounds', type: 'checkbox', checked: settings.companion.sound, click: (i) => { settings.companion.sound = i.checked; saveSettings(settings); broadcast('companion', settings.companion) } },
      { label: 'Focus mode (quiet cat)', type: 'checkbox', checked: settings.focusMode, click: (i) => setFocus(i.checked) },
      { label: 'Low-power mode', type: 'checkbox', checked: settings.lowPower, click: (i) => setLowPower(i.checked) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL('data:image/png;base64,' + TRAY_ICON_PNG_BASE64)
  tray = new Tray(icon.resize({ width: 16, height: 16, quality: 'best' }))
  tray.setToolTip('Windows Cat Companion')
  tray.on('click', togglePanel)
  refreshTray()
}

/** after any change to stats / bond / collection: unlock achievements, save, tell the windows */
function companionChanged(): void {
  const fresh = newlyUnlocked(settings.companion)
  for (const a of fresh) settings.companion.achievements[a.id] = Date.now()
  saveSettings(settings)
  broadcast('companion', settings.companion)
  if (fresh.length) petWin?.webContents.send('achievement', fresh.map((a) => a.title))
}

function bump(name: StatName, by = 1): void {
  settings.companion.stats[name] = (settings.companion.stats[name] ?? 0) + by
  companionChanged()
}

/** window tops for perching: rectangles only, never titles or app names */
function pollWindows(): void {
  if (!petWin || !petWin.isVisible()) return
  const tops: WinTop[] = settings.companion.perch ? listWindowTops(primary().workArea, process.pid) : []
  const json = JSON.stringify(tops)
  if (json !== lastPlatforms) {
    lastPlatforms = json
    petWin.webContents.send('platforms', tops)
  }
}

/** (re)register every global hotkey from settings; ones another app owns are reported, not fatal */
function applyHotkeys(): void {
  globalShortcut.unregisterAll()
  hotkeyFailed = []
  const actions: Record<HotkeyId, () => void> = { panel: togglePanel, picker: showPicker, pause: () => clip.setPaused(!clip.paused), focus: () => setFocus(!settings.focusMode) }
  for (const id of Object.keys(actions) as HotkeyId[]) {
    const accel = settings.hotkeys[id]
    if (!accel) continue
    let ok = false
    try { ok = globalShortcut.register(accel, actions[id]) } catch { ok = false }
    if (!ok) hotkeyFailed.push(id)
  }
  refreshTray()
}

const currentBackup = () => buildBackup(work.get(), settings.companion, settings.ui)
const capBytes = () => Math.max(50, Math.min(10_240, settings.snapshotCapMB)) * 1024 * 1024

function snapshotList(): SnapshotList {
  return { items: listSnapshots().slice(0, 30), usedBytes: snapshotBytes(), capMB: settings.snapshotCapMB }
}

/** a quiet daily safety copy (and one before any restore) */
function autoSnapshot(): void {
  try {
    const newest = listSnapshots()[0]
    if (!newest || Date.now() - newest.createdAt > 24 * 3_600_000) {
      work.flush()
      createSnapshot(currentBackup(), 'auto')
      trimSnapshots(capBytes())
    }
  } catch (e) {
    console.error('auto snapshot failed', (e as Error).message)
  }
}

function previewOf(data: BackupData): BackupPick {
  const { conflicts } = mergeWorkspaces(work.get(), data.workspace)
  const clip = (t: string) => t.replace(/\s+/g, ' ').slice(0, 90)
  return {
    summary: summarize(data),
    conflicts: conflicts.map((c) => ({ id: c.id, title: c.current.title || c.incoming.title || 'Untitled', mine: c.current.updatedAt, theirs: c.incoming.updatedAt, mineText: clip(c.current.body), theirText: clip(c.incoming.body) }))
  }
}

/** restore a backup. A safety snapshot of the current state is always taken first. */
function applyBackup(data: BackupData, mode: 'merge' | 'replace', choices: Record<string, Resolution>): void {
  work.flush()
  createSnapshot(currentBackup(), 'before-restore')
  trimSnapshots(capBytes())
  if (mode === 'replace') {
    work.replace(data.workspace)
    settings.companion = { ...data.companion, lastSeen: settings.companion.lastSeen }
    settings.ui = data.ui
  } else {
    const { ws, conflicts } = mergeWorkspaces(work.get(), data.workspace)
    work.replace(resolveConflicts(ws, conflicts, choices, randomUUID))
    settings.companion = mergeCompanion(settings.companion, data.companion)
  }
  work.flush()
  broadcast('ui', settings.ui)
  companionChanged()
  refreshTray()
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const sender = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(e.sender)

function registerIpc(): void {
  ipcMain.handle('metrics:get', () => {
    const m = app.getAppMetrics()
    return {
      cpuPercent: m.reduce((a, p) => a + p.cpu.percentCPUUsage, 0),
      memoryMB: m.reduce((a, p) => a + p.memory.workingSetSize, 0) / 1024
    }
  })
  ipcMain.handle('settings:get', () => settings)
  ipcMain.on('welcome:done', () => { settings.welcomed = true; saveSettings(settings) })
  ipcMain.handle('focus:set', (_e, on: unknown) => { if (typeof on === 'boolean') setFocus(on) })
  ipcMain.handle('settings:lowPower', (_e, on: unknown) => {
    if (typeof on === 'boolean') setLowPower(on)
  })

  // panel window
  ipcMain.handle('panel:set', (_e, s: unknown) => {
    if (s === 'expanded') showPanel()
    else if (s === 'collapsed') panelWin?.hide()
  })
  ipcMain.handle('panel:toggle', () => togglePanel())
  ipcMain.on('picker:hide', () => pickerWin?.hide())
  ipcMain.on('picker:show', () => showPicker())

  // overlay: click-through capture + position reports
  ipcMain.on('ui:capture', (e, over: unknown) => {
    if (typeof over === 'boolean' && sender(e) === petWin) petWin?.setIgnoreMouseEvents(!over, { forward: true })
    e.returnValue = true
  })
  ipcMain.on('pet:pos', (_e, x: unknown, y: unknown, onFloor: unknown) => {
    if (!isNum(x) || !isNum(y) || !petWin) return
    const b = petWin.getBounds()
    catPos = { x: b.x + x, y: b.y + y }
    // remember where the cat stands (per display) once it is resting on the floor
    if (onFloor === true && Math.abs(x - lastSaved.x) > 8) {
      lastSaved = { x }
      settings.placement[displayKey(primary().id)] = { x, y: 0 }
      saveSettings(settings)
    }
  })
  ipcMain.handle('pet:home', () => settings.placement[displayKey(primary().id)]?.x ?? null)

  // companion
  ipcMain.on('stat:bump', (_e, name: unknown) => { if (isStat(name)) bump(name) })
  ipcMain.on('collect', (_e, id: unknown) => {
    if (typeof id !== 'string' || !COLLECTIBLES.some((c) => c.id === id)) return
    settings.companion.collection[id] = (settings.companion.collection[id] ?? 0) + 1
    bump('found')
  })
  ipcMain.on('decorate:set', (_e, on: unknown) => { if (typeof on === 'boolean') broadcast('decorate', on) })
  ipcMain.handle('windows:get', () => JSON.parse(lastPlatforms))
  ipcMain.handle('companion:get', () => ({ ...settings.companion, lastSeen: prevSeen }))
  ipcMain.handle('companion:interact', (_e, k: unknown) => {
    if (k === 'pet' || k === 'treat' || k === 'play' || k === 'rest') {
      // spamming one action has a funny, harmless consequence (and earns no bond); never any penalty
      const outcome = overdo.record(k, Date.now())
      if (awardsBond(outcome)) settings.companion = applyInteraction(settings.companion, k)
      if (outcome === 'puke') settings.companion.stats.puke = (settings.companion.stats.puke ?? 0) + 1
      if (outcome === 'annoyed') settings.companion.stats.annoyed = (settings.companion.stats.annoyed ?? 0) + 1
      if (outcome === 'hyper') settings.companion.stats.hyper = (settings.companion.stats.hyper ?? 0) + 1
      petWin?.webContents.send('react', k, outcome) // single path: the overlay animates, wherever the request came from
      companionChanged()
    }
    return settings.companion
  })
  ipcMain.handle('companion:config', (_e, c: unknown) => {
    const o = (c ?? {}) as { personality?: unknown; bubbles?: unknown; sound?: unknown; volume?: unknown; cosmetics?: unknown }
    if (typeof o.personality === 'string' && (PERSONALITIES as readonly string[]).includes(o.personality)) {
      settings.companion.personality = o.personality as (typeof PERSONALITIES)[number]
    }
    if (typeof o.bubbles === 'boolean') settings.companion.bubbles = o.bubbles
    if (typeof o.sound === 'boolean') settings.companion.sound = o.sound
    if (typeof (o as { perch?: unknown }).perch === 'boolean') settings.companion.perch = (o as { perch: boolean }).perch
    const ro = o as { roomMode?: unknown; roomOffer?: unknown; roomStyle?: unknown; roomSize?: unknown; roomPos?: unknown }
    if (typeof ro.roomMode === 'boolean') {
      if (ro.roomMode && !settings.companion.roomMode) settings.companion.stats.roomMoved = (settings.companion.stats.roomMoved ?? 0) + 1
      settings.companion.roomMode = ro.roomMode
      if (ro.roomMode) settings.companion.roomOffer = 'accepted' // saying yes once answers the question for good
    }
    if (ro.roomOffer === 'unasked' || ro.roomOffer === 'accepted' || ro.roomOffer === 'declined') settings.companion.roomOffer = ro.roomOffer
    if (ro.roomStyle && typeof ro.roomStyle === 'object') {
      const before = JSON.stringify(settings.companion.roomStyle)
      settings.companion.roomStyle = sanitizeRoomStyle(ro.roomStyle, levelInfo(settings.companion.bond).level, settings.companion.roomStyle)
      if (JSON.stringify(settings.companion.roomStyle) !== before) settings.companion.stats.roomStyled = (settings.companion.stats.roomStyled ?? 0) + 1
    }
    if (typeof ro.roomSize === 'string' && ro.roomSize in ROOM_DIMS) settings.companion.roomSize = ro.roomSize as keyof typeof ROOM_DIMS
    if (ro.roomPos === null) settings.companion.roomPos = null
    else if (ro.roomPos && typeof ro.roomPos === 'object') {
      const p = ro.roomPos as { x?: unknown; y?: unknown }
      if (isNum(p.x) && isNum(p.y)) settings.companion.roomPos = { x: Math.round(Math.max(0, Math.min(8000, p.x))), y: Math.round(Math.max(0, Math.min(8000, p.y))) }
    }
    if (Array.isArray((o as { room?: unknown }).room)) {
      const before = settings.companion.room.length
      settings.companion.room = sanitizeRoom((o as { room: unknown }).room, levelInfo(settings.companion.bond).level)
      const added = settings.companion.room.length - before
      if (added > 0) settings.companion.stats.furniturePlaced = (settings.companion.stats.furniturePlaced ?? 0) + added
    }
    if (isNum(o.volume)) settings.companion.volume = Math.min(1, Math.max(0, o.volume))
    if (o.cosmetics && typeof o.cosmetics === 'object') {
      const level = levelInfo(settings.companion.bond).level
      for (const slot of Object.keys(CATALOG) as Slot[]) {
        const id = (o.cosmetics as Record<string, unknown>)[slot]
        // only unlocked items can be equipped, whatever the renderer asks for
        if (typeof id === 'string' && canEquip(slot, id, level)) settings.companion.cosmetics[slot] = id
      }
    }
    refreshTray()
    companionChanged()
    return settings.companion
  })

  // workspace (notes + snippets)
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
  ipcMain.handle('ws:get', () => ({ ws: work.get(), recovery: work.recovery }))
  const itemInput = (i: unknown): ItemInput | null => {
    const o = (i ?? {}) as Record<string, unknown>
    if (o.kind !== 'note' && o.kind !== 'snippet') return null
    return {
      id: typeof o.id === 'string' ? o.id : undefined,
      kind: o.kind,
      title: text(o.title, 200),
      body: text(o.body, 200_000),
      format: o.format === 'markdown' ? 'markdown' : o.format === 'text' ? 'text' : undefined,
      folderId: o.folderId === null ? null : typeof o.folderId === 'string' ? o.folderId : undefined,
      favorite: typeof o.favorite === 'boolean' ? o.favorite : undefined
    }
  }
  ipcMain.handle('ws:saveItem', (_e, i: unknown) => {
    const input = itemInput(i)
    if (!input) return null
    const existed = typeof input.id === 'string' && work.get().items.some((x) => x.id === input.id)
    const saved = work.saveItem(input)
    if (!existed) bump(saved.kind === 'note' ? 'noteCreated' : 'snippetCreated')
    return saved
  })
  ipcMain.handle('ws:deleteItem', (_e, id: unknown) => { if (typeof id === 'string') work.removeItem(id) })
  ipcMain.handle('ws:saveFolder', (_e, f: unknown) => {
    const o = (f ?? {}) as Record<string, unknown>
    const name = text(o.name, 60)
    return name === undefined ? null : work.saveFolder({ id: typeof o.id === 'string' ? o.id : undefined, name })
  })
  ipcMain.handle('ws:deleteFolder', (_e, id: unknown) => { if (typeof id === 'string') work.removeFolder(id) })
  // ---- private vault ----
  const run = <T,>(fn: () => T): { ok: boolean; error?: string } & Partial<T extends object ? T : object> => {
    try {
      const r = fn()
      return { ok: true, ...((r && typeof r === 'object' ? r : {}) as object) } as never
    } catch (e) {
      return { ok: false, error: (e as Error).message } as never
    }
  }
  ipcMain.handle('vault:status', () => vault.status())
  ipcMain.handle('vault:create', (_e, pw: unknown) => run(() => vault.create(typeof pw === 'string' ? pw : '')))
  ipcMain.handle('vault:unlock', (_e, pw: unknown) => run(() => vault.unlock(typeof pw === 'string' ? pw : '')))
  ipcMain.handle('vault:unlockRecovery', (_e, k: unknown) => run(() => vault.unlockRecovery(typeof k === 'string' ? k : '')))
  ipcMain.handle('vault:unlockOs', () => run(() => vault.unlockOs()))
  ipcMain.handle('vault:lock', () => vault.lock())
  ipcMain.handle('vault:get', () => { const d = vault.data(); if (d) vault.touch(); return d })
  // a save that races an auto-lock is ignored quietly (the page switches to the lock screen)
  ipcMain.handle('vault:saveItem', (_e, i: unknown) => { const input = itemInput(i); try { return input ? vault.saveItem(input) : null } catch { return null } })
  ipcMain.handle('vault:deleteItem', (_e, id: unknown) => { try { if (typeof id === 'string') vault.removeItem(id) } catch { /* locked */ } })
  ipcMain.handle('vault:saveFolder', (_e, f: unknown) => {
    const o = (f ?? {}) as Record<string, unknown>
    const name = text(o.name, 60)
    try { return name === undefined ? null : vault.saveFolder({ id: typeof o.id === 'string' ? o.id : undefined, name }) } catch { return null }
  })
  ipcMain.handle('vault:deleteFolder', (_e, id: unknown) => { try { if (typeof id === 'string') vault.removeFolder(id) } catch { /* locked */ } })
  ipcMain.handle('vault:changePassword', (_e, pw: unknown) => run(() => vault.changePassword(typeof pw === 'string' ? pw : '')))
  ipcMain.handle('vault:setOs', (_e, on: unknown) => run(() => vault.setOs(on === true)))
  ipcMain.handle('vault:setOptions', (_e, o: unknown) => {
    const v = (o ?? {}) as { autoLockMin?: unknown; showNames?: unknown }
    vault.setOptions({ autoLockMin: typeof v.autoLockMin === 'number' ? v.autoLockMin : undefined, showNames: typeof v.showNames === 'boolean' ? v.showNames : undefined })
    settings.vaultAutoLockMin = vault.autoLockMin
    settings.vaultShowNames = vault.showNames
    saveSettings(settings)
  })
  ipcMain.handle('vault:destroy', (_e, c: unknown) => run(() => { if (c !== 'DELETE') throw new Error('Type DELETE to confirm'); vault.destroy() }))
  // copying private text: it is not captured into clipboard history, and is wiped from the clipboard after 30 s
  ipcMain.handle('vault:copy', async (_e, t: unknown) => {
    if (typeof t !== 'string' || !vault.data()) return
    vault.touch()
    await clip.copyText(t.slice(0, 500_000))
    const h = hashOf(t)
    if (vaultClearTimer) clearTimeout(vaultClearTimer)
    vaultClearTimer = setTimeout(async () => {
      try {
        const items = await (await import('electron')).clipboard.read()
        const cur = items[0] && items[0].types.includes('text/plain') ? await (await items[0].getType('text/plain')).text() : ''
        if (cur && hashOf(cur) === h) await clip.copyText('')
      } catch { /* clipboard busy: leave it */ }
    }, 30_000)
  })
  ipcMain.handle('clip:copyText', (_e, t: unknown) => { if (typeof t === 'string') return clip.copyText(t.slice(0, 500_000)) })

  // backup / restore / snapshots
  ipcMain.handle('backup:export', async (_e, pw: unknown) => {
    try {
      const password = typeof pw === 'string' ? pw : ''
      const plain = JSON.stringify(currentBackup())
      const text = password ? JSON.stringify(encryptText(plain, password)) : plain
      const d = new Date()
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const r = await dialog.showSaveDialog(panelWin ?? undefined!, {
        title: 'Save backup',
        defaultPath: `WinCatBackup-${stamp}${password ? '-encrypted' : ''}.json`,
        filters: [{ name: 'Cat Companion backup', extensions: ['json'] }]
      })
      if (r.canceled || !r.filePath) return { ok: false, canceled: true }
      writeFileSync(r.filePath, text)
      return { ok: true, path: r.filePath, encrypted: !!password }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
  ipcMain.handle('backup:pick', async (): Promise<BackupPick> => {
    pendingBackup = null
    pendingEnvelope = null
    const r = await dialog.showOpenDialog(panelWin ?? undefined!, { title: 'Choose a backup', properties: ['openFile'], filters: [{ name: 'Cat Companion backup', extensions: ['json'] }] })
    if (r.canceled || !r.filePaths[0]) return { canceled: true }
    try {
      if (statSync(r.filePaths[0]).size > 64 * 1024 * 1024) return { error: 'That file is too large to be a backup.' }
      const raw = JSON.parse(readFileSync(r.filePaths[0], 'utf8'))
      if (isEnvelope(raw)) {
        pendingEnvelope = raw
        return { needsPassword: true }
      }
      const data = parseBackup(raw)
      if (!data) return { error: 'This file is not a Cat Companion backup.' }
      pendingBackup = data
      return previewOf(data)
    } catch {
      return { error: 'Could not read that file.' }
    }
  })
  ipcMain.handle('backup:unlock', (_e, pw: unknown): BackupPick => {
    if (!pendingEnvelope || typeof pw !== 'string') return { error: 'Choose a backup file first.' }
    try {
      const data = parseBackup(JSON.parse(decryptText(pendingEnvelope, pw)))
      if (!data) return { error: 'This file is not a Cat Companion backup.' }
      pendingBackup = data
      pendingEnvelope = null
      return previewOf(data)
    } catch (e) {
      return { needsPassword: true, error: (e as Error).message }
    }
  })
  ipcMain.handle('backup:apply', (_e, mode: unknown, choices: unknown) => {
    if (!pendingBackup) return { ok: false, error: 'No backup is selected.' }
    if (mode !== 'merge' && mode !== 'replace') return { ok: false, error: 'Unknown restore mode.' }
    const clean: Record<string, Resolution> = {}
    if (choices && typeof choices === 'object') {
      for (const [k, v] of Object.entries(choices as Record<string, unknown>)) if (v === 'mine' || v === 'backup' || v === 'both') clean[k] = v
    }
    try {
      applyBackup(pendingBackup, mode, clean)
      pendingBackup = null
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
  ipcMain.on('backup:cancel', () => { pendingBackup = null; pendingEnvelope = null })
  // launch at sign-in: off by default, only offered for the installed app (never registers the dev build)
  ipcMain.handle('login:get', () => ({ available: app.isPackaged, enabled: app.isPackaged ? app.getLoginItemSettings().openAtLogin : false }))
  ipcMain.handle('login:set', (_e, on: unknown) => {
    if (typeof on === 'boolean' && app.isPackaged) app.setLoginItemSettings({ openAtLogin: on })
    return { available: app.isPackaged, enabled: app.isPackaged ? app.getLoginItemSettings().openAtLogin : false }
  })
  ipcMain.handle('clipcfg:get', () => settings.clipboard)
  ipcMain.handle('clipcfg:set', (_e, patch: unknown) => {
    settings.clipboard = sanitizeClipConfig({ ...settings.clipboard, ...((patch ?? {}) as object) }, settings.clipboard)
    saveSettings(settings)
    clip.setConfig(settings.clipboard)
    return settings.clipboard
  })
  ipcMain.handle('hotkeys:get', () => ({ hotkeys: settings.hotkeys, failed: hotkeyFailed }))
  ipcMain.handle('hotkeys:set', (_e, id: unknown, accel: unknown) => {
    if (typeof id !== 'string' || !(id in HOTKEY_LABELS) || !isValidAccelerator(accel)) return { hotkeys: settings.hotkeys, failed: hotkeyFailed, error: 'That is not a valid shortcut. Use at least one of Ctrl, Alt, Shift plus a key.' }
    const key = id as HotkeyId
    const clash = (Object.keys(settings.hotkeys) as HotkeyId[]).find((o) => o !== key && accel !== '' && settings.hotkeys[o] === accel)
    if (clash) return { hotkeys: settings.hotkeys, failed: hotkeyFailed, error: `Already used for "${HOTKEY_LABELS[clash]}".` }
    settings.hotkeys = sanitizeHotkeys({ ...settings.hotkeys, [key]: accel }, settings.hotkeys)
    saveSettings(settings)
    applyHotkeys()
    return { hotkeys: settings.hotkeys, failed: hotkeyFailed, error: hotkeyFailed.includes(key) ? 'Another program is already using that shortcut. Try a different one.' : undefined }
  })
  ipcMain.handle('snapshots:list', () => snapshotList())
  ipcMain.handle('snapshots:create', () => {
    work.flush()
    createSnapshot(currentBackup(), 'manual')
    trimSnapshots(capBytes())
    return snapshotList()
  })
  ipcMain.handle('snapshots:restore', (_e, name: unknown) => {
    const data = typeof name === 'string' ? readSnapshot(name) : null
    if (!data) return { ok: false, error: 'That snapshot could not be read.' }
    try {
      applyBackup(data, 'replace', {})
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
  ipcMain.handle('snapshots:setCap', (_e, mb: unknown) => {
    if (isNum(mb)) {
      settings.snapshotCapMB = Math.round(Math.max(50, Math.min(10_240, mb)))
      saveSettings(settings)
      trimSnapshots(capBytes())
    }
    return snapshotList()
  })

  // appearance / accessibility
  ipcMain.handle('ui:get', () => settings.ui)
  ipcMain.handle('ui:set', (_e, patch: unknown) => {
    settings.ui = sanitizeUi({ ...settings.ui, ...((patch ?? {}) as object) }, settings.ui)
    saveSettings(settings)
    broadcast('ui', settings.ui)
    return settings.ui
  })

  // clipboard
  ipcMain.handle('clip:state', () => clip.state())
  ipcMain.handle('clip:copy', (_e, i: unknown) => { if (isId(i)) return clip.copy(i) })
  ipcMain.handle('clip:pause', (_e, p: unknown) => { if (typeof p === 'boolean') clip.setPaused(p) })
  ipcMain.handle('clip:clear', () => clip.clear())
  ipcMain.handle('clip:pin', (_e, i: unknown) => { if (isId(i)) { clip.history.togglePin(i); clip.setPaused(clip.paused) } })
  ipcMain.handle('clip:remove', (_e, i: unknown) => { if (isId(i)) { clip.history.remove(i); clip.setPaused(clip.paused) } })
  ipcMain.handle('clip:resolve', (_e, i: unknown, keep: unknown) => { if (isId(i) && typeof keep === 'boolean') clip.resolvePending(i, keep) })
  ipcMain.handle('clip:image', (_e, i: unknown) => (isId(i) ? clip.imageDataUrl(i) : null))
}

if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => togglePanel())

app.whenReady().then(() => {
  settings = loadSettings()
  prevSeen = settings.companion.lastSeen
  clip = new ClipboardService((st) => {
    panelWin?.webContents.send('clip', st)
    if (pickerWin && !pickerWin.isDestroyed()) pickerWin.webContents.send('clip', st)
    refreshTray()
  })
  work = new WorkspaceService((w) => {
    panelWin?.webContents.send('ws', w)
    if (pickerWin && !pickerWin.isDestroyed()) pickerWin.webContents.send('ws', w)
  })
  work.load()
  vault = new VaultService(
    (s) => panelWin?.webContents.send('vault', s),
    (w) => panelWin?.webContents.send('vaultData', w)
  )
  vault.autoLockMin = settings.vaultAutoLockMin
  vault.showNames = settings.vaultShowNames
  vault.load()
  registerIpc()
  createPetWindow()
  createPanelWindow()
  createTray()
  clip.setConfig(settings.clipboard)
  clip.start() // capture is session-only (and off until enabled); history lives in memory
  applyHotkeys()

  // Hide automatically during fullscreen apps (without touching the user's own hide setting); return afterwards.
  setInterval(() => {
    if (!petWin) return
    const fs = !process.env.WINCAT_NO_FULLSCREEN_HIDE && isFullscreenAppActive() // env flag: dev/testing only
    if (fs && petWin.isVisible()) {
      autoHidden = true
      petWin.hide()
      panelWin?.hide()
    } else if (!fs && autoHidden) {
      autoHidden = false
      if (!settings.catHidden) petWin.showInactive()
    }
  }, 2000)

  setInterval(pollWindows, 1000)
  setTimeout(autoSnapshot, 30_000)
  setInterval(autoSnapshot, 6 * 3_600_000)

  // keep the overlay covering the primary display's work area
  const refit = () => petWin?.setBounds(primary().workArea)
  screen.on('display-removed', refit)
  screen.on('display-metrics-changed', refit)
})

// Closing the panel never quits; quitting is explicit via the tray.
app.on('window-all-closed', () => {})
app.on('before-quit', () => { quitting = true })
app.on('will-quit', () => {
  settings.companion.lastSeen = Date.now()
  saveSettings(settings)
  globalShortcut.unregisterAll()
  vault?.lock()
  work?.flush()
  clip?.stop()
  clip?.clear()
})
