import { useEffect, useRef, useState } from 'react'
import { PlayerState, TimeFormat, currentFrame as frameOf } from '../usePlayer'
import { useT } from '../useT'

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0
  const s = Math.floor(sec % 60)
  const m = Math.floor((sec / 60) % 60)
  const h = Math.floor(sec / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// SMPTE-style HH:MM:SS:FF, non-drop — the frames field is just the sub-second
// remainder at the container rate. (True drop-frame for 29.97/23.976 renumbers
// frames and is a rabbit hole a player doesn't need.)
// Timecode is derived from the *integer* frame index, never from the float clock:
// stepping parks time exactly on a frame boundary, where floor(time * fps) flips
// either way and the frames field stutters. Nominal (rounded) rate, non-drop — so
// at 23.976 this runs a hair ahead of the wall clock, exactly as non-drop does.
function tcFromFrame(frame: number, fps: number): string {
  const rate = Math.max(1, Math.round(fps) || 24)
  const f = Math.max(0, Math.floor(frame))
  const pad = (n: number) => String(n).padStart(2, '0')
  const secs = Math.floor(f / rate)
  return `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs / 60) % 60))}:${pad(secs % 60)}:${pad(f % rate)}`
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
  timeFormat: TimeFormat
  onCycleTimeFormat: () => void
}

export default function Controls(props: Props) {
  const t = useT()
  const { state } = props
  const pct = state.duration > 0 ? (state.timePos / state.duration) * 100 : 0
  const volPct = Math.min(100, (state.volume / 150) * 100)
  const hdr = hdrLabel(state.gamma, state.hdrFormat)
  const audio = audioBadge(state.audioCodec, state.audioChannels, state.audioCommercial)
  // resolution — only for streams (locally you already know the quality). Sits on
  // the top badge line with HDR, e.g. "2160p HDR10" / "2160p".
  const res = state.isStream && state.videoHeight > 0 ? `${state.videoHeight}p` : ''
  const topBadge = [res, hdr].filter(Boolean).join(' ')

  // A-B loop markers on the seek bar (positions as % of duration)
  const dur = state.duration || 0
  const abPct = (t: number): number => (dur > 0 ? Math.max(0, Math.min(100, (t / dur) * 100)) : 0)

  // reflect whether the right panel is open, so the list button reads "pressed"
  const [panelOpen, setPanelOpen] = useState(false)
  useEffect(() => window.mmp.onPanelState(setPanelOpen), [])

  // recording indicator: a red dot + running timer, shown only while recording,
  // click to stop. `since` is the main-process start timestamp; tick every second.
  const [rec, setRec] = useState<{ recording: boolean; since: number | null }>({ recording: false, since: null })
  const [recElapsed, setRecElapsed] = useState(0)
  useEffect(() => {
    window.mmp.getRecording().then(setRec)
    return window.mmp.onRecordingState(setRec)
  }, [])
  useEffect(() => {
    if (!rec.recording || !rec.since) return
    const tick = (): void => setRecElapsed(Math.max(0, Math.floor((Date.now() - rec.since!) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [rec.recording, rec.since])

  // show the volume number transiently — while grabbing the thumb and on any
  // volume change (drag / wheel / keyboard). Not persistent.
  const [volShow, setVolShow] = useState(false)
  const volTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstVol = useRef(true)
  const showVol = (): void => {
    setVolShow(true)
    if (volTimer.current) clearTimeout(volTimer.current)
    volTimer.current = setTimeout(() => setVolShow(false), 900)
  }
  useEffect(() => {
    if (firstVol.current) {
      firstVol.current = false
      return // don't flash on the initial volume (mount / restore)
    }
    showVol()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.volume])

  return (
    <div className="osc">
      {/* Row 1: buttons */}
      <div className="osc-row osc-buttons">
        <div className="grp left">
          {/* tooltip tracks what the click will do, not the icon: at volume 0
              but un-muted the glyph reads muted, yet clicking still mutes */}
          <button
            className="ib s"
            onClick={props.onToggleMute}
            title={state.mute ? t('osc.unmute') : t('osc.mute')}
          >
            {state.mute || state.volume === 0 ? <IcMute /> : <IcVolume />}
          </button>
          <div className="vol-wrap">
            {volShow && <span className="vol-num">{Math.round(state.volume)}</span>}
            <input
              className="rng volume"
              type="range"
              min={0}
              max={150}
              value={state.mute ? 0 : state.volume}
              style={{ ['--fill' as any]: `${volPct}%` }}
              onChange={e => props.onSetVolume(Number(e.target.value))}
              onPointerDown={showVol}
            />
          </div>
        </div>

        <div className="grp center">
          <button className="ib" onClick={() => props.onSeekBy(-10)} title={t('osc.back', { n: 10 })}>
            <IcRewind />
          </button>
          <button
            className="ib play"
            onClick={props.onTogglePause}
            title={state.pause ? t('osc.play') : t('osc.pause')}
          >
            {state.pause ? <IcPlay /> : <IcPause />}
          </button>
          <button className="ib" onClick={() => props.onSeekBy(10)} title={t('osc.forward', { n: 10 })}>
            <IcForward />
          </button>
        </div>

        <div className="grp right">
          {rec.recording && (
            <button
              className="rec-pill"
              title={t('menu.stopRecord')}
              onClick={() => window.mmp.toggleRecording()}
            >
              <span className="rec-dot" />
              {fmt(recElapsed)}
            </button>
          )}
          {(topBadge || audio) && (
            <div className="osc-fmt">
              {topBadge && <span className="fmt-badge">{topBadge}</span>}
              {audio && <span className="fmt-badge">{audio}</span>}
            </div>
          )}
          <button
            className="ib s"
            title={t('osc.library')}
            onClick={() => window.mmp.toggleLibrary()}
          >
            <IcSaved />
          </button>
          <button
            className="ib s"
            title={t('common.settings')}
            onClick={() => window.mmp.togglePanel('settings')}
          >
            <IcGear />
          </button>
          <button
            className={`ib s ${panelOpen ? 'on' : ''}`}
            title={t('osc.panel')}
            onClick={() => window.mmp.togglePanel('playlist')}
          >
            <IcList />
          </button>
        </div>
      </div>

      {/* Row 2: seek — or, on a live stream, elapsed time + a LIVE badge (no bar).
          Live has no real duration; drawing position/duration made the fill snap
          backwards as mpv's estimated duration crept up with the arriving buffer. */}
      <div className="osc-row osc-seek">
        {state.isLive ? (
          <>
            <span className="t cur">{fmt(state.timePos)}</span>
            <div className="seek-wrap" />
            {Math.abs(state.speed - 1) > 0.01 && (
              <span className="osc-speed">{+state.speed.toFixed(2)}×</span>
            )}
            <button className="t dur live-badge" title="Go to live" onClick={() => window.mmp.goLive()}>
              <span className="live-dot" />
              LIVE
            </button>
          </>
        ) : (
          <>
            <span
              className="t cur clickable"
              onClick={props.onCycleTimeFormat}
              title={t('osc.timeFormat')}
            >
              {props.timeFormat === 'timecode'
                ? tcFromFrame(frameOf(state), state.fps)
                : props.timeFormat === 'frame'
                  ? String(frameOf(state))
                  : fmt(state.timePos)}
            </span>
            <div className="seek-wrap">
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
              {state.abLoopA != null && state.abLoopB != null && (
                <span
                  className="ab-region"
                  style={{ left: `${abPct(state.abLoopA)}%`, width: `${abPct(state.abLoopB) - abPct(state.abLoopA)}%` }}
                />
              )}
              {state.abLoopA != null && <span className="ab-mark" style={{ left: `${abPct(state.abLoopA)}%` }} />}
              {state.abLoopB != null && <span className="ab-mark" style={{ left: `${abPct(state.abLoopB)}%` }} />}
            </div>
            {Math.abs(state.speed - 1) > 0.01 && (
              <span className="osc-speed">{+state.speed.toFixed(2)}×</span>
            )}
            <span
              className="t dur clickable"
              onClick={props.onCycleTimeFormat}
              title={t('osc.timeFormat')}
            >
              {props.timeFormat === 'timecode'
                ? tcFromFrame(state.frameCount || Math.floor(state.duration * state.fps), state.fps)
                : props.timeFormat === 'frame'
                  ? String(state.frameCount || Math.floor(state.duration * state.fps) || 0)
                  : fmt(state.duration)}
            </span>
          </>
        )}
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
const IcSaved = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
    <path d="M12 2.7 L14.2 9 L20.8 9.1 L15.5 13.1 L17.5 19.5 L12 15.7 L6.5 19.5 L8.5 13.1 L3.2 9.1 L9.8 9 Z" />
  </svg>
)
