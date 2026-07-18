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
  'demux-channel-count'?: number
  'demux-bitrate'?: number
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

const SUB_FMT: Record<string, string> = {
  subrip: 'SubRip',
  srt: 'SubRip',
  ass: 'ASS',
  ssa: 'SSA',
  webvtt: 'WebVTT',
  mov_text: 'MOV Text',
  hdmv_pgs_subtitle: 'PGS',
  pgssub: 'PGS',
  dvd_subtitle: 'VobSub',
  dvdsub: 'VobSub',
  vobsub: 'VobSub',
  dvb_subtitle: 'DVB',
  dvbsub: 'DVB',
  dvb_teletext: 'Teletext'
}

// friendly format tag shown on the RIGHT of a subtitle row (MPC-HC style)
function subFmt(codec?: string): string {
  if (!codec) return ''
  return SUB_FMT[codec.toLowerCase()] || codec.toUpperCase()
}

// Subtitle left label. The format lives in the right-hand tag (subFmt), so strip
// format tokens out of the title ("English-PGS" → "English") and don't repeat the
// codec. Keeps meaningful descriptors like SDH / Forced. Falls back to language.
function subName(t: Track): string {
  let title = t.title && !looksLikeFilename(t.title) ? t.title : ''
  if (title) {
    title = title
      .replace(/[._\-]+/g, ' ') // separators → space
      .replace(/\b(subrip|srt|sup|pgs|pgssub|vobsub|ass|ssa|webvtt|dvb)\b/gi, ' ') // drop format
      .replace(/\s+/g, ' ')
      .trim()
  }
  const lang = langName(t.lang)
  if (!title) return lang || `Track ${t.id}`
  // prefix the language only if the title doesn't already name it
  if (lang && !title.toLowerCase().includes(lang.toLowerCase())) return `${lang} ${title}`
  return title
}

const AUDIO_FMT: Record<string, string> = {
  truehd: 'Dolby TrueHD',
  eac3: 'Dolby Digital Plus',
  ac3: 'Dolby Digital',
  dts: 'DTS',
  aac: 'AAC',
  flac: 'FLAC',
  alac: 'ALAC',
  opus: 'Opus',
  vorbis: 'Vorbis',
  mp3: 'MP3'
}
const LANG_NAME: Record<string, string> = {
  eng: 'English', jpn: 'Japanese', chi: 'Chinese', zho: 'Chinese',
  fra: 'French', fre: 'French', deu: 'German', ger: 'German',
  spa: 'Spanish', ita: 'Italian', kor: 'Korean', rus: 'Russian',
  por: 'Portuguese', dut: 'Dutch', nld: 'Dutch', pol: 'Polish',
  tha: 'Thai', vie: 'Vietnamese', ara: 'Arabic', hin: 'Hindi',
  ind: 'Indonesian', tur: 'Turkish', swe: 'Swedish', dan: 'Danish',
  nor: 'Norwegian', fin: 'Finnish', ces: 'Czech', cze: 'Czech',
  ell: 'Greek', gre: 'Greek', heb: 'Hebrew', hun: 'Hungarian', ukr: 'Ukrainian'
}

function langName(lang?: string): string {
  if (!lang) return ''
  return LANG_NAME[lang.toLowerCase()] || lang.toUpperCase()
}

function audioFmt(codec?: string): string {
  if (!codec) return ''
  const c = codec.toLowerCase()
  return AUDIO_FMT[c] || (c.startsWith('pcm') ? 'PCM' : codec.toUpperCase())
}

function chLayout(n?: number): string {
  if (!n) return ''
  if (n >= 8) return '7.1'
  if (n === 7) return '6.1'
  if (n === 6) return '5.1'
  if (n === 3) return '2.1'
  if (n === 2) return '2.0'
  if (n === 1) return 'Mono'
  return `${n}ch`
}

// A release-name dumped into the track title (dotted, no spaces, resolution/source
// tokens) — useless as a label, so drop it and build one from language + format.
function looksLikeFilename(s: string): boolean {
  if (/\b(480p|576p|720p|1080p|2160p|bluray|remux|web-?dl|webrip|hdtv|x264|x265|hevc|avc)\b/i.test(s)) {
    return true
  }
  return (s.match(/\./g) || []).length >= 3 && !s.includes(' ')
}

function bitrate(bps?: number): string {
  return bps && bps > 0 ? `${Math.round(bps / 1000)} kbps` : ''
}

