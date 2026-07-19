import { app, BrowserWindow, ipcMain, dialog, Menu, screen } from 'electron'
import { join, dirname, basename, extname } from 'node:path'
import { existsSync, readdirSync, readFileSync, mkdirSync, statSync, renameSync, createWriteStream } from 'node:fs'
import { spawn, ChildProcess } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { MpvController } from './mpv'
import { removeBorderLine, setCornerPreference, CORNER_DEFAULT, CORNER_DONOTROUND } from './dwm'
import {
  getSettings,
  setSetting,
  getPosition,
  savePosition,
  clearPosition,
  getPlaylistItem,
  savePlaylistItem,
  type Settings
} from './settings'

const isDev = !app.isPackaged

// electron-vite dev restarts Electron constantly; its on-disk HTTP cache can
// corrupt and then fail module loads with ERR_CACHE_READ_FAILURE (blank window).
// Disable the cache in dev to avoid it. (Must run before app is ready.)
if (isDev) app.commandLine.appendSwitch('disable-http-cache')

// Main transparent window hosts mpv video (via --wid). The OSC lives in a
// separate Win11 *acrylic* child window pinned to the bottom-center, so we can
// see whether the OS frosted-glass material looks good over the video.
let win: BrowserWindow | null = null
let oscWin: BrowserWindow | null = null
let mpv: MpvController | null = null
let preFsBounds: Electron.Rectangle | null = null
let lastAspect = 0 // last video aspect the window was fitted to (avoid re-jumping)

const OSC_H = 92
// Right panel is dynamic: PANEL_MAX_W when there's room, shrinking toward
// PANEL_MIN_W on small windows so the OSC still gets ≥ OSC_MIN_W beside it.
// The window's min width is derived from these so both always fit (panelW).
const OSC_MIN_W = 480 // OSC content cramps below this
const PANEL_MIN_W = 300 // narrowest usable panel (track names truncate)
const PANEL_MAX_W = 440 // comfortable panel width (= --panel-w default)
const OSC_GAP = 80 // OSC breathing room within its area (≈ 40px each side)
const WIN_MIN_W = PANEL_MIN_W + OSC_MIN_W + OSC_GAP // 850
const TITLEBAR_H = 32 // grey title strip reserved above the video (logical px)
let panelOpen = false // right (playlist) panel open → drives OSC shrink/shift
let leftPanelOpen = false // left (settings) panel open
// side panels as real acrylic child windows (like the OSC), so they frost the video
let rightPanelWin: BrowserWindow | null = null
let leftPanelWin: BrowserWindow | null = null
let rightPanelAnim: NodeJS.Timeout | null = null
let leftPanelAnim: NodeJS.Timeout | null = null
let hideTimer: NodeJS.Timeout | null = null
let oscAnim: NodeJS.Timeout | null = null
let oscShown = false
let oscHovered = false // pointer is over the OSC window → don't auto-hide
let hasMedia = false
let menuOpen = false // context menu is open → hide the OSC so it's not covered by it
// briefly ignore movement-triggered reveals after a fullscreen toggle — the
// resize emits a synthetic mousemove that can land in an edge zone and pop the OSC
let suppressRevealUntil = 0

const VIDEO_EXT = [
  'mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm', 'm4v', 'ts', 'mpg', 'mpeg',
  'm2ts', 'rmvb', '3gp', 'ogv', 'mp3', 'flac', 'aac', 'wav', 'm4a', 'ogg', 'opus'
]
const MAX_FOLDER_SCAN = 500 // cap a folder scan so a huge dir (e.g. a drive root) can't blow up the playlist

// ---- Playlist ----
// We manage the list ourselves (mpv only ever holds the single current file,
// loaded via loadfile-replace), so repeat / shuffle / add / remove are all
// handled here rather than through mpv's own playlist commands.
type RepeatMode = 'off' | 'all' | 'one'
let playlist: string[] = []
let plIndex = -1
let urlTitles: Record<string, string> = {} // resolved titles for URL items (nice playlist names)
let playlistKey = '' // stable id of the current URL playlist (for "resume at last item"); '' = none
let discDevice = '' // bluray-device / dvd-device path when the current item is a disc
let repeatMode: RepeatMode = 'off'
// resume: the file + position we're currently tracking, and when we last wrote it
let resumePath = ''
let resumePos = 0
let lastPosWrite = 0
let lastDuration = 0
let lastVolume = 100
let pendingResumeToast = '' // show the "Resumed from …" toast only once playback starts
// Shuffle is a persistent mode (not a one-shot reorder): the list keeps its
// display order, but auto-advance / next picks randomly. `shuffleBag` holds the
// not-yet-played indices this cycle (no repeats until it drains); `shuffleHistory`
// is the played order so Prev can step back.
let shuffleOn = false
let shuffleBag: number[] = []
let shuffleHistory: number[] = []
const isUrl = (p: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(p)

// ---- yt-dlp (on-demand) ----
// YouTube & other site URLs are resolved by mpv's ytdl_hook via yt-dlp. We don't
// bundle it (17MB, and it goes stale as sites change); instead we fetch the latest
// the first time you actually play a site URL — base install stays lean + fresh.
const MEDIA_URL_EXT =
  /\.(mp4|mkv|webm|m4v|mov|avi|flv|ts|m2ts|mpg|mpeg|m3u8|mpd|mp3|flac|aac|wav|ogg|opus|m4a)(\?|#|$)/i
let ytdlDownloading: Promise<string | null> | null = null

// mpv ytdl-format per quality cap ('' = yt-dlp's default = best available).
const YTDL_FORMAT: Record<Settings['streamQuality'], string> = {
  best: '',
  '2160': 'bestvideo[height<=?2160]+bestaudio/best[height<=?2160]',
  '1080': 'bestvideo[height<=?1080]+bestaudio/best[height<=?1080]',
  '720': 'bestvideo[height<=?720]+bestaudio/best[height<=?720]',
  '480': 'bestvideo[height<=?480]+bestaudio/best[height<=?480]'
}

const ytdlExe = (): string => join(app.getPath('userData'), 'yt-dlp', 'yt-dlp.exe')

/** A site URL (YouTube, etc.) mpv must resolve via yt-dlp — not a direct media file. */
function needsYtdl(url: string): boolean {
  return /^https?:\/\//i.test(url) && !MEDIA_URL_EXT.test(url)
}

function ytdlStale(): boolean {
  try {
    return Date.now() - statSync(ytdlExe()).mtimeMs > 14 * 24 * 3600 * 1000
  } catch {
    return true
  }
}

async function downloadYtdl(): Promise<string | null> {
  const dest = ytdlExe()
  try {
    mkdirSync(dirname(dest), { recursive: true })
    broadcast('ui:toast', 'Fetching yt-dlp…')
    const res = await fetch(
      'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
      { headers: { 'User-Agent': 'lunoir' } }
    )
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
    const tmp = `${dest}.part` // write to temp then rename so a partial file can't be used
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp))
    renameSync(tmp, dest)
    return dest
  } catch {
    broadcast('ui:toast', "Couldn't fetch yt-dlp")
    return null
  }
}

/** Ensure yt-dlp is available: use the existing copy at once (refreshing a stale
 *  one in the background); download first if it's missing. Returns its path/null. */
async function ensureYtdl(): Promise<string | null> {
  if (existsSync(ytdlExe())) {
    if (ytdlStale() && !ytdlDownloading) {
      ytdlDownloading = downloadYtdl().finally(() => (ytdlDownloading = null))
    }
    return ytdlExe()
  }
  if (!ytdlDownloading) ytdlDownloading = downloadYtdl().finally(() => (ytdlDownloading = null))
  return ytdlDownloading
}

