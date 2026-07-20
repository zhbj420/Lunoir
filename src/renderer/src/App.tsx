import OverlayView from './views/OverlayView'
import OscView from './views/OscView'
import PanelView from './views/PanelView'
import MenuView from './views/MenuView'

export default function App() {
  const params = new URLSearchParams(location.search)
  const win = params.get('win')
  if (win === 'osc') return <OscView />
  if (win === 'menu') return <MenuView />
  if (win === 'panel') return <PanelView kind={(params.get('kind') as 'playlist' | 'settings') ?? 'playlist'} />
  return <OverlayView />
}
