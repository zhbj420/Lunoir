import { usePlayer } from '../usePlayer'
import { useShortcuts } from '../useShortcuts'
import Controls from '../components/Controls'

// Runs inside the Win11 acrylic window. The window itself provides the frosted
// background; the panel fills it and stays transparent so the acrylic shows.
export default function OscView() {
  const p = usePlayer()

  useShortcuts({
    togglePause: p.togglePause,
    seekBy: p.seekBy,
    bumpVolume: d => p.setVolume(p.state.volume + d),
    toggleMute: p.toggleMute,
    fullscreen: p.fullscreen,
    openFile: p.openFile,
    next: () => window.mmp.playNext(),
    prev: () => window.mmp.playPrev(),
    onActivity: p.reveal
  })

  return (
    <div className={`osc-win ${p.showUi ? 'ui-visible' : 'ui-hidden'}`} onMouseMove={p.reveal}>
      <Controls
        state={p.state}
        onTogglePause={p.togglePause}
        onSeek={p.seekTo}
        onSeekBy={p.seekBy}
        onSetVolume={p.setVolume}
        onToggleMute={p.toggleMute}
        onFullscreen={p.fullscreen}
      />
    </div>
  )
}
