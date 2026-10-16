export type ClipCategory = 'text' | 'code' | 'link' | 'image'

export interface ClipItem {
  id: number
  hash: string
  kind: 'text' | 'image'
  category: ClipCategory
  /** text items only */
  text?: string
  count: number
  pinned: boolean
  at: number
  bytes: number
  /** image exceeded a retention limit, so its data is not kept */
  overLimit: boolean
}

/** A suspected-secret capture waiting for the user's decision. Deliberately carries no content. */
export interface PendingReview {
  id: number
  /** why it was flagged, e.g. "private key", never the value itself */
  reason: string
}

export interface ClipState {
  items: ClipItem[]
  paused: boolean
  pending: PendingReview[]
  imageBytes: number
}