// Audio tracks in remuxes often carry the whole release filename as their title,
// so they all read identically. Show language + format (+ channels + bitrate)
// instead — bitrate tells apart otherwise-identical tracks (e.g. two English
// DD 5.1: a 640k main + a 448k track). Keep a genuinely descriptive title too.
function audioTrackLabel(t: Track): string {
  let main = [langName(t.lang), audioFmt(t.codec), chLayout(t['demux-channel-count'])]
    .filter(Boolean)
    .join(' ')
  const br = bitrate(t['demux-bitrate'])
  if (main && br) main = `${main} · ${br}`
  const title = t.title && !looksLikeFilename(t.title) ? t.title : ''
  if (title && main) return `${title} · ${main}`
  return main || title || `Track ${t.id}`
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

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

// A label + stepper with an editable numeric field + reset. Works in display
// units (unit / decimals / signed): the −/+ (or ↑/↓) buttons step; the field
// takes a typed value and clamps it to [min, max]. Left button always decreases.
function AdjustRow({
  label,
  variant,
  value,
  min,
  max,
  step,
  resetValue,
  unit,
  decimals,
  signed,
  disabled,
  leftTitle,
  rightTitle,
  onChange
}: {
  label: string
  variant: 'step' | 'pos'
  value: number
  min: number
  max: number
  step: number
  resetValue: number
  unit: string
  decimals: number
  signed?: boolean
  disabled?: boolean
  leftTitle?: string
  rightTitle?: string
  onChange: (v: number) => void
}) {
  const [text, setText] = useState<string | null>(null) // non-null while editing
  const factor = Math.pow(10, decimals)
  const round = (v: number): number => Math.round(v * factor) / factor
  const set = (v: number): void => onChange(clamp(round(v), min, max))

  const rounded = round(value)
  const sign = signed && rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  const display = `${sign}${Math.abs(rounded).toFixed(decimals)}${unit}`
  const offset = rounded !== round(resetValue)

  const commit = (): void => {
    if (text === null) return
    const n = parseFloat(text.replace(/[^0-9.eE+-]/g, ''))
    if (!isNaN(n)) set(n)
    setText(null)
  }

  const Left = variant === 'pos' ? IconUp : IconMinus
  const Right = variant === 'pos' ? IconDown : IconPlus

  return (
    <div className={`adjust-row ${offset && !disabled ? 'offset' : ''} ${disabled ? 'disabled' : ''}`}>
      <span className="adjust-label">{label}</span>
      <div className="adjust-stepper">
        <button className="adjust-btn" title={leftTitle} disabled={disabled} onClick={() => set(value - step)}>
          <Left />
        </button>
        <input
          className="adjust-val"
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={text !== null ? text : display}
          onChange={e => setText(e.target.value)}
          onFocus={e => {
            setText(String(rounded))
            e.currentTarget.select()
          }}
          onBlur={commit}
          onKeyDown={e => {
            e.stopPropagation() // don't let digits / arrows fire the player shortcuts
            if (e.key === 'Enter') {
              commit()
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              setText(null)
              e.currentTarget.blur()
            }
          }}
        />
        <button className="adjust-btn" title={rightTitle} disabled={disabled} onClick={() => set(value + step)}>
          <Right />
        </button>
      </div>
      <button className="adjust-reset" title="Reset" disabled={disabled || !offset} onClick={() => onChange(resetValue)}>
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
export default function RightPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  // apply + persist for the adjust rows. Size/Brightness take a display % and
  // convert to the underlying mpv value (sub-scale multiplier / sub-color grey).
  const setAudioDelayV = (v: number): void => {
    setAudioDelay(v)
    window.mmp.set('audio-delay', v)
  }
  const setSubDelayV = (v: number): void => {
    setSubDelay(v)
    window.mmp.set('sub-delay', v)
  }
  const setSubPosV = (v: number): void => {
    setSubPos(v)
    window.mmp.set('sub-pos', v)
  }
  const setSubScaleV = (pct: number): void => {
    const s = pct / 100
    setSubScale(s)
    window.mmp.set('sub-scale', s)
  }
  const setSubBrightV = (pct: number): void => {
    setSubBright(pct)
    const c = (pct / 100).toFixed(2)
    window.mmp.set('sub-color', `${c}/${c}/${c}`)
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
        <button className="panel-collapse" title="Collapse panel" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4l4 4-4 4M9 4l4 4-4 4" />
          </svg>
        </button>
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
                    {audioTrackLabel(t)}
                  </span>
                </div>
              ))
            )}
            <AdjustRow
              label="Delay"
              variant="step"
              value={audioDelay}
              min={-1000}
              max={1000}
              step={0.1}
              resetValue={0}
              unit="s"
              decimals={1}
              signed
              disabled={audioTracks.length === 0}
              leftTitle="Earlier (−0.1s)"
              rightTitle="Later (+0.1s)"
              onChange={setAudioDelayV}
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
                  {subName(t)}
                </span>
                {subFmt(t.codec) && <span className="pl-fmt">{subFmt(t.codec)}</span>}
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
                  value={subDelay}
                  min={-1000}
                  max={1000}
                  step={0.1}
                  resetValue={0}
                  unit="s"
                  decimals={1}
                  signed
                  disabled={!hasSub}
                  leftTitle="Earlier (−0.1s)"
                  rightTitle="Later (+0.1s)"
                  onChange={setSubDelayV}
                />
                <AdjustRow
                  label="Position"
                  variant="pos"
                  value={subPos}
                  min={0}
                  max={150}
                  step={2}
                  resetValue={100}
                  unit=""
                  decimals={0}
                  disabled={!hasSub}
                  leftTitle="Move up"
                  rightTitle="Move down"
                  onChange={setSubPosV}
                />
                <AdjustRow
                  label="Size"
                  variant="step"
                  value={Math.round(subScale * 100)}
                  min={0}
                  max={10000}
                  step={10}
                  resetValue={100}
                  unit="%"
                  decimals={0}
                  disabled={!hasSub || isImageSub}
                  leftTitle="Smaller"
                  rightTitle="Larger"
                  onChange={setSubScaleV}
                />
                <AdjustRow
                  label="Brightness"
                  variant="step"
                  value={subBright}
                  min={0}
                  max={100}
                  step={10}
                  resetValue={100}
                  unit="%"
                  decimals={0}
                  disabled={!hasSub || isImageSub}
                  leftTitle="Dimmer"
                  rightTitle="Brighter"
                  onChange={setSubBrightV}
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
