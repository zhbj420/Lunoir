import { useEffect, useState } from 'react'

// Mirrors main/settings.ts (the renderer defines its own view of shared shapes,
// like the other components here).
interface Settings {
  scanFolderIntoPlaylist: boolean
  resumePlayback: boolean
  audioLang: string
  subLang: string
  subsDefaultOn: boolean
  subHdrPeak: number
  hwdec: 'auto' | 'auto-copy' | 'no'
  streamQuality: 'best' | '1080' | '720' | '480'
  useCookies: boolean
  cookiesBrowser: string
  screenshotSubs: boolean
  rememberWindow: boolean
  rememberVolume: boolean
  volume: number
  windowBounds: { x: number; y: number; width: number; height: number } | null
}

// Short, value-dependent explanation shown under Hardware decoding.
const HWDEC_DESC: Record<Settings['hwdec'], string> = {
  auto: 'GPU decoding, most efficient — frames stay in video memory.',
  'auto-copy': 'GPU decoding, copied to RAM — needed for CPU filters like SVP.',
  no: 'CPU (software) decoding — most compatible, but heavier.'
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
  desc?: string
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

  useEffect(() => {
    window.mmp.getSettings().then(setS)
    return window.mmp.onSettingsChanged(setS)
  }, [])

  // optimistic local update + persist to main
  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    setS(prev => (prev ? { ...prev, [key]: value } : prev))
    window.mmp.setSetting(key, value)
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

          <div className="set-sec">Audio &amp; subtitles</div>
          <Row label="Preferred audio language" desc="mpv code, e.g. eng or jpn — applies to the next file opened. Blank = the file's own order.">
            <input
              className="set-input"
              spellCheck={false}
              placeholder="eng"
              value={s.audioLang}
              onChange={e => set('audioLang', e.target.value)}
              onKeyDown={e => e.stopPropagation()}
            />
          </Row>
          <Row label="Preferred subtitle language" desc="e.g. chi, eng — applies to the next file opened. Blank = the file's own order.">
            <input
              className="set-input"
              spellCheck={false}
              placeholder="chi"
              value={s.subLang}
              onChange={e => set('subLang', e.target.value)}
              onKeyDown={e => e.stopPropagation()}
            />
          </Row>
          <Row label="Subtitles on by default">
            <Toggle on={s.subsDefaultOn} onChange={v => set('subsDefaultOn', v)} />
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
            <select
              className="set-select"
              value={s.hwdec}
              onChange={e => set('hwdec', e.target.value as Settings['hwdec'])}
            >
              <option value="auto">Auto</option>
              <option value="auto-copy">Auto (copy back)</option>
              <option value="no">Off (software)</option>
            </select>
          </Row>
          <Row label="Online video quality" desc="Caps YouTube / stream quality (to save bandwidth) — applies to the next stream. Best = highest available.">
            <select
              className="set-select"
              value={s.streamQuality}
              onChange={e => set('streamQuality', e.target.value as Settings['streamQuality'])}
            >
              <option value="best">Best</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
            </select>
          </Row>
          <Row label="Use browser cookies" desc="Reads your logged-in cookies so member / age-restricted / Premium videos work. Off by default — your call.">
            <Toggle on={s.useCookies} onChange={v => set('useCookies', v)} />
          </Row>
          {s.useCookies && (
            <Row label="Cookies from">
              <select
                className="set-select"
                value={s.cookiesBrowser}
                onChange={e => set('cookiesBrowser', e.target.value)}
              >
                <option value="edge">Edge</option>
                <option value="chrome">Chrome</option>
                <option value="firefox">Firefox</option>
                <option value="brave">Brave</option>
                <option value="opera">Opera</option>
              </select>
            </Row>
          )}

          <div className="set-sec">Screenshots</div>
          <Row label="Include subtitles" desc="Burn the on-screen subtitles into the screenshot.">
            <Toggle on={s.screenshotSubs} onChange={v => set('screenshotSubs', v)} />
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
