import { useEffect } from 'react'
import { usePlayer } from '../usePlayer'
import { useShortcuts } from '../useShortcuts'
import Library from '../components/Library'

// Runs inside the centred acrylic 收藏 window. The window itself provides the
// frosted background; the content fills it and scales in via `library-shown` when
// main reveals it. Main owns show/position; closing routes back to main.
export default function LibraryView() {
  const p = usePlayer()

  // keep global shortcuts working when this window has focus (like PanelView)
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
    document.body.classList.add('library-win')
    return () => document.body.classList.remove('library-win')
  }, [])

  // main fades the window; the content scales/fades in on this class
  useEffect(
    () => window.mmp.onLibraryReveal(open => document.body.classList.toggle('library-shown', open)),
    []
  )

  // Esc closes the overlay (inputs stopPropagation so typing a value is unaffected)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.mmp.closeLibrary()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return <Library />
}