/** An explicit playlist URL (YouTube /playlist?…) — expand it into the queue. */
function isPlaylistUrl(url: string): boolean {
  return isUrl(url) && /\/playlist\?/i.test(url)
}

const isDiscUri = (t: string): boolean => t === 'bd://' || t === 'dvd://'

/** A clean disc title, best source first:
 *  1. the disc's own META library name (BDMV/META/DL/bdmt_*.xml <di:name>) — burned
 *     into the disc, always there at playback (mpv also surfaces this as media-title).
 *  2. a media-server .nfo <title> (Emby/Kodi/Jellyfin) — only if the folder was scanned.
 *  3. the folder name.
 *  META leads because a disc may never have been scanned by a media server. */
function discTitle(root: string): string {
  // 1. the disc's own META name
  try {
    const metaDir = join(root, 'BDMV', 'META', 'DL')
    for (const f of readdirSync(metaDir)) {
      if (!/^bdmt_.*\.xml$/i.test(f)) continue
      const m = readFileSync(join(metaDir, f), 'utf8').match(/<di:name>\s*([^<]+?)\s*<\/di:name>/i)
      if (m && m[1].trim()) return m[1].trim()
    }
  } catch {
    /* no META folder */
  }
  // 2. a media-server .nfo
  const nfos = [join(root, 'BDMV', 'index.nfo'), join(root, 'index.nfo'), join(root, 'movie.nfo')]
  try {
    for (const f of readdirSync(root)) if (extname(f).toLowerCase() === '.nfo') nfos.push(join(root, f))
  } catch {
    /* ignore */
  }
  for (const nfo of nfos) {
    try {
      const m = readFileSync(nfo, 'utf8').match(/<title>\s*([^<]+?)\s*<\/title>/i)
      if (m && m[1].trim()) return m[1].trim()
    } catch {
      /* not there / unreadable */
    }
  }
  // 3. the folder name
  return basename(root)
}

/** If `target` is a Blu-ray / DVD disc folder, how to open it — else null. Accepts
 *  the disc root, or the BDMV / VIDEO_TS folder itself (played via bd:// / dvd://,
 *  which auto-selects the main title with all its tracks + chapters). */
function discInfo(target: string): { device: string; uri: string; name: string } | null {
  try {
    if (!statSync(target).isDirectory()) return null
  } catch {
    return null
  }
  const up = basename(target).toUpperCase()
  const root = up === 'BDMV' || up === 'VIDEO_TS' ? dirname(target) : target
  if (existsSync(join(root, 'BDMV', 'index.bdmv'))) return { device: root, uri: 'bd://', name: discTitle(root) }
  if (existsSync(join(root, 'VIDEO_TS', 'VIDEO_TS.IFO'))) return { device: root, uri: 'dvd://', name: discTitle(root) }
  return null
}

/** Folder picker — a video folder, or a Blu-ray/DVD disc (Windows can't mix
 *  file + folder dialogs, so this is separate from Open File). */
async function promptOpenFolder(): Promise<void> {
  if (!win) return
  const res = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select a folder (a video folder, or a Blu-ray/DVD disc)'
  })
  if (!res.canceled && res.filePaths[0]) openMedia(res.filePaths[0])
}

/** Stable id for a playlist URL — its list= param, so extra params don't change it. */
function playlistKeyOf(url: string): string {
  return 'list:' + (url.match(/[?&]list=([^&]+)/i)?.[1] ?? url)
}

