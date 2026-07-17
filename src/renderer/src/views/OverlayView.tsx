import { useState } from 'react'
import { usePlayer } from '../usePlayer'
import { useShortcuts } from '../useShortcuts'
import TitleBar from '../components/TitleBar'
import EmptyState from '../components/EmptyState'

// Main window: title bar, empty state, video-surface gestures. The OSC lives in
// the separate acrylic window (OscView).
export default function OverlayView() {
  const p = usePlayer()
  const [dragging, setDragging] = useState(false)

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
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      const path = window.mmp.getPathForFile(file)
      if (path) window.mmp.loadFile(path)
    }
  }

  return (
    <div
      className={`app ${p.showUi ? 'ui-visible' : 'ui-hidden'} ${dragging ? 'dragging' : ''}`}
      onMouseMove={p.reveal}
      onDrop={onDrop}
      onDragOver={e => {
        e.preventDefault()
        if (!dragging) setDragging(true)
      }}
      onDragLeave={e => {
        if (e.relatedTarget === null) setDragging(false)
      }}
      onWheel={e => {
        p.setVolume(p.state.volume + (e.deltaY < 0 ? 5 : -5))
        p.reveal()
      }}
    >
      <TitleBar title={p.state.title} />
      <div className="video-surface" onClick={p.togglePause} onDoubleClick={p.fullscreen} />
      {!p.state.hasMedia && <EmptyState onOpen={p.openFile} />}
      <div className="drop-hint" />
    </div>
  )
}
