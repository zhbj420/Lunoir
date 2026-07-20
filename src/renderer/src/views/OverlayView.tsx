import { useEffect, useRef, useState } from 'react'
import { usePlayer, currentFrame } from '../usePlayer'
import { useShortcuts } from '../useShortcuts'
import { useT } from '../useT'
import TitleBar from '../components/TitleBar'
import EmptyState from '../components/EmptyState'
import type { MenuNode, SerializedMenuNode } from '../components/ContextMenu'

// Release filenames carry a tail of technical tags ("…S01E01.1080p.WEB-DL.AAC2.0
// .x264-CHDWEB") that only bloat a screenshot's name. Cut at the first such tag,
// keeping the parts a human cares about (title, season/episode, year).
const TECH_TAG =
  /[.\s_-](\d{3,4}p|4k|web-?dl|web-?rip|blu-?ray|bd-?rip|br-?rip|hdtv|remux|dvdrip|x26[45]|h\.?26[45]|hevc|avc|xvid|aac\d?|ac-?3|e-?ac-?3|ddp?\d?|dts(-hd)?|truehd|atmos|flac|opus|\d{1,2}bits?|hdr\d*\+?|dv|hi10p?|repack|proper|internal|\d+audio)/i

function cleanBaseName(fileName: string): string {
  let n = fileName.replace(/\.[^.]+$/, '') // drop the extension
  const m = n.match(TECH_TAG)
  if (m?.index) n = n.slice(0, m.index)
  n = n.replace(/[.\s_-]+$/, '') // trim trailing separators
  if (n.length > 50) n = n.slice(0, 50).replace(/[.\s_-]+$/, '') // hard backstop
  return n.replace(/%/g, '') // % starts a specifier in mpv's template
}