/** Enumerate a playlist's entries (flat = fast, no per-video resolve): [{url,title}]. */
function enumeratePlaylist(ytdlPath: string, url: string): Promise<{ url: string; title: string }[]> {
  return new Promise(resolve => {
    const proc = spawn(
      ytdlPath,
      ['--flat-playlist', '--no-warnings', '--print', '%(url)s ||| %(title)s', url],
      { windowsHide: true }
    )
    let out = ''
    proc.stdout?.on('data', d => (out += d))
    proc.on('error', () => resolve([]))
    proc.on('close', () => {
      const entries: { url: string; title: string }[] = []
      for (const line of out.split(/\r?\n/)) {
        const sep = line.indexOf(' ||| ')
        if (sep < 0) continue
        const u = line.slice(0, sep).trim()
        if (/^https?:\/\//i.test(u)) entries.push({ url: u, title: line.slice(sep + 5).trim() || u })
      }
      resolve(entries)
    })
  })
}

/** Load a playlist URL: fetch its entries via yt-dlp and queue them all. */
async function loadPlaylistUrl(url: string): Promise<void> {
  broadcast('ui:loading', true)
  broadcast('ui:toast', 'Loading playlist…')
  const ytdl = await ensureYtdl()
  if (!ytdl) {
    broadcast('ui:loading', false) // ensureYtdl already toasted the failure
    return
  }
  const entries = await enumeratePlaylist(ytdl, url)
  if (!entries.length) {
    broadcast('ui:loading', false)
    broadcast('ui:toast', "Couldn't load playlist")
    return
  }
  playlist = entries.map(e => e.url)
  urlTitles = {}
  for (const e of entries) urlTitles[e.url] = e.title
  playlistKey = playlistKeyOf(url)
  // resume at the last video watched in this playlist (if it's still in the list)
  plIndex = 0
  if (getSettings().resumePlaylistItem) {
    const last = getPlaylistItem(playlistKey)
    const at = last ? playlist.indexOf(last) : -1
    if (at >= 0) plIndex = at
  }
  resyncShuffle()
  playCurrent() // plays the first; the loading spinner clears on its first frame
}

function playlistPayload() {
  return {
    // URL items get their resolved title once known; local items use the basename
    items: playlist.map(p => ({ path: p, name: urlTitles[p] || basename(p) })),
    index: plIndex,
    repeat: repeatMode,
    shuffle: shuffleOn
  }
}

/** (Re)fill the shuffle bag with every index except the one playing, shuffled. */
function refillShuffleBag(): void {
  const rest: number[] = []
  for (let i = 0; i < playlist.length; i++) if (i !== plIndex) rest.push(i)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  shuffleBag = rest
}

/** Next index under shuffle: drain the bag, refilling only if Repeat-All. -1 = stop. */
function nextShuffleIndex(): number {
  if (shuffleBag.length === 0) {
    if (repeatMode === 'all') refillShuffleBag()
    if (shuffleBag.length === 0) return -1
  }
  return shuffleBag.pop() as number
}

/** Sorted list of the video files directly inside a folder (non-recursive). */
function scanFolder(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter(f => VIDEO_EXT.includes(extname(f).slice(1).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
      .map(f => join(dir, f))
  } catch {
    return []
  }
}

/** Open media the user picked — a file, a URL, a Blu-ray/DVD disc folder, or a
 *  plain folder (whose videos are queued). */
function openMedia(target: string): void {
  if (isPlaylistUrl(target)) {
    loadPlaylistUrl(target) // async: enumerate the entries, then queue + play them
    return
  }
  const disc = discInfo(target)
  if (disc) {
    playlist = [disc.uri]
    plIndex = 0
    playlistKey = ''
    urlTitles = { [disc.uri]: disc.name } // show the folder name in the playlist/title
    discDevice = disc.device
    resyncShuffle()
    playCurrent()
    return
  }
  playlistKey = '' // a single file / folder scan isn't a resumable URL playlist
  discDevice = ''
  let isDir = false
  try {
    isDir = statSync(target).isDirectory()
  } catch {
    /* not a real path (e.g. av://…) */
  }
  if (isDir) {
    // an explicitly opened plain folder → queue the videos directly inside it
    // (non-recursive; subfolders are NOT scanned). A folder with no top-level
    // videos — e.g. a parent of disc folders — just reports it, no silent hang.
    let files = scanFolder(target)
    if (!files.length) {
      broadcast('ui:toast', 'No playable media in this folder')
      return
    }
    if (files.length > MAX_FOLDER_SCAN) {
      broadcast('ui:toast', `Folder has ${files.length} videos — loading the first ${MAX_FOLDER_SCAN}`)
      files = files.slice(0, MAX_FOLDER_SCAN)
    }
    playlist = files
    plIndex = 0
  } else if (isUrl(target) || !getSettings().scanFolderIntoPlaylist) {
    playlist = [target]
    plIndex = 0
  } else {
    // opened a file with "scan folder" on → queue its siblings, start on it.
    // A huge folder just plays the one file (don't build a runaway list).
    const files = scanFolder(dirname(target))
    playlist = files.length && files.length <= MAX_FOLDER_SCAN ? files : [target]
    const norm = (s: string) => s.replace(/\\/g, '/').toLowerCase()
    plIndex = Math.max(0, playlist.findIndex(f => norm(f) === norm(target)))
  }
  resyncShuffle() // new list → reseed the shuffle bag
  playCurrent()
}

function playCurrent(): void {
  if (plIndex < 0 || plIndex >= playlist.length) return
  const target = playlist[plIndex]
  // remember which item of this URL playlist we're on, so reopening resumes here
  if (playlistKey && getSettings().resumePlaylistItem) savePlaylistItem(playlistKey, target)
  broadcast('playlist:changed', playlistPayload())
  if (mpv) {
    // a disc: point mpv at the device + give it a friendly title; else clear any
    // stale override (force-media-title is persistent across loads)
    if (isDiscUri(target)) {
      mpv.setProperty(target === 'bd://' ? 'bluray-device' : 'dvd-device', discDevice)
      mpv.setProperty('force-media-title', urlTitles[target] || 'Blu-ray')
    } else {
      mpv.setProperty('force-media-title', '')
    }
  }
  if (isUrl(target) || isDiscUri(target)) broadcast('ui:loading', true) // grey until the first frame (disc scan takes a moment)
  if (needsYtdl(target)) {
    // fetch yt-dlp if needed, point mpv's ytdl_hook at it, then load
    ensureYtdl().then(path => {
      if (!mpv) return
      if (path) mpv.setProperty('script-opts', `ytdl_hook-ytdl_path=${path.replace(/\\/g, '/')}`)
      mpv.loadFile(target)
      mpv.setProperty('pause', false)
    })
    return
  }
  mpv?.loadFile(target)
  mpv?.setProperty('pause', false) // always start playing on load
}

function playIndex(i: number): void {
  if (i < 0 || i >= playlist.length) return
  plIndex = i
  // forward navigation (click / next): keep the shuffle bag + history in step
  if (shuffleOn) {
    shuffleBag = shuffleBag.filter(x => x !== i)
    shuffleHistory.push(i)
  }
  playCurrent()
}

function playNext(): void {
  if (shuffleOn) {
    const i = nextShuffleIndex()
    if (i >= 0) playIndex(i)
    return
  }
  if (plIndex < playlist.length - 1) playIndex(plIndex + 1)
}

function playPrev(): void {
  if (shuffleOn) {
    // step back through the played history (don't re-push it)
    if (shuffleHistory.length >= 2) {
      shuffleHistory.pop()
      plIndex = shuffleHistory[shuffleHistory.length - 1]
      playCurrent()
    }
    return
  }
  if (plIndex > 0) playIndex(plIndex - 1)
}

/** What to do when the current item ends (driven by mpv's eof-reached). */
function onEnded(): void {
  if (repeatMode === 'one') {
    playCurrent() // replay the same file
    return
  }
  if (shuffleOn) {
    const i = nextShuffleIndex()
    if (i >= 0) playIndex(i) // else bag drained & not Repeat-All → stop
    return
  }
  if (plIndex < playlist.length - 1) playIndex(plIndex + 1)
  else if (repeatMode === 'all' && playlist.length > 0) playIndex(0) // wrap around
}

/** Rebuild the shuffle bag/history after the list itself changes. */
function resyncShuffle(): void {
  if (!shuffleOn) return
  refillShuffleBag()
  shuffleHistory = plIndex >= 0 ? [plIndex] : []
}

/** Toggle shuffle mode (list order stays; auto-advance / next goes random). */
function toggleShuffle(): void {
  shuffleOn = !shuffleOn
  if (shuffleOn) {
    resyncShuffle() // seed bag + history from the current list/position
  } else {
    shuffleBag = []
    shuffleHistory = []
  }
  broadcast('playlist:changed', playlistPayload())
}

/** Append files to the list; start playing if nothing was queued before. */
function addToPlaylist(paths: string[]): void {
  const fresh = paths.filter(p => p && !playlist.includes(p))
  if (!fresh.length) return
  const wasEmpty = playlist.length === 0
  playlist.push(...fresh)
  resyncShuffle() // fold the new items into the shuffle bag
  if (wasEmpty) {
    plIndex = 0
    playCurrent()
  } else {
    broadcast('playlist:changed', playlistPayload())
  }
}

/** Remove one item; if it's the one playing, advance to what slides into place. */
function removeFromPlaylist(i: number): void {
  if (i < 0 || i >= playlist.length) return
  const removingCurrent = i === plIndex
  playlist.splice(i, 1)
  if (i < plIndex) plIndex--
  if (removingCurrent) {
    if (playlist.length === 0) {
      plIndex = -1
    } else {
      plIndex = Math.min(plIndex, playlist.length - 1)
      resyncShuffle() // indices shifted — rebuild the bag before advancing
      playCurrent()
      return
    }
  }
  resyncShuffle() // indices shifted — rebuild the bag
  broadcast('playlist:changed', playlistPayload())
}

/** Cycle the repeat mode: off → all → one → off. */
function cycleRepeat(): void {
  repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off'
  broadcast('playlist:changed', playlistPayload())
}

function resolveMpvPath(): string | null {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'mpv', 'mpv.exe')]
    : [
        join(app.getAppPath(), 'resources', 'mpv', 'mpv.exe'),
        join(process.cwd(), 'resources', 'mpv', 'mpv.exe')
      ]
  return candidates.find(existsSync) ?? null
}

// ---- Per-track metadata via MediaInfo ----
// mpv reports demux-bitrate / codec-profile only for the *active* track, so the
// panel can't show bitrate or the commercial audio format (DTS-HD MA, TrueHD
// Atmos…) for the others. MediaInfo probes every stream at once. We join its
// results back onto mpv's track-list by ff-index (== MediaInfo's StreamOrder).
interface ProbeStream {
  format?: string // 'AC-3', 'DTS', 'MLP FBA'
  commercial?: string // 'Dolby Digital', 'DTS-HD Master Audio', 'Dolby TrueHD with Dolby Atmos'
  features?: string // 'LC', 'XLL' (codec sub-profile)
  bitRate?: number // bps
}
let miProc: ChildProcess | null = null // in-flight MediaInfo process
let probeTarget = '' // path of the file currently being probed (guards stale results)
// Latest track-list / selected audio id / probe results — the OSC's audio badge
// needs the *active* track's commercial format (Atmos / DTS:X …), which is the
// join of these three. Main is where all three flow through, so it resolves and
// broadcasts the ready value.
let lastTracks: Array<Record<string, unknown>> = []
let lastAid: number | false = false
let lastProbe: Record<number, ProbeStream> = {}

