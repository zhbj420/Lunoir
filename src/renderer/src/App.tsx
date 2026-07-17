import OverlayView from './views/OverlayView'
import OscView from './views/OscView'

export default function App() {
  const win = new URLSearchParams(location.search).get('win')
  return win === 'osc' ? <OscView /> : <OverlayView />
}
