import { useEffect, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { useT, type T } from '../useT'

type Tab = 'playlist' | 'chapters' | 'tracks'
type RepeatMode = 'off' | 'all' | 'one'
type SourceType = 'queue' | 'iptv' | 'playlist-url'
interface Playlist {
  items: { path: string; name: string; group?: string }[]
  index: number
  repeat: RepeatMode
  shuffle: boolean
  sourceType: SourceType
  merge: boolean
  canMerge: boolean
  trimClip: number
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
  'ff-index'?: number // absolute stream index — joins to MediaInfo's StreamOrder
  'demux-channel-count'?: number
  'demux-bitrate'?: number
}

// Per-track audio metadata from MediaInfo (main process), keyed by ff-index.
interface ProbeStream {
  format?: string // 'AC-3', 'DTS', 'MLP FBA'
  commercial?: string // 'Dolby Digital', 'DTS-HD Master Audio', 'Dolby TrueHD with Dolby Atmos'
  features?: string // 'LC', 'XLL' (codec sub-profile)
  bitRate?: number // bps
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
function subName(t: Track, tr: T): string {
  let title = t.title && !looksLikeFilename(t.title) ? t.title : ''
  if (title) {
    title = title
      .replace(/[._\-]+/g, ' ') // separators → space
      .replace(/\b(subrip|srt|sup|pgs|pgssub|vobsub|ass|ssa|webvtt|dvb)\b/gi, ' ') // drop format
      .replace(/\s+/g, ' ')
      .trim()
  }
  const lang = langName(t.lang)
  if (!title) return lang || tr('panel.trackN', { n: t.id })
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

// The commercial audio format name. MediaInfo's commercial string is the richest
// ("DTS-HD Master Audio", "Dolby TrueHD with Dolby Atmos"); fall back to the mpv
// codec name, appending the sub-profile (AAC "LC" → "AAC LC") when it adds info.
function audioFormatName(t: Track, ff?: ProbeStream): string {
  if (ff?.commercial) return ff.commercial.replace(/\s*with Dolby Atmos/i, ' Atmos')
  const base = audioFmt(t.codec)
  const f = ff?.features
  if (base && f && !base.toLowerCase().includes(f.toLowerCase())) return `${base} ${f}`
  return base
}

// Audio tracks in remuxes often carry the whole release filename as their title,
// so they all read identically. Show language + format (+ channels + bitrate)
// instead — bitrate tells apart otherwise-identical tracks (e.g. two English
// DD 5.1: a 640k main + a 448k track). MediaInfo (ff) supplies the per-track
// bitrate + commercial format that mpv can't report for inactive tracks; we fall
// back to mpv's demux-bitrate when it's absent. Keep a descriptive title too.
function audioTrackLabel(t: Track, ff: ProbeStream | undefined, tr: T): string {
  let main = [langName(t.lang), audioFormatName(t, ff), chLayout(t['demux-channel-count'])]
    .filter(Boolean)
    .join(' ')
  const br = bitrate(ff?.bitRate ?? t['demux-bitrate'])
  // plain wide gap before the bitrate (no "·"); 3 nbsp so HTML won't collapse it
  const gap = String.fromCharCode(0xa0).repeat(3)
  if (main && br) main = `${main}${gap}${br}`
  const title = t.title && !looksLikeFilename(t.title) ? t.title : ''
  if (title && main) return `${title} · ${main}`
  return main || title || tr('panel.trackN', { n: t.id })
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
// The four bottom-toolbar glyphs share one spec: viewBox 24, content filling the
// 4–20 box (16px, centred), stroke 1.8 — so they read the same size in the row.
// Repeat-all (loop). Repeat-one reuses this + a "1" badge; repeat-off uses the
// distinct →| glyph below so the three states read at a glance.
const IconRepeat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4l4 4-4 4" />
    <path d="M20 8H8a4 4 0 0 0-4 4" />
    <path d="M8 20l-4-4 4-4" />
    <path d="M4 16h12a4 4 0 0 0 4-4" />
  </svg>
)
// Repeat off: play to the end, then stop — arrow into a bar (→|).
const IconRepeatOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12h11" />
    <path d="M11 7l5 5-5 5" />
    <path d="M20 4v16" />
  </svg>
)
// Shuffle: two corner arrows + crossing diagonals (clean Feather form).
const IconShuffle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h4v4" />
    <path d="M4 20L20 4" />
    <path d="M20 16v4h-4" />
    <path d="M15 15l5 5" />
    <path d="M4 4l5 5" />
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
  const t = useT()
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
      <button className="adjust-reset" title={t('adjust.reset')} disabled={disabled || !offset} onClick={() => onChange(resetValue)}>
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
  const t = useT()
  const [tab, setTab] = useState<Tab>('tracks') // Audio & Sub is the default tab
  const [pl, setPl] = useState<Playlist>({ items: [], index: -1, repeat: 'off', shuffle: false, sourceType: 'queue', merge: false, canMerge: false, trimClip: -1 })
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [curChapter, setCurChapter] = useState(-1)
  const [tracks, setTracks] = useState<Track[]>([])
  const [probe, setProbe] = useState<Record<number, ProbeStream>>({})
  const [aid, setAid] = useState<number | false>(false)
  const [sid, setSid] = useState<number | false>(false)
  const [audioDelay, setAudioDelay] = useState(0)
  const [subDelay, setSubDelay] = useState(0)
  const [subPos, setSubPos] = useState(100) // sub-pos, 0 (top) – 100 (bottom)
  const [subScale, setSubScale] = useState(1) // sub-scale multiplier
  const [subBright, setSubBright] = useState(100) // % of white; local (sub-color)
  const [subAdjOpen, setSubAdjOpen] = useState(false)
  const [collectionSaved, setCollectionSaved] = useState(false) // is this queue/source in 收藏?
  const [channelSearch, setChannelSearch] = useState('') // IPTV channel filter
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set()) // collapsed group names

  // playlist state, pushed from main
  useEffect(() => {
    let mounted = true
    window.mmp.getPlaylist().then(p => mounted && setPl(p))
    return window.mmp.onPlaylistChanged(p => setPl(p))
  }, [])

  // whether the current collection (queue / IPTV source) is saved → save-button state
  useEffect(() => window.mmp.onCollectionSaved(setCollectionSaved), [])

  // when a NEW IPTV list loads, collapse every group but the first (a channel switch
  // within the same list keeps your collapse state — guarded by a list identity)
  const listId = useRef('')
  useEffect(() => {
    if (pl.sourceType !== 'iptv') {
      listId.current = ''
      return
    }
    const id = pl.items.length + '|' + (pl.items[0]?.path ?? '')
    if (id === listId.current) return
    listId.current = id
    const seen = new Set<string>()
    const names: string[] = []
    for (const it of pl.items) {
      const g = it.group || t('panel.ungrouped')
      if (!seen.has(g)) {
        seen.add(g)
        names.push(g)
      }
    }
    setCollapsed(new Set(names.slice(1))) // all but the first group
    setChannelSearch('') // a fresh list starts unfiltered
  }, [pl, t])

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
      if (mounted) setProbe({}) // drop stale metadata; MediaInfo re-probes the new file
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
    // per-track audio metadata probed by MediaInfo in the main process
    const offProbe = window.mmp.onProbe(({ streams }) => {
      if (mounted) setProbe(streams || {})
    })
    return () => {
      mounted = false
      off()
      offProbe()
    }
  }, [])

  const repeat: RepeatMode = pl.repeat
  const audioTracks = tracks.filter(t => t.type === 'audio')
  const subTracks = tracks.filter(t => t.type === 'sub')

  const hasSub = sid !== false
  const activeSub = subTracks.find(t => t.id === sid)
  const isImageSub = !!activeSub && IMAGE_SUB_CODECS.has((activeSub.codec || '').toLowerCase())

  // Adjust rows are a *live, per-playback* nudge: they set the mpv property and
  // nothing else, so they reset with the session and never touch the saved defaults
  // in Settings (which is where the global baseline lives). Size/Brightness take a
  // display % and convert to the underlying mpv value (sub-scale / sub-color grey).
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

  // IPTV: the channel list is grouped by group-title + filterable; a normal queue
  // stays flat. Keep each item's original playlist index for playIndex().
  const isIptv = pl.sourceType === 'iptv'
  // drag-to-reorder the queue (not IPTV channels). HTML5 DnD — a click still fires
  // play; a real drag reorders. dropIndex marks where the dragged row will land.
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  // queue multi-select (channels zap on single-click, never select): single click
  // selects, Ctrl/Shift extend, double-click plays. Selection clears when the list's
  // contents change (reorder / add / remove shift the indices).
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const selAnchor = useRef<number | null>(null)
  const itemsSig = pl.items.map(it => it.path).join('|')
  const lastSig = useRef(itemsSig)
  useEffect(() => {
    if (lastSig.current !== itemsSig) {
      lastSig.current = itemsSig
      setSelected(new Set())
      selAnchor.current = null
    }
  }, [itemsSig])
  // Delete key removes the current multi-selection (queue playlist tab only)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Delete' || isIptv || tab !== 'playlist' || selected.size === 0) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      e.preventDefault()
      window.mmp.removePlaylistItems([...selected])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isIptv, tab, selected])
  const rowSelect = (i: number, e: ReactMouseEvent): void => {
    if (e.shiftKey && selAnchor.current !== null) {
      const lo = Math.min(selAnchor.current, i)
      const hi = Math.max(selAnchor.current, i)
      const range = new Set<number>()
      for (let k = lo; k <= hi; k++) range.add(k)
      setSelected(range)
    } else if (e.ctrlKey || e.metaKey) {
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(i)) next.delete(i)
        else next.add(i)
        return next
      })
      selAnchor.current = i
    } else {
      setSelected(new Set([i]))
      selAnchor.current = i
    }
  }
  const q = channelSearch.trim().toLowerCase()
  const shownChannels = pl.items
    .map((it, i) => ({ ...it, i }))
    .filter(it => !q || it.name.toLowerCase().includes(q))
  const channelGroups: { name: string; items: typeof shownChannels }[] = []
  if (isIptv) {
    for (const it of shownChannels) {
      const g = it.group || t('panel.ungrouped')
      let grp = channelGroups.find(x => x.name === g)
      if (!grp) {
        grp = { name: g, items: [] }
        channelGroups.push(grp)
      }
      grp.items.push(it)
    }
  }
  // the group the currently-playing channel lives in → highlight its header if collapsed
  const activeGroup =
    isIptv && pl.index >= 0 && pl.items[pl.index]
      ? pl.items[pl.index].group || t('panel.ungrouped')
      : null
  const toggleGroup = (name: string): void =>
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  // one playlist/channel row (shared by the flat queue + the grouped IPTV view).
  // Key by the original index, never the path — an IPTV list can repeat a URL
  // (multi-source / duplicate channels), and duplicate React keys leave ghost rows.
  const plRow = (it: { path: string; name: string }, i: number) => {
    // queue rows drag-reorder; IPTV channel rows don't. A click still plays; only a
    // real drag reorders (HTML5 DnD keeps the two apart).
    const dnd = isIptv
      ? {}
      : {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            setDragIndex(i)
            e.dataTransfer.effectAllowed = 'move'
          },
          onDragOver: (e: DragEvent) => {
            e.preventDefault()
            // cursor in the bottom half of a row → insert AFTER it (i+1). This lets you
            // reach the very end (drop on the last row's bottom half → append).
            const r = e.currentTarget.getBoundingClientRect()
            const target = e.clientY > r.top + r.height / 2 ? i + 1 : i
            if (dropIndex !== target) setDropIndex(target)
          },
          onDrop: (e: DragEvent) => {
            e.preventDefault()
            if (dragIndex !== null && dropIndex !== null) {
              // drag the whole multi-selection as a block if the grabbed row is in it
              const group = selected.has(dragIndex) && selected.size > 1 ? [...selected] : [dragIndex]
              window.mmp.movePlaylistItems(group, dropIndex)
            }
            setDragIndex(null)
            setDropIndex(null)
          },
          onDragEnd: () => {
            setDragIndex(null)
            setDropIndex(null)
          }
        }
    return (
      <div
        key={i}
        className={`pl-item ${i === pl.index ? 'active' : ''}${!isIptv && selected.has(i) ? ' selected' : ''}${
          pl.merge && pl.trimClip === i ? ' trimming' : ''
        }${i === dragIndex ? ' dragging' : ''}${dragIndex !== null && dropIndex === i ? ' drop-before' : ''}${
          dragIndex !== null && dropIndex === pl.items.length && i === pl.items.length - 1 ? ' drop-after' : ''
        }`}
        title={it.name}
        onClick={isIptv ? () => window.mmp.playIndex(i) : e => rowSelect(i, e)}
        onDoubleClick={
          isIptv ? undefined : () => (pl.merge ? window.mmp.trimClip(i) : window.mmp.playIndex(i))
        }
        {...dnd}
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
    )
  }

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
        <button className={`panel-tab ${tab === 'tracks' ? 'active' : ''}`} onClick={() => setTab('tracks')}>
          {t('panel.tab.audioSub')}
        </button>
        <button className={`panel-tab ${tab === 'playlist' ? 'active' : ''}`} onClick={() => setTab('playlist')}>
          {pl.sourceType === 'iptv' ? t('panel.tab.channels') : t('panel.tab.playlist')}
        </button>
        <button className={`panel-tab ${tab === 'chapters' ? 'active' : ''}`} onClick={() => setTab('chapters')}>
          {t('panel.tab.chapters')}
        </button>
        <span className="panel-tabs-spacer" />
        <button className="panel-collapse" title={t('common.collapse')} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4l4 4-4 4M9 4l4 4-4 4" />
          </svg>
        </button>
      </div>

      {tab === 'playlist' && (
        <>
          {isIptv && pl.items.length > 0 && (
            <div className="panel-search">
              <input
                value={channelSearch}
                spellCheck={false}
                placeholder={t('panel.searchChannels')}
                onChange={e => setChannelSearch(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
            </div>
          )}
          <div
            className="panel-body"
            onDragOver={
              isIptv
                ? undefined
                : e => {
                    // dragging over the empty area below the rows → append to the end
                    // (a big, easy target for "move to last")
                    if (e.target === e.currentTarget && dragIndex !== null) {
                      e.preventDefault()
                      if (dropIndex !== pl.items.length) setDropIndex(pl.items.length)
                    }
                  }
            }
            onDrop={
              isIptv
                ? undefined
                : e => {
                    if (e.target === e.currentTarget && dragIndex !== null && dropIndex !== null) {
                      e.preventDefault()
                      const group = selected.has(dragIndex) && selected.size > 1 ? [...selected] : [dragIndex]
                      window.mmp.movePlaylistItems(group, dropIndex)
                    }
                    setDragIndex(null)
                    setDropIndex(null)
                  }
            }
          >
            {pl.items.length === 0 ? (
              <div className="panel-empty">{t('panel.empty.queue')}</div>
            ) : isIptv ? (
              channelGroups.length === 0 ? (
                <div className="panel-empty">{t('panel.noMatches')}</div>
              ) : (
                channelGroups.map(g => {
                  const shut = collapsed.has(g.name) && !q
                  const holdsActive = shut && g.name === activeGroup // playing channel is hidden here
                  return (
                    <div key={g.name} className="pl-group">
                      <button
                        className={`pl-group-head ${shut ? 'shut' : ''} ${holdsActive ? 'has-active' : ''}`}
                        onClick={() => toggleGroup(g.name)}
                      >
                        <svg className="pl-group-chev" width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
                          <path d="M1 0.5 L8 4.5 L1 8.5 Z" />
                        </svg>
                        <span className="pl-group-name">{g.name}</span>
                        <span className="pl-group-count">{g.items.length}</span>
                      </button>
                      {!shut && g.items.map(it => plRow(it, it.i))}
                    </div>
                  )
                })
              )
            ) : (
              pl.items.map((it, i) => plRow(it, i))
            )}
          </div>

          <div className="panel-tools">
            <button
              className={`tool ${collectionSaved ? 'on' : ''}`}
              title={pl.sourceType === 'iptv' ? t('panel.saveSource') : t('panel.savePlaylist')}
              onClick={() => window.mmp.saveCollection()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={collectionSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
                <path d="M12 4 l2.35 4.9 5.4 .7 -3.95 3.7 1.0 5.3 -4.8 -2.6 -4.8 2.6 1.0 -5.3 -3.95 -3.7 5.4 -.7 Z" />
              </svg>
            </button>
            <button
              className="tool"
              title={repeat === 'off' ? t('panel.repeat.off') : repeat === 'all' ? t('panel.repeat.all') : t('panel.repeat.one')}
              onClick={() => window.mmp.cycleRepeat()}
            >
              {repeat === 'off' ? <IconRepeatOff /> : <IconRepeat />}
              {repeat === 'one' && <span className="tool-badge">1</span>}
            </button>
            <button
              className={`tool ${pl.shuffle ? 'on' : ''}`}
              title={pl.shuffle ? t('panel.shuffle.on') : t('panel.shuffle.off')}
              disabled={pl.merge}
              onClick={() => window.mmp.toggleShuffle()}
            >
              <IconShuffle />
            </button>
            {/* "watch as one": stitch the local queue into one continuous timeline.
                Only offered for a mergeable queue (local files, ≥2). */}
            {pl.canMerge && (
              <button
                className={`tool ${pl.merge ? 'on' : ''}`}
                title={pl.merge ? t('panel.merge.on') : t('panel.merge.off')}
                onClick={() => window.mmp.toggleMerge()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {/* three clips laid on a timeline track */}
                  <path d="M3 18h18" />
                  <rect x="3.5" y="7" width="5" height="7" rx="1" />
                  <rect x="9.5" y="7" width="5" height="7" rx="1" />
                  <rect x="15.5" y="7" width="5" height="7" rx="1" />
                </svg>
              </button>
            )}
            <span className="panel-tools-spacer" />
            <button className="tool" title={t('panel.addFiles')} onClick={() => window.mmp.addToPlaylist()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 4v16M4 12h16" />
              </svg>
            </button>
            <button
              className="tool"
              title={t('panel.removeCurrent')}
              disabled={pl.index < 0 && selected.size === 0}
              onClick={() => {
                if (selected.size > 0) window.mmp.removePlaylistItems([...selected])
                else if (pl.index >= 0) window.mmp.removeFromPlaylist(pl.index)
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16" />
                <path d="M6 6l1 14h10l1-14" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          </div>
        </>
      )}

      {tab === 'chapters' && (
        <div className="panel-body">
          {chapters.length === 0 ? (
            <div className="panel-empty">{t('panel.empty.chapters')}</div>
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
                <span className="pl-name">{ch.title || t('panel.chapterN', { n: i + 1 })}</span>
                <span className="pl-time">{fmt(ch.time)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'tracks' && (
        <>
          <div className="panel-body">
            <div className="track-sec">{t('panel.sec.audio')}</div>
            {audioTracks.length === 0 ? (
              <div className="track-empty">{t('panel.empty.audio')}</div>
            ) : (
              audioTracks.map(tk => (
                <div
                  key={`a${tk.id}`}
                  className={`pl-item ${tk.id === aid ? 'active' : ''}`}
                  onClick={() => window.mmp.set('aid', tk.id)}
                >
                  <span className="pl-mark">{tk.id === aid ? <Check /> : null}</span>
                  <span className="pl-name" onMouseEnter={e => clipTitle(e.currentTarget)}>
                    {audioTrackLabel(tk, tk['ff-index'] != null ? probe[tk['ff-index']] : undefined, t)}
                  </span>
                </div>
              ))
            )}
            <AdjustRow
              label={t('adjust.delay')}
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
              leftTitle={t('adjust.earlier')}
              rightTitle={t('adjust.later')}
              onChange={setAudioDelayV}
            />

            <div className="track-sec">{t('panel.sec.subtitles')}</div>
            <div
              className={`pl-item ${sid === false ? 'active' : ''}`}
              onClick={() => window.mmp.set('sid', 'no')}
            >
              <span className="pl-mark">{sid === false ? <Check /> : null}</span>
              <span className="pl-name">{t('panel.subNone')}</span>
            </div>
            {subTracks.map(tk => (
              <div
                key={`s${tk.id}`}
                className={`pl-item ${tk.id === sid ? 'active' : ''}`}
                onClick={() => window.mmp.set('sid', tk.id)}
              >
                <span className="pl-mark">{tk.id === sid ? <Check /> : null}</span>
                <span className="pl-name" onMouseEnter={e => clipTitle(e.currentTarget)}>
                  {subName(tk, t)}
                </span>
                {subFmt(tk.codec) && <span className="pl-fmt">{subFmt(tk.codec)}</span>}
              </div>
            ))}

            <button className="track-add" onClick={() => window.mmp.addSubtitle()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t('panel.addSub')}
            </button>
          </div>

          {/* pinned, collapsible subtitle-adjust footer — always reachable no
              matter how long the track list is */}
          <div className={`sub-adjust ${subAdjOpen ? 'open' : ''}`}>
            <button className="sub-adjust-head" onClick={() => setSubAdjOpen(o => !o)}>
              <Chevron />
              <span className="sub-adjust-label">{t('adjust.label')}</span>
              {!subAdjOpen && subOffset && <span className="sub-adjust-dot" title={t('adjust.active')} />}
            </button>
            <div className="sub-adjust-anim">
              <div className="sub-adjust-body">
                <AdjustRow
                  label={t('adjust.delay')}
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
                  leftTitle={t('adjust.earlier')}
                  rightTitle={t('adjust.later')}
                  onChange={setSubDelayV}
                />
                <AdjustRow
                  label={t('adjust.position')}
                  variant="pos"
                  value={subPos}
                  min={0}
                  max={150}
                  step={2}
                  resetValue={100}
                  unit=""
                  decimals={0}
                  disabled={!hasSub}
                  leftTitle={t('adjust.moveUp')}
                  rightTitle={t('adjust.moveDown')}
                  onChange={setSubPosV}
                />
                <AdjustRow
                  label={t('adjust.size')}
                  variant="step"
                  value={Math.round(subScale * 100)}
                  min={0}
                  max={10000}
                  step={10}
                  resetValue={100}
                  unit="%"
                  decimals={0}
                  disabled={!hasSub || isImageSub}
                  leftTitle={t('adjust.smaller')}
                  rightTitle={t('adjust.larger')}
                  onChange={setSubScaleV}
                />
                <AdjustRow
                  label={t('adjust.brightness')}
                  variant="step"
                  value={subBright}
                  min={0}
                  max={100}
                  step={10}
                  resetValue={100}
                  unit="%"
                  decimals={0}
                  disabled={!hasSub || isImageSub}
                  leftTitle={t('adjust.dimmer')}
                  rightTitle={t('adjust.brighter')}
                  onChange={setSubBrightV}
                />
                {isImageSub && (
                  <div className="sub-adjust-hint">{t('adjust.imageSubHint')}</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