function resolveMediaInfoPath(): string | null {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'mediainfo', 'MediaInfo.exe')]
    : [
        join(app.getAppPath(), 'resources', 'mediainfo', 'MediaInfo.exe'),
        join(process.cwd(), 'resources', 'mediainfo', 'MediaInfo.exe')
      ]
  return candidates.find(existsSync) ?? null
}

/** The video track's HDR flavour: 'Dolby Vision' / 'HDR10+' / 'HDR10' / '' (SDR
 *  or unknown). mpv can't tell DV from HDR10 (both are PQ); MediaInfo reads it. */
function videoHdrLabel(t: Record<string, unknown>): string {
  const f = `${t.HDR_Format ?? ''} ${t.HDR_Format_Commercial ?? ''}`.toLowerCase()
  if (f.includes('dolby vision')) return 'Dolby Vision' // any DV profile → one label
  if (f.includes('2094') || f.includes('hdr10+')) return 'HDR10+'
  if (f.includes('2086') || f.includes('hdr10')) return 'HDR10'
  return ''
}

/** Parse MediaInfo's --Output=JSON: per-audio-track metadata (keyed by ff-index)
 *  plus the video HDR flavour. */
function parseMediaInfo(json: string): { audio: Record<number, ProbeStream>; hdr: string } {
  const audio: Record<number, ProbeStream> = {}
  let hdr = ''
  const tracks = JSON.parse(json)?.media?.track
  if (!Array.isArray(tracks)) return { audio, hdr }
  for (const t of tracks) {
    if (t['@type'] === 'Video' && !hdr) {
      hdr = videoHdrLabel(t)
      continue
    }
    if (t['@type'] !== 'Audio') continue
    const idx = parseInt(t.StreamOrder, 10) // absolute stream order == mpv ff-index
    if (!Number.isFinite(idx)) continue
    const br = parseInt(t.BitRate ?? t.BitRate_Nominal, 10)
    audio[idx] = {
      format: t.Format || undefined,
      commercial: t.Format_Commercial_IfAny || undefined,
      features: t.Format_AdditionalFeatures || undefined,
      bitRate: Number.isFinite(br) && br > 0 ? br : undefined
    }
  }
  return { audio, hdr }
}

/** Probe a freshly-loaded file and broadcast per-track audio metadata. */
function runProbe(file: string): void {
  // only probe real local files — skip URLs, av://lavfi, bd://, dvd://, etc.
  if (!file || isUrl(file) || !existsSync(file)) return
  const miPath = resolveMediaInfoPath()
  if (!miPath) return
  if (miProc) {
    try { miProc.kill() } catch {}
    miProc = null
  }
  probeTarget = file
  const proc = spawn(miPath, ['--Output=JSON', file], { windowsHide: true })
  miProc = proc
  let out = ''
  proc.stdout?.on('data', d => (out += d))
  proc.on('error', () => { if (miProc === proc) miProc = null })
  proc.on('close', () => {
    if (miProc === proc) miProc = null
    if (probeTarget !== file) return // a newer file superseded this probe
    let streams: Record<number, ProbeStream> = {}
    let hdr = ''
    try {
      const parsed = parseMediaInfo(out)
      streams = parsed.audio
      hdr = parsed.hdr
    } catch { /* leave empty */ }
    lastProbe = streams
    broadcast('media:probe', { path: file, streams })
    broadcast('video:hdr', hdr) // Dolby Vision / HDR10+ / HDR10 / '' for the OSC badge
    broadcastActiveAudio() // the active track now has a commercial name
  })
}

/** Resolve the active audio track's MediaInfo fields and push them to the OSC. */
function broadcastActiveAudio(): void {
  const t = lastTracks.find(x => x.type === 'audio' && x.id === lastAid)
  const ffi = t && typeof t['ff-index'] === 'number' ? (t['ff-index'] as number) : -1
  const ff = ffi >= 0 ? lastProbe[ffi] : undefined
  // native channel count from the demuxer — reliable per-track and fires on every
  // track switch (audio-params/channel-count doesn't always), so the badge keeps
  // its "5.1" when you switch tracks.
  const chRaw = t?.['demux-channel-count']
  const channels = typeof chRaw === 'number' ? chRaw : 0
  broadcast('audio:active', {
    commercial: ff?.commercial ?? '',
    features: ff?.features ?? '',
    channels
  })
}

