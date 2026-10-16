import type { Item, ItemKind } from './workspace'

export interface SearchQuery {
  q: string
  kind?: ItemKind | 'all'
  /** undefined = any folder, null = items with no folder */
  folderId?: string | null
  favoritesOnly?: boolean
  /** only items updated at or after this time (ms epoch) */
  since?: number
}

export interface Hit {
  item: Item
  score: number
}

const tokens = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)

/**
 * Case-insensitive AND search over title + body of persistent items only.
 * Title matches outrank body matches; ties go to favorites, then recency.
 */
export function search(items: Item[], query: SearchQuery): Hit[] {
  const terms = tokens(query.q)
  const hits: Hit[] = []
  for (const item of items) {
    if (query.kind && query.kind !== 'all' && item.kind !== query.kind) continue
    if (query.folderId !== undefined && item.folderId !== query.folderId) continue
    if (query.favoritesOnly && !item.favorite) continue
    if (query.since !== undefined && item.updatedAt < query.since) continue
    let score = 0
    if (terms.length) {
      const title = item.title.toLowerCase()
      const body = item.body.toLowerCase()
      let ok = true
      for (const t of terms) {
        const inTitle = title.includes(t)
        const inBody = body.includes(t)
        if (!inTitle && !inBody) { ok = false; break }
        score += (inTitle ? 10 : 0) + (inBody ? 2 : 0) + (title.startsWith(t) ? 5 : 0)
      }
      if (!ok) continue
    }
    hits.push({ item, score: score + (item.favorite ? 1 : 0) })
  }
  return hits.sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt)
}

/** A short excerpt around the first match, for result rows. */
export function excerpt(body: string, q: string, len = 90): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  const t = tokens(q)[0]
  const at = t ? flat.toLowerCase().indexOf(t) : -1
  const start = at > 30 ? at - 30 : 0
  return (start > 0 ? '…' : '') + flat.slice(start, start + len) + (flat.length > start + len ? '…' : '')
}
