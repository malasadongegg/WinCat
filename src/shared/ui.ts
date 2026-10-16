/** Appearance, accessibility and dashboard layout preferences. */
export const THEMES = ['system', 'dark', 'light', 'contrast'] as const
export type Theme = (typeof THEMES)[number]
export type Density = 'comfortable' | 'compact'

export const WIDGET_IDS = ['actions', 'clipboard', 'snippets', 'notes', 'performance'] as const
export type WidgetId = (typeof WIDGET_IDS)[number]

export interface WidgetPref {
  id: WidgetId
  visible: boolean
  pinned: boolean
}

export interface UiSettings {
  theme: Theme
  /** 0.85 .. 1.5 */
  textScale: number
  density: Density
  /** stops decorative animation, including the cat's idle animation */
  reduceMotion: boolean
  largeTargets: boolean
  widgets: WidgetPref[]
}

export const DEFAULT_UI: UiSettings = {
  theme: 'system',
  textScale: 1,
  density: 'comfortable',
  reduceMotion: false,
  largeTargets: false,
  widgets: WIDGET_IDS.map((id) => ({ id, visible: true, pinned: false }))
}

/** Merge untrusted input over a base, keeping only valid values. Always returns every widget once. */
export function sanitizeUi(raw: unknown, base: UiSettings = DEFAULT_UI): UiSettings {
  const r = (raw ?? {}) as Partial<UiSettings>
  const seen = new Set<WidgetId>()
  const widgets: WidgetPref[] = []
  const src = Array.isArray(r.widgets) ? r.widgets : base.widgets
  for (const w of src) {
    const o = w as Partial<WidgetPref>
    if ((WIDGET_IDS as readonly string[]).includes(o?.id as string) && !seen.has(o.id as WidgetId)) {
      seen.add(o.id as WidgetId)
      widgets.push({ id: o.id as WidgetId, visible: o.visible !== false, pinned: o.pinned === true })
    }
  }
  for (const id of WIDGET_IDS) if (!seen.has(id)) widgets.push({ id, visible: true, pinned: false })
  return {
    theme: (THEMES as readonly string[]).includes(r.theme as string) ? (r.theme as Theme) : base.theme,
    textScale: typeof r.textScale === 'number' && Number.isFinite(r.textScale) ? Math.min(1.5, Math.max(0.85, r.textScale)) : base.textScale,
    density: r.density === 'compact' || r.density === 'comfortable' ? r.density : base.density,
    reduceMotion: typeof r.reduceMotion === 'boolean' ? r.reduceMotion : base.reduceMotion,
    largeTargets: typeof r.largeTargets === 'boolean' ? r.largeTargets : base.largeTargets,
    widgets
  }
}

/** pinned widgets first, otherwise in the user's order; hidden ones excluded */
export function visibleWidgets(prefs: WidgetPref[]): WidgetPref[] {
  const v = prefs.filter((w) => w.visible)
  return [...v.filter((w) => w.pinned), ...v.filter((w) => !w.pinned)]
}

export function moveWidget(prefs: WidgetPref[], id: WidgetId, dir: -1 | 1): WidgetPref[] {
  const i = prefs.findIndex((w) => w.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= prefs.length) return prefs
  const next = [...prefs]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