function loadRenderer(w: BrowserWindow, query = ''): void {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    w.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${query ? `?${query}` : ''}`)
  } else {
    w.loadFile(join(__dirname, '../renderer/index.html'), query ? { search: `?${query}` } : undefined)
  }
}

function broadcast(channel: string, ...args: unknown[]): void {
  for (const w of [win, oscWin, rightPanelWin, leftPanelWin]) {
    if (w && !w.isDestroyed()) w.webContents.send(channel, ...args)
  }
}

// Right-panel width for a given window width: full (PANEL_MAX_W) when there's
// room, shrinking toward PANEL_MIN_W on small windows to protect the OSC.
function panelW(winWidth: number): number {
  return Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, winWidth - OSC_MIN_W - OSC_GAP))
}

// Push the current panel width to the renderer so the --panel-w CSS var tracks
// the window (the panel visibly narrows as the window gets small).
function pushPanelWidth(): void {
  if (!win || win.isDestroyed()) return
  win.webContents.send('ui:panel-width', panelW(win.getBounds().width))
}

/** Resting bounds of the OSC: bottom-center, moved out of the side panel's way. */
function oscRestBounds(): Electron.Rectangle {
  const b = win!.getBounds()
  const avail = panelOpen ? b.width - panelW(b.width) : b.width
  const w = Math.min(620, Math.max(OSC_MIN_W, avail - OSC_GAP))
  const margin = Math.max(44, Math.round(b.height * 0.09))
  return {
    x: Math.round(b.x + (avail - w) / 2),
    y: Math.round(b.y + b.height - OSC_H - margin),
    width: Math.round(w),
    height: OSC_H
  }
}

// Reveal / hide the OSC by fading + sliding the whole acrylic window as one unit
// (setOpacity + setBounds). This avoids Windows' show() scale animation and the
// "two layer" look of fading the content over a static frosted frame.
function animateOsc(reveal: boolean): void {
  if (!win || !oscWin || win.isDestroyed() || oscWin.isDestroyed()) return
  if (oscAnim) {
    clearInterval(oscAnim)
    oscAnim = null
  }
  const rest = oscRestBounds()
  const lift = 22
  const dur = reveal ? 260 : 190
  if (reveal && !oscWin.isVisible()) {
    // show while fully transparent so the OS open-animation isn't seen
    oscWin.setOpacity(0)
    oscWin.setBounds({ ...rest, y: rest.y + lift })
    oscWin.showInactive()
  }
  oscShown = reveal
  const fromOp = oscWin.getOpacity()
  const toOp = reveal ? 1 : 0
  const fromY = oscWin.getBounds().y
  const toY = reveal ? rest.y : rest.y + lift
  const t0 = Date.now()
  oscAnim = setInterval(() => {
    if (!oscWin || oscWin.isDestroyed()) {
      if (oscAnim) clearInterval(oscAnim)
      oscAnim = null
      return
    }
    const p = Math.min(1, (Date.now() - t0) / dur)
    const e = reveal ? 1 - Math.pow(1 - p, 3) : p * p
    oscWin.setOpacity(fromOp + (toOp - fromOp) * e)
    oscWin.setBounds({ ...rest, y: Math.round(fromY + (toY - fromY) * e) })
    if (p >= 1) {
      clearInterval(oscAnim!)
      oscAnim = null
    }
  }, 16)
}

/** Keep the OSC glued to the window when it moves/resizes. */
function layoutOsc(): void {
  if (!win || !oscWin || win.isDestroyed() || oscWin.isDestroyed()) return
  if (oscShown && !oscAnim) oscWin.setBounds(oscRestBounds())
}

/**
 * Glide the OSC to its resting spot when the side panel opens/closes, so it
 * re-centers in sync with the panel's slide instead of snapping. Matches the
 * panel's easeOutExpo feel (fast out, long settle). Skips when hidden.
 */
function slideOscToRest(): void {
  if (!oscWin || oscWin.isDestroyed() || !oscShown) return
  const rest = oscRestBounds()
  const from = oscWin.getBounds()
  if (from.x === rest.x && from.y === rest.y && from.width === rest.width) return
  if (oscAnim) {
    clearInterval(oscAnim)
    oscAnim = null
  }
  oscWin.setOpacity(1) // it's shown — snap opacity in case a reveal was mid-flight
  const dur = 420
  const t0 = Date.now()
  oscAnim = setInterval(() => {
    if (!oscWin || oscWin.isDestroyed()) {
      if (oscAnim) clearInterval(oscAnim)
      oscAnim = null
      return
    }
    const p = Math.min(1, (Date.now() - t0) / dur)
    const e = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p) // easeOutExpo
    oscWin.setBounds({
      x: Math.round(from.x + (rest.x - from.x) * e),
      y: Math.round(from.y + (rest.y - from.y) * e),
      width: Math.round(from.width + (rest.width - from.width) * e),
      height: OSC_H
    })
    if (p >= 1) {
      clearInterval(oscAnim!)
      oscAnim = null
    }
  }, 16)
}

// ---------- Side panels (acrylic child windows, cloned from the OSC) ----------

/** Resting bounds of a side panel: a full-height strip on the given edge, below
 *  the title bar (top = 0 in fullscreen), width = panelW. */
function panelBounds(side: 'right' | 'left'): Electron.Rectangle {
  const b = win!.getBounds()
  const top = preFsBounds ? 0 : TITLEBAR_H
  const w = panelW(b.width)
  return {
    x: side === 'right' ? b.x + b.width - w : b.x,
    y: b.y + top,
    width: w,
    height: b.height - top
  }
}

const panelWinOf = (side: 'right' | 'left') => (side === 'right' ? rightPanelWin : leftPanelWin)
function setPanelAnim(side: 'right' | 'left', t: NodeJS.Timeout | null): void {
  if (side === 'right') rightPanelAnim = t
  else leftPanelAnim = t
}

/**
 * Fade a side-panel window in/out *in place* (at its resting bounds). A separate
 * window can't be clipped to the parent, so a slide would spill the panel out over
 * the desktop — hence a pure opacity fade, never moving outside the window. When
 * closed we leave it at rest (opacity 0) but click-through, so it neither pops
 * Windows' scale animation (never hidden) nor blocks clicks on the video beneath.
 */
function animatePanel(side: 'right' | 'left', reveal: boolean): void {
  const pw = panelWinOf(side)
  if (!win || !pw || win.isDestroyed() || pw.isDestroyed()) return
  const prev = side === 'right' ? rightPanelAnim : leftPanelAnim
  if (prev) clearInterval(prev)
  // open in step with the content-slide CSS; on close the frost just vanishes fast
  // (the slide feel is carried by the content, so the window needn't linger)
  const dur = reveal ? 240 : 120
  if (reveal) {
    pw.setBounds(panelBounds(side)) // always at rest — within the window, never outside
    pw.setIgnoreMouseEvents(false)
    if (!pw.isVisible()) {
      pw.setOpacity(0)
      pw.showInactive()
    }
  }
  const fromOp = pw.getOpacity()
  const toOp = reveal ? 1 : 0
  const t0 = Date.now()
  const timer = setInterval(() => {
    if (!pw || pw.isDestroyed()) {
      setPanelAnim(side, null)
      clearInterval(timer)
      return
    }
    const p = Math.min(1, (Date.now() - t0) / dur)
    // easeOutCubic both ways: the fade starts FAST, so on close the frost drops out
    // immediately (in step with the content sliding away) instead of lingering
    const e = 1 - Math.pow(1 - p, 3)
    pw.setOpacity(fromOp + (toOp - fromOp) * e)
    if (p >= 1) {
      clearInterval(timer)
      setPanelAnim(side, null)
      if (!reveal && !pw.isDestroyed()) pw.setIgnoreMouseEvents(true) // closed → don't block the video
    }
  }, 16)
  setPanelAnim(side, timer)
}

/** Keep an open panel glued to the window on move/resize (skip mid-animation). */
function layoutPanel(side: 'right' | 'left'): void {
  const pw = panelWinOf(side)
  const open = side === 'right' ? panelOpen : leftPanelOpen
  const anim = side === 'right' ? rightPanelAnim : leftPanelAnim
  if (!win || !pw || win.isDestroyed() || pw.isDestroyed()) return
  if (open && !anim) pw.setBounds(panelBounds(side))
}

/** Toggle the right (playlist) panel window; it shifts the OSC out of the way. */
function togglePlaylistPanel(): void {
  if (!rightPanelWin) return
  panelOpen = !panelOpen
  animatePanel('right', panelOpen) // window fades in place
  rightPanelWin.webContents.send('panel:reveal', panelOpen) // content slides within it
  slideOscToRest() // re-center the OSC around the panel
  broadcast('ui:panel-open', panelOpen) // OSC list button pressed-state
}

function revealUi(): void {
  if (menuOpen) return // don't pop the OSC over/under the open context menu
  broadcast('ui:reveal')
  // only run the slide-up when the OSC is actually hidden — re-running it while
  // it's already at rest re-reads getBounds() and, with DPI rounding, animates a
  // ±1px difference every mouse move (visible jitter)
  if (hasMedia && !oscShown) animateOsc(true)
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (oscHovered) return // pointer is over the OSC — keep it up (no flicker)
    broadcast('ui:hide')
    animateOsc(false) // slide down + fade out
  }, 5000)
}

function toggleFullscreen(): void {
  if (!win) return
  suppressRevealUntil = Date.now() + 350 // don't let the resize's mousemove pop the OSC
  if (preFsBounds) {
    // EXIT — native fullscreen restores the previous bounds itself
    preFsBounds = null
    win.setFullScreen(false)
    setCornerPreference(win, CORNER_DEFAULT) // rounded corners look good windowed
  } else {
    // ENTER — OS-native fullscreen state: Windows treats it as a fullscreen app
    // (better z-order, notifications suppressed) — no borderless+alwaysOnTop hack.
    preFsBounds = win.getBounds() // still used as the "is fullscreen" flag
    win.setFullScreen(true)
    setCornerPreference(win, CORNER_DONOTROUND)
  }
  win.webContents.send('win:fullscreen', preFsBounds != null)
  updateVideoMargin() // 0 in fullscreen (video fills), restore the strip on exit
  // the window size just changed — snap the OSC to the new bottom-center and
  // cancel any in-flight reveal/hide so it doesn't settle at the old position
  const placeOsc = (): void => {
    if (oscWin && !oscWin.isDestroyed() && oscShown) {
      if (oscAnim) {
        clearInterval(oscAnim)
        oscAnim = null
      }
      oscWin.setOpacity(1)
      oscWin.setBounds(oscRestBounds())
    }
    // snap any open panels to their new full-height bounds (top = 0 in fullscreen)
    for (const side of ['right', 'left'] as const) {
      const pw = panelWinOf(side)
      const open = side === 'right' ? panelOpen : leftPanelOpen
      if (pw && !pw.isDestroyed() && open) {
        const anim = side === 'right' ? rightPanelAnim : leftPanelAnim
        if (anim) {
          clearInterval(anim)
          setPanelAnim(side, null)
        }
        pw.setOpacity(1)
        pw.setBounds(panelBounds(side))
      }
    }
  }
  placeOsc()
  setTimeout(placeOsc, 60)
}

/**
 * Reserve the title-bar strip at the top of the video via mpv's top margin so
 * the picture sits *below* the grey title bar instead of under it. The ratio is
 * unitless (px/px), so it's DPI-independent. Zero in fullscreen (video fills).
 */
function updateVideoMargin(): void {
  if (!mpv || !win || win.isDestroyed()) return
  const h = win.getContentBounds().height
  const ratio = preFsBounds || h <= 0 ? 0 : Math.min(0.4, TITLEBAR_H / h)
  mpv.setProperty('video-margin-ratio-top', ratio)
}

/**
 * Resize the window so the *video area* (client minus the title strip) matches
 * the video's aspect ratio — picture fills it edge-to-edge, no letterbox bars in
 * windowed mode. Keeps the current width, stays centered, clamps to the display.
 * Skips when the ratio is unchanged (don't jump on same-ratio episodes) or when
 * fullscreen / maximized.
 */
function fitWindowToVideo(aspect: number): void {
  if (!win || win.isDestroyed()) return
  if (!(aspect > 0.2 && aspect < 5)) return

  const changed = Math.abs(aspect - lastAspect) >= 0.01
  lastAspect = aspect

  // one-time fit of the window to the video aspect so it opens filled; skip if
  // the ratio is unchanged, or when fullscreen / maximized. Manual resize after
  // this just lets mpv letterbox/pillarbox to keep the picture's own aspect
  // (standard contain fit — the window can be any shape).
  if (!changed || preFsBounds || win.isMaximized()) return

  const b = win.getBounds()
  const disp = screen.getDisplayMatching(b).workArea
  const maxW = Math.round(disp.width * 0.92)
  const maxH = Math.round(disp.height * 0.92)

  let w = b.width
  let videoH = Math.round(w / aspect)
  let h = videoH + TITLEBAR_H
  if (h > maxH) { h = maxH; videoH = h - TITLEBAR_H; w = Math.round(videoH * aspect) }
  if (w > maxW) { w = maxW; videoH = Math.round(w / aspect); h = videoH + TITLEBAR_H }
  w = Math.max(w, WIN_MIN_W)
  h = Math.max(h, 320)

  // keep the window centered on its current center, clamped into the work area
  const cx = b.x + b.width / 2
  const cy = b.y + b.height / 2
  let x = Math.round(cx - w / 2)
  let y = Math.round(cy - h / 2)
  x = Math.max(disp.x, Math.min(x, disp.x + disp.width - w))
  y = Math.max(disp.y, Math.min(y, disp.y + disp.height - h))

  win.setBounds({ x, y, width: w, height: h })
  layoutOsc()
  updateVideoMargin()
}

/** An acrylic side-panel child window (clone of the OSC), square-cornered since
 *  it docks to the window edge. Loaded with `?win=panel&kind=…`; shown on open. */
function makePanelWindow(kind: 'playlist' | 'settings'): BrowserWindow {
  const pw = new BrowserWindow({
    width: PANEL_MAX_W,
    height: 600, // placeholders; real bounds set on open by panelBounds()
    frame: false,
    transparent: false,
    backgroundMaterial: 'acrylic',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: true, // settings has text inputs; panels take focus on click
    hasShadow: false,
    roundedCorners: false, // docked to the edge → square reads better than the OSC's rounding
    parent: win!,
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  loadRenderer(pw, `win=panel&kind=${kind}`)
  pw.webContents.once('did-finish-load', () => {
    if (pw.isDestroyed()) return
    removeBorderLine(pw)
    setCornerPreference(pw, CORNER_DONOTROUND)
    // pre-warm: show it once now, fully transparent + click-through at its resting
    // spot, so Windows plays its window-show scale animation while it's invisible.
    // Every later open then finds it already shown → a clean fade, no first-time zoom.
    if (win && !win.isDestroyed()) {
      pw.setBounds(panelBounds(kind === 'playlist' ? 'right' : 'left'))
      pw.setOpacity(0)
      pw.setIgnoreMouseEvents(true)
      pw.showInactive()
    }
  })
  pw.on('closed', () => {
    if (kind === 'playlist') rightPanelWin = null
    else leftPanelWin = null
  })
  return pw
}

function createWindows(): void {
  const settings = getSettings()
  const saved = settings.rememberWindow ? settings.windowBounds : null
  win = new BrowserWindow({
    // restore the last size/position when "remember window" is on, else default
    ...(saved
      ? { x: saved.x, y: saved.y, width: saved.width, height: saved.height }
      : {
          width: 1000,
          height: 620,
          // MMP_LEFT: dev-only — park at the left edge so test screenshots don't
          // sit under other UI (normal launch stays centered).
          ...(process.env['MMP_LEFT'] ? { x: 40, y: 60 } : { center: true })
        }),
    minWidth: WIN_MIN_W,
    minHeight: 320,
    frame: false,
    // opaque + acrylic: the empty state / uncovered areas show a frosted desktop
    // (like the taskbar). mpv's video child covers it where there's picture.
    backgroundMaterial: 'acrylic',
    show: false,
    title: 'Lunoir',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  loadRenderer(win)

  oscWin = new BrowserWindow({
    width: 620,
    height: OSC_H,
    frame: false,
    transparent: false,
    backgroundMaterial: 'acrylic',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    // not focusable: clicking a button must not activate the OSC child window —
    // in fullscreen that would drop the main window's foreground state and pop the
    // taskbar. It has no text inputs, so clicks/drags still work without focus.
    focusable: false,
    hasShadow: false,
    roundedCorners: true,
    parent: win,
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  loadRenderer(oscWin, 'win=osc')

  rightPanelWin = makePanelWindow('playlist')

  // keep the OSC + panels glued to the main window
  win.on('move', () => {
    layoutOsc()
    layoutPanel('right')
    layoutPanel('left')
  })
  win.on('resize', () => {
    layoutOsc()
    updateVideoMargin() // keep the reserved title strip proportional as height changes
    pushPanelWidth() // panel width tracks the window width
    layoutPanel('right')
    layoutPanel('left')
  })

  // broadcast app active/inactive so the renderer can compensate the acrylic
  // (Win11 lightens acrylic on inactive windows)
  const updateFocus = () =>
    broadcast(
      'app:focus',
      BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isFocused())
    )
  for (const w of [win, oscWin, rightPanelWin, leftPanelWin]) {
    if (!w) continue
    w.on('focus', updateFocus)
    w.on('blur', () => setTimeout(updateFocus, 30))
  }

  win.once('ready-to-show', () => {
    win?.show()
    if (win) removeBorderLine(win) // drop the Win11 hairline border (visible in fullscreen)
    startMpv()
  })
  oscWin.webContents.once('did-finish-load', () => {
    if (oscWin) removeBorderLine(oscWin)
    layoutOsc()
    revealUi()
  })

  // save volume / bounds / resume position while the window still exists
  win.on('close', () => persistState())
  win.on('closed', () => {
    for (const w of [oscWin, rightPanelWin, leftPanelWin]) {
      if (w && !w.isDestroyed()) w.close()
    }
    mpv?.quit()
    win = null
  })
  oscWin.on('closed', () => {
    oscWin = null
  })
}

/** Push settings mpv cares about: hwdec, preferred track languages, sub visibility. */
function applyMpvSettings(): void {
  if (!mpv) return
  const s = getSettings()
  mpv.setProperty('hwdec', s.hwdec)
  mpv.setProperty('alang', s.audioLang) // '' = mpv default (file's own order)
  mpv.setProperty('slang', s.subLang)
  mpv.setProperty('sub-visibility', s.subsDefaultOn)
  mpv.setProperty('sub-auto', s.autoLoadSubs ? 'fuzzy' : 'no') // auto-pick external subs
  mpv.setProperty('sub-hdr-peak', s.subHdrPeak) // HDR subtitle brightness (nits); ignored for SDR
  mpv.setProperty('audio-pitch-correction', s.keepPitch) // keep pitch when changing speed
  mpv.setProperty('ytdl-format', YTDL_FORMAT[s.streamQuality]) // online quality cap
  applyYtdlCookies()
}

/** Screenshot image format: PNG (lossless) or JPG (high quality, smaller files). */
function applyScreenshotFormat(): void {
  if (!mpv) return
  const fmt = getSettings().screenshotFormat
  mpv.setProperty('screenshot-format', fmt)
  if (fmt === 'jpg') mpv.setProperty('screenshot-jpeg-quality', 95) // barely-visible compression
}

/** Feed yt-dlp browser cookies (member/Premium/age-restricted) when the user opts in. */
function applyYtdlCookies(): void {
  if (!mpv) return
  const s = getSettings()
  mpv.setProperty('ytdl-raw-options', s.useCookies ? `cookies-from-browser=${s.cookiesBrowser}` : '')
}

/** Effective screenshot folder ('' setting → the Pictures/Lunoir default). */
function screenshotDir(): string {
  return getSettings().screenshotDir || join(app.getPath('pictures'), 'Lunoir')
}

function applyScreenshotDir(): void {
  if (!mpv) return
  const dir = screenshotDir()
  try { mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }
  mpv.setProperty('screenshot-directory', dir)
}

/** Save volume / window bounds / playback position on exit (per the toggles). */
function persistState(): void {
  const s = getSettings()
  if (s.rememberVolume) setSetting('volume', lastVolume)
  if (s.rememberWindow && win && !win.isDestroyed() && !preFsBounds && !win.isMaximized()) {
    setSetting('windowBounds', win.getBounds())
  }
  if (s.resumePlayback && resumePath) {
    const nearEnd = lastDuration > 0 && resumePos > lastDuration - 10
    if (resumePos > 5 && !nearEnd) savePosition(resumePath, resumePos)
    else clearPosition(resumePath) // watched to the end → don't resume next time
  }
}

function mmss(sec: number): string {
  sec = Math.max(0, Math.floor(sec))
  const s = sec % 60
  const m = Math.floor(sec / 60) % 60
  const h = Math.floor(sec / 3600)
  const p = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`
}

