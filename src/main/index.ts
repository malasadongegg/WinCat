import { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, nativeImage, screen } from 'electron'
import { join } from 'path'
import { clampToArea } from '../shared/clamp'
import type { Settings } from '../shared/types'
import { CATALOG, canEquip, type Slot } from '../shared/cosmetics'
import { PERSONALITIES, applyInteraction, levelInfo } from '../shared/companion'
import { ClipboardService } from './clipboard/service'
import { isFullscreenAppActive } from './fullscreen'
import { loadSettings, saveSettings } from './settings'
import { OverdoTracker, awardsBond } from '../shared/overdo'
import { COLLECTIBLES, isStat, newlyUnlocked, sanitizeRoom, type StatName } from '../shared/catlife'
import { listWindowTops, type WinTop } from './windows'
import { WorkspaceService } from './workspace'
import { sanitizeUi } from '../shared/ui'

const PANEL_SIZE = { width: 900, height: 600 }

/** Two windows: a transparent click-through overlay the cat roams on, and the Cat's Desk panel. */
let petWin: BrowserWindow | null = null
let panelWin: BrowserWindow | null = null
let tray: Tray | null = null
let settings: Settings
let autoHidden = false
let quitting = false
let prevSeen = 0
let clip: ClipboardService
let work: WorkspaceService
const overdo = new OverdoTracker()
let lastPlatforms = '[]'
/** last cat position reported by the overlay, in screen coordinates */
let catPos: { x: number; y: number } | null = null
let lastSaved = { x: -9999 }

const displayKey = (id: number) => String(id)
const primary = () => screen.getPrimaryDisplay()

function loadView(win: BrowserWindow, view: 'pet' | 'panel'): void {
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
  for (const w of [petWin, panelWin]) if (w && !w.isDestroyed()) w.webContents.send(channel, ...args)
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
      { label: 'Pause clipboard capture (off until enabled)', type: 'checkbox', checked: clip?.paused ?? false, click: (i) => clip.setPaused(i.checked) },
      { label: 'Sounds', type: 'checkbox', checked: settings.companion.sound, click: (i) => { settings.companion.sound = i.checked; saveSettings(settings); broadcast('companion', settings.companion) } },
      { label: 'Low-power mode', type: 'checkbox', checked: settings.lowPower, click: (i) => setLowPower(i.checked) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
}

function createTray(): void {
  // Placeholder icon generated in code (BGRA purple square) until a real asset exists.
  const buf = Buffer.alloc(16 * 16 * 4)
  for (let i = 0; i < 256; i++) buf.set([0xff, 0x5c, 0x7c, 0xff], i * 4)
  tray = new Tray(nativeImage.createFromBitmap(buf, { width: 16, height: 16 }))
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
  ipcMain.handle('settings:lowPower', (_e, on: unknown) => {
    if (typeof on === 'boolean') setLowPower(on)
  })

  // panel window
  ipcMain.handle('panel:set', (_e, s: unknown) => {
    if (s === 'expanded') showPanel()
    else if (s === 'collapsed') panelWin?.hide()
  })
  ipcMain.handle('panel:toggle', () => togglePanel())

  // overlay: click-through capture + position reports
  ipcMain.on('ui:capture', (e, over: unknown) => {
    if (typeof over === 'boolean' && sender(e) === petWin) petWin?.setIgnoreMouseEvents(!over, { forward: true })
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
  ipcMain.handle('ws:saveItem', (_e, i: unknown) => {
    const o = (i ?? {}) as Record<string, unknown>
    if (o.kind !== 'note' && o.kind !== 'snippet') return null
    const existed = typeof o.id === 'string' && work.get().items.some((i) => i.id === o.id)
    const saved = work.saveItem({
      id: typeof o.id === 'string' ? o.id : undefined,
      kind: o.kind,
      title: text(o.title, 200),
      body: text(o.body, 200_000),
      format: o.format === 'markdown' ? 'markdown' : o.format === 'text' ? 'text' : undefined,
      folderId: o.folderId === null ? null : typeof o.folderId === 'string' ? o.folderId : undefined,
      favorite: typeof o.favorite === 'boolean' ? o.favorite : undefined
    })
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
  ipcMain.handle('clip:copyText', (_e, t: unknown) => { if (typeof t === 'string') return clip.copyText(t.slice(0, 500_000)) })

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
    refreshTray()
  })
  work = new WorkspaceService((w) => panelWin?.webContents.send('ws', w))
  work.load()
  registerIpc()
  createPetWindow()
  createPanelWindow()
  createTray()
  clip.start() // capture is session-only (and off until enabled); history lives in memory
  if (!globalShortcut.register('Control+Alt+C', togglePanel)) console.warn('hotkey Ctrl+Alt+C unavailable')

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
  work?.flush()
  clip?.stop()
  clip?.clear()
})
