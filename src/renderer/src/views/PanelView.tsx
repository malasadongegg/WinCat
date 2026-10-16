import { useEffect, useState } from 'react'
import { DEFAULT_COMPANION, type CompanionState } from '@shared/companion'
import type { Metrics } from '@shared/types'
import { Dashboard } from '../Dashboard'
import { applyUi, useUi, useWorkspace } from '../ui/hooks'

/** The Cat's Desk window. Hidden (not destroyed) when closed. */
export function PanelView() {
  const [lowPower, setLowPower] = useState(false)
  const [focus, setFocus] = useState(false)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [comp, setComp] = useState<CompanionState>(DEFAULT_COMPANION)
  const { ws, recovery } = useWorkspace()
  const [ui, updateUi] = useUi()

  useEffect(() => applyUi(ui), [ui])

  useEffect(() => {
    window.cat.getSettings().then((s) => { setLowPower(s.lowPower); setFocus(s.focusMode) })
    const offF = window.cat.onFocus(setFocus)
    window.cat.companionGet().then(setComp)
    const offLp = window.cat.onLowPower(setLowPower)
    const offC = window.cat.onCompanion(setComp)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) window.cat.setPanel('collapsed') }
    window.addEventListener('keydown', onKey)
    return () => { offLp(); offC(); offF(); window.removeEventListener('keydown', onKey) }
  }, [])

  // poll real process metrics only while the panel is actually visible
  useEffect(() => {
    let live = true
    const poll = () => { if (!document.hidden) window.cat.getMetrics().then((m) => live && setMetrics(m)) }
    poll()
    const id = setInterval(poll, 2000)
    return () => { live = false; clearInterval(id) }
  }, [])

  return (
    <Dashboard
      ws={ws}
      recovery={recovery}
      ui={ui}
      onUi={updateUi}
      lowPower={lowPower}
      focus={focus}
      metrics={metrics}
      companion={comp}
      onInteract={(k) => { window.cat.companionInteract(k) }}
      onConfig={(c) => { window.cat.companionConfig(c) }}
      onLowPower={(on) => window.cat.setLowPower(on)}
      onClose={() => window.cat.setPanel('collapsed')}
    />
  )
}
