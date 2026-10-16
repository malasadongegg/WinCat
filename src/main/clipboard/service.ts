import { clipboard, ClipboardItem } from 'electron'
import { ClipHistory, hashOf } from './history'
import { detectSensitive } from './sensitive'
import type { ClipState, PendingReview } from '../../shared/clipboard'
import { DEFAULT_CLIP_CONFIG, type ClipConfig } from '../../shared/clipconfig'

/**
 * Polls the system clipboard (Electron has no change event) and feeds ClipHistory.
 * Capture is OFF until start() is called and can be paused at any time.
 * Pending suspected secrets live only in this process's memory and vanish on exit.
 */
export class ClipboardService {
  readonly history = new ClipHistory()
  /** Capture is opt-in: starts paused each launch until the user turns it on. */
  paused = true
  private config: ClipConfig = DEFAULT_CLIP_CONFIG
  private timer: NodeJS.Timeout | null = null
  private lastHash = ''
  private pending = new Map<number, { text: string; reason: string }>()
  private nextPending = 1
  private busy = false

  constructor(private onChange: (s: ClipState) => void) {}

  setConfig(c: ClipConfig): void {
    this.config = c
    this.history.setLimits({ perImage: c.perImageMB * 1048576, totalImages: c.totalImagesMB * 1048576 })
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.tick(), 500)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  setPaused(p: boolean): void {
    this.paused = p
    this.emit()
    // don't capture what was already on the clipboard when capture is turned on
    if (!p) {
      this.busy = true // block ticks until the baseline is taken
      void this.currentHash().then((h) => { this.lastHash = h }).finally(() => { this.busy = false })
    }
  }

  state(): ClipState {
    const pending: PendingReview[] = [...this.pending].map(([id, p]) => ({ id, reason: p.reason }))
    return { items: this.history.list(), paused: this.paused, pending, imageBytes: this.history.imageBytes() }
  }

  /** Copy a history item back to the clipboard. Pasting is a separate, deliberate user action. */
  async copy(id: number): Promise<void> {
    const it = this.history.get(id)
    if (!it) return
    if (it.kind === 'text' && it.text !== undefined) {
      this.lastHash = hashOf(it.text) // so our own write is not re-captured
      await clipboard.writeText(it.text)
    } else {
      const png = this.history.imageFor(id)
      if (!png) return
      this.lastHash = hashOf(png)
      await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })])
    }
  }

  /** Copy arbitrary text (e.g. a snippet) without it being re-captured into history. */
  async copyText(text: string): Promise<void> {
    this.lastHash = hashOf(text)
    await clipboard.writeText(text)
  }

  resolvePending(id: number, keep: boolean): void {
    const p = this.pending.get(id)
    if (!p) return
    this.pending.delete(id)
    if (keep) this.history.addText(p.text)
    this.emit()
  }

  clear(): void {
    this.history.clear()
    this.pending.clear()
    this.emit()
  }

  imageDataUrl(id: number): string | null {
    const png = this.history.imageFor(id)
    return png ? 'data:image/png;base64,' + png.toString('base64') : null
  }

  /** Read the clipboard once. Text wins over image (apps often put both when copying rich content). */
  private async snapshot(): Promise<{ text?: string; png?: Buffer }> {
    const items = await clipboard.read()
    const item = items[0]
    if (!item) return {}
    if (item.types.includes('text/plain')) {
      const text = await (await item.getType('text/plain')).text()
      if (text) return { text }
    }
    if (item.types.includes('image/png')) {
      const blob = await item.getType('image/png')
      return { png: Buffer.from(await blob.arrayBuffer()) }
    }
    return {}
  }

  private async currentHash(): Promise<string> {
    const { text, png } = await this.snapshot()
    return text ? hashOf(text) : png ? hashOf(png) : ''
  }

  private async tick(): Promise<void> {
    if (this.paused || this.busy) return
    this.busy = true
    try {
      const { text, png } = await this.snapshot()
      if (this.paused) return
      if (text) {
        const h = hashOf(text)
        if (h === this.lastHash) return
        this.lastHash = h
        const reason = detectSensitive(text, [], this.config.disabled, this.config.patterns)
        if (reason) {
          // hold in memory only; ask before anything is stored in history
          this.pending.set(this.nextPending++, { text, reason })
        } else {
          this.history.addText(text)
        }
      } else if (png) {
        const h = hashOf(png)
        if (h === this.lastHash) return
        this.lastHash = h
        this.history.addImage(png)
      } else {
        this.lastHash = ''
        return
      }
      this.emit()
    } catch {
      /* clipboard briefly unavailable (locked by another app): try again next tick */
    } finally {
      this.busy = false
    }
  }

  private emit(): void {
    this.onChange(this.state())
  }
}
