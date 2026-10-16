import { describe, expect, it } from 'vitest'
import { ClipHistory, MAX_ITEMS, categorize } from './history'
import { detectSensitive } from './sensitive'

describe('ClipHistory', () => {
  it('dedupes by moving to top and counting copies', () => {
    const h = new ClipHistory()
    h.addText('a'); h.addText('b'); h.addText('a')
    const l = h.list()
    expect(l.map((i) => i.text)).toEqual(['a', 'b'])
    expect(l[0].count).toBe(2)
  })
  it('caps at 500, dropping oldest unpinned', () => {
    const h = new ClipHistory()
    h.addText('keep'); h.togglePin(h.list()[0].id)
    for (let i = 0; i < MAX_ITEMS + 10; i++) h.addText('x' + i)
    const l = h.list()
    expect(l.length).toBe(MAX_ITEMS)
    expect(l.some((i) => i.text === 'keep')).toBe(true)
    expect(l.some((i) => i.text === 'x0')).toBe(false)
  })
  it('flags images over the per-image limit and keeps no data', () => {
    const h = new ClipHistory({ perImage: 10, totalImages: 100 })
    const it = h.addImage(Buffer.alloc(50, 1))
    expect(it.overLimit).toBe(true)
    expect(h.imageFor(it.id)).toBeUndefined()
  })
  it('evicts oldest image data past the total cap, flagging it', () => {
    const h = new ClipHistory({ perImage: 60, totalImages: 100 })
    const a = h.addImage(Buffer.alloc(60, 1))
    h.addImage(Buffer.alloc(60, 2))
    expect(h.get(a.id)!.overLimit).toBe(true)
    expect(h.imageBytes()).toBe(60)
  })
  it('clear removes everything', () => {
    const h = new ClipHistory()
    h.addText('a'); h.addImage(Buffer.alloc(5, 3)); h.clear()
    expect(h.list()).toEqual([])
    expect(h.imageBytes()).toBe(0)
  })
})

describe('categorize', () => {
  it('detects links, code, text', () => {
    expect(categorize('https://example.com/x')).toBe('link')
    expect(categorize('const a = 1;\nreturn a;')).toBe('code')
    expect(categorize('hello there')).toBe('text')
  })
})

describe('detectSensitive', () => {
  it('flags common secret shapes without returning them', () => {
    expect(detectSensitive('-----BEGIN RSA PRIVATE KEY-----')).toBe('private key')
    expect(detectSensitive('password = hunter2hunter2')).toBeTruthy()
    expect(detectSensitive('ghp_' + 'a'.repeat(36))).toBe('GitHub token')
  })
  it('ignores ordinary text', () => {
    expect(detectSensitive('see you at 5pm')).toBeNull()
  })
})
