import koffi from 'koffi'

/**
 * Is some other application showing a fullscreen window right now?
 *
 * Looks only at the foreground window's geometry (does it cover its whole monitor?), its window class
 * (to ignore the desktop/shell) and its process id (to ignore our own windows). No titles, process
 * names or app histories are read or stored. SHQueryUserNotificationState is not used because our own
 * desktop-sized overlay makes it report "busy".
 */
interface Api {
  fg: () => unknown
  rect: (h: unknown, out: Rect) => boolean
  monitor: (h: unknown, flags: number) => unknown
  info: (m: unknown, mi: { cbSize: number; rcMonitor: Rect; rcWork: Rect; dwFlags: number }) => boolean
  pid: (h: unknown, out: number[]) => number
  cls: (h: unknown, buf: Uint16Array, n: number) => number
}
interface Rect { left: number; top: number; right: number; bottom: number }

let api: Api | null = null
try {
  const user32 = koffi.load('user32.dll')
  const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
  const MONITORINFO = koffi.struct('MONITORINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' })
  api = {
    fg: user32.func('void *GetForegroundWindow()'),
    rect: user32.func('bool GetWindowRect(void *h, _Out_ RECT *r)'),
    monitor: user32.func('void *MonitorFromWindow(void *h, uint32 flags)'),
    info: user32.func('bool GetMonitorInfoW(void *m, _Inout_ MONITORINFO *mi)'),
    pid: user32.func('uint32 GetWindowThreadProcessId(void *h, _Out_ uint32 *pid)'),
    cls: user32.func('int GetClassNameW(void *h, _Out_ uint16_t *buf, int n)')
  } as unknown as Api
} catch {
  api = null // non-Windows or load failure: feature disabled
}

const SHELL_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd'])

export function isFullscreenAppActive(): boolean {
  if (!api) return false
  try {
    const h = api.fg()
    if (!h) return false
    const pid = [0]
    api.pid(h, pid)
    if (pid[0] === process.pid) return false // our own windows never count

    const buf = new Uint16Array(256)
    const n = api.cls(h, buf, 256)
    if (SHELL_CLASSES.has(String.fromCharCode(...buf.subarray(0, n)))) return false

    const r: Rect = { left: 0, top: 0, right: 0, bottom: 0 }
    if (!api.rect(h, r)) return false
    const mi = { cbSize: 40, rcMonitor: { ...r }, rcWork: { ...r }, dwFlags: 0 }
    if (!api.info(api.monitor(h, 2 /* MONITOR_DEFAULTTONEAREST */), mi)) return false
    const m = mi.rcMonitor
    return r.left <= m.left && r.top <= m.top && r.right >= m.right && r.bottom >= m.bottom
  } catch {
    return false
  }
}
