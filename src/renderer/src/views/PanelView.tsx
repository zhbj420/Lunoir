import { useEffect } from 'react'
import { usePlayer } from '../usePlayer'
import { useShortcuts } from '../useShortcuts'
import RightPanel from '../components/RightPanel'
import SettingsPanel from '../components/SettingsPanel'
import ResizeGrips from '../components/ResizeGrips'

// Runs inside an acrylic side-panel child window. The window itself provides the
// frosted background; the panel fills it and stays translucent (see the
// `body.panel-win .panel` rules in styles.css). The window is shown/positioned by
// the main process, so `open` is always true here — closing routes back to main.
export default function PanelView({ kind }: { kind: 'playlist' | 'settings' }) {
  const p = usePlayer()

  // keep keyboard shortcuts working when this window has focus (like OscView)
  useShortcuts({
    togglePause: p.togglePause,
    seekBy: p.seekBy,
    frameStep: p.frameStep,
    paused: p.state.pause,
    bumpVolume: d => p.setVolume(p.state.volume + d),
    toggleMute: p.toggleMute,
    fullscreen: p.fullscreen,
    openFile: p.openFile,
    next: () => window.mmp.playNext(),
    prev: () => window.mmp.playPrev(),
    onActivity: p.reveal
  })

  useEffect(() => {
    document.body.classList.add('panel-win')
    return () => document.body.classList.remove('panel-win')
  }, [])

  // main fades the window in place; here we slide the CONTENT within it (a window
  // can't be clipped to the parent, so a window-slide would spill onto the desktop)
  useEffect(
    () => window.mmp.onPanelReveal(open => document.body.classList.toggle('panel-shown', open)),
    []
  )

  // Esc closes the panel (toggling it off in main); inputs stopPropagation, so
  // Esc while typing a value doesn't reach here
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.mmp.togglePanel(kind)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [kind])

  const close = (): void => window.mmp.togglePanel(kind)

  return kind === 'settings' ? (
    <SettingsPanel open onClose={close} />
  ) : (
    <>
      <RightPanel open onClose={close} />
      {/* restore window resize on the edges this right-docked panel covers */}
      <ResizeGrips edges={['e', 's', 'se']} />
    </>
  )
}
