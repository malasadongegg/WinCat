import type { Interaction } from './companion'

/**
 * Doing too much of one thing in a short time has a funny, harmless consequence:
 *   treats -> the cat feels full, then pukes
 *   pets   -> the cat gets grumpy and runs off
 *   play   -> the cat gets hyper (zoomies), then tires out
 * These only ever come from the player spamming an action. Neglect never has a consequence,
 * nothing is saved, nothing is lost: it lasts seconds, awards no bond, and resets on restart.
 */
export type Outcome = 'ok' | 'warn' | 'puke' | 'annoyed' | 'hyper'

interface Rule {
  windowMs: number
  /** number of recent actions (including this one) at which a warning appears */
  warnAt: number
  /** ... and at which the over-do consequence happens */
  limit: number
  over: Exclude<Outcome, 'ok' | 'warn'>
}

export const RULES: Partial<Record<Interaction, Rule>> = {
  treat: { windowMs: 5 * 60_000, warnAt: 3, limit: 4, over: 'puke' },
  pet: { windowMs: 30_000, warnAt: 8, limit: 12, over: 'annoyed' },
  play: { windowMs: 90_000, warnAt: 3, limit: 4, over: 'hyper' }
}

export class OverdoTracker {
  private log: Record<string, number[]> = {}

  record(kind: Interaction, now: number): Outcome {
    const rule = RULES[kind]
    if (!rule) return 'ok'
    const recent = (this.log[kind] ?? []).filter((t) => now - t < rule.windowMs)
    recent.push(now)
    if (recent.length >= rule.limit) {
      this.log[kind] = [] // the cat has "reset": stomach emptied, calmed down, tired out
      return rule.over
    }
    this.log[kind] = recent
    return recent.length >= rule.warnAt ? 'warn' : 'ok'
  }

  reset(): void {
    this.log = {}
  }
}

/** bond is only awarded for normal interactions */
export const awardsBond = (o: Outcome): boolean => o === 'ok' || o === 'warn'
