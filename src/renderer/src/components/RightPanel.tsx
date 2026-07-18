import { useEffect, useState } from 'react'

type Tab = 'playlist' | 'chapters' | 'tracks'
type RepeatMode = 'off' | 'all' | 'one'
interface Playlist {
  items: { path: string; name: string }[]
  index: number
  repeat: RepeatMode
}
interface Chapter {
  title?: string
  time: number
}
interface Track {
  id: number
  type: string // 'video' | 'audio' | 'sub'
  title?: string
  lang?: string
  codec?: string
  external?: boolean
}

// image/bitmap subtitle codecs: no glyphs to restyle, so size/brightness don't
// apply (only position + delay do). mpv reports these in the track codec field.
const IMAGE_SUB_CODECS = new Set([
  'hdmv_pgs_subtitle',
  'pgssub',
  'dvd_subtitle',
  'dvdsub',
  'vobsub',
  'dvb_subtitle',
  'dvbsub',
  'dvb_teletext'
])

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0
  const s = Math.floor(t % 60)
  const m = Math.floor((t / 60) % 60)
  const h = Math.floor(t / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// set a native tooltip only when the text is actually clipped, so short rows
// don't show a redundant hover bubble
function clipTitle(el: HTMLElement): void {
  el.title = el.scrollWidth > el.clientWidth + 1 ? el.textContent || '' : ''
}

// full inline label (MPC-HC style, minus the "S:" prefix and the right column):
// "Simplified, Singapore [chi] (subrip)"
function trackFull(t: Track): string {
  const parts: string[] = []
  if (t.title) parts.push(t.title)
  if (t.lang) parts.push(`[${t.lang}]`)
  if (t.codec) parts.push(`(${t.codec})`)
  return parts.join(' ') || `Track ${t.id}`
}

const round1 = (v: number): number => Math.round(v * 10) / 10
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

// signed, one decimal, proper minus glyph: "+0.3s", "−0.2s", "0.0s"
function fmtDelay(v: number): string {
  const r = round1(v)
  const sign = r > 0 ? '+' : r < 0 ? '−' : ''
  return `${sign}${Math.abs(r).toFixed(1)}s`
}

const Check = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 6.5 L5 9 L9.5 3.5" />
  </svg>
)
const IconMinus = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M4 8h8" />
  </svg>
)
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <path d="M8 4v8M4 8h8" />
  </svg>
)
const IconUp = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 12V4M4.5 7.5 8 4l3.5 3.5" />
  </svg>
)
const IconDown = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 4v8M4.5 8.5 8 12l3.5-3.5" />
  </svg>
)
const IconReset = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
)

// A single label + stepper + reset row. `variant` picks the stepper glyphs:
// 'delay'/'scale' use −/+, 'pos' uses ↑/↓ (and hides the numeric readout, since
// sub-pos's 0–100 number isn't meaningful). onStep(dir): -1 = left/up button.
function AdjustRow({
  label,
  variant,
  display,
  offset,
  disabled,
  leftTitle,
  rightTitle,
  onStep,
  onReset
}: {
  label: string
  variant: 'step' | 'pos'
  display?: string | null
  offset: boolean
  disabled?: boolean
  leftTitle?: string
  rightTitle?: string
  onStep: (dir: -1 | 1) => void
  onReset: () => void
}) {
  const Left = variant === 'pos' ? IconUp : IconMinus
  const Right = variant === 'pos' ? IconDown : IconPlus
  return (
    <div className={`adjust-row ${offset && !disabled ? 'offset' : ''} ${disabled ? 'disabled' : ''}`}>
      <span className="adjust-label">{label}</span>
      <div className="adjust-stepper">
        <button className="adjust-btn" title={leftTitle} disabled={disabled} onClick={() => onStep(-1)}>
          <Left />
        </button>
        {display != null ? <span className="adjust-val">{display}</span> : <span className="adjust-div" />}
        <button className="adjust-btn" title={rightTitle} disabled={disabled} onClick={() => onStep(1)}>
          <Right />
        </button>
      </div>
      <button className="adjust-reset" title="Reset" disabled={disabled || !offset} onClick={onReset}>
        <IconReset />
      </button>
    </div>
  )
}

const Chevron = () => (
  <svg className="chev" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6l4 4 4-4" />
  </svg>
)

