import { DEFAULT_UI, type Theme, type UiSettings } from '@shared/ui'
import { BackupCard } from './BackupCard'

interface Props {
  ui: UiSettings
  onUi: (p: Partial<UiSettings>) => void
  lowPower: boolean
  onLowPower: (on: boolean) => void
}

export function SettingsPage({ ui, onUi, lowPower, onLowPower }: Props) {
  return (
    <div>
      <div className="row page-head"><h1>Settings</h1></div>
      <div className="card">
        <h2>Appearance</h2>
        <label className="field">
          <span>Theme</span>
          <select value={ui.theme} onChange={(e) => onUi({ theme: e.target.value as Theme })}>
            <option value="system">Match system</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="contrast">High contrast</option>
          </select>
        </label>
        <label className="field">
          <span>Text size <b>{Math.round(ui.textScale * 100)}%</b></span>
          <input type="range" min={0.85} max={1.5} step={0.05} value={ui.textScale} onChange={(e) => onUi({ textScale: Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>Density</span>
          <select value={ui.density} onChange={(e) => onUi({ density: e.target.value as UiSettings['density'] })}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
      </div>
      <div className="card">
        <h2>Accessibility &amp; performance</h2>
        <label className="row"><input type="checkbox" checked={ui.reduceMotion} onChange={(e) => onUi({ reduceMotion: e.target.checked })} /> Reduce motion (also calms the cat&rsquo;s idle animation)</label>
        <label className="row"><input type="checkbox" checked={ui.largeTargets} onChange={(e) => onUi({ largeTargets: e.target.checked })} /> Larger buttons and fields</label>
        <label className="row"><input type="checkbox" checked={lowPower} onChange={(e) => onLowPower(e.target.checked)} /> Low-power mode</label>
        <p className="hint">Keyboard: <kbd>Ctrl</kbd>+<kbd>K</kbd> search &middot; <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>C</kbd> open/close &middot; <kbd>Esc</kbd> close. Click the cat for care, double-click it for this desk.</p>
        <button onClick={() => onUi(DEFAULT_UI)}>Reset appearance</button>
      </div>
      <BackupCard />
    </div>
  )
}
