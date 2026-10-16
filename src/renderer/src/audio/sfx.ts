/**
 * Cat sounds synthesised with the Web Audio API: no audio files, nothing to license.
 * Everything is short and soft. Sounds are OFF by default; the caller decides whether to play.
 */
export type Sound = 'meow' | 'purr' | 'chirp' | 'munch' | 'squeak' | 'sigh' | 'gag' | 'hiss'

export class Sfx {
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null
  /** 0..1 */
  volume = 0.4

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) this.ctx = new AudioContext()
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const d = b.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      this.noise = b
    }
    return this.noise
  }

  /** master gain kept low: even volume 1 is gentle */
  private out(ctx: AudioContext, peak: number, start: number, dur: number): GainNode {
    const g = ctx.createGain()
    const v = Math.max(0, Math.min(1, this.volume)) * 0.35 * peak
    g.gain.setValueAtTime(0.0001, start)
    g.gain.linearRampToValueAtTime(v, start + Math.min(0.03, dur / 4))
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    g.connect(ctx.destination)
    return g
  }

  play(name: Sound): void {
    if (this.volume <= 0) return
    const ctx = this.ensure()
    if (!ctx) return
    const t = ctx.currentTime
    switch (name) {
      case 'meow': return this.meow(ctx, t, 1)
      case 'chirp': return this.chirp(ctx, t)
      case 'purr': return this.purr(ctx, t)
      case 'munch': return this.munch(ctx, t)
      case 'squeak': return this.squeak(ctx, t)
      case 'sigh': return this.sigh(ctx, t)
      case 'gag': return this.gag(ctx, t)
      case 'hiss': return this.hiss(ctx, t)
    }
  }

  /** sawtooth through a sweeping band-pass = a vowel-ish "mee-ow" */
  private meow(ctx: AudioContext, t: number, pitch: number): void {
    const dur = 0.55
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(420 * pitch, t)
    osc.frequency.linearRampToValueAtTime(780 * pitch, t + 0.18)
    osc.frequency.linearRampToValueAtTime(480 * pitch, t + dur)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 4
    bp.frequency.setValueAtTime(900, t)
    bp.frequency.linearRampToValueAtTime(1900, t + 0.2)
    bp.frequency.linearRampToValueAtTime(1100, t + dur)
    osc.connect(bp)
    bp.connect(this.out(ctx, 1, t, dur))
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }

  private chirp(ctx: AudioContext, t: number): void {
    for (let i = 0; i < 2; i++) {
      const s = t + i * 0.11
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(650, s)
      o.frequency.exponentialRampToValueAtTime(1150, s + 0.09)
      o.connect(this.out(ctx, 0.8, s, 0.1))
      o.start(s)
      o.stop(s + 0.12)
    }
  }

  /** low-passed noise pulsing at ~25 Hz */
  private purr(ctx: AudioContext, t: number): void {
    const dur = 2.4
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(ctx)
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 260
    const pulse = ctx.createGain()
    pulse.gain.value = 0.5
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 25
    const depth = ctx.createGain()
    depth.gain.value = 0.5
    lfo.connect(depth)
    depth.connect(pulse.gain)
    src.connect(lp)
    lp.connect(pulse)
    pulse.connect(this.out(ctx, 1.4, t, dur))
    src.start(t)
    lfo.start(t)
    src.stop(t + dur + 0.05)
    lfo.stop(t + dur + 0.05)
  }

  private munch(ctx: AudioContext, t: number): void {
    for (let i = 0; i < 5; i++) {
      const s = t + i * 0.28
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuffer(ctx)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 800 + Math.random() * 500
      bp.Q.value = 2
      src.connect(bp)
      bp.connect(this.out(ctx, 1.1, s, 0.07))
      src.start(s)
      src.stop(s + 0.08)
    }
  }

  private squeak(ctx: AudioContext, t: number): void {
    for (let i = 0; i < 2; i++) {
      const s = t + i * 0.16
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(1300, s)
      o.frequency.exponentialRampToValueAtTime(1900, s + 0.07)
      o.connect(this.out(ctx, 0.5, s, 0.09))
      o.start(s)
      o.stop(s + 0.11)
    }
  }

  /** low wobbling retch */
  private gag(ctx: AudioContext, t: number): void {
    const dur = 0.9
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(190, t)
    o.frequency.exponentialRampToValueAtTime(70, t + dur)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 14
    const depth = ctx.createGain()
    depth.gain.value = 30
    lfo.connect(depth)
    depth.connect(o.frequency)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 600
    o.connect(lp)
    lp.connect(this.out(ctx, 1, t, dur))
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05)
  }

  /** a short burst of high-passed noise */
  private hiss(ctx: AudioContext, t: number): void {
    const dur = 0.6
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(ctx)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 3200
    src.connect(hp)
    hp.connect(this.out(ctx, 0.9, t, dur))
    src.start(t)
    src.stop(t + dur + 0.05)
  }

  private sigh(ctx: AudioContext, t: number): void {
    const dur = 0.9
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(420, t)
    o.frequency.exponentialRampToValueAtTime(240, t + dur)
    o.connect(this.out(ctx, 0.45, t, dur))
    o.start(t)
    o.stop(t + dur + 0.05)
  }
}
