import { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../usePlayer'
import { useShortcuts } from '../useShortcuts'
import TitleBar from '../components/TitleBar'
import EmptyState from '../components/EmptyState'
import ContextMenu, { MenuNode } from '../components/ContextMenu'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

// video-aspect-override values for the Aspect submenu. Stretch drops keepaspect.
const ASPECTS: { key: string; label: string; apply: () => void }[] = [
  { key: 'default', label: 'Default', apply: () => { window.mmp.set('keepaspect', true); window.mmp.set('video-aspect-override', -1) } },
  { key: '16:9', label: '16:9', apply: () => { window.mmp.set('keepaspect', true); window.mmp.set('video-aspect-override', '16:9') } },
  { key: '4:3', label: '4:3', apply: () => { window.mmp.set('keepaspect', true); window.mmp.set('video-aspect-override', '4:3') } },
  { key: '2.35', label: '2.35:1', apply: () => { window.mmp.set('keepaspect', true); window.mmp.set('video-aspect-override', '2.35') } },
  { key: 'stretch', label: 'Stretch to fill', apply: () => window.mmp.set('keepaspect', false) }
]

// Main window: title bar, empty state, video-surface gestures, side panels. The
// OSC lives in the separate acrylic window (OscView).
export default function OverlayView() {
  const p = usePlayer()
  const [dragging, setDragging] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [plCount, setPlCount] = useState(0)
  const [hasChapters, setHasChapters] = useState(false)
  const [aspect, setAspect] = useState('default')
  const [toast, setToast] = useState<string | null>(null)
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlText, setUrlText] = useState('')
  const [screenshotSubs, setScreenshotSubs] = useState(true)
  const [loading, setLoading] = useState(false)
  const [volToast, setVolToast] = useState<number | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const volToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const lastY = useRef(-1)
  const downAccum = useRef(0)
  const entering = useRef(false)
  const enterY = useRef(-1)

  const showToast = (msg: string): void => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }

  // wheel-volume shows a compact volume OSD (icon + bar + number), not the OSC
  const showVolToast = (v: number): void => {
    setVolToast(v)
    if (volToastTimer.current) clearTimeout(volToastTimer.current)
    volToastTimer.current = setTimeout(() => setVolToast(null), 1000)
  }

  // playlist size (for enabling Prev/Next) and whether the file has chapters
  useEffect(() => {
    window.mmp.getPlaylist().then(pl => setPlCount(pl.items.length))
    return window.mmp.onPlaylistChanged(pl => setPlCount(pl.items.length))
  }, [])
  useEffect(() => {
    const check = async (): Promise<void> => {
      try {
        const list = await window.mmp.command(['get_property', 'chapter-list'])
        setHasChapters(Array.isArray(list) && list.length > 0)
      } catch {
        setHasChapters(false)
      }
    }
    check()
    return window.mmp.onProperty(({ name, data }) => {
      if (name === 'chapter-list') setHasChapters(Array.isArray(data) && (data as unknown[]).length > 0)
      else if (name === 'path' || name === 'filename') check()
    })
  }, [])
  // track the screenshot-subtitles setting (the menu's Screenshot uses it); relay
  // toasts pushed from main (e.g. "Resumed from …")
  useEffect(() => {
    window.mmp.getSettings().then(s => setScreenshotSubs(s.screenshotSubs))
    const offS = window.mmp.onSettingsChanged(s => setScreenshotSubs(s.screenshotSubs))
    const offT = window.mmp.onToast(showToast)
    const offL = window.mmp.onLoading(setLoading)
    return () => {
      offS()
      offT()
      offL()
    }
  }, [])

  // Reveal the UI only when the pointer heads toward the controls — moving down
  // a bit, or near the top (title) / bottom (OSC) edges — not on every twitch.
  const onMove = (e: React.MouseEvent) => {
    const x = e.clientX
    const y = e.clientY
    const h = window.innerHeight
    // Returning to the window (pointer came from outside) shouldn't pop the OSC.
    // A single small nudge on re-entry isn't intent — and if you enter into the
    // top/bottom edge zone, the edge check below would fire immediately. So after
    // entry, suppress every reveal until the pointer has genuinely moved away
    // (>50px) from where it came in.
    if (entering.current) {
      if (enterY.current < 0) {
        enterY.current = y // anchor at the entry point
        lastY.current = y
        return
      }
      if (Math.abs(y - enterY.current) < 50) {
        lastY.current = y
        return
      }
      entering.current = false // moved enough — resume normal reveal (but not on this move)
      lastY.current = y
      downAccum.current = 0
      return
    }
    if (lastY.current >= 0) {
      const dy = y - lastY.current
      downAccum.current = dy > 0 ? downAccum.current + dy : 0
    }
    lastY.current = y
    // bottom reveal only in the centre band (where the OSC sits), so coming in
    // from a bottom corner / the taskbar doesn't pop it. Top strip stays full
    // width (need to reach the window buttons anywhere along it).
    const w = window.innerWidth
    const bottomCentre = y > h - 150 && x > w * 0.2 && x < w * 0.8
    if (bottomCentre || y < 46 || downAccum.current > 100) {
      downAccum.current = 0
      p.reveal()
    }
  }

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

  // (both side panels are now their own acrylic windows, owned + toggled by main)

  // grey title strip only over video; hide it (and the reserved margin) fullscreen
  useEffect(() => window.mmp.onFullscreen(fs => document.body.classList.toggle('fullscreen', fs)), [])
  useEffect(() => {
    document.body.classList.toggle('has-media', p.state.hasMedia)
  }, [p.state.hasMedia])

  // hide the OSC (a separate window on top) while the context menu is open
  useEffect(() => {
    window.mmp.setMenuOpen(menu !== null)
  }, [menu])
  // the URL overlay stays mounted (so it can fade in/out) — focus its input on open
  useEffect(() => {
    if (urlOpen) urlInputRef.current?.focus()
  }, [urlOpen])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      const path = window.mmp.getPathForFile(file)
      if (path) window.mmp.loadFile(path)
    }
  }

  // mpv screenshots the decoded frame at its native resolution (window size
  // irrelevant); the OSC/UI never appear (they're a separate window / compositor
  // layer). 'video' mode drops subtitles, default keeps them.
  const screenshot = (noSubs: boolean): void => {
    window.mmp.command(noSubs ? ['screenshot', 'video'] : ['screenshot'])
    showToast('Screenshot saved to Pictures › Lunoir')
  }

  const submitUrl = (): void => {
    const u = urlText.trim()
    if (u) window.mmp.loadFile(u)
    setUrlOpen(false)
  }

  // right-click menu contents (built fresh each render from live state)
  const multi = plCount > 1
  // A-B loop cycles: no A → set A, A set → set B, both set → clear (mpv 'ab-loop')
  const abLabel =
    p.state.abLoopA == null
      ? 'A-B loop: set start (A)'
      : p.state.abLoopB == null
        ? 'A-B loop: set end (B)'
        : 'A-B loop: clear'
  const menuItems: MenuNode[] = [
    { label: p.state.pause ? 'Play' : 'Pause', onClick: p.togglePause },
    { sep: true },
    { label: 'Previous', onClick: () => window.mmp.playPrev(), disabled: !multi },
    { label: 'Next', onClick: () => window.mmp.playNext(), disabled: !multi },
    { label: 'Previous chapter', onClick: () => window.mmp.command(['add', 'chapter', -1]), disabled: !hasChapters },
    { label: 'Next chapter', onClick: () => window.mmp.command(['add', 'chapter', 1]), disabled: !hasChapters },
    { sep: true },
    {
      label: 'Speed',
      submenu: SPEEDS.map(v => ({
        label: v === 1 ? 'Normal' : `${v}×`,
        checked: Math.abs(p.state.speed - v) < 0.01,
        onClick: () => {
          window.mmp.set('speed', v)
          showToast(v === 1 ? 'Normal speed' : `Speed ${v}×`)
        }
      }))
    },
    {
      label: 'Aspect ratio',
      submenu: ASPECTS.map(a => ({
        label: a.label,
        checked: aspect === a.key,
        onClick: () => {
          setAspect(a.key)
          a.apply()
        }
      }))
    },
    { sep: true },
    { label: abLabel, checked: p.state.abLoopA != null && p.state.abLoopB != null, onClick: () => window.mmp.command(['ab-loop']) },
    { sep: true },
    { label: 'Screenshot', onClick: () => screenshot(!screenshotSubs) },
    { sep: true },
    { label: 'Open file…', onClick: p.openFile },
    { label: 'Open URL…', onClick: () => { setUrlText(''); setUrlOpen(true) } },
    { sep: true },
    { label: 'Fullscreen', onClick: p.fullscreen }
  ]

  return (
    <div
      className={`app ${p.showUi ? 'ui-visible' : 'ui-hidden'} ${dragging ? 'dragging' : ''}`}
      onMouseEnter={() => {
        entering.current = true
        enterY.current = -1
      }}
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
        // adjust volume without popping the OSC. When the OSC is hidden, show a
        // volume toast; when it's already up, its own number shows instead.
        const v = Math.round(Math.min(150, Math.max(0, p.state.volume + (e.deltaY < 0 ? 5 : -5))))
        p.setVolume(v)
        if (!p.showUi) showVolToast(v)
      }}
    >
      <TitleBar title={p.state.title} />
      <div
        className="video-surface"
        onClick={p.togglePause}
        onDoubleClick={p.fullscreen}
        onContextMenu={e => {
          // right-click menu only during playback (empty state keeps its URL shortcut)
          if (!p.state.hasMedia) return
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
      />
      {/* loading (a URL/playlist resolving) hides the home screen right away — just
          the bare window + spinner, exactly like loading a single video; if it
          fails, end-file clears loading and the home screen comes back */}
      {!p.state.hasMedia && !loading && <EmptyState onOpen={p.openFile} />}

      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <div className="loading-text">Loading…</div>
        </div>
      )}

      {/* both side panels are now their own acrylic windows (owned by main) */}

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}

      <div
        className={`url-overlay ${urlOpen ? 'open' : ''}`}
        onMouseDown={() => setUrlOpen(false)}
      >
        <div className="url-box" onMouseDown={e => e.stopPropagation()}>
          <input
            ref={urlInputRef}
            className="url-input"
            spellCheck={false}
            placeholder="Paste a video or stream URL…"
            value={urlText}
            onChange={e => setUrlText(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation() // don't fire player shortcuts while typing
              if (e.key === 'Enter') submitUrl()
              else if (e.key === 'Escape') setUrlOpen(false)
            }}
          />
          <button className="url-go" onClick={submitUrl} title="Play">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M8 5 L18 12 L8 19 Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {volToast !== null && (
        <div className="vol-toast">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            {volToast === 0 ? (
              <>
                <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="currentColor" />
                <path d="M16.5 9 L21.5 15 M21.5 9 L16.5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </>
            ) : (
              <>
                <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="currentColor" />
                <path d="M15.5 8.5 Q17.5 12 15.5 15.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M18 6 Q21.2 12 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </>
            )}
          </svg>
          <div className="vol-toast-bar">
            <div className="vol-toast-fill" style={{ width: `${Math.min(100, volToast)}%` }} />
          </div>
          <span className="vol-toast-num">{volToast}</span>
        </div>
      )}

      <div className="drop-hint" />
    </div>
  )
}