function startMpv(): void {
  const mpvPath = resolveMpvPath()
  if (!mpvPath) {
    dialog.showErrorBox(
      'mpv not found',
      'Could not find mpv.exe.\nRun "npm run setup" to download it into resources/mpv/.'
    )
    return
  }
  if (!win) return

  const hbuf = win.getNativeWindowHandle()
  const wid = hbuf.length === 8 ? hbuf.readBigUInt64LE() : BigInt(hbuf.readUInt32LE())

  mpv = new MpvController(mpvPath)
  mpv.on('property', (name: string, data: unknown) => {
    if ((name === 'path' || name === 'filename' || name === 'media-title') && data) hasMedia = true
    broadcast('mpv:property', { name, data })
    // a new file loaded → drop stale probe + HDR badge, re-probe its tracks
    if (name === 'path' && typeof data === 'string') {
      lastProbe = {}
      broadcast('video:hdr', '') // clear until MediaInfo re-resolves (gamma fallback covers HDR meanwhile)
      resumePath = data // track this file's position for resume
      resumePos = 0
      lastDuration = 0
      runProbe(data)
    }
    // give URL playlist items a real name once mpv resolves the media title
    if (name === 'media-title' && typeof data === 'string' && data && plIndex >= 0 && isUrl(playlist[plIndex])) {
      if (urlTitles[playlist[plIndex]] !== data) {
        urlTitles[playlist[plIndex]] = data
        broadcast('playlist:changed', playlistPayload())
      }
    }
    // keep the active-audio resolver's inputs current, re-push on any change
    if (name === 'track-list') {
      lastTracks = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []
      broadcastActiveAudio()
    } else if (name === 'aid') {
      lastAid = typeof data === 'number' ? data : false
      broadcastActiveAudio()
    } else if (name === 'duration' && typeof data === 'number') {
      lastDuration = data
    } else if (name === 'volume' && typeof data === 'number') {
      lastVolume = data
    } else if (name === 'time-pos' && typeof data === 'number') {
      resumePos = data
      // throttled resume-position save; clear it once we're near the end (watched)
      if (getSettings().resumePlayback && resumePath && Date.now() - lastPosWrite > 5000) {
        lastPosWrite = Date.now()
        const nearEnd = lastDuration > 0 && data > lastDuration - 10
        if (data > 5 && !nearEnd) savePosition(resumePath, data)
        else if (nearEnd) clearPosition(resumePath)
      }
    }
    // (no auto-reveal on load: playback starts clean; the OSC appears on activity)
    // advance / repeat when the current item ends
    if (name === 'eof-reached' && data === true) onEnded()
    // fit the window to the video's aspect ratio (no letterbox in windowed mode)
    if (name === 'video-params/aspect' && typeof data === 'number') fitWindowToVideo(data)
  })
  mpv.on('mpv-event', (event: string) => {
    broadcast('mpv:event', event)
    if (event === 'end-file') broadcast('ui:loading', false)
    if (event === 'playback-restart') {
      broadcast('ui:loading', false) // first frame is up (after any buffering)
      if (pendingResumeToast) {
        // now that playback actually started, announce the resume (not during the
        // grey loading gap — which for streams comes well before this)
        broadcast('ui:toast', `Resumed from ${pendingResumeToast}`)
        pendingResumeToast = ''
      }
    }
    // resume: seek to the saved position as soon as the file is loaded (so a stream
    // buffers at the right spot); the toast waits for playback-restart above
    if (event === 'file-loaded') {
      pendingResumeToast = '' // clear any stale pending toast from a failed load
      if (getSettings().resumePlayback && resumePath) {
        const pos = getPosition(resumePath)
        if (typeof pos === 'number' && pos > 5) {
          mpv?.command(['seek', pos, 'absolute']).catch(() => {})
          pendingResumeToast = mmss(pos)
        }
      }
    }
  })
  mpv.on('log', (line: string) => isDev && process.stdout.write(`[mpv] ${line}`))
  mpv.on('connected', () => {
    broadcast('mpv:connected')
    updateVideoMargin() // reserve the title strip from the start
    applyMpvSettings() // hwdec / preferred languages / subtitle visibility
    const startup = getSettings()
    if (startup.rememberVolume) {
      lastVolume = startup.volume
      mpv!.setProperty('volume', startup.volume)
    }
    // screenshots (context-menu action) → the chosen folder, PNG, named after the
    // source + playback timestamp
    applyScreenshotDir()
    mpv!.setProperty('screenshot-template', '%F_%wH-%wM-%wS')
    applyScreenshotFormat()
    if (process.env['MMP_OPEN']) {
      setTimeout(() => openMedia(process.env['MMP_OPEN'] as string), 300)
      if (process.env['MMP_PANEL']) setTimeout(() => win?.webContents.send('ui:panel-toggle', 'playlist'), 900)
      if (process.env['MMP_PAUSE']) setTimeout(() => mpv?.setProperty('pause', true), 1200)
    } else if (process.env['MMP_TESTSRC']) {
      mpv?.loadFile('av://lavfi:testsrc=size=1280x720:rate=30')
      if (process.env['MMP_PAUSE']) setTimeout(() => mpv?.setProperty('pause', true), 900)
    }
  })
  mpv.start({ wid: wid as unknown as number })
}

