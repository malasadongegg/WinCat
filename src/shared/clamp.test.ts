import { describe, expect, it } from 'vitest'
import { clampToArea } from './clamp'

const area = { x: 0, y: 0, width: 1000, height: 800 }
describe('clampToArea', () => {
  it('keeps in-bounds rect unchanged', () => {
    expect(clampToArea({ x: 10, y: 10, width: 100, height: 100 }, area)).toEqual({ x: 10, y: 10, width: 100, height: 100 })
  })
  it('pulls overflowing rect back inside', () => {
    expect(clampToArea({ x: 950, y: 790, width: 100, height: 100 }, area)).toEqual({ x: 900, y: 700, width: 100, height: 100 })
  })
  it('handles negative-origin monitors', () => {
    const left = { x: -1920, y: 0, width: 1920, height: 1080 }
    expect(clampToArea({ x: -2000, y: -5, width: 200, height: 200 }, left).x).toBe(-1920)
  })
})
