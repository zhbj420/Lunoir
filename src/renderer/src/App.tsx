import { usePlayer } from './usePlayer'
import { useShortcuts } from './useShortcuts'
import TitleBar from './components/TitleBar'
import EmptyState from './components/EmptyState'
import Controls from './components/Controls'

export default function App() {
  const p = usePlayer()

  useShortcuts({
    togglePause: p.togglePause,
    seekBy: p.seekBy,
    bumpVolume: d => p.setVolume(p.state.volume + d),
    toggleMute: p.toggleMute,
    fullscreen: p.fullscreen,
    openFile: p.openFile,
    onActivity: p.reveal
  })

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      const path = window.mmp.getPathForFile(file)
      if (path) window.mmp.loadFile(path)
    }
  }

  return (
    <div
      className={`app ${p.showUi ? 'ui-visible' : 'ui-hidden'}`}
      onMouseMove={p.reveal}
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
      onWheel={e => {
        p.setVolume(p.state.volume + (e.deltaY < 0 ? 5 : -5))
        p.reveal()
      }}
    >
      <TitleBar title={p.state.title} />

      <div className="video-surface" onClick={p.togglePause} onDoubleClick={p.fullscreen} />

      {!p.state.hasMedia && <EmptyState onOpen={p.openFile} />}

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