function registerIpc(): void {
  // Swallow expected rejections (mpv not connected yet, or a get_property that's
  // "property unavailable" e.g. chapters on a file with none). The renderer treats
  // a null result the same as an empty/missing value, so no need to surface these.
  ipcMain.handle('mpv:command', async (_e, cmd: any[]) => {
    try {
      return await mpv?.command(cmd)
    } catch {
      return null
    }
  })
  ipcMain.on('mpv:set', (_e, name: string, value: unknown) => mpv?.setProperty(name, value))
  ipcMain.on('mpv:loadfile', (_e, path: string) => openMedia(path))
  ipcMain.on('ui:activity', () => {
    if (Date.now() < suppressRevealUntil) return // just toggled fullscreen — stay quiet
    revealUi()
  })
  // context menu opened/closed — hide the OSC while it's up (the OSC is a separate
  // child window on top of the main window, so it would otherwise cover the menu)
  ipcMain.on('ui:menu-open', (_e, open: boolean) => {
    menuOpen = Boolean(open)
    if (menuOpen) {
      if (hideTimer) {
        clearTimeout(hideTimer)
        hideTimer = null
      }
      broadcast('ui:hide')
      animateOsc(false)
    }
  })
  ipcMain.on('ui:osc-hover', (_e, hovering: boolean) => {
    oscHovered = Boolean(hovering)
    if (oscHovered) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null } // stay up while hovered
    } else if (oscShown) {
      // pointer left the OSC while it was up → linger, then hide. If it was
      // already hidden (pointer just passed over on its way in), don't pop it.
      revealUi()
    }
  })

  // playlist
  ipcMain.handle('playlist:get', () => playlistPayload())
  ipcMain.on('playlist:play', (_e, i: number) => playIndex(i))
  ipcMain.on('playlist:next', () => playNext())
  ipcMain.on('playlist:prev', () => playPrev())
  ipcMain.on('playlist:toggle-shuffle', () => toggleShuffle())
  ipcMain.on('playlist:remove', (_e, i: number) => removeFromPlaylist(i))
  ipcMain.on('playlist:repeat-cycle', () => cycleRepeat())
  ipcMain.on('sub:add', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Add Subtitle',
      properties: ['openFile'],
      filters: [
        { name: 'Subtitles', extensions: ['srt', 'ass', 'ssa', 'vtt', 'sub', 'sup', 'idx', 'lrc'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (!res.canceled && res.filePaths[0]) {
      try {
        await mpv?.command(['sub-add', res.filePaths[0], 'select'])
      } catch {
        /* ignore */
      }
    }
  })
  ipcMain.on('playlist:add', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Add to Playlist',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media', extensions: VIDEO_EXT },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (!res.canceled && res.filePaths.length) addToPlaylist(res.filePaths)
  })

  // OSC buttons (in the acrylic child window) request a panel toggle through main.
  // The right (playlist) panel is now its own acrylic window, owned by main; the
  // left (settings) panel is still rendered in the main window (Phase 1).
  ipcMain.on('ui:panel-toggle', (_e, name: string) => {
    if (name === 'playlist') togglePlaylistPanel()
    else win?.webContents.send('ui:panel-toggle', name)
  })

  ipcMain.handle('app:open-dialog', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Open Media',
      properties: ['openFile'],
      filters: [
        { name: 'Media', extensions: VIDEO_EXT },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
  })

  // settings
  ipcMain.handle('app:pick-folder', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Choose screenshot folder',
      defaultPath: screenshotDir(),
      properties: ['openDirectory', 'createDirectory']
    })
    return res.canceled || !res.filePaths[0] ? null : res.filePaths[0]
  })
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.on('settings:set', (_e, key: keyof Settings, value: unknown) => {
    setSetting(key, value as never)
    // live-apply just the changed mpv property (languages take effect next file load)
    if (mpv) {
      if (key === 'hwdec') mpv.setProperty('hwdec', value)
      else if (key === 'audioLang') mpv.setProperty('alang', value)
      else if (key === 'subLang') mpv.setProperty('slang', value)
      else if (key === 'subsDefaultOn') mpv.setProperty('sub-visibility', value)
      else if (key === 'autoLoadSubs') mpv.setProperty('sub-auto', value ? 'fuzzy' : 'no')
      else if (key === 'subHdrPeak') mpv.setProperty('sub-hdr-peak', value)
      else if (key === 'keepPitch') mpv.setProperty('audio-pitch-correction', value)
      else if (key === 'streamQuality') mpv.setProperty('ytdl-format', YTDL_FORMAT[value as Settings['streamQuality']])
      else if (key === 'useCookies' || key === 'cookiesBrowser') applyYtdlCookies()
      else if (key === 'screenshotDir') applyScreenshotDir()
      else if (key === 'screenshotFormat') applyScreenshotFormat()
    }
    broadcast('settings:changed', getSettings()) // let other windows (e.g. screenshot) track it
  })

  ipcMain.on('ui:open-disc', () => promptOpenFolder()) // double-click Open File → folder/disc
  ipcMain.on('win:minimize', () => win?.minimize())
  ipcMain.on('win:toggle-maximize', () => {
    win?.isMaximized() ? win.unmaximize() : win?.maximize()
    setTimeout(layoutOsc, 40)
  })
  ipcMain.on('win:close', () => win?.close())
  ipcMain.on('win:toggle-fullscreen', () => toggleFullscreen())
  // a panel window's resize grips resize the MAIN window (they sit over its edge)
  ipcMain.handle('win:get-bounds', () => (win && !win.isDestroyed() ? win.getBounds() : null))
  ipcMain.on('win:set-size', (_e, width: number, height: number) => {
    if (!win || win.isDestroyed() || win.isMaximized() || preFsBounds) return
    const b = win.getBounds() // top-left stays fixed (right/bottom-docked grips)
    win.setBounds({
      x: b.x,
      y: b.y,
      width: Math.max(WIN_MIN_W, Math.round(width)),
      height: Math.max(320, Math.round(height))
    })
  })
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const res = await dialog.showOpenDialog(win!, {
              properties: ['openFile'],
              filters: [{ name: 'Media', extensions: VIDEO_EXT }, { name: 'All', extensions: ['*'] }]
            })
            if (!res.canceled && res.filePaths[0]) mpv?.loadFile(res.filePaths[0])
          }
        },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+Shift+O', // reachable even though the frameless window hides the menu bar
          click: () => promptOpenFolder()
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { label: 'View', submenu: [{ role: 'toggleDevTools' }, { role: 'reload' }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  // materialise the default screenshot folder so the settings UI shows a real path
  if (!getSettings().screenshotDir) {
    setSetting('screenshotDir', join(app.getPath('pictures'), 'Lunoir'))
  }
  registerIpc()
  buildMenu()
  createWindows()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindows()
  })
})

app.on('window-all-closed', () => {
  mpv?.quit()
  app.quit()
})
