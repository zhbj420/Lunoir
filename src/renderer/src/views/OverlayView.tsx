import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../usePlayer'
import { useShortcuts } from '../useShortcuts'
import TitleBar from '../components/TitleBar'
import EmptyState from '../components/EmptyState'
import RightPanel from '../components/RightPanel'

// Main window: title bar, empty state, video-surface gestures, side panels. The
// OSC lives in the separate acrylic window (OscView).
export default function OverlayView() {
  const p = usePlayer()
  const [dragging, setDragging] = useState(false)
  const [panel, setPanel] = useState<string | null>(null)
  const lastY = useRef(-1)
  const downAccum = useRef(0)

  // Reveal the UI only when the pointer heads toward the controls — moving down
  // a bit, or near the top (title) / bottom (OSC) edges — not on every twitch.
  const onMove = (e: React.MouseEvent) => {
    const y = e.clientY
    const h = window.innerHeight
    if (lastY.current >= 0) {
      const dy = y - lastY.current
      downAccum.current = dy > 0 ? downAccum.current + dy : 0
    }
    lastY.current = y
    if (y > h - 150 || y < 46 || downAccum.current > 60) {
      downAccum.current = 0
      p.reveal()
    }
  }

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

  // OSC buttons (in the acrylic window) toggle side panels via main
  useEffect(() => window.mmp.onPanelToggle(name => setPanel(cur => (cur === name ? null : name))), [])

  // grey title strip only over video; hide it (and the reserved margin) fullscreen
  useEffect(() => window.mmp.onFullscreen(fs => document.body.classList.toggle('fullscreen', fs)), [])
  useEffect(() => {
    document.body.classList.toggle('has-media', p.state.hasMedia)
  }, [p.state.hasMedia])

  // tell main whether a panel is open so the OSC moves out of its way
  useEffect(() => window.mmp.setPanelState(panel !== null), [panel])

  // Esc closes an open panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panel) setPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel])

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
      onMouseMove={onMove}
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
      <RightPanel open={panel === 'playlist'} />
      <div className="drop-hint" />
    </div>
  )
}
