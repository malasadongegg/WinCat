import { createRoot } from 'react-dom/client'
import type { CatApi } from '@shared/types'
import { PanelView } from './views/PanelView'
import { PetView } from './views/PetView'
import { PickerView } from './views/PickerView'
import './styles.css'

declare global {
  interface Window {
    cat: CatApi
  }
}

// One renderer bundle, two windows: ?view=pet (desktop overlay) or ?view=panel (Cat's Desk).
const view = new URLSearchParams(window.location.search).get('view')
document.body.classList.add(view === 'pet' ? 'view-pet' : view === 'picker' ? 'view-picker' : 'view-panel')
createRoot(document.getElementById('root')!).render(view === 'pet' ? <PetView /> : view === 'picker' ? <PickerView /> : <PanelView />)
