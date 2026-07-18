import { useEffect, useState } from 'react'
import { PlayerState } from '../usePlayer'

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const s = Math.floor(sec % 60)
  const m = Math.floor((sec / 60) % 60)
  const h = Math.floor(sec / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// The HDR badge. MediaInfo's flavour (Dolby Vision / HDR10+ / HDR10) is the
// precise source — mpv can't tell DV from HDR10 (both are PQ). Fall back to the
// gamma transfer for a generic "HDR" while MediaInfo hasn't resolved (or can't).
function hdrLabel(gamma: string, hdrFormat: string): string {
  if (hdrFormat) return hdrFormat
  const g = gamma.toLowerCase()
  if (g === 'pq' || g === 'st2084' || g === 'hlg') return 'HDR'
  return ''
}

function channelLayout(n: number): string {
  if (n >= 8) return '7.1'
  if (n === 7) return '6.1'
  if (n === 6) return '5.1'
  if (n === 3) return '2.1'
  if (n === 2) return '2.0'
  if (n === 1) return 'Mono'
  return ''
}

// Short codec name for the base (non-premium) formats.
function codecShort(codec: string): string {
  const c = codec.toLowerCase()
  const names: Record<string, string> = {
    truehd: 'TrueHD',
    eac3: 'DD+',
    ac3: 'DD',
    dts: 'DTS',
    aac: 'AAC',
    flac: 'FLAC',
    alac: 'ALAC',
    opus: 'Opus',
    vorbis: 'Vorbis',
    mp3: 'MP3'
  }
  return names[c] || (c.startsWith('pcm') ? 'PCM' : codec.toUpperCase())
}

// The OSC audio badge. `commercial` is the active track's MediaInfo commercial
// name (empty until probed). Object-audio / lossless-master names show bare
// (they're long and self-explanatory); base codecs carry the channel layout.
//   TrueHD+Atmos → "Atmos TrueHD"   DD+ +Atmos → "Atmos"   DTS:X → "DTS:X"
//   DTS-HD MA/HRA → as-is            plain TrueHD → "TrueHD 7.1"   DD+ → "DD+ 5.1"
// Falls back to the short codec name + layout when no commercial name is known.
function audioBadge(codec: string, channels: number, commercial: string): string {
  if (!codec) return ''
  const c = codec.toLowerCase()
  const m = commercial || ''
  if (/atmos/i.test(m)) return c === 'truehd' ? 'Atmos TrueHD' : 'Atmos'
  if (/dts[\s:_-]*x/i.test(m)) return 'DTS:X'
  if (/dts-hd\s*ma|master audio/i.test(m)) return 'DTS-HD MA'
  if (/dts-hd\s*hra|high[\s-]*resolution/i.test(m)) return 'DTS-HD HRA'
  const name = codecShort(codec)
  const layout = channelLayout(channels)
  return layout ? `${name} ${layout}` : name
}

interface Props {
  state: PlayerState
  onTogglePause: () => void
  onSeek: (sec: number) => void
  onSeekBy: (d: number) => void
  onSetVolume: (v: number) => void
  onToggleMute: () => void
  onFullscreen: () => void
}

export default function Controls(props: Props) {
  const { state } = props
  const pct = state.duration > 0 ? (state.timePos / state.duration) * 100 : 0
  const volPct = Math.min(100, (state.volume / 150) * 100)
  const hdr = hdrLabel(state.gamma, state.hdrFormat)
  const audio = audioBadge(state.audioCodec, state.audioChannels, state.audioCommercial)

  // reflect whether the right panel is open, so the list button reads "pressed"
  const [panelOpen, setPanelOpen] = useState(false)
  useEffect(() => window.mmp.onPanelState(setPanelOpen), [])

  return (
    <div className="osc">
      {/* Row 1: buttons */}
      <div className="osc-row osc-buttons">
        <div className="grp left">
          <button className="ib s" onClick={props.onToggleMute} title="Mute">
            {state.mute || state.volume === 0 ? <IcMute /> : <IcVolume />}
          </button>
          <input
            className="rng volume"
            type="range"
            min={0}
            max={150}
            value={state.mute ? 0 : state.volume}
            style={{ ['--fill' as any]: `${volPct}%` }}
            onChange={e => props.onSetVolume(Number(e.target.value))}
          />
        </div>

        <div className="grp center">
          <button className="ib" onClick={() => props.onSeekBy(-10)} title="Back 10s">
            <IcRewind />
          </button>
          <button className="ib play" onClick={props.onTogglePause} title="Play/Pause">
            {state.pause ? <IcPlay /> : <IcPause />}
          </button>
          <button className="ib" onClick={() => props.onSeekBy(10)} title="Forward 10s">
            <IcForward />
          </button>
        </div>

        <div className="grp right">
          {(hdr || audio) && (
            <div className="osc-fmt">
              {hdr && <span className="fmt-badge">{hdr}</span>}
              {audio && <span className="fmt-badge">{audio}</span>}
            </div>
          )}
          <button className="ib s" title="Settings (coming soon)">
            <IcGear />
          </button>
          <button
            className={`ib s ${panelOpen ? 'on' : ''}`}
            title="Playlist"
            onClick={() => window.mmp.togglePanel('playlist')}
          >
            <IcList />
          </button>
        </div>
      </div>

      {/* Row 2: seek */}
      <div className="osc-row osc-seek">
        <span className="t cur">{fmt(state.timePos)}</span>
        <input
          className="rng seek"
          type="range"
          min={0}
          max={state.duration || 0}
          step={0.1}
          value={Math.min(state.timePos, state.duration || 0)}
          style={{ ['--fill' as any]: `${pct}%` }}
          onChange={e => props.onSeek(Number(e.target.value))}
        />
        {Math.abs(state.speed - 1) > 0.01 && (
          <span className="osc-speed">{+state.speed.toFixed(2)}×</span>
        )}
        <span className="t dur">{fmt(state.duration)}</span>
      </div>
    </div>
  )
}

/* ---- icons (IINA-style glyphs) ---- */
const IcPlay = () => (
  <svg viewBox="0 0 24 24" width="44" height="44"><path d="M7 4.5 L20 12 L7 19.5 Z" fill="currentColor" /></svg>
)
const IcPause = () => (
  <svg viewBox="0 0 24 24" width="44" height="44">
    <rect x="5.4" y="4.5" width="5.2" height="15" rx="0.6" fill="currentColor" />
    <rect x="13.4" y="4.5" width="5.2" height="15" rx="0.6" fill="currentColor" />
  </svg>
)
const IcRewind = () => (
  <svg viewBox="0 0 24 24" width="40" height="40">
    <path d="M12.5 6 L3.5 12 L12.5 18 Z M21.5 6 L12.5 12 L21.5 18 Z" fill="currentColor" />
  </svg>
)
const IcForward = () => (
  <svg viewBox="0 0 24 24" width="40" height="40">
    <path d="M11.5 6 L20.5 12 L11.5 18 Z M2.5 6 L11.5 12 L2.5 18 Z" fill="currentColor" />
  </svg>
)
const IcVolume = () => (
  <svg viewBox="0 0 24 24" width="27" height="27">
    <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="currentColor" />
    <path d="M15.5 8.5 Q17.5 12 15.5 15.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M18 6 Q21.2 12 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)
const IcMute = () => (
  <svg viewBox="0 0 24 24" width="27" height="27">
    <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" fill="currentColor" />
    <path d="M16.5 9 L21.5 15 M21.5 9 L16.5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)
const IcGear = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.49.49 0 0013.9 2h-3.84c-.24 0-.44.17-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87a.49.49 0 00.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
)
const IcList = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
    <path d="M8 7 H20 M8 12 H20 M8 17 H20 M4 7 h.01 M4 12 h.01 M4 17 h.01" />
  </svg>
)
