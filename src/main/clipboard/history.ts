import { createHash } from 'crypto'
import type { ClipItem, ClipCategory } from '../../shared/clipboard'

export const MAX_ITEMS = 500

export interface Limits {
  /** max bytes for a single image */
  perImage: number
  /** max bytes for all retained images combined */
  totalImages: number
}

export const DEFAULT_LIMITS: Limits = { perImage: 5 * 1024 * 1024, totalImages: 50 * 1024 * 1024 }

export function hashOf(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

const LINK = /^(https?:\/\/|www\.)\S+$/i
const CODE_HINTS = /(=>|\b(function|const|let|var|class|import|return|def|public|private)\b|[{};]\s*$|^\s*(<\/?[a-z][^>]*>|#include|\/\/|\/\*))/m

export function categorize(text: string): ClipCategory {
  const t = text.trim()
  if (LINK.test(t) && !t.includes('\n')) return 'link'
  const lines = t.split('\n')
  if (lines.length > 1 && CODE_HINTS.test(t)) return 'code'
  if (lines.length === 1 && /[{};]$/.test(t) && CODE_HINTS.test(t)) return 'code'
  return 'text'
}

/** Session-only clipboard history. Never persisted; images held in memory only. */
export class ClipHistory {
  private items: ClipItem[] = []
  private imageData = new Map<string, Buffer>()
  private nextId = 1

  constructor(private limits: Limits = DEFAULT_LIMITS) {}

  /** apply new image limits right away (images already kept stay until the total is exceeded again) */
  setLimits(l: Limits): void {
    this.limits = l
    this.enforceImageTotal()
  }

  list(): ClipItem[] {
    return this.items.map((i) => ({ ...i }))
  }

  get(id: number): ClipItem | undefined {
    return this.items.find((i) => i.id === id)
  }

  imageFor(id: number): Buffer | undefined {
    const it = this.get(id)
    return it ? this.imageData.get(it.hash) : undefined
  }

  imageBytes(): number {
    let n = 0
    for (const b of this.imageData.values()) n += b.length
    return n
  }

  addText(text: string, now = Date.now()): ClipItem {
    return this.upsert(hashOf(text), () => ({
      kind: 'text',
      category: categorize(text),
      text,
      overLimit: false,
      bytes: Buffer.byteLength(text)
    }), now)
  }

  addImage(png: Buffer, now = Date.now()): ClipItem {
    const hash = hashOf(png)
    const tooBig = png.length > this.limits.perImage
    const existing = this.items.find((i) => i.hash === hash)
    if (existing) return this.upsert(hash, () => { throw new Error('unreachable') }, now)
    const item = this.upsert(hash, () => ({
      kind: 'image',
      category: 'image',
      overLimit: tooBig,
      bytes: png.length
    }), now)
    if (!tooBig) {
      this.imageData.set(hash, png)
      this.enforceImageTotal()
    }
    return this.get(item.id) ?? item
  }

  togglePin(id: number): void {
    const it = this.get(id)
    if (it) it.pinned = !it.pinned
  }

  remove(id: number): void {
    const it = this.get(id)
    if (!it) return
    this.items = this.items.filter((i) => i.id !== id)
    this.imageData.delete(it.hash)
  }

  clear(): void {
    this.items = []
    this.imageData.clear()
  }

  private upsert(hash: string, make: () => Omit<ClipItem, 'id' | 'hash' | 'count' | 'pinned' | 'at'>, now: number): ClipItem {
    const existing = this.items.find((i) => i.hash === hash)
    if (existing) {
      existing.count++
      existing.at = now
      this.items = [existing, ...this.items.filter((i) => i !== existing)]
      return existing
    }
    const item: ClipItem = { id: this.nextId++, hash, count: 1, pinned: false, at: now, ...make() }
    this.items.unshift(item)
    this.enforceCap()
    return item
  }

  /** Drop the oldest unpinned items beyond MAX_ITEMS. */
  private enforceCap(): void {
    while (this.items.length > MAX_ITEMS) {
      let idx = -1
      for (let i = this.items.length - 1; i >= 0; i--) {
        if (!this.items[i].pinned) { idx = i; break }
      }
      if (idx < 0) break // everything pinned: allow overflow rather than drop pinned items
      const [gone] = this.items.splice(idx, 1)
      this.imageData.delete(gone.hash)
    }
  }

  /** Evict oldest unpinned images' data until under the total cap; entry stays, flagged overLimit. */
  private enforceImageTotal(): void {
    for (let i = this.items.length - 1; i >= 0 && this.imageBytes() > this.limits.totalImages; i--) {
      const it = this.items[i]
      if (it.kind === 'image' && !it.pinned && this.imageData.has(it.hash)) {
        this.imageData.delete(it.hash)
        it.overLimit = true
      }
    }
  }
}