// The right-hand context panel. Tabs: Playlist, Chapters, Audio & Sub.
export default function RightPanel({ open }: { open: boolean }) {
  const [tab, setTab] = useState<Tab>('playlist')
  const [pl, setPl] = useState<Playlist>({ items: [], index: -1, repeat: 'off' })
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [curChapter, setCurChapter] = useState(-1)
  const [tracks, setTracks] = useState<Track[]>([])
  const [aid, setAid] = useState<number | false>(false)
  const [sid, setSid] = useState<number | false>(false)
  const [audioDelay, setAudioDelay] = useState(0)
  const [subDelay, setSubDelay] = useState(0)
  const [subPos, setSubPos] = useState(100) // sub-pos, 0 (top) – 100 (bottom)
  const [subScale, setSubScale] = useState(1) // sub-scale multiplier
  const [subBright, setSubBright] = useState(100) // % of white; local (sub-color)
  const [subAdjOpen, setSubAdjOpen] = useState(false)

  // playlist state, pushed from main
  useEffect(() => {
    let mounted = true
    window.mmp.getPlaylist().then(p => mounted && setPl(p))
    return window.mmp.onPlaylistChanged(p => setPl(p))
  }, [])

  // chapters: fetch on mount / file change, and follow live position
  useEffect(() => {
    let mounted = true
    const refresh = async () => {
      try {
        const list = await window.mmp.command(['get_property', 'chapter-list'])
        if (mounted) setChapters(Array.isArray(list) ? list : [])
      } catch {
        if (mounted) setChapters([])
      }
      try {
        const c = await window.mmp.command(['get_property', 'chapter'])
        if (mounted) setCurChapter(typeof c === 'number' ? c : -1)
      } catch {
        if (mounted) setCurChapter(-1)
      }
    }
    refresh()
    const off = window.mmp.onProperty(({ name, data }) => {
      if (name === 'chapter') setCurChapter(typeof data === 'number' ? data : -1)
      else if (name === 'chapter-list') setChapters(Array.isArray(data) ? (data as Chapter[]) : [])
      else if (name === 'path' || name === 'filename') refresh()
    })
    return () => {
      mounted = false
      off()
    }
  }, [])

  // tracks (audio + subtitle) + delay/pos/scale: fetch on mount / file change,
  // follow live changes. sub-color (brightness) is kept locally, not read back.
  useEffect(() => {
    let mounted = true
    const num = async (prop: string, set: (n: number) => void, fallback: number) => {
      try {
        const v = await window.mmp.command(['get_property', prop])
        if (mounted) set(typeof v === 'number' ? v : fallback)
      } catch {
        if (mounted) set(fallback)
      }
    }
    const refresh = async () => {
      try {
        const list = await window.mmp.command(['get_property', 'track-list'])
        if (mounted) setTracks(Array.isArray(list) ? list : [])
      } catch {
        if (mounted) setTracks([])
      }
      try {
        const a = await window.mmp.command(['get_property', 'aid'])
        if (mounted) setAid(typeof a === 'number' ? a : false)
      } catch {
        if (mounted) setAid(false)
      }
      try {
        const s = await window.mmp.command(['get_property', 'sid'])
        if (mounted) setSid(typeof s === 'number' ? s : false)
      } catch {
        if (mounted) setSid(false)
      }
      num('audio-delay', setAudioDelay, 0)
      num('sub-delay', setSubDelay, 0)
      num('sub-pos', setSubPos, 100)
      num('sub-scale', setSubScale, 1)
    }
    refresh()
    const off = window.mmp.onProperty(({ name, data }) => {
      if (name === 'track-list') setTracks(Array.isArray(data) ? (data as Track[]) : [])
      else if (name === 'aid') setAid(typeof data === 'number' ? data : false)
      else if (name === 'sid') setSid(typeof data === 'number' ? data : false)
      else if (name === 'audio-delay') setAudioDelay(typeof data === 'number' ? data : 0)
      else if (name === 'sub-delay') setSubDelay(typeof data === 'number' ? data : 0)
      else if (name === 'sub-pos') setSubPos(typeof data === 'number' ? data : 100)
      else if (name === 'sub-scale') setSubScale(typeof data === 'number' ? data : 1)
      else if (name === 'path' || name === 'filename') refresh()
    })
    return () => {
      mounted = false
      off()
    }
  }, [])

  const repeat: RepeatMode = pl.repeat
  const audioTracks = tracks.filter(t => t.type === 'audio')
  const subTracks = tracks.filter(t => t.type === 'sub')

  const hasSub = sid !== false
  const activeSub = subTracks.find(t => t.id === sid)
  const isImageSub = !!activeSub && IMAGE_SUB_CODECS.has((activeSub.codec || '').toLowerCase())

  // audio delay
  const stepAudioDelay = (dir: -1 | 1): void => {
    const v = round1(audioDelay + dir * 0.1)
    setAudioDelay(v)
    window.mmp.set('audio-delay', v)
  }
  const resetAudioDelay = (): void => {
    setAudioDelay(0)
    window.mmp.set('audio-delay', 0)
  }
  // subtitle delay
  const stepSubDelay = (dir: -1 | 1): void => {
    const v = round1(subDelay + dir * 0.1)
    setSubDelay(v)
    window.mmp.set('sub-delay', v)
  }
  const resetSubDelay = (): void => {
    setSubDelay(0)
    window.mmp.set('sub-delay', 0)
  }
  // subtitle vertical position (↑ = up = lower sub-pos)
  const stepSubPos = (dir: -1 | 1): void => {
    const v = clamp(subPos + dir, 0, 100)
    setSubPos(v)
    window.mmp.set('sub-pos', v)
  }
  const resetSubPos = (): void => {
    setSubPos(100)
    window.mmp.set('sub-pos', 100)
  }
  // subtitle size
  const stepSubScale = (dir: -1 | 1): void => {
    const v = clamp(round1(subScale + dir * 0.1), 0.3, 3)
    setSubScale(v)
    window.mmp.set('sub-scale', v)
  }
  const resetSubScale = (): void => {
    setSubScale(1)
    window.mmp.set('sub-scale', 1)
  }
  // subtitle brightness: dim the fill from white toward grey (fixes HDR-blown subs)
  const applyBright = (pct: number): void => {
    const c = (pct / 100).toFixed(2)
    window.mmp.set('sub-color', `${c}/${c}/${c}`)
  }
  const stepSubBright = (dir: -1 | 1): void => {
    const v = clamp(subBright + dir * 10, 10, 100)
    setSubBright(v)
    applyBright(v)
  }
  const resetSubBright = (): void => {
    setSubBright(100)
    window.mmp.set('sub-color', '1.0/1.0/1.0')
  }

  const subOffset =
    Math.round(subDelay * 10) !== 0 ||
    subPos !== 100 ||
    Math.round(subScale * 100) !== 100 ||
    subBright !== 100

  return (
    // The panel lives inside the main window's .app, whose onMouseMove/onWheel
    // reveal the OSC and change volume. Stop those events here so interacting
    // with the panel (moving over it, clicking steppers, scrolling the list)
    // doesn't leak out to the video UI.
    <div
      className={`panel ${open ? 'open' : ''}`}
      onMouseMove={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div className="panel-tabs">
        <button className={`panel-tab ${tab === 'playlist' ? 'active' : ''}`} onClick={() => setTab('playlist')}>
          Playlist
        </button>
        <button className={`panel-tab ${tab === 'chapters' ? 'active' : ''}`} onClick={() => setTab('chapters')}>
          Chapters
        </button>
        <button className={`panel-tab ${tab === 'tracks' ? 'active' : ''}`} onClick={() => setTab('tracks')}>
          Audio &amp; Sub
        </button>
        <span className="panel-tabs-spacer" />
      </div>

      {tab === 'playlist' && (
        <>
          <div className="panel-body">
            {pl.items.length === 0 ? (
              <div className="panel-empty">Nothing queued</div>
            ) : (
              pl.items.map((it, i) => (
                <div
                  key={it.path}
                  className={`pl-item ${i === pl.index ? 'active' : ''}`}
                  title={it.name}
                  onClick={() => window.mmp.playIndex(i)}
                >
                  <span className="pl-mark">
                    {i === pl.index ? (
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
                        <path d="M1 0.5 L8 4.5 L1 8.5 Z" />
                      </svg>
                    ) : (
                      <span className="pl-idx">{i + 1}</span>
                    )}
                  </span>
                  <span className="pl-name">{it.name}</span>
                </div>
              ))
            )}
          </div>

          <div className="panel-tools">
            <button
              className={`tool ${repeat !== 'off' ? 'on' : ''}`}
              title={repeat === 'off' ? 'Repeat: off' : repeat === 'all' ? 'Repeat: all' : 'Repeat: one'}
              onClick={() => window.mmp.cycleRepeat()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3l3 3-3 3" />
                <path d="M20 6H8a4 4 0 0 0-4 4v1" />
                <path d="M7 21l-3-3 3-3" />
                <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
              </svg>
              {repeat === 'one' && <span className="tool-badge">1</span>}
            </button>
            <button className="tool" title="Shuffle" onClick={() => window.mmp.shufflePlaylist()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 4l3 3-3 3" />
                <path d="M3 20h4c1.3 0 2.5-.6 3.3-1.7L15 11" />
                <path d="M3 7h4c1.3 0 2.5.6 3.3 1.7l.7 1" />
                <path d="M18 20l3-3-3-3" />
                <path d="M21 17h-4c-.9 0-1.8-.3-2.5-.9" />
              </svg>
            </button>
            <span className="panel-tools-spacer" />
            <button className="tool" title="Add files" onClick={() => window.mmp.addToPlaylist()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              className="tool"
              title="Remove current"
              disabled={pl.index < 0}
              onClick={() => pl.index >= 0 && window.mmp.removeFromPlaylist(pl.index)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16" />
                <path d="M6 7l1 13h10l1-13" />
                <path d="M9 7V4h6v3" />
              </svg>
            </button>
          </div>
        </>
      )}

      {tab === 'chapters' && (
        <div className="panel-body">
          {chapters.length === 0 ? (
            <div className="panel-empty">No chapters</div>
          ) : (
            chapters.map((ch, i) => (
              <div
                key={i}
                className={`pl-item ${i === curChapter ? 'active' : ''}`}
                onClick={() => window.mmp.set('chapter', i)}
              >
                <span className="pl-mark">
                  {i === curChapter ? (
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
                      <path d="M1 0.5 L8 4.5 L1 8.5 Z" />
                    </svg>
                  ) : (
                    <span className="pl-idx">{i + 1}</span>
                  )}
                </span>
                <span className="pl-name">{ch.title || `Chapter ${i + 1}`}</span>
                <span className="pl-time">{fmt(ch.time)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'tracks' && (
        <>
          <div className="panel-body">
            <div className="track-sec">Audio</div>
            {audioTracks.length === 0 ? (
              <div className="track-empty">No audio tracks</div>
            ) : (
              audioTracks.map(t => (
                <div
                  key={`a${t.id}`}
                  className={`pl-item ${t.id === aid ? 'active' : ''}`}
                  onClick={() => window.mmp.set('aid', t.id)}
                >
                  <span className="pl-mark">{t.id === aid ? <Check /> : null}</span>
                  <span className="pl-name" onMouseEnter={e => clipTitle(e.currentTarget)}>
                    {trackFull(t)}
                  </span>
                </div>
              ))
            )}
            <AdjustRow
              label="Delay"
              variant="step"
              display={fmtDelay(audioDelay)}
              offset={Math.round(audioDelay * 10) !== 0}
              disabled={audioTracks.length === 0}
              leftTitle="Earlier (−0.1s)"
              rightTitle="Later (+0.1s)"
              onStep={stepAudioDelay}
              onReset={resetAudioDelay}
            />

            <div className="track-sec">Subtitles</div>
            <div
              className={`pl-item ${sid === false ? 'active' : ''}`}
              onClick={() => window.mmp.set('sid', 'no')}
            >
              <span className="pl-mark">{sid === false ? <Check /> : null}</span>
              <span className="pl-name">None</span>
            </div>
            {subTracks.map(t => (
              <div
                key={`s${t.id}`}
                className={`pl-item ${t.id === sid ? 'active' : ''}`}
                onClick={() => window.mmp.set('sid', t.id)}
              >
                <span className="pl-mark">{t.id === sid ? <Check /> : null}</span>
                <span className="pl-name" onMouseEnter={e => clipTitle(e.currentTarget)}>
                  {trackFull(t)}
                </span>
              </div>
            ))}

            <button className="track-add" onClick={() => window.mmp.addSubtitle()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add subtitle…
            </button>
          </div>

          {/* pinned, collapsible subtitle-adjust footer — always reachable no
              matter how long the track list is */}
          <div className={`sub-adjust ${subAdjOpen ? 'open' : ''}`}>
            <button className="sub-adjust-head" onClick={() => setSubAdjOpen(o => !o)}>
              <Chevron />
              <span className="sub-adjust-label">Adjust</span>
              {!subAdjOpen && subOffset && <span className="sub-adjust-dot" title="Adjustments active" />}
            </button>
            <div className="sub-adjust-anim">
              <div className="sub-adjust-body">
                <AdjustRow
                  label="Delay"
                  variant="step"
                  display={fmtDelay(subDelay)}
                  offset={Math.round(subDelay * 10) !== 0}
                  disabled={!hasSub}
                  leftTitle="Earlier (−0.1s)"
                  rightTitle="Later (+0.1s)"
                  onStep={stepSubDelay}
                  onReset={resetSubDelay}
                />
                <AdjustRow
                  label="Position"
                  variant="pos"
                  display={null}
                  offset={subPos !== 100}
                  disabled={!hasSub}
                  leftTitle="Move up"
                  rightTitle="Move down"
                  onStep={stepSubPos}
                  onReset={resetSubPos}
                />
                <AdjustRow
                  label="Size"
                  variant="step"
                  display={`${Math.round(subScale * 100)}%`}
                  offset={Math.round(subScale * 100) !== 100}
                  disabled={!hasSub || isImageSub}
                  leftTitle="Smaller"
                  rightTitle="Larger"
                  onStep={stepSubScale}
                  onReset={resetSubScale}
                />
                <AdjustRow
                  label="Brightness"
                  variant="step"
                  display={`${subBright}%`}
                  offset={subBright !== 100}
                  disabled={!hasSub || isImageSub}
                  leftTitle="Dimmer"
                  rightTitle="Brighter"
                  onStep={stepSubBright}
                  onReset={resetSubBright}
                />
                {isImageSub && (
                  <div className="sub-adjust-hint">Image subtitle — position &amp; delay only</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