// Burn-in formatting — same maths as the OSC readout (non-drop HH:MM:SS:FF, frame
// index derived from time x container fps).
function fmtTc(frame: number, fps: number): string {
  const rate = Math.max(1, Math.round(fps) || 24)
  const f = Math.max(0, Math.floor(frame))
  const pad = (n: number): string => String(n).padStart(2, '0')
  const secs = Math.floor(f / rate)
  return [
    pad(Math.floor(secs / 3600)),
    pad(Math.floor((secs / 60) % 60)),
    pad(secs % 60),
    pad(f % rate)
  ].join(':')
}

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
  const t = useT()
  const p = usePlayer()
  const [dragging, setDragging] = useState(false)
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
    window.mmp.getSettings().then(s => {
      setScreenshotSubs(s.screenshotSubs)
      setTcOverlay(s.timecodeOverlay)
    })
    const offS = window.mmp.onSettingsChanged(s => {
      setScreenshotSubs(s.screenshotSubs)
      setTcOverlay(s.timecodeOverlay)
    })
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
  // Windows won't give a maximized window the acrylic backdrop, so the empty state
  // paints a solid fallback instead of showing through to black.
  useEffect(
    () => window.mmp.onMaximized(m => document.body.classList.toggle('maximized', m)),
    []
  )
  useEffect(() => {
    document.body.classList.toggle('has-media', p.state.hasMedia)
  }, [p.state.hasMedia])

  // the menu window hides the OSC, which would drop us into .ui-hidden (cursor:none)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tcOverlay, setTcOverlay] = useState(false)
  useEffect(() => window.mmp.onMenuState(setMenuOpen), [])

  // a click in the menu window comes back here as an id → run that item's handler
  useEffect(() => window.mmp.onMenuInvoke(id => menuActions.current.get(id)?.()), [])

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
    // Name it "<file>_<position>_<yymmdd>_<hhmmss>": the position comes first so a
    // movie's shots sort in playback order, and the capture date/time guarantees
    // uniqueness. Seconds are enough here — frame precision belongs on screen, not
    // in a filename. mpv's %t* are strftime, but position has to be computed here.
    const ts = Math.max(0, p.state.timePos)
    const pad = (n: number): string => String(n).padStart(2, '0')
    const pos = [
      pad(Math.floor(ts / 3600)),
      pad(Math.floor((ts / 60) % 60)),
      pad(Math.floor(ts % 60))
    ].join('-')
    const base = cleanBaseName(p.state.fileName) || '%F'
    window.mmp.set('screenshot-template', `${base}_${pos}_%ty%tm%td_%tH%tM%tS`)
    window.mmp.command(noSubs ? ['screenshot', 'video'] : ['screenshot'])
    showToast(t('toast.screenshotSaved'))
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
      ? t('menu.abStart')
      : p.state.abLoopB == null
        ? t('menu.abEnd')
        : t('menu.abClear')
  const menuItems: MenuNode[] = [
    { label: p.state.pause ? t('osc.play') : t('osc.pause'), onClick: p.togglePause },
    { sep: true },
    { label: t('menu.previous'), onClick: () => window.mmp.playPrev(), disabled: !multi },
    { label: t('menu.next'), onClick: () => window.mmp.playNext(), disabled: !multi },
    { label: t('menu.prevChapter'), onClick: () => window.mmp.command(['add', 'chapter', -1]), disabled: !hasChapters },
    { label: t('menu.nextChapter'), onClick: () => window.mmp.command(['add', 'chapter', 1]), disabled: !hasChapters },
    { sep: true },
    {
      label: t('menu.speed'),
      submenu: SPEEDS.map(v => ({
        label: v === 1 ? t('menu.speedNormal') : `${v}×`,
        checked: Math.abs(p.state.speed - v) < 0.01,
        onClick: () => {
          window.mmp.set('speed', v)
          showToast(v === 1 ? t('toast.speedNormal') : t('toast.speed', { v }))
        }
      }))
    },
    {
      label: t('menu.aspect'),
      // ratios (16:9…) name themselves; only Default and Stretch are words
      submenu: ASPECTS.map(a => ({
        label: a.key === 'default' ? t('common.default') : a.key === 'stretch' ? t('menu.aspectStretch') : a.label,
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
    { label: t('menu.screenshot'), onClick: () => screenshot(!screenshotSubs) },
    {
      label: t('menu.tcOverlay'),
      checked: tcOverlay,
      onClick: () => window.mmp.setSetting('timecodeOverlay', !tcOverlay)
    },
    { sep: true },
    { label: t('menu.openFile'), onClick: p.openFile },
    { label: t('menu.openUrl'), onClick: () => { setUrlText(''); setUrlOpen(true) } },
    { sep: true },
    { label: t('menu.fullscreen'), onClick: p.fullscreen }
  ]

  // The menu is its own window now, so it can only be handed plain data: pack the
  // tree (dropping the closures), remember each handler under the same id, and run
  // it when the menu window reports back what was clicked.
  const menuActions = useRef(new Map<string, () => void>())

  const openMenuWindow = (screenX: number, screenY: number): void => {
    menuActions.current.clear()
    const pack = (nodes: MenuNode[], prefix = ''): SerializedMenuNode[] =>
      nodes.map((n, i) => {
        const id = `${prefix}${i}`
        if (n.onClick) menuActions.current.set(id, n.onClick)
        return {
          id,
          label: n.label,
          disabled: n.disabled,
          checked: n.checked,
          sep: n.sep,
          submenu: n.submenu ? pack(n.submenu, `${id}.`) : undefined
        }
      })
    window.mmp.openMenu(screenX, screenY, pack(menuItems))
  }

  return (
    <div
      className={`app ${p.showUi ? 'ui-visible' : 'ui-hidden'} ${dragging ? 'dragging' : ''} ${menuOpen ? 'menu-open' : ''}`}
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
          openMenuWindow(e.screenX, e.screenY)
        }}
      />
      {/* loading (a URL/playlist resolving) hides the home screen right away — just
          the bare window + spinner, exactly like loading a single video; if it
          fails, end-file clears loading and the home screen comes back */}
      {!p.state.hasMedia && !loading && <EmptyState onOpen={p.openFile} />}

      {/* Always-on timecode + frame burn-in. Deliberately independent of the OSC's
          readout: the OSC auto-hides, and staring at frames is exactly when you
          need the numbers to stay put. */}
      {tcOverlay && p.state.hasMedia && (
        <div className="tc-burn">
          <span className="tc-main">{fmtTc(currentFrame(p.state), p.state.fps)}</span>
          <span className="tc-frame">{currentFrame(p.state)}</span>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <div className="loading-text">{t('toast.loading')}</div>
        </div>
      )}

      {/* both side panels are now their own acrylic windows (owned by main) */}

      <div
        className={`url-overlay ${urlOpen ? 'open' : ''}`}
        onMouseDown={() => setUrlOpen(false)}
      >
        <div className="url-box" onMouseDown={e => e.stopPropagation()}>
          <input
            ref={urlInputRef}
            className="url-input"
            spellCheck={false}
            placeholder={t('empty.urlPlaceholder')}
            value={urlText}
            onChange={e => setUrlText(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation() // don't fire player shortcuts while typing
              if (e.key === 'Enter') submitUrl()
              else if (e.key === 'Escape') setUrlOpen(false)
            }}
          />
          <button className="url-go" onClick={submitUrl} title={t('empty.urlPlay')}>
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
