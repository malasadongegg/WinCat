import { useCallback, useEffect, useState } from 'react'
import type { ClipState } from '@shared/clipboard'
import { DEFAULT_UI, type UiSettings } from '@shared/ui'
import { EMPTY_WORKSPACE, type Workspace } from '@shared/workspace'

export function useWorkspace(): { ws: Workspace; recovery: string | null } {
  const [ws, setWs] = useState<Workspace>(EMPTY_WORKSPACE)
  const [recovery, setRecovery] = useState<string | null>(null)
  useEffect(() => {
    window.cat.wsGet().then((r) => { setWs(r.ws); setRecovery(r.recovery) })
    return window.cat.onWorkspace(setWs)
  }, [])
  return { ws, recovery }
}

export function useUi(): [UiSettings, (patch: Partial<UiSettings>) => void] {
  const [ui, setUi] = useState<UiSettings>(DEFAULT_UI)
  useEffect(() => {
    window.cat.uiGet().then(setUi)
    return window.cat.onUi(setUi)
  }, [])
  const update = useCallback((patch: Partial<UiSettings>) => { window.cat.uiSet(patch).then(setUi) }, [])
  return [ui, update]
}

export function useClip(): ClipState | null {
  const [st, setSt] = useState<ClipState | null>(null)
  useEffect(() => {
    window.cat.clipState().then(setSt)
    return window.cat.onClip(setSt)
  }, [])
  return st
}

/** Apply theme / text size / density / motion / target-size preferences to the document. */
export function applyUi(ui: UiSettings): void {
  const d = document.documentElement
  d.dataset.theme = ui.theme
  d.dataset.density = ui.density
  d.dataset.motion = ui.reduceMotion ? 'reduce' : 'normal'
  d.dataset.targets = ui.largeTargets ? 'large' : 'normal'
  d.style.zoom = String(ui.textScale)
}

export function ago(t: number): string {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
