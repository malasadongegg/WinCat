import koffi from 'koffi'

/**
 * Finds the top edges of open windows so the cat can sit on them.
 *
 * Privacy: this reads ONLY each window's rectangle (and, to filter out the desktop / taskbar /
 * hidden system windows, its class name and visibility flags). Window titles, process names
 * and app identities are never read, stored or sent anywhere.
 */
export interface Rect { left: number; top: number; right: number; bottom: number }
export interface WinTop { id: number; left: number; right: number; top: number }

interface Api {
  enumWindows: (cb: unknown, lparam: number) => boolean
  proto: unknown
  visible: (h: unknown) => boolean
  iconic: (h: unknown) => boolean
  rect: (h: unknown, out: Rect) => boolean
  style: (h: unknown, idx: number) => number
  pid: (h: unknown, out: number[]) => number
  cls: (h: unknown, buf: Uint16Array, n: number) => number
  dwm: (h: unknown, attr: number, out: unknown, size: number) => number
}

let api: Api | null = null
try {
  const user32 = koffi.load('user32.dll')
  const dwmapi = koffi.load('dwmapi.dll')
  const RECT = koffi.struct('WRECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
  const proto = koffi.proto('bool __stdcall WinEnumProc(void *hwnd, intptr lparam)')
  api = {
    proto,
    enumWindows: user32.func('bool EnumWindows(WinEnumProc *cb, intptr lparam)'),
    visible: user32.func('bool IsWindowVisible(void *h)'),
    iconic: user32.func('bool IsIconic(void *h)'),
    rect: user32.func('bool GetWindowRect(void *h, _Out_ WRECT *r)'),
    style: user32.func('int32 GetWindowLongW(void *h, int idx)'),
    pid: user32.func('uint32 GetWindowThreadProcessId(void *h, _Out_ uint32 *pid)'),
    cls: user32.func('int GetClassNameW(void *h, _Out_ uint16_t *buf, int n)'),
    dwm: dwmapi.func('int DwmGetWindowAttribute(void *h, uint32 attr, _Out_ WRECT *out, uint32 size)')
  } as unknown as Api
  void RECT
} catch {
  api = null // non-Windows or load failure: perching disabled
}

const SKIP_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Windows.UI.Core.CoreWindow', 'NotifyIconOverflowWindow'])
const GWL_EXSTYLE = -20
const WS_EX_TOOLWINDOW = 0x80
const WS_EX_NOACTIVATE = 0x08000000
const DWMWA_CLOAKED = 14
const DWMWA_EXTENDED_FRAME_BOUNDS = 9

/**
 * @param area the work area of the display the cat lives on (screen coordinates)
 * @param selfPid our own process id (our windows are ignored)
 */
export function listWindowTops(area: { x: number; y: number; width: number; height: number }, selfPid: number): WinTop[] {
  if (!api) return []
  const a = api
  const found: Array<{ id: number; rect: Rect }> = []
  const cb = koffi.register((hwnd: unknown): boolean => {
    try {
      if (!a.visible(hwnd) || a.iconic(hwnd)) return true
      const ex = a.style(hwnd, GWL_EXSTYLE)
      if (ex & (WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE)) return true
      const pid = [0]
      a.pid(hwnd, pid)
      if (pid[0] === selfPid) return true
      const buf = new Uint16Array(128)
      const n = a.cls(hwnd, buf, 128)
      if (SKIP_CLASSES.has(String.fromCharCode(...buf.subarray(0, n)))) return true
      const cloaked = { left: 0, top: 0, right: 0, bottom: 0 }
      // "cloaked" windows (other virtual desktops, hidden UWP shells) report visible but are not
      if (a.dwm(hwnd, DWMWA_CLOAKED, cloaked as unknown as Rect, 4) === 0 && cloaked.left !== 0) return true
      const r: Rect = { left: 0, top: 0, right: 0, bottom: 0 }
      // the true visible frame (the plain window rect includes an invisible resize border)
      if (a.dwm(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, r, 16) !== 0 && !a.rect(hwnd, r)) return true
      found.push({ id: Number(koffi.address(hwnd)), rect: r })
    } catch {
      /* ignore this window */
    }
    return true
  }, koffi.pointer(a.proto as never))
  try {
    a.enumWindows(cb, 0)
  } finally {
    koffi.unregister(cb)
  }

  // EnumWindows lists windows front-to-back. Keep a window's top edge only if it is not hidden
  // behind a window in front of it, and only if it is a sensible standing place.
  const out: WinTop[] = []
  const inFront: Rect[] = []
  for (const w of found) {
    const r = w.rect
    const width = r.right - r.left
    const height = r.bottom - r.top
    const usable = width >= 260 && height >= 140 && r.top > area.y + 12 && r.top < area.y + area.height - 120
    if (usable) {
      const samples = [r.left + width * 0.2, r.left + width * 0.5, r.left + width * 0.8]
      const covered = samples.filter((x) => inFront.some((f) => x >= f.left && x <= f.right && r.top + 2 >= f.top && r.top + 2 <= f.bottom)).length
      if (covered === 0) out.push({ id: w.id, left: r.left - area.x, right: r.right - area.x, top: r.top - area.y })
    }
    inFront.push(r)
  }
  return out.slice(0, 12)
}
