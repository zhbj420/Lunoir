import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Mirrors main/settings.ts (the renderer defines its own view of shared shapes,
// like the other components here).
interface Settings {
  scanFolderIntoPlaylist: boolean
  resumePlayback: boolean
  resumePlaylistItem: boolean
  keepPitch: boolean
  audioLang: string
  subLang: string
  subsDefaultOn: boolean
  autoLoadSubs: boolean
  audioPassthrough: boolean
  passthroughCodecs: string
  oscHideDelay: number
  subHdrPeak: number
  hwdec: 'auto' | 'auto-copy' | 'no'
  streamQuality: 'best' | '2160' | '1080' | '720' | '480'
  useCookies: boolean
  cookiesBrowser: string
  screenshotSubs: boolean
  screenshotFormat: 'png' | 'jpg'
  screenshotDir: string
  rememberWindow: boolean
  rememberVolume: boolean
  volume: number
  windowBounds: { x: number; y: number; width: number; height: number } | null
}

type Opt = { value: string; label: string }

// Short, value-dependent explanation shown under Hardware decoding.
const HWDEC_DESC: Record<Settings['hwdec'], string> = {
  auto: 'GPU decoding, most efficient — frames stay in video memory.',
  'auto-copy': 'GPU decoding, copied to RAM — needed for CPU filters like SVP.',
  no: 'CPU (software) decoding — most compatible, but heavier.'
}

const HWDEC_OPTS: Opt[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'auto-copy', label: 'Auto (copy back)' },
  { value: 'no', label: 'Off (software)' }
]
const QUALITY_OPTS: Opt[] = [
  { value: 'best', label: 'Best' },
  { value: '2160', label: '2160p (4K)' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' }
]
const SCREENSHOT_FMT_OPTS: Opt[] = [
  { value: 'png', label: 'PNG (lossless)' },
  { value: 'jpg', label: 'JPG (high quality)' }
]
// mpv audio-spdif codec names → human labels (Atmos rides on TrueHD, DTS:X on DTS-HD)
const PASSTHROUGH_CODECS = [
  { code: 'ac3', label: 'Dolby Digital (AC-3)' },
  { code: 'eac3', label: 'Dolby Digital Plus' },
  { code: 'truehd', label: 'Dolby TrueHD / Atmos' },
  { code: 'dts', label: 'DTS' },
  { code: 'dts-hd', label: 'DTS-HD / DTS:X' }
]
const BROWSER_OPTS: Opt[] = [
  { value: 'edge', label: 'Edge' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'brave', label: 'Brave' },
  { value: 'opera', label: 'Opera' }
]
// language codes match track tags (a few carry variants, e.g. Chinese chi/zho)
const LANG_OPTS: Opt[] = [
  { value: '', label: 'Default' },
  { value: 'eng', label: 'English' },
  { value: 'chi,zho', label: 'Chinese' },
  { value: 'jpn', label: 'Japanese' },
  { value: 'kor', label: 'Korean' },
  { value: 'fre', label: 'French' },
  { value: 'ger', label: 'German' },
  { value: 'spa', label: 'Spanish' },
  { value: 'ita', label: 'Italian' },
  { value: 'rus', label: 'Russian' },
  { value: 'por', label: 'Portuguese' }
]

// Custom dropdown — native <select> popups render broken in this frameless window.
// The list is portaled to <body> (escaping the panel's transform + overflow) and
// positioned at the trigger via fixed coords; it closes on outside click / scroll.
function Select({ value, options, onChange }: { value: string; options: Opt[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const label = options.find(o => o.value === value)?.label ?? value

  const openMenu = (): void => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const listH = options.length * 30 + 8
    const up = r.bottom + listH > window.innerHeight - 8
    setBox({ top: up ? r.top - listH - 4 : r.bottom + 4, left: r.left, width: r.width })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (): void => setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('wheel', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('wheel', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        className={`set-dropdown ${open ? 'open' : ''}`}
        onMouseDown={e => e.stopPropagation()}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span className="set-dropdown-label">{label}</span>
        <svg className="set-dropdown-chev" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open &&
        box &&
        createPortal(
          <div
            className="set-dropdown-list"
            style={{ top: box.top, left: box.left, minWidth: box.width }}
            onMouseDown={e => e.stopPropagation()}
          >
            {options.map(o => (
              <button
                key={o.value}
                className={`set-dropdown-item ${o.value === value ? 'sel' : ''}`}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}

// A small editable number field: type + Enter/blur commits (clamped to [min,max]).
function NumInput({
  value,
  min,
  max,
  onChange
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const [text, setText] = useState<string | null>(null)
  const commit = (): void => {
    if (text === null) return
    const n = parseInt(text, 10)
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
    setText(null)
  }
  return (
    <input
      className="set-num-input"
      type="text"
      inputMode="numeric"
      value={text !== null ? text : String(value)}
      onChange={e => setText(e.target.value)}
      onFocus={e => {
        setText(String(value))
        e.currentTarget.select()
      }}
      onBlur={commit}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          commit()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          setText(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`switch ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    >
      <span className="switch-knob" />
    </button>
  )
}

// A labelled row: title + optional description on the left, a control on the right.
function Row({
  label,
  desc,
  children
}: {
  label: string
  desc?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="set-row">
      <div className="set-text">
        <div className="set-label">{label}</div>
        {desc && <div className="set-desc">{desc}</div>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  )
}

// Left-hand settings panel (opened from the OSC gear). Reads/writes settings via
// the main process; changes apply immediately.
export default function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [s, setS] = useState<Settings | null>(null)
  const [pathEdit, setPathEdit] = useState<string | null>(null) // non-null while typing the folder

  useEffect(() => {
    window.mmp.getSettings().then(setS)
    return window.mmp.onSettingsChanged(setS)
  }, [])

  // optimistic local update + persist to main
  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    setS(prev => (prev ? { ...prev, [key]: value } : prev))
    window.mmp.setSetting(key, value)
  }

  const browseFolder = async (): Promise<void> => {
    const dir = await window.mmp.pickFolder()
    if (dir) set('screenshotDir', dir)
  }

  // passthrough codec set (persisted as a comma list, kept in a canonical order)
  const hasCodec = (c: string): boolean => (s?.passthroughCodecs ?? '').split(',').includes(c)
  const toggleCodec = (c: string, on: boolean): void => {
    const cur = new Set((s?.passthroughCodecs ?? '').split(',').filter(Boolean))
    if (on) cur.add(c)
    else cur.delete(c)
    set('passthroughCodecs', PASSTHROUGH_CODECS.filter(x => cur.has(x.code)).map(x => x.code).join(','))
  }

  return (
    <div
      className={`panel left ${open ? 'open' : ''}`}
      onMouseMove={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div className="panel-tabs">
        <button className="panel-tab active">Settings</button>
        <span className="panel-tabs-spacer" />
        <button className="panel-collapse" title="Collapse panel" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l-4 4 4 4M7 4l-4 4 4 4" />
          </svg>
        </button>
      </div>

      {s && (
        <div className="panel-body settings-body">
          <div className="set-sec">Playlist</div>
          <Row label="Scan folder into playlist" desc="When you open a file, also queue the other videos in its folder.">
            <Toggle on={s.scanFolderIntoPlaylist} onChange={v => set('scanFolderIntoPlaylist', v)} />
          </Row>
          <Row label="Resume playback" desc="Remember where each file was left off and jump back on reopen.">
            <Toggle on={s.resumePlayback} onChange={v => set('resumePlayback', v)} />
          </Row>
          <Row label="Resume playlists" desc="Reopening a playlist link jumps back to the last video you watched in it.">
            <Toggle on={s.resumePlaylistItem} onChange={v => set('resumePlaylistItem', v)} />
          </Row>

          <div className="set-sec">Audio &amp; subtitles</div>
          <Row label="Keep pitch when changing speed" desc="Time-stretch audio so voices don't go chipmunky at higher playback speeds.">
            <Toggle on={s.keepPitch} onChange={v => set('keepPitch', v)} />
          </Row>
          <Row
            label="Audio passthrough"
            desc={
              <>
                Bitstream compressed audio to an external receiver / DAC — it decodes, not the app.
                <br />
                Needs hardware that supports the format (no sound if it doesn't).
              </>
            }
          >
            <Toggle on={s.audioPassthrough} onChange={v => set('audioPassthrough', v)} />
          </Row>
          {s.audioPassthrough && (
            <div className="set-suboptions">
              {PASSTHROUGH_CODECS.map(c => (
                <Row key={c.code} label={c.label}>
                  <Toggle on={hasCodec(c.code)} onChange={v => toggleCodec(c.code, v)} />
                </Row>
              ))}
            </div>
          )}
          <Row
            label="Preferred audio language"
            desc={
              <>
                Auto-select this language when opening a file.
                <br />
                Default = the file's own order.
              </>
            }
          >
            <Select value={s.audioLang} options={LANG_OPTS} onChange={v => set('audioLang', v)} />
          </Row>
          <Row
            label="Preferred subtitle language"
            desc={
              <>
                Auto-select this language when opening a file.
                <br />
                Default = the file's own order.
              </>
            }
          >
            <Select value={s.subLang} options={LANG_OPTS} onChange={v => set('subLang', v)} />
          </Row>
          <Row label="Subtitles on by default">
            <Toggle on={s.subsDefaultOn} onChange={v => set('subsDefaultOn', v)} />
          </Row>
          <Row label="Auto-load external subtitles" desc="Automatically pick up matching .srt/.ass files sitting next to the video.">
            <Toggle on={s.autoLoadSubs} onChange={v => set('autoLoadSubs', v)} />
          </Row>
          <Row label="HDR subtitle brightness" desc="Peak nits for subtitles over HDR video — lower is dimmer. SDR is unaffected.">
            <div className="set-slider">
              <input
                type="range"
                className="set-range"
                min={50}
                max={400}
                step={5}
                value={Math.min(400, Math.max(50, s.subHdrPeak))}
                onChange={e => set('subHdrPeak', Number(e.target.value))}
              />
              <NumInput value={s.subHdrPeak} min={10} max={10000} onChange={v => set('subHdrPeak', v)} />
            </div>
          </Row>

          <div className="set-sec">Video</div>
          <Row label="Hardware decoding" desc={HWDEC_DESC[s.hwdec]}>
            <Select value={s.hwdec} options={HWDEC_OPTS} onChange={v => set('hwdec', v as Settings['hwdec'])} />
          </Row>
          <Row label="Online video quality" desc="An upper limit — the real quality still depends on the source (a 1080p-max video plays at 1080p even if you pick higher). Best = highest the source offers. Applies to the next stream.">
            <Select value={s.streamQuality} options={QUALITY_OPTS} onChange={v => set('streamQuality', v as Settings['streamQuality'])} />
          </Row>
          <Row label="Use browser cookies" desc="Reads your logged-in cookies so member / age-restricted / Premium videos work. Off by default — your call.">
            <Toggle on={s.useCookies} onChange={v => set('useCookies', v)} />
          </Row>
          {s.useCookies && (
            <Row label="Cookies from">
              <Select value={s.cookiesBrowser} options={BROWSER_OPTS} onChange={v => set('cookiesBrowser', v)} />
            </Row>
          )}

          <div className="set-sec">Screenshots</div>
          <Row label="Include subtitles" desc="Burn the on-screen subtitles into the screenshot.">
            <Toggle on={s.screenshotSubs} onChange={v => set('screenshotSubs', v)} />
          </Row>
          <Row label="Format" desc="PNG is lossless; JPG is far smaller at near-invisible quality loss (95%).">
            <Select value={s.screenshotFormat} options={SCREENSHOT_FMT_OPTS} onChange={v => set('screenshotFormat', v as Settings['screenshotFormat'])} />
          </Row>
          <div className="set-row col">
            <div className="set-text">
              <div className="set-label">Save folder</div>
              <div className="set-desc">Where screenshots are written. Type a path or browse.</div>
            </div>
            <div className="set-path">
              <input
                className="set-path-input"
                spellCheck={false}
                value={pathEdit !== null ? pathEdit : s.screenshotDir}
                onChange={e => setPathEdit(e.target.value)}
                onFocus={() => setPathEdit(s.screenshotDir)}
                onBlur={() => {
                  if (pathEdit !== null && pathEdit.trim()) set('screenshotDir', pathEdit.trim())
                  setPathEdit(null)
                }}
                onKeyDown={e => {
                  e.stopPropagation()
                  if (e.key === 'Enter') e.currentTarget.blur()
                  else if (e.key === 'Escape') {
                    setPathEdit(null)
                    e.currentTarget.blur()
                  }
                }}
              />
              <button className="set-path-btn" title="Browse…" onClick={browseFolder}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="set-sec">Controls</div>
          <Row
            label="Auto-hide delay"
            desc={
              <>
                How long the on-screen controls linger after the mouse stops, then fade out.
                <br />
                Default = 5 seconds.
              </>
            }
          >
            <div className="set-slider">
              <input
                type="range"
                className="set-range"
                min={1}
                max={15}
                step={1}
                value={Math.min(15, Math.max(1, s.oscHideDelay))}
                onChange={e => set('oscHideDelay', Number(e.target.value))}
              />
              <NumInput value={s.oscHideDelay} min={1} max={120} onChange={v => set('oscHideDelay', v)} />
            </div>
          </Row>

          <div className="set-sec">Window</div>
          <Row label="Remember size &amp; position">
            <Toggle on={s.rememberWindow} onChange={v => set('rememberWindow', v)} />
          </Row>
          <Row label="Remember volume">
            <Toggle on={s.rememberVolume} onChange={v => set('rememberVolume', v)} />
          </Row>
        </div>
      )}
    </div>
  )
}
