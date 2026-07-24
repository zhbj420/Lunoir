import { app, BrowserWindow, ipcMain, dialog, Menu, screen, shell } from 'electron'
import { join, dirname, basename, extname, resolve } from 'node:path'
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, renameSync, createWriteStream } from 'node:fs'
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
  addRecent,
  updateRecentName,
  getRecents,
  removeRecent,
  clearRecents,
  getFavourites,
  isFavourite,
  addFavourite,
  removeFavourite,
  renameFavourite,
  removeFavouriteChannel,
  removeFavouriteItem,
  updateFavouriteChannels,
  type Settings,
  type MediaKind,
  type Channel,
  type FavEntry
} from './settings'
import type { SourceType } from '../preload/index'
import { translate, effectiveLocale, type Key } from '@shared/i18n'

const isDev = !app.isPackaged

// Main-process translator. Resolves the locale fresh on every call from the saved
// setting + OS language, so toasts and dialogs follow a language change with no
// wiring. (The renderer has useT; the main process just needs this thin helper.)
// getPreferredSystemLanguages() reads the OS language list directly — unlike
// getLocale() it isn't clamped to the bundled locale paks, so it matches what the
// renderer sees via navigator.language and 'system' resolves the same on both sides.
function osLocale(): string {
  return app.getPreferredSystemLanguages?.()[0] || app.getLocale()
}
function tr(key: Key, vars?: Record<string, string | number>): string {
  return translate(effectiveLocale(getSettings().uiLanguage, osLocale()), key, vars)
}

// electron-vite dev restarts Electron constantly; its on-disk HTTP cache can
// corrupt and then fail module loads with ERR_CACHE_READ_FAILURE (blank window).
// Disable the cache in dev to avoid it. (Must run before app is ready.)
if (isDev) app.commandLine.appendSwitch('disable-http-cache')

// Grayscale antialiasing instead of ClearType's subpixel (RGB) antialiasing.
// Our text is light-on-dark and small, which is where subpixel AA is at its worst:
// it fakes resolution by tinting the R/G/B subpixels, and on a dark background that
// leaves coloured fringes around thin strokes — tinted differently per stroke, so a
// line of hanzi reads as uneven weight. Grayscale AA has nothing to tint.
// (CSS -webkit-font-smoothing is the macOS-only lever for the same thing; Blink
// ignores it on Windows — verified on this machine, no change at all.)
app.commandLine.appendSwitch('disable-lcd-text')

// Main transparent window hosts mpv video (via --wid). The OSC lives in a
// separate Win11 *acrylic* child window pinned to the bottom-center, so we can
// see whether the OS frosted-glass material looks good over the video.
let win: BrowserWindow | null = null
let oscWin: BrowserWindow | null = null
let mpv: MpvController | null = null
let preFsBounds: Electron.Rectangle | null = null
// Mini player (PiP): the SAME window shrunk into a corner, kept on top, title strip
// hidden. No re-parenting — mpv renders into this window's HWND either way, so the
// whole mode is bounds + alwaysOnTop + a compact overlay drawn in the main window's
// DOM (a plain scrim, not acrylic: CSS can't frost the video, and nobody expects
// frost at this size). Non-null = we're in it, and holds the bounds to go back to.
let preMiniBounds: Electron.Rectangle | null = null
const isMini = (): boolean => preMiniBounds != null
const MINI_W = 480 // logical px — readable across the room, still out of the way
const MINI_MIN_W = 240
// …and a ceiling. The mini player trades the title bar, the OSC, the side panels and
// the playlist for staying small and out of the way; blown right up it has paid all of
// that and kept none of it, and the normal window is better in every respect. Every
// system PiP caps this for the same reason — the cap is generous, not tight: 55% of the
// work area, never past 1100px (so ~1056 on a 1920 screen, 1100 on anything wider).
const MINI_MAX_W = 1100
const MINI_MAX_SHARE = 0.55

/** Is the title strip absent right now? Fullscreen and the mini player both drop it,
 *  and the setting hides it in windowed mode too. Everything that positions itself
 *  below the bar (video margin, side panels, the library overlay) asks this. */
const noTitleStrip = (): boolean =>
  Boolean(preFsBounds) || isMini() || getSettings().hideTitleBar
let fsWasMaximized = false // restore the maximized state when leaving fullscreen
// Bounds to go back to while "maximized", and the flag for being in that state.
// We never use the OS maximize — see fakeMaximize().
let preMaxBounds: Electron.Rectangle | null = null
const isMaxed = (): boolean => preMaxBounds != null
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

// 收藏 (library) overlay: a centred acrylic child window (recents + favourites)
let libraryWin: BrowserWindow | null = null
let libraryOpen = false
let libraryAnim: NodeJS.Timeout | null = null

// Context menu: its own acrylic window so it frosts the video like the OSC/panels
// (a DOM menu can only paint a flat scrim — it can't reach mpv's surface). The
// renderer measures its own content and reports the size, since the accordion
// submenus change height; we only place/reveal the window once a size arrives.
let menuWin: BrowserWindow | null = null
let menuAnchor: { x: number; y: number } | null = null // screen coords of the click
let menuShown = false
let menuOrigin: { x: number; y: number } | null = null // where we actually placed it
let menuAnim: ReturnType<typeof setInterval> | null = null
// Accordion timing (easeOutQuad throughout — see animateMenuTo). Expanding is a
// single motion: the window grows over MENU_GROW_MS. Collapsing is two halves that
// must *feel* like one motion of the same length, so the renderer's fold matches
// MENU_GROW_MS exactly, and the window shrink runs shorter so it always leads the
// fold — a window taller than its content uncovers stale pixels (a ghost).
const MENU_GROW_MS = 220 // window grows
const MENU_UNFOLD_MS = MENU_GROW_MS // content unfolds in lockstep with it
const MENU_FOLD_MS = MENU_GROW_MS // content folds; perceived length matches expanding
const MENU_SHRINK_MS = MENU_FOLD_MS - 50 // window shrinks *ahead* of the fold
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
// the top-level thing the user just opened (for recents name-refinement); channel
// switches within a loaded list don't change this
let curOpen: { target: string; kind: MediaKind } | null = null
// the parsed channels of the currently-open list (to snapshot on 收藏); null otherwise
let curOpenChannels: Channel[] | null = null
// a URL open waiting on 'seekable' to decide recents: only a seekable VOD is added;
// a live (non-seekable) stream never is. Files are added at once (never live).
let curRecentPending = false
// what the loaded list IS → the right panel labels it 播放列表 vs 频道, and the
// bottom save button saves a playlist vs 收藏s the IPTV source
let sourceType: SourceType = 'queue'
let repeatMode: RepeatMode = 'off'
// resume: the file + position we're currently tracking, and when we last wrote it
let resumePath = ''
let resumePos = 0
let lastPosWrite = 0
let lastDuration = 0
let lastVolume = 100
let pendingResumeToast = '' // show the "Resumed from …" toast only once playback starts
let lastSeekable = true // mpv 'seekable'; false = a live stream (no meaningful position)

/** Can the current target carry a resume position? Live TV can't: its `time-pos` is
 *  just how long you've been watching, not a place in the material. Without this,
 *  watching a channel for 5s wrote its URL into positions.json, and switching back to
 *  it later seeked "into" the live edge and announced "Resumed from 3:20".
 *  Gated on the source being IPTV (deterministic, independent of when 'seekable'
 *  lands) and on seekability (catches a live URL opened on its own). Defaults to
 *  allowing resume, so nothing that works today stops working. */
function canResume(): boolean {
  return sourceType !== 'iptv' && lastSeekable !== false
}
// Shuffle is a persistent mode (not a one-shot reorder): the list keeps its
// display order, but auto-advance / next picks randomly. `shuffleBag` holds the
// not-yet-played indices this cycle (no repeats until it drains); `shuffleHistory`
// is the played order so Prev can step back.
let shuffleOn = false
let shuffleBag: number[] = []
let shuffleHistory: number[] = []
// "watch as one" (连起来看): the local queue plays as a single mpv EDL timeline.
// While on, each clip is an mpv chapter — navigation seeks within the one file
// instead of reloading, and the seek bar spans the whole set. Reset on a new open.
let mergeOn = false
let pendingMergeSeek = -1 // clip to seek to once the timeline's chapters are known
// The stitched timeline's chapter list mixes OUR clip boundaries with each source
// file's OWN chapters (a Blu-ray rip drags in 15+ of them), so a chapter index is NOT
// a clip index. `clipStarts` is the boundaries alone — every downstream use (seek-bar
// ticks, current-clip tracking, clip seeking) goes through it, never a raw chapter.
let clipStarts: number[] = [] // start time (s) of each clip within the timeline
let timelineChapterTimes: number[] = [] // every chapter's time, to map a chapter index → clip
// Phase 2 — per-clip in/out trim. Session-only, keyed by PATH so a trim travels with
// its clip through reorder. `trimClip` = the clip currently isolated for trimming
// (−1 = the normal full timeline); cur* track the isolated clip's edit + duration.
const trims = new Map<string, { in: number; out: number }>()
// Per-clip playback frame rate (Timeline). Session-only, keyed by PATH so it travels with
// the clip through reorder — same model as `trims`. Absent = play at the clip's own rate.
// A target BELOW the clip's capture fps is the slow motion, and it's driven through mpv's
// `speed`: unlike a container-fps override, speed is a runtime property (so it can differ
// per clip), it slows picture and sound TOGETHER (pitch-corrected, so audio survives), and it
// leaves container-fps alone so the frame/timecode readout stays honest.
const clipFps = new Map<string, number>()
const srcFps = new Map<string, number>() // capture fps per path, probed once via MediaInfo
let trimClip = -1
let curIn = 0
let curOut = -1 // −1 until the isolated clip's duration resolves it
let curDur = 0
const isUrl = (p: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(p)

// ---- yt-dlp (on-demand) ----
// YouTube & other site URLs are resolved by mpv's ytdl_hook via yt-dlp. We don't
// bundle it (17MB, and it goes stale as sites change); instead we fetch the latest
// the first time you actually play a site URL — base install stays lean + fresh.
const MEDIA_URL_EXT =
  /\.(mp4|mkv|webm|m4v|mov|avi|flv|ts|m2ts|mpg|mpeg|m3u8|mpd|mp3|flac|aac|wav|ogg|opus|m4a)(\?|#|$)/i
let ytdlDownloading: Promise<string | null> | null = null

// An IPTV channel list — .m3u / .txt, but NOT .m3u8 (that's a stream manifest, and the
// trailing 8 keeps it out). The (\?|#|$) tail is the point: subscriptions are handed out
// as https://host/iptv.m3u?userid=…&auth_token=…, and anchoring on the end of the string
// sent every one of those down the single-file path — mpv then followed the m3u itself
// and played entry #1, so the whole list looked like one video.
const CHANNEL_LIST_EXT = /\.(m3u|txt)(\?|#|$)/i

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
    broadcast('ui:toast', tr('main.fetchingYtdl'))
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
    broadcast('ui:toast', tr('main.ytdlFailed'))
    return null
  }
}

// yt-dlp reports why it refused a URL — members-only, DRM, region-locked, unavailable,
// or its own extractor being out of date — but it says so on mpv's log, which we
// otherwise discard. Keep the last such line so end-file can show the real reason
// instead of a bare "couldn't load", which tells you nothing about what to do next.
let lastYtdlError = ''
const YTDL_ERROR_RE = /^\[ytdl_hook\].*\bERROR:\s*(.+)$/i
// Sites break yt-dlp regularly; when it says so, that's the one failure we can fix
// ourselves rather than just report.
const YTDL_OUTDATED_RE = /out.?of.?date|outdated|update (yt-dlp|to the latest)|nightly/i

function noteYtdlError(line: string): void {
  const m = YTDL_ERROR_RE.exec(line.trim())
  if (!m) return
  // strip yt-dlp's boilerplate tail so the toast stays one readable sentence
  lastYtdlError = m[1]
    .replace(/\s*;\s*please report this issue.*/i, '')
    .replace(/\s*You might want to use.*/i, '')
    .trim()
    .slice(0, 200)
}

/** Take (and clear) the last yt-dlp error — one load failure, one report. */
function takeYtdlError(): string {
  const e = lastYtdlError
  lastYtdlError = ''
  return e
}

/** Re-download yt-dlp now, regardless of age. Used by the Settings button and
 *  automatically when yt-dlp itself says it's out of date. */
async function refreshYtdl(): Promise<boolean> {
  if (ytdlDownloading) return (await ytdlDownloading) != null
  ytdlDownloading = downloadYtdl().finally(() => (ytdlDownloading = null))
  const path = await ytdlDownloading
  if (path) {
    // point mpv at the new binary right away, so a retry uses it without a restart
    mpv?.setProperty('script-opts', `ytdl_hook-ytdl_path=${path.replace(/\\/g, '/')}`)
    broadcast('ui:toast', tr('main.ytdlUpdated'))
  }
  return path != null
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

// ---- update check (notify-only) ----
// Compare the running version to GitHub's latest release; the UI just opens the
// release page to download. No auto-install: the build is unsigned, so a silent
// updater would trip SmartScreen and needs signing to install cleanly anyway.
const UPDATE_REPO = 'zhbj420/Lunoir'
interface UpdateInfo {
  current: string // running version, e.g. "0.5.1"
  latest: string // newest release tag, e.g. "0.5.2"
  url: string // release page to open for the download
  hasUpdate: boolean
}
let updateCache: UpdateInfo | null = null
let updateCheckedAt = 0

/** "v0.5.1"/"0.5.1" → [0,5,1]; missing/garbage parts → 0. */
function verParts(v: string): number[] {
  return v.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0)
}
/** Is remote strictly newer than local? (numeric major.minor.patch compare) */
function isNewer(remote: string, local: string): boolean {
  const a = verParts(remote)
  const b = verParts(local)
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  const current = app.getVersion()
  try {
    const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { 'User-Agent': 'lunoir', Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return null
    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = (data.tag_name || '').replace(/^v/i, '')
    if (!latest) return null
    return {
      current,
      latest,
      url: data.html_url || `https://github.com/${UPDATE_REPO}/releases/latest`,
      hasUpdate: isNewer(latest, current)
    }
  } catch {
    return null // offline / rate-limited → stay silent
  }
}

/** Check for a newer release. `force` (the manual Settings button) always re-fetches;
 *  the background path (Home mount) respects the setting and reuses a <1h cache so
 *  returning to Home doesn't hit the network each time. */
async function checkUpdate(force: boolean): Promise<UpdateInfo | null> {
  if (!force && !getSettings().checkForUpdates) return null
  const fresh = Date.now() - updateCheckedAt < 60 * 60 * 1000
  if (!force && fresh && updateCache) return updateCache
  const info = await fetchLatestRelease()
  if (info) {
    updateCache = info
    updateCheckedAt = Date.now()
  }
  return info ?? updateCache
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
    title: tr('dlg.selectFolder')
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
  broadcast('ui:toast', tr('main.loadingPlaylist'))
  const ytdl = await ensureYtdl()
  if (!ytdl) {
    broadcast('ui:loading', false) // ensureYtdl already toasted the failure
    return
  }
  const entries = await enumeratePlaylist(ytdl, url)
  if (!entries.length) {
    broadcast('ui:loading', false)
    broadcast('ui:toast', tr('main.playlistFailed'))
    return
  }
  playlist = entries.map(e => e.url)
  urlTitles = {}
  for (const e of entries) urlTitles[e.url] = e.title
  sourceType = 'playlist-url' // a YouTube-style URL playlist (a queue, not IPTV)
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
  // the clip the playback rate applies to (trimmed one, else the playing one) — the OSC
  // names its rate: the override if it has one, otherwise its probed native rate
  const curPath = playlist[trimClip >= 0 ? trimClip : plIndex] ?? ''
  // IPTV channels carry a group-title; map url → group so the panel can group them
  const groupOf =
    sourceType === 'iptv' && curOpenChannels ? new Map(curOpenChannels.map(c => [c.url, c.group])) : null
  return {
    // URL items get their resolved title once known; local items use the basename
    // fps = this clip's Timeline playback rate (0 = its own); drives the panel's tick
    items: playlist.map(p => ({
      path: p,
      name: urlTitles[p] || basename(p),
      group: groupOf?.get(p) || '',
      fps: clipFps.get(p) ?? 0
    })),
    index: plIndex,
    repeat: repeatMode,
    shuffle: shuffleOn,
    sourceType,
    merge: mergeOn, // "watch as one" is active
    canMerge: canMerge(), // queue is mergeable (local, ≥2) → show the toggle
    trimClip, // which clip is isolated for trimming (−1 = full timeline)
    clipStarts, // clip boundary times (s) — the OSC's ticks; NOT the source files' chapters
    clipFps: clipFps.get(curPath) ?? 0, // current clip's override (0 = none)
    clipSrcFps: srcFps.get(curPath) ?? 0 // …and its native rate, once probed
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

// A browser-ish User-Agent — IPTV list servers commonly stub or refuse requests
// that don't look like a browser (verified: without it the list came back empty).
const IPTV_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

// A custom User-Agent for the source that's open right now, typed into the URL box's
// Advanced strip and remembered on the saved source. It belongs to the SOURCE, not the
// player: some providers serve the real stream only to their own app's UA and quietly
// redirect everyone else to a placeholder clip, so every channel plays the same test
// video — while another source needs nothing, or something different. Empty = leave both
// the list fetch (IPTV_UA) and mpv's own UA alone.
let sourceUa = ''

/** Parse an IPTV channel list — extended M3U (#EXTINF) or the common txt
 *  (`name,url` with `group,#genre#` headers) — into flat {name,url,group} entries.
 *  Multi-source lists list the same channel several times; kept flat for now. */
function parseChannelList(text: string): { name: string; url: string; group: string }[] {
  const out: { name: string; url: string; group: string }[] = []
  const lines = text.split(/\r?\n/)
  const isM3u = /^﻿?#EXTM3U/i.test(lines[0] || '') || lines.some(l => /^#EXTINF/i.test(l))
  if (isM3u) {
    let pending: { name: string; group: string } | null = null
    for (const raw of lines) {
      const line = raw.trim()
      if (/^#EXTINF/i.test(line)) {
        const group = (line.match(/group-title="([^"]*)"/i)?.[1] || '').trim()
        // display name follows the comma after the last attribute (so a comma
        // inside an attribute value doesn't cut the name short)
        const q = line.lastIndexOf('"')
        const c = line.indexOf(',', q >= 0 ? q : 0)
        pending = { name: c >= 0 ? line.slice(c + 1).trim() : '', group }
      } else if (line && !line.startsWith('#')) {
        if (/^https?:\/\//i.test(line)) out.push({ name: pending?.name || line, url: line, group: pending?.group || '' })
        pending = null
      }
    }
  } else {
    let group = ''
    for (const raw of lines) {
      const line = raw.trim()
      const c = line.indexOf(',')
      if (!line || c < 0) continue
      const left = line.slice(0, c).trim()
      const right = line.slice(c + 1).trim()
      if (right === '#genre#') group = left
      else if (/^https?:\/\//i.test(right)) out.push({ name: left || right, url: right, group })
    }
  }
  return out
}

/** Fetch (remote) or read (local) an IPTV list source and parse it to channels.
 *  Returns [] on any failure (network down, file gone, unparseable). */
async function fetchChannels(source: string): Promise<Channel[]> {
  try {
    let text: string
    if (/^https?:\/\//i.test(source)) {
      // the source's own UA wins when it has one — some providers gate the list too
      const res = await fetch(source, { headers: { 'User-Agent': sourceUa || IPTV_UA } })
      text = await res.text()
    } else {
      text = readFileSync(source, 'utf8')
    }
    return parseChannelList(text)
  } catch {
    return []
  }
}

/** Load an IPTV channel list (.m3u/.txt, local or remote) into the playlist and
 *  play the first channel. Falls back to playing `source` directly if it doesn't
 *  parse as a list (≥2 http entries). */
async function loadChannelList(source: string): Promise<void> {
  broadcast('ui:loading', true)
  broadcast('ui:toast', tr('main.loadingPlaylist'))
  const channels = await fetchChannels(source)
  if (channels.length < 2) {
    broadcast('ui:loading', false)
    mpv?.loadFile(source) // not a channel list — treat it as a single item
    return
  }
  playlist = channels.map(c => c.url)
  urlTitles = {}
  for (const c of channels) urlTitles[c.url] = c.name
  curOpenChannels = channels // remember for a possible 收藏 snapshot of this list
  sourceType = 'iptv' // a channel directory, not a play-through queue → panel says 频道
  playlistKey = ''
  discDevice = ''
  plIndex = 0
  resyncShuffle()
  playCurrent() // the loading spinner clears on the first channel's first frame
}

/** Classify + record a freshly-opened target in the recents list. The name is
 *  provisional (a URL's real title arrives later via media-title → refined then). */
function recordOpen(target: string): void {
  const kind: MediaKind = CHANNEL_LIST_EXT.test(target) || isPlaylistUrl(target)
    ? 'list'
    : isUrl(target)
      ? 'url'
      : 'file'
  curOpen = { target, kind }
  curOpenChannels = null // set by loadChannelList if this open turns out to be a list
  curRecentPending = false
  mergeOn = false // a fresh open leaves "watch as one" off; user re-enables per queue
  pendingMergeSeek = -1
  clipStarts = []
  timelineChapterTimes = []
  clipFps.clear() // per-clip rates are per-session-per-queue, like trims
  trims.clear() // trims are per-session-per-queue
  trimClip = -1
  broadcastTrim() // clear any stale in/out handles from a prior trim session
  sourceType = 'queue' // loadChannelList / loadPlaylistUrl override for iptv / yt-playlist
  broadcast('library:current-fav', isFavourite(target)) // right-click 收藏 reflects it
  // What enters "recently played":
  //  - a whole channel list (IPTV m3u/txt, or a playlist URL) never does — it's a
  //    collection you save to 收藏 on purpose.
  //  - a single file is added at once (a local file is never live).
  //  - a single URL waits: it's added only once mpv proves it a seekable VOD; a live
  //    (non-seekable) stream is never added (decided in the 'seekable' handler).
  if (kind === 'list') return
  if (kind === 'file') {
    addRecent(target, basename(target) || target, 'file')
    broadcast('recents:changed')
  } else {
    curRecentPending = true // a URL — hold until 'seekable' decides
  }
}

/** After any favourites mutation: refresh the overlay + the right-click toggle +
 *  the panel's collection save-button state. */
function afterFavChange(): void {
  broadcast('favourites:changed')
  broadcast('library:current-fav', curOpen ? isFavourite(curOpen.target) : false)
  broadcast('library:collection-saved', collectionSaved())
}

// A content fingerprint of the current queue → a stable id, so saving the same
// queue twice dedups (and the button can show a saved/unsaved toggle).
function hashStr(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
const queueKey = (): string => 'pl:' + hashStr(playlist.join('|'))
function queueName(): string {
  const first = playlist[0]
  if (!first) return 'Playlist'
  const base = urlTitles[first] || basename(first)
  const dir = isUrl(first) ? '' : basename(dirname(first))
  return playlist.length > 1 && dir ? dir : base // a folder queue → the folder name
}

/** Is the current collection already saved? (the m3u source for IPTV, else the
 *  current queue by fingerprint) — drives the panel's save-button state. */
function collectionSaved(): boolean {
  if (sourceType === 'iptv') return curOpen ? isFavourite(curOpen.target) : false
  return playlist.length > 0 && isFavourite(queueKey())
}

/** The panel's bottom button: save/unsave the whole collection. IPTV → the m3u
 *  source (kind 'list'); a queue → a saved playlist snapshot (kind 'playlist'). */
function saveCollection(): void {
  if (sourceType === 'iptv') {
    if (!curOpen) return
    if (isFavourite(curOpen.target)) {
      removeFavourite(curOpen.target)
      afterFavChange()
      broadcast('ui:toast', tr('toast.unfavourited'))
    } else {
      favouriteTarget(curOpen.target)
      broadcast('ui:toast', tr('toast.favourited'))
    }
    return
  }
  if (!playlist.length) return
  const key = queueKey()
  if (isFavourite(key)) {
    removeFavourite(key)
    afterFavChange()
    broadcast('ui:toast', tr('toast.unfavourited'))
  } else {
    addFavourite({
      target: key,
      name: queueName(),
      kind: 'playlist',
      at: Date.now(),
      items: playlist.map(p => ({ path: p, name: urlTitles[p] || basename(p) }))
    })
    afterFavChange()
    broadcast('ui:toast', tr('toast.favourited'))
  }
}

/** Put a fresh set of channels/items into the queue and play at startIndex. */
function playFavCollection(fav: FavEntry, channels: Channel[], startIndex: number): void {
  playlist = channels.map(c => c.url)
  urlTitles = {}
  for (const c of channels) urlTitles[c.url] = c.name
  curOpenChannels = fav.kind === 'list' ? channels : null
  sourceType = fav.kind === 'list' ? 'iptv' : 'queue'
  curOpen = { target: fav.target, kind: fav.kind } // so collection-saved reads true
  curRecentPending = false
  plIndex = Math.max(0, Math.min(startIndex, playlist.length - 1))
  playlistKey = ''
  discDevice = ''
  resyncShuffle()
  playCurrent()
}

/** Load a saved collection and play. An IPTV list **re-fetches its source** for the
 *  latest channels (a URL source updates; a local file picks up edits), falling back
 *  to the stored snapshot if the source is offline/gone. A saved playlist just plays
 *  its snapshot items (they're local/VOD files, not a live directory). */
function loadFavCollection(fav: FavEntry, startIndex = 0): void {
  sourceUa = fav.userAgent ?? '' // restore (or clear) the source's UA before anything fetches
  if (fav.kind === 'playlist' && fav.items?.length) {
    playFavCollection(fav, fav.items.map(i => ({ url: i.path, name: i.name, group: '' })), startIndex)
    return
  }
  if (fav.kind !== 'list') return
  broadcast('ui:loading', true)
  broadcast('ui:toast', tr('main.loadingPlaylist'))
  fetchChannels(fav.target).then(fresh => {
    const channels = fresh.length ? fresh : (fav.channels ?? [])
    if (!channels.length) {
      broadcast('ui:loading', false)
      broadcast('ui:toast', tr('main.playlistFailed')) // offline AND no snapshot
      return
    }
    if (fresh.length) updateFavouriteChannels(fav.target, fresh) // keep the snapshot current
    playFavCollection(fav, channels, startIndex)
  })
}

/** Save a target to 收藏. Derives kind + a good name (prefers the resolved recents
 *  name), and snapshots the channels when it's the currently-loaded list. */
function favouriteTarget(target: string): void {
  if (isFavourite(target)) return
  let kind: MediaKind
  let channels: Channel[] | undefined
  if (curOpen && curOpen.target === target) {
    kind = curOpen.kind
    if (kind === 'list') channels = curOpenChannels ?? undefined
  } else {
    kind = CHANNEL_LIST_EXT.test(target) || isPlaylistUrl(target) ? 'list' : isUrl(target) ? 'url' : 'file'
  }
  const name = getRecents().find(r => r.target === target)?.name || (kind === 'url' ? target : basename(target) || target)
  const entry: FavEntry = { target, name, kind, at: Date.now() }
  if (channels) entry.channels = channels
  // remember the source's UA with it — otherwise reopening from the library would go
  // back to being served the placeholder clip and you'd have to retype it every time
  if (sourceUa) entry.userAgent = sourceUa
  addFavourite(entry)
  afterFavChange()
}

/** Open media the user picked — a file, a URL, a Blu-ray/DVD disc folder, or a
 *  plain folder (whose videos are queued). */
/** Stop playback and clear everything the queue described — back to the Home screen.
 *  Mirrors what a fresh open resets, minus loading anything: mpv goes idle, the panels
 *  empty out, and the renderer drops its media state (see onGoHome). */
function goHome(): void {
  mpv?.command(['stop']).catch(() => {})
  mpv?.setProperty('speed', 1) // a timeline clip may have owned the rate
  playlist = []
  plIndex = -1
  urlTitles = {}
  playlistKey = ''
  discDevice = ''
  curOpen = null
  curOpenChannels = null
  curRecentPending = false
  sourceType = 'queue'
  sourceUa = ''
  mergeOn = false
  pendingMergeSeek = -1
  trimClip = -1
  clipStarts = []
  timelineChapterTimes = []
  trims.clear()
  clipFps.clear()
  resumePath = '' // nothing playing → nothing to write a position for
  // main keeps its OWN hasMedia (revealUi gates the OSC on it) and until now nothing
  // ever cleared it — there was no way back to Home with a file loaded. Leaving it set
  // makes every mouse move on the Home screen pop the OSC back up.
  hasMedia = false
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  broadcast('ui:hide')
  animateOsc(false)
  broadcastTrim()
  broadcast('playlist:changed', playlistPayload())
  broadcast('library:collection-saved', collectionSaved())
  broadcast('ui:loading', false)
  broadcast('ui:home')
}

function openMedia(target: string, userAgent = ''): void {
  sourceUa = userAgent // a fresh open replaces it — including clearing it back to none
  recordOpen(target)
  if (isPlaylistUrl(target)) {
    loadPlaylistUrl(target) // async: enumerate the entries, then queue + play them
    return
  }
  // an IPTV channel list (.m3u / .txt — NOT .m3u8, which is a stream manifest)
  if (CHANNEL_LIST_EXT.test(target)) {
    loadChannelList(target)
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
      broadcast('ui:toast', tr('main.noMedia'))
      return
    }
    if (files.length > MAX_FOLDER_SCAN) {
      broadcast('ui:toast', tr('main.folderTruncated', { count: files.length, max: MAX_FOLDER_SCAN }))
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
  // Skip past local files that have gone missing — a saved playlist / recent may
  // point at a file since moved or deleted. Advance to the next playable item, or
  // stop if none remain. (URLs/discs can't be checked cheaply — mpv reports those.)
  let skipped = 0
  while (plIndex < playlist.length) {
    const t = playlist[plIndex]
    if (isUrl(t) || isDiscUri(t) || existsSync(t)) break
    skipped++
    plIndex++
  }
  if (plIndex >= playlist.length) {
    broadcast('playlist:changed', playlistPayload())
    broadcast('ui:toast', tr('main.noPlayable'))
    return
  }
  if (skipped > 0) broadcast('ui:toast', tr('main.skippedMissing'))
  const target = playlist[plIndex]
  // remember which item of this URL playlist we're on, so reopening resumes here
  if (playlistKey && getSettings().resumePlaylistItem) savePlaylistItem(playlistKey, target)
  broadcast('playlist:changed', playlistPayload())
  broadcast('library:collection-saved', collectionSaved()) // panel save-button state
  // a disc needs its device pointed at BEFORE loading
  if (mpv && isDiscUri(target)) {
    mpv.setProperty(target === 'bd://' ? 'bluray-device' : 'dvd-device', discDevice)
  }
  // Custom User-Agent, applied per load and ONLY for channels. Some IPTV providers
  // serve the real stream just to their own app's UA and silently 302 everyone else to
  // a placeholder clip — every channel then plays the same test video. Set for channel
  // loads, cleared ('' = mpv's own default) for everything else, so a file, a disc or
  // an online video is never carrying somebody's IPTV UA.
  if (mpv) mpv.setProperty('user-agent', sourceType === 'iptv' ? sourceUa : '')
  // The title to force once loaded: a disc's folder name, or an IPTV channel's name
  // (its HLS/http feed carries no useful title, and IPTV URLs often lack a media
  // extension so force it regardless). Everything else clears the override so mpv
  // uses the file's own title. Applied AFTER loadFile — mpv's own path/filename
  // events reset the renderer's title on load, so forcing it before load gets wiped
  // and the title falls back to the ugly URL basename.
  const forcedTitle = isDiscUri(target)
    ? urlTitles[target] || 'Blu-ray'
    : isUrl(target) && urlTitles[target] && (sourceType === 'iptv' || !needsYtdl(target))
      ? urlTitles[target]
      : ''
  if (isUrl(target) || isDiscUri(target)) broadcast('ui:loading', true) // grey until the first frame (disc scan takes a moment)
  // IPTV channels are direct streams — never yt-dlp them (their URLs just don't end
  // in a media extension, which is the only thing needsYtdl keys off).
  if (needsYtdl(target) && sourceType !== 'iptv') {
    // fetch yt-dlp if needed, point mpv's ytdl_hook at it, then load
    ensureYtdl().then(path => {
      if (!mpv) return
      if (path) mpv.setProperty('script-opts', `ytdl_hook-ytdl_path=${path.replace(/\\/g, '/')}`)
      mpv.loadFile(target)
      mpv.setProperty('force-media-title', forcedTitle)
      mpv.setProperty('pause', false)
    })
    return
  }
  mpv?.loadFile(target)
  mpv?.setProperty('force-media-title', forcedTitle) // after load — see above
  mpv?.setProperty('pause', false) // always start playing on load
}

function playIndex(i: number): void {
  if (i < 0 || i >= playlist.length) return
  plIndex = i
  if (mergeOn) {
    // one stitched timeline: jump to the clip's start instead of reloading. Covers
    // next/prev (they call playIndex) and clicking a clip; unpause in case we were
    // parked at the timeline's end. NOT mpv's `chapter` property — the source files'
    // own chapters share that list, so chapter N ≠ clip N.
    seekToClip(i)
    mpv?.setProperty('pause', false)
    broadcast('playlist:changed', playlistPayload())
    return
  }
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
  if (mergeOn) {
    // the whole stitched timeline reached its end
    if (repeatMode === 'all') playIndex(0) // loop the timeline; otherwise stop
    return
  }
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
  if (mergeOn) return // a stitched timeline has no shuffle (see toggleMerge)
  shuffleOn = !shuffleOn
  if (shuffleOn) {
    resyncShuffle() // seed bag + history from the current list/position
  } else {
    shuffleBag = []
    shuffleHistory = []
  }
  broadcast('playlist:changed', playlistPayload())
}

// ---- "watch as one" (连起来看): the queue as a single mpv EDL timeline ----

/** Can the current queue play as one timeline? Gated by the experimental setting;
 *  local files only, at least two. */
function canMerge(): boolean {
  return (
    getSettings().experimentalTimeline &&
    sourceType === 'queue' &&
    playlist.length >= 2 &&
    playlist.every(p => !isUrl(p) && !isDiscUri(p))
  )
}

/** Write an mpv EDL of the current queue → its temp path. Length-prefixed paths
 *  (%<bytes>%<path>) make any filename (commas, spaces) safe; omitting per-clip
 *  length lets mpv probe true durations and expose one chapter per clip. */
function writeTimelineEdl(): string {
  const lines = ['# mpv EDL v0']
  for (const p of playlist) {
    const fwd = p.replace(/\\/g, '/')
    const prefix = `%${Buffer.byteLength(fwd, 'utf8')}%${fwd}`
    const t = trims.get(p) // a trimmed clip contributes only its in→out span (start,length)
    lines.push(t && t.out > t.in ? `${prefix},${t.in},${t.out - t.in}` : prefix)
  }
  const edl = join(app.getPath('temp'), 'lunoir-timeline.edl')
  writeFileSync(edl, lines.join('\n') + '\n')
  return edl
}

/** A title for the merged timeline: the clips' shared folder name, else generic. */
function timelineTitle(): string {
  return basename(dirname(playlist[0] || '')) || tr('timeline.title')
}

/** A clip's true capture fps via MediaInfo, cached per path. 0 when unreadable — the
 *  caller then leaves the speed alone rather than guessing. */
function probeSrcFps(path: string): Promise<number> {
  const hit = srcFps.get(path)
  if (hit !== undefined) return Promise.resolve(hit)
  const mi = resolveMediaInfoPath()
  if (!mi) return Promise.resolve(0)
  return new Promise(resolve => {
    let out = ''
    let settled = false
    const done = (v: number): void => {
      if (settled) return
      settled = true
      srcFps.set(path, v)
      resolve(v)
    }
    const proc = spawn(mi, ['--Inform=Video;%FrameRate%', path], { windowsHide: true })
    proc.stdout?.on('data', d => (out += d))
    proc.on('error', () => done(0))
    proc.on('close', () => {
      const fps = parseFloat(out.trim())
      done(Number.isFinite(fps) && fps > 0 ? fps : 0)
    })
  })
}

/** The clip the rate applies to: the one being trimmed, else the one playing. */
function currentClip(): number {
  return trimClip >= 0 ? trimClip : plIndex
}

/** Drive mpv's speed from the current clip's target frame rate, and publish that clip's
 *  NATIVE rate so the OSC can name it even when there's no override. Runs in the timeline
 *  AND in trim — the rate is a property of the clip, so trimming previews exactly what the
 *  timeline will play. Outside the timeline the user owns `speed` outright. */
async function applyClipSpeed(): Promise<void> {
  if (!mpv || !mergeOn) return
  const path = playlist[currentClip()]
  if (!path) return
  const src = await probeSrcFps(path) // cached; also feeds the OSC's "59.94 fps"
  if (!mergeOn || playlist[currentClip()] !== path) return // clip moved on while probing
  const target = clipFps.get(path) ?? 0
  mpv?.setProperty('speed', target > 0 && src > 0 ? target / src : 1)
  broadcast('playlist:changed', playlistPayload()) // the probed native rate may have just landed
}

/** Right-click a clip → set its playback frame rate (0 = its own / original). */
function setClipFps(i: number, fps: number): void {
  const path = playlist[i]
  if (!path) return
  if (fps > 0) clipFps.set(path, fps)
  else clipFps.delete(path)
  broadcast('playlist:changed', playlistPayload())
  if (i === plIndex) void applyClipSpeed()
}

/** Which clip contains timeline position `t` — the last boundary at or before it.
 *  (Boundaries can share a timestamp with a source chapter, hence the epsilon.) */
function clipAt(t: number): number {
  let k = 0
  for (let i = 0; i < clipStarts.length; i++) if (t >= clipStarts[i] - 0.001) k = i
  return k
}

/** Seek the stitched timeline to clip `i`'s start. Exact, so we land inside the clip —
 *  a keyframe seek can land just before the boundary, i.e. in the previous clip. */
function seekToClip(i: number): void {
  if (i < 0 || i >= clipStarts.length) return
  mpv?.command(['seek', clipStarts[i], 'absolute', 'exact']).catch(() => {})
}

/** Load the queue as one continuous EDL timeline, beginning on `startClip` (seek
 *  applied once mpv reports the timeline's chapters — see the chapter-list handler). */
function loadTimeline(startClip: number): void {
  if (!mpv) return
  pendingMergeSeek = startClip > 0 ? startClip : -1
  broadcast('playlist:changed', playlistPayload())
  mpv.loadFile(writeTimelineEdl())
  mpv.setProperty('force-media-title', timelineTitle())
  mpv.setProperty('pause', false)
}

/** Toggle "watch as one". On: play the queue as one EDL (drops shuffle, which makes
 *  no sense across a stitched timeline). Off: resume the clip the playhead is in. */
function toggleMerge(): void {
  if (!mergeOn) {
    if (!canMerge()) return
    mergeOn = true
    shuffleOn = false
    shuffleBag = []
    shuffleHistory = []
    loadTimeline(plIndex < 0 ? 0 : plIndex)
  } else {
    const wasTrimming = trimClip >= 0
    if (trimClip >= 0) plIndex = trimClip // resume the clip we were trimming
    mergeOn = false
    trimClip = -1
    clipStarts = [] // leaving the timeline → drop its boundaries (and the OSC's ticks)
    timelineChapterTimes = []
    mpv?.setProperty('speed', 1) // the timeline owned the rate; hand it back at normal
    broadcastTrim() // clear the OSC's in/out handles + reset button
    if (plIndex < 0) plIndex = 0 // plIndex tracks the current chapter while merged
    playCurrent() // resume that clip (from its start — Phase 1)
    if (wasTrimming) revealUi() // the OSC was pinned during trim → restart its hide cycle so it can disappear
  }
  broadcast('playlist:changed', playlistPayload())
}

// ---- Phase 2: per-clip in/out trim within the Timeline ----

/** Tell the OSC the current trim edit (clip being trimmed + in/out) so it shows or
 *  hides the blue handles. clip = −1 → not trimming. */
function broadcastTrim(): void {
  broadcast('timeline:trim', { clip: trimClip, in: curIn, out: curOut < 0 ? curDur : curOut })
}

/** Persist the isolated clip's range into `trims` (keyed by path), or clear it if the
 *  range is essentially the whole clip. */
function storeTrim(): void {
  if (trimClip < 0 || trimClip >= playlist.length) return
  const p = playlist[trimClip]
  const out = curOut < 0 ? curDur : curOut
  if (curIn <= 0.05 && (curDur === 0 || out >= curDur - 0.05)) trims.delete(p)
  else trims.set(p, { in: Math.max(0, curIn), out })
}

/** Isolate clip `i` and enter trim mode: play just that clip, paused, so its in/out
 *  can be set frame by frame. */
function enterTrim(i: number): void {
  if (!mpv || i < 0 || i >= playlist.length) return
  storeTrim() // persist whatever clip we were editing
  trimClip = i
  const t = trims.get(playlist[i])
  curIn = t?.in ?? 0
  curOut = t?.out ?? -1 // resolved to the clip's duration once it loads
  curDur = 0
  mpv.loadFile(playlist[i])
  mpv.setProperty('pause', true) // paused → frame-accurate handle scrubbing
  void applyClipSpeed() // trim previews at the clip's own rate — what the timeline will play
  broadcastTrim()
  broadcast('playlist:changed', playlistPayload())
  revealUi() // bring the controls up so the in/out handles are visible right away
}

/** Commit the current trim and return to the full stitched timeline (reflecting it). */
function exitTrim(): void {
  if (trimClip < 0) return
  storeTrim()
  const clip = trimClip
  trimClip = -1
  broadcastTrim() // clip = −1 → the OSC hides the handles
  loadTimeline(clip) // rebuild the EDL with the trim, land back on that clip
}

/** Double-click a clip in Timeline mode: the isolated clip → commit (exit); another
 *  clip → switch to trimming it (committing the current one first). */
function toggleTrim(i: number): void {
  if (!mergeOn) return
  if (trimClip === i) exitTrim()
  else enterTrim(i)
}

/** Drag an in/out handle: set that point (seconds) and scrub the preview to it. */
function setTrim(which: 'in' | 'out', t: number): void {
  if (trimClip < 0 || !mpv) return
  const dur = curDur || t
  const v = Math.max(0, Math.min(dur, t))
  if (which === 'in') curIn = Math.min(v, (curOut < 0 ? dur : curOut) - 0.1)
  else curOut = Math.max(v, curIn + 0.1)
  mpv.command(['seek', which === 'in' ? curIn : curOut, 'absolute']).catch(() => {})
  broadcastTrim()
}

/** Reset the isolated clip's range to the full clip. */
function resetTrim(): void {
  if (trimClip < 0) return
  curIn = 0
  curOut = curDur
  broadcastTrim()
}

/** Drag-reorder: move the given queue items (a single row or a whole multi-selection)
 *  as a block to just before index `to`, keeping the currently-playing item current.
 *  Rebuilds the stitched timeline in the new order if merged. */
function movePlaylistItems(indices: number[], to: number): void {
  const idx = [...new Set(indices)].filter(i => i >= 0 && i < playlist.length).sort((a, b) => a - b)
  if (!idx.length || to < 0 || to > playlist.length) return
  const currentPath = plIndex >= 0 ? playlist[plIndex] : null
  const idxSet = new Set(idx)
  const moving = idx.map(i => playlist[i])
  const rest = playlist.filter((_, i) => !idxSet.has(i))
  // `to` indexes the ORIGINAL array (insert-before that row); shift left by how many
  // moved items sat before it
  const insertAt = Math.max(0, Math.min(rest.length, to - idx.filter(i => i < to).length))
  rest.splice(insertAt, 0, ...moving)
  playlist = rest
  if (currentPath !== null) {
    const ni = playlist.indexOf(currentPath) // local queues have unique paths
    if (ni >= 0) plIndex = ni
  }
  resyncShuffle()
  if (mergeOn) loadTimeline(plIndex) // rebuild the EDL in the new order, stay on the current clip
  else broadcast('playlist:changed', playlistPayload())
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

/** Remove one or more selected queue items at once. If the playing item is among
 *  them, advance to whatever slides into its place; rebuilds the timeline if merged. */
function removePlaylistItems(indices: number[]): void {
  const idx = [...new Set(indices)].filter(i => i >= 0 && i < playlist.length).sort((a, b) => b - a) // desc
  if (!idx.length) return
  const removingCurrent = idx.includes(plIndex)
  for (const i of idx) {
    playlist.splice(i, 1)
    if (i < plIndex) plIndex--
  }
  if (removingCurrent) {
    if (playlist.length === 0) {
      plIndex = -1
    } else {
      plIndex = Math.min(plIndex, playlist.length - 1)
      resyncShuffle()
      if (mergeOn) loadTimeline(plIndex)
      else playCurrent()
      return // playCurrent / loadTimeline broadcast the change
    }
  }
  resyncShuffle()
  if (mergeOn) loadTimeline(plIndex)
  else broadcast('playlist:changed', playlistPayload())
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

// An i/p badge was tried here and removed: mpv's `video-frame-info.interlaced` is a
// PER-FRAME flag, and with hardware decoding (and broadcast streams that splice
// differently-encoded segments) it reads inconsistently — the badge flickered between
// 1080i and 1080p on one channel. A confident-looking badge over an unreliable signal
// is worse than not claiming anything, which is why the letter is now only printed
// where it's certain. The deinterlace setting stays; the picture is the ground truth.

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
  // only probe real local files — skip URLs, av://lavfi, bd://, dvd://, and our own
  // .edl timeline (a text file — MediaInfo on it is meaningless).
  if (!file || isUrl(file) || /\.edl$/i.test(file) || !existsSync(file)) return
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
  for (const w of [win, oscWin, rightPanelWin, leftPanelWin, menuWin, libraryWin]) {
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

/** Resting bounds of the OSC: centered in the middle strip left free by whichever
 *  side panel is open (settings docks left, playlist docks right; only one open). */
function oscRestBounds(): Electron.Rectangle {
  const b = win!.getBounds()
  const pw = panelW(b.width)
  const left = leftPanelOpen ? pw : 0
  const right = panelOpen ? pw : 0
  const avail = b.width - left - right
  const w = Math.min(620, Math.max(OSC_MIN_W, avail - OSC_GAP))
  const margin = Math.max(44, Math.round(b.height * 0.09))
  return {
    x: Math.round(b.x + left + (avail - w) / 2),
    y: Math.round(b.y + b.height - OSC_H - margin),
    width: Math.round(w),
    height: OSC_H
  }
}

/**
 * Opacity setter that keeps the acrylic alive.
 *
 * On Windows `setOpacity(<1)` turns the window LAYERED (WS_EX_LAYERED), and a
 * layered window cannot keep its DWM system backdrop — so every OSC/panel fade
 * silently killed the frost. Electron drops the layered style again at opacity 1,
 * but the backdrop is NOT restored on its own: it only came back on minimize +
 * restore (which rebuilds the window). So re-assert it every time we settle back
 * to fully opaque. Symptom this fixes: pause (→ OSC reveal animation) left every
 * acrylic surface flat until you minimized the app.
 */
const wentLayered = new WeakMap<BrowserWindow, boolean>()

/** Ask DWM for the acrylic backdrop again. Several things drop it (going layered,
 *  maximizing) and Windows never puts it back by itself — the frost stays dead
 *  until the window is rebuilt, which is why "minimize + restore" used to be the
 *  only cure. Anything that can kill the backdrop must call this afterwards. */
function reassertBackdrop(w: BrowserWindow | null): void {
  if (!w || w.isDestroyed()) return
  w.setBackgroundMaterial('acrylic')
}

function setWinOpacity(w: BrowserWindow | null, v: number): void {
  if (!w || w.isDestroyed()) return
  w.setOpacity(v)
  if (v < 1) {
    wentLayered.set(w, true) // now layered → its backdrop is gone
    return
  }
  // back to fully opaque: only re-assert if we actually dropped below 1, otherwise
  // the redundant DWM call makes the window visibly flash on every reveal
  if (wentLayered.get(w)) {
    wentLayered.set(w, false)
    reassertBackdrop(w)
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
    setWinOpacity(oscWin, 0)
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
    setWinOpacity(oscWin, fromOp + (toOp - fromOp) * e)
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
  setWinOpacity(oscWin, 1) // it's shown — snap opacity in case a reveal was mid-flight
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
  const top = noTitleStrip() ? 0 : TITLEBAR_H
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
      setWinOpacity(pw, 0)
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
    setWinOpacity(pw, fromOp + (toOp - fromOp) * e)
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

function closeRightPanel(): void {
  if (!panelOpen) return
  panelOpen = false
  animatePanel('right', false)
  rightPanelWin?.webContents.send('panel:reveal', false)
  broadcast('ui:panel-open', false) // OSC list button un-press
}

function closeLeftPanel(): void {
  if (!leftPanelOpen) return
  leftPanelOpen = false
  animatePanel('left', false)
  leftPanelWin?.webContents.send('panel:reveal', false)
  broadcast('ui:settings-open', false) // OSC gear un-highlights
}

/** Both side panels shift the OSC and are mutually exclusive (opening one closes
 *  the other) — two full-width panels + the OSC can't share a normal window. */
function togglePlaylistPanel(): void {
  if (!rightPanelWin) return
  if (panelOpen) {
    closeRightPanel()
  } else {
    closeLeftPanel() // one panel at a time
    panelOpen = true
    animatePanel('right', true)
    rightPanelWin.webContents.send('panel:reveal', true)
    broadcast('ui:panel-open', true)
  }
  slideOscToRest() // glide the OSC to the new middle strip
}

function toggleSettingsPanel(): void {
  if (!leftPanelWin) return
  if (leftPanelOpen) {
    closeLeftPanel()
  } else {
    closeRightPanel()
    leftPanelOpen = true
    animatePanel('left', true)
    leftPanelWin.webContents.send('panel:reveal', true)
    broadcast('ui:settings-open', true) // OSC gear highlights while settings is open
  }
  slideOscToRest()
}

// ---------- 收藏 (library) overlay: a centred acrylic child window ----------

/** Centred resting bounds: ~60% of the video area, clamped, below the title bar
 *  (top = 0 in fullscreen). Re-derived on every open + parent move/resize. */
function libraryBounds(): Electron.Rectangle {
  const b = win!.getBounds()
  const top = noTitleStrip() ? 0 : TITLEBAR_H
  const availH = b.height - top
  const w = Math.round(Math.min(880, Math.max(460, b.width * 0.62)))
  const h = Math.round(Math.min(700, Math.max(380, availH * 0.76)))
  return {
    x: Math.round(b.x + (b.width - w) / 2),
    y: Math.round(b.y + top + (availH - h) / 2),
    width: w,
    height: h
  }
}

/** Fade the library window in/out in place (the content does its own scale-in via
 *  the `library:reveal` class — a window can't be clipped to the parent). */
function animateLibrary(reveal: boolean): void {
  if (!win || !libraryWin || win.isDestroyed() || libraryWin.isDestroyed()) return
  const lw = libraryWin
  if (libraryAnim) clearInterval(libraryAnim)
  const dur = reveal ? 200 : 130
  if (reveal) {
    lw.setBounds(libraryBounds())
    lw.setIgnoreMouseEvents(false)
    if (!lw.isVisible()) {
      setWinOpacity(lw, 0)
      lw.showInactive()
    }
    lw.focus() // so Esc + wheel land in the overlay right away
  }
  const fromOp = lw.getOpacity()
  const toOp = reveal ? 1 : 0
  const t0 = Date.now()
  libraryAnim = setInterval(() => {
    if (lw.isDestroyed()) {
      if (libraryAnim) clearInterval(libraryAnim)
      libraryAnim = null
      return
    }
    const p = Math.min(1, (Date.now() - t0) / dur)
    const e = 1 - Math.pow(1 - p, 3)
    setWinOpacity(lw, fromOp + (toOp - fromOp) * e)
    if (p >= 1) {
      if (libraryAnim) clearInterval(libraryAnim)
      libraryAnim = null
      if (!reveal && !lw.isDestroyed()) lw.setIgnoreMouseEvents(true) // closed → let clicks reach the video
    }
  }, 16)
}

function closeLibrary(): void {
  if (!libraryOpen) return
  libraryOpen = false
  animateLibrary(false)
  broadcast('library:reveal', false) // library window (scale-out) + main window (cursor/Home on-state)
}

function toggleLibrary(): void {
  if (!libraryWin) return
  if (libraryOpen) {
    closeLibrary()
    return
  }
  closeRightPanel() // don't stack the overlay over an open side panel
  closeLeftPanel()
  libraryOpen = true
  // hide the OSC while the overlay is up (like the context menu does) — it would
  // otherwise sit over the video behind the centred overlay
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  broadcast('ui:hide')
  animateOsc(false)
  animateLibrary(true)
  broadcast('library:reveal', true) // library window (scale-in) + main window (cursor/Home on-state)
}

/** Keep the open overlay centred on the window (skip mid-animation). */
function layoutLibrary(): void {
  if (!win || !libraryWin || win.isDestroyed() || libraryWin.isDestroyed()) return
  if (libraryOpen && !libraryAnim) libraryWin.setBounds(libraryBounds())
}

/** An acrylic centred child window for the 收藏 overlay (`?win=library`). Rounded
 *  (it floats free, unlike the edge-docked square panels). Pre-warmed like them. */
function makeLibraryWindow(): BrowserWindow {
  const lw = new BrowserWindow({
    width: 700,
    height: 520, // placeholders; real bounds set on open by libraryBounds()
    frame: false,
    transparent: false,
    backgroundMaterial: 'acrylic',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: true, // clickable lists + (later) an add-URL input
    hasShadow: false,
    parent: win!,
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  loadRenderer(lw, 'win=library')
  lw.webContents.once('did-finish-load', () => {
    if (lw.isDestroyed()) return
    removeBorderLine(lw)
    if (win && !win.isDestroyed()) {
      lw.setBounds(libraryBounds())
      setWinOpacity(lw, 0)
      lw.setIgnoreMouseEvents(true)
      lw.showInactive() // pre-warm so the first real open is a clean fade, no zoom
    }
  })
  lw.on('closed', () => {
    libraryWin = null
  })
  return lw
}

function revealUi(): void {
  if (menuOpen || libraryOpen) return // don't pop the OSC under the menu / 收藏 overlay
  if (isMini()) return // the mini player has its own overlay; the OSC would dwarf it
  broadcast('ui:reveal')
  // only run the slide-up when the OSC is actually hidden — re-running it while
  // it's already at rest re-reads getBounds() and, with DPI rounding, animates a
  // ±1px difference every mouse move (visible jitter)
  if (hasMedia && !oscShown) animateOsc(true)
  if (hideTimer) clearTimeout(hideTimer)
  const delayMs = Math.max(1, getSettings().oscHideDelay) * 1000
  hideTimer = setTimeout(() => {
    if (oscHovered) return // pointer is over the OSC — keep it up (no flicker)
    if (trimClip >= 0 && getSettings().pinOscInTrim) return // keep the in/out handles reachable while trimming
    broadcast('ui:hide')
    animateOsc(false) // slide down + fade out
  }, delayMs)
}

/**
 * While fullscreen, sit above the taskbar's z-band so the shell can't flash it up
 * when the OSC (a focusable child, needed for its acrylic) briefly steals the
 * foreground. Tied to app-frontmost so alt-tabbing away releases the grip — we
 * don't want to cover other apps. Owned children (OSC / panels) stay above their
 * owner regardless, so they're never hidden by this.
 */
function syncFsTopmost(): void {
  if (!win || win.isDestroyed()) return
  const appActive = BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isFocused())
  // the mini player stays on top even when the app is in the background — that IS the
  // point of it; fullscreen only claims topmost while we're the active app.
  win.setAlwaysOnTop(isMini() || (Boolean(preFsBounds) && appActive), 'screen-saver')
}

/**
 * "Maximize" by covering the work area, never with the OS maximize.
 *
 * Entering the real maximized state permanently destroys the window's DWM acrylic
 * backdrop: it does not come back on restore, and neither re-asserting the material
 * nor toggling it through 'none' revives it (both tried) — only rebuilding the
 * window does. Borderless fullscreen already proved that a window can cover the
 * whole screen and keep its frost, so the size was never the problem; the maximized
 * *state* is. Same escape as native fullscreen → borderless fullscreen.
 */
function fakeMaximize(): void {
  if (!win || win.isDestroyed() || preMaxBounds) return
  preMaxBounds = win.getBounds()
  win.setBounds(screen.getDisplayMatching(preMaxBounds).workArea) // workArea = keeps the taskbar
  win.webContents.send('win:maximized', true)
}

function unfakeMaximize(): void {
  if (!win || win.isDestroyed() || !preMaxBounds) return
  const restore = preMaxBounds
  preMaxBounds = null
  win.setBounds(restore)
  win.webContents.send('win:maximized', false)
}

function toggleFullscreen(): void {
  if (!win) return
  if (isMini()) toggleMini() // the two are exclusive — leave the mini player first
  suppressRevealUntil = Date.now() + 350 // don't let the resize's mousemove pop the OSC
  if (preFsBounds) {
    // EXIT — drop topmost, restore the pre-fullscreen size/state
    const restore = preFsBounds
    preFsBounds = null
    win.setAlwaysOnTop(false)
    win.setBounds(restore)
    if (fsWasMaximized) fakeMaximize() // restore stored the pre-max bounds
    setCornerPreference(win, CORNER_DEFAULT) // rounded corners look good windowed
  } else {
    // ENTER — *borderless* fullscreen: cover the whole monitor (incl. the taskbar
    // area) + go topmost, rather than OS-native fullscreen. Native fullscreen makes
    // Windows ignore setAlwaysOnTop, so clicking the focusable OSC (which briefly
    // steals the foreground) lets the shell flash the taskbar up. Borderless +
    // topmost keeps that reveal *behind* our full-screen window, so it never shows.
    fsWasMaximized = isMaxed()
    // restore point + the "is fullscreen" flag. When maximized, remember the bounds
    // from *before* the maximize, so leaving fullscreen can re-derive both states.
    preFsBounds = preMaxBounds ?? win.getBounds()
    preMaxBounds = null
    win.setBounds(screen.getDisplayMatching(preFsBounds).bounds) // full monitor, not workArea
    setCornerPreference(win, CORNER_DONOTROUND)
  }
  syncFsTopmost() // topmost above the taskbar while fullscreen + frontmost (alt-tab releases)
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
      setWinOpacity(oscWin, 1)
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
        setWinOpacity(pw, 1)
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
// Is the cursor over the mini player? Polled from MAIN rather than watched in the
// renderer, because the whole window is a drag region and those hand their mouse
// events to the OS — the renderer never sees hover there, which is why a CSS :hover
// reveal only ever fired once you were already on a button. Comparing the cursor
// against the window rectangle sidesteps the problem entirely. Only runs while the
// mini player is up.
let miniHoverTimer: NodeJS.Timeout | null = null
let miniHovered = false
// window rect at the moment a drag began; every move resolves against it — see win:drag-move
let dragAnchor: Electron.Rectangle | null = null

function stopMiniHoverWatch(): void {
  if (miniHoverTimer) {
    clearInterval(miniHoverTimer)
    miniHoverTimer = null
  }
  miniHovered = false
}

function startMiniHoverWatch(): void {
  stopMiniHoverWatch()
  broadcast('ui:mini-hover', false)
  miniHoverTimer = setInterval(() => {
    if (!win || win.isDestroyed() || !isMini()) {
      stopMiniHoverWatch()
      return
    }
    const c = screen.getCursorScreenPoint()
    const b = win.getBounds()
    const inside = c.x >= b.x && c.x < b.x + b.width && c.y >= b.y && c.y < b.y + b.height
    if (inside !== miniHovered) {
      miniHovered = inside
      broadcast('ui:mini-hover', inside)
    }
  }, 150)
}

/**
 * Toggle the mini player. Exclusive with fullscreen, and with the side panels /
 * library overlay — none of them fit, and the OSC window is hidden outright (its
 * controls are ~480px of chrome; the mini overlay replaces them).
 */
function toggleMini(): void {
  if (!win || win.isDestroyed()) return
  suppressRevealUntil = Date.now() + 350 // the resize's mousemove must not pop the OSC
  if (preMiniBounds) {
    // EXIT — unlock the aspect, drop topmost, restore size + the normal minimum
    const restore = preMiniBounds
    preMiniBounds = null
    win.setAspectRatio(0)
    win.setMinimumSize(WIN_MIN_W, 320)
    win.setMaximumSize(32767, 32767) // effectively unlimited again
    win.setAlwaysOnTop(false)
    win.setBounds(restore)
    setCornerPreference(win, CORNER_DEFAULT)
    stopMiniHoverWatch()
    broadcast('ui:mini-hover', false)
    broadcast('ui:mini', false)
    updateVideoMargin()
    revealUi()
    return
  }
  if (!hasMedia) return // nothing to float
  if (preFsBounds) toggleFullscreen() // leave fullscreen first — the two are exclusive
  closeRightPanel()
  closeLeftPanel()
  if (libraryOpen) closeLibrary()
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  broadcast('ui:hide')
  animateOsc(false)

  // go back to the pre-maximize bounds if we were "maximized" — restoring to a
  // work-area-sized rectangle would otherwise look like it did nothing
  preMiniBounds = isMaxed() && preMaxBounds ? preMaxBounds : win.getBounds()
  const aspect = lastAspect > 0.2 && lastAspect < 5 ? lastAspect : 16 / 9
  const w = MINI_W
  const h = Math.round(w / aspect)
  const area = screen.getDisplayNearestPoint(win.getBounds()).workArea
  win.setMinimumSize(MINI_MIN_W, Math.round(MINI_MIN_W / aspect))
  const maxW = Math.round(Math.min(MINI_MAX_W, area.width * MINI_MAX_SHARE))
  win.setMaximumSize(maxW, Math.round(maxW / aspect))
  win.setBounds({
    x: area.x + area.width - w - 24, // bottom-right, with a margin off the edges
    y: area.y + area.height - h - 24,
    width: w,
    height: h
  })
  win.setAspectRatio(aspect) // free resize, locked shape
  win.setAlwaysOnTop(true, 'screen-saver')
  broadcast('ui:mini', true)
  updateVideoMargin()
  startMiniHoverWatch()
}

function updateVideoMargin(): void {
  if (!mpv || !win || win.isDestroyed()) return
  const h = win.getContentBounds().height
  // no strip reserved when it isn't drawn: fullscreen, the mini player, or the
  // hide-title-bar setting. The peeking bar then overlays the video instead of
  // reserving space, so revealing it never reflows the picture.
  const ratio = noTitleStrip() || h <= 0 ? 0 : Math.min(0.4, TITLEBAR_H / h)
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
  if (!changed || preFsBounds || isMaxed()) return

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
      setWinOpacity(pw, 0)
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

/** Acrylic context-menu window (`?win=menu`). Focusable both because DWM only
 *  frosts focusable windows and because we use its blur as "clicked outside". */
function makeMenuWindow(): BrowserWindow {
  const mw = new BrowserWindow({
    width: 240,
    height: 320, // placeholders; real bounds arrive with the renderer's measured size
    frame: false,
    transparent: false,
    backgroundMaterial: 'acrylic',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    parent: win!,
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  loadRenderer(mw, 'win=menu')
  mw.webContents.once('did-finish-load', () => {
    if (mw.isDestroyed()) return
    removeBorderLine(mw)
    // pre-warm like the panels so the first open doesn't play Windows' zoom-in
    setWinOpacity(mw, 0)
    mw.setIgnoreMouseEvents(true)
    mw.showInactive()
  })
  mw.on('blur', () => hideMenu()) // clicking anywhere else dismisses
  mw.on('closed', () => {
    menuWin = null
  })
  return mw
}

/**
 * Put the menu at the click. The corner is chosen ONCE, on the first size — later
 * sizes (a submenu accordion opening) keep that same origin and are only nudged if
 * growth would run off-screen. Re-deciding the flip on every resize made the whole
 * menu jump around as you expanded a submenu.
 */
function placeMenu(w: number, h: number): void {
  if (!menuWin || menuWin.isDestroyed() || !menuAnchor) return
  const area = screen.getDisplayNearestPoint(menuAnchor).workArea
  if (!menuOrigin) {
    let x = menuAnchor.x
    let y = menuAnchor.y
    if (x + w > area.x + area.width) x = menuAnchor.x - w // flip left of the cursor
    if (y + h > area.y + area.height) y = menuAnchor.y - h // flip above it
    menuOrigin = { x, y }
  }
  // keep the chosen corner; only slide back in when the grown menu would overflow
  const x = Math.max(area.x, Math.min(menuOrigin.x, area.x + area.width - w))
  const y = Math.max(area.y, Math.min(menuOrigin.y, area.y + area.height - h))
  menuWin.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h })
}

/**
 * Grow the menu to a new size with an ease-out settle (accordion expanding).
 * Only bounds are animated — that's safe for the acrylic, unlike opacity (see
 * setWinOpacity). Collapsing snaps instead: the renderer has already dropped those
 * rows, so easing the window down would just trail an empty frosted strip.
 */
function animateMenuTo(w: number, h: number, allowShrink = false, onDone?: () => void): void {
  if (!menuWin || menuWin.isDestroyed()) return
  if (menuAnim) {
    clearInterval(menuAnim)
    menuAnim = null
  }
  const from = menuWin.getBounds().height
  if (h <= from && !allowShrink) {
    placeMenu(w, h)
    return
  }
  const dur = allowShrink ? MENU_SHRINK_MS : MENU_GROW_MS
  const t0 = Date.now()
  menuAnim = setInterval(() => {
    if (!menuWin || menuWin.isDestroyed() || !menuShown) {
      if (menuAnim) clearInterval(menuAnim)
      menuAnim = null
      return
    }
    const p = Math.min(1, (Date.now() - t0) / dur)
    // easeOutQuad, not Cubic: cubic front-loads ~70% of the distance into the first
    // third of the time, so the long tail reads as a *second*, slower move rather
    // than one gesture. Quad still settles softly but stays much more even.
    const e = 1 - Math.pow(1 - p, 2)
    placeMenu(w, Math.round(from + (h - from) * e))
    if (p >= 1) {
      clearInterval(menuAnim!)
      menuAnim = null
      onDone?.()
    }
  }, 16)
}

function hideMenu(): void {
  if (!menuShown) return
  menuShown = false
  menuAnchor = null
  menuOrigin = null
  if (menuAnim) {
    clearInterval(menuAnim)
    menuAnim = null
  }
  menuOpen = false
  broadcast('ui:menu', false)
  if (menuWin && !menuWin.isDestroyed()) {
    setWinOpacity(menuWin, 0)
    menuWin.setIgnoreMouseEvents(true)
  }
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
    // focusable: true is REQUIRED — Win11 refuses to render the acrylic backdrop
    // on a window that can never activate (a non-focusable OSC shows a flat solid
    // grey, no frost). The downside it used to guard against — clicking a button in
    // fullscreen activates the OSC, drops the main window's foreground state and
    // pops the taskbar — is instead handled by bouncing focus back to the main
    // window whenever the OSC takes it (the OSC has no text inputs to keep focus).
    focusable: true,
    hasShadow: false,
    roundedCorners: true,
    parent: win,
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  loadRenderer(oscWin, 'win=osc')

  // NOTE: we deliberately do NOT bounce focus back to the main window when the OSC
  // is clicked. Win11 renders an *inactive* window's acrylic as a flat fallback
  // colour, so stealing focus straight back left the OSC unfrosted after every
  // button press. The taskbar problem that bounce originally guarded against is
  // now handled by borderless fullscreen + always-on-top (see toggleFullscreen).

  menuWin = makeMenuWindow()
  rightPanelWin = makePanelWindow('playlist')
  leftPanelWin = makePanelWindow('settings')
  libraryWin = makeLibraryWindow()

  // keep the OSC + panels + overlay glued to the main window
  win.on('move', () => {
    layoutOsc()
    layoutPanel('right')
    layoutPanel('left')
    layoutLibrary()
  })
  win.on('resize', () => {
    layoutOsc()
    updateVideoMargin() // keep the reserved title strip proportional as height changes
    pushPanelWidth() // panel width tracks the window width
    layoutPanel('right')
    layoutPanel('left')
    layoutLibrary()
  })

  // broadcast app active/inactive so the renderer can compensate the acrylic
  // (Win11 lightens acrylic on inactive windows), and release/re-assert the
  // fullscreen topmost grip so alt-tabbing away doesn't leave us covering apps
  const updateFocus = (): void => {
    broadcast(
      'app:focus',
      BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isFocused())
    )
    syncFsTopmost()
  }
  for (const w of [win, oscWin, rightPanelWin, leftPanelWin, menuWin, libraryWin]) {
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
  // Aero Snap, Win+Up and a title-bar double-click can still reach the real OS
  // maximize, which is the thing that kills the acrylic for good. Bounce straight
  // back out of it and apply ours instead. (unmaximize() here fires 'unmaximize',
  // which we deliberately don't listen for — we own that transition.)
  win.on('maximize', () => {
    win?.unmaximize()
    fakeMaximize()
  })

  win.on('close', () => {
    stopRecording(true) // finalize the recording file before we tear mpv down
    persistState()
  })
  win.on('closed', () => {
    for (const w of [oscWin, rightPanelWin, leftPanelWin, libraryWin]) {
      if (w && !w.isDestroyed()) w.close()
    }
    mpv?.quit()
    win = null
  })
  oscWin.on('closed', () => {
    oscWin = null
  })
}

// fontconfig accepts a comma-separated family list and takes the first one that's
// actually installed, so append a known-good CJK face. Without it, picking a font
// the machine doesn't have (Source Han on a stock Windows, say) drops to whatever
// the system feels like — often something missing Simplified-only glyphs, which is
// the very problem the setting exists to fix.
const SUB_FONT_FALLBACK = 'Microsoft YaHei'

function subFontChain(font: string): string {
  const f = font.trim()
  if (!f || f === 'sans-serif') return 'sans-serif'
  return f === SUB_FONT_FALLBACK ? f : `${f},${SUB_FONT_FALLBACK}`
}

/** Push settings mpv cares about: hwdec, preferred track languages, sub visibility. */
function applyMpvSettings(): void {
  if (!mpv) return
  const s = getSettings()
  mpv.setProperty('hwdec', s.hwdec)
  mpv.setProperty('deinterlace', s.deinterlace)
  mpv.setProperty('alang', s.audioLang) // '' = mpv default (file's own order)
  mpv.setProperty('slang', s.subLang)
  mpv.setProperty('sub-visibility', s.subsDefaultOn)
  mpv.setProperty('sub-auto', s.autoLoadSubs ? 'fuzzy' : 'no') // auto-pick external subs
  // SRT carries no styling, so the font is entirely ours to pick. mpv's default
  // 'sans-serif' resolves to whatever the system fancies, which on a Japanese
  // release often lacks Simplified-only glyphs (们/吗) — libass then substitutes
  // just those characters and they visibly clash with the rest of the line.
  if (s.subFont) mpv.setProperty('sub-font', subFontChain(s.subFont))
  if (s.subFontSize > 0) mpv.setProperty('sub-font-size', s.subFontSize)
  mpv.setProperty('sub-spacing', s.subSpacing)
  mpv.setProperty('sub-bold', s.subBold)
  mpv.setProperty('sub-outline-size', s.subOutline)
  // resting position; the right panel's Adjust nudges sub-pos on top of this
  mpv.setProperty('sub-margin-y', s.subMarginY)
  // HDR subtitle brightness (nits); ignored for SDR. Two separate mpv props:
  // sub-hdr-peak = text subs (libass SRT/ASS), image-subs-hdr-peak = bitmap subs
  // (PGS/VOBSUB, what most UHD Blu-ray rips carry — its default 1000 nits is harsh).
  mpv.setProperty('sub-hdr-peak', s.subHdrPeak)
  mpv.setProperty('image-subs-hdr-peak', s.subHdrPeak)
  mpv.setProperty('audio-pitch-correction', s.keepPitch) // keep pitch when changing speed
  mpv.setProperty('ytdl-format', YTDL_FORMAT[s.streamQuality]) // online quality cap
  applyYtdlCookies()
  applyAudioPassthrough()
}

/** Audio passthrough (bitstream to an external receiver/DAC). Off → decode in
 *  software; on → send the raw stream for the listed codecs (mpv audio-spdif). */
function applyAudioPassthrough(): void {
  if (!mpv) return
  const s = getSettings()
  mpv.setProperty('audio-spdif', s.audioPassthrough ? s.passthroughCodecs : '')
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

// ---- stream recording (mpv stream-record: tee the played stream to a file) ----
// Setting the `stream-record` property to a path starts it (stream-copy, no
// re-encode); setting it to '' stops. State lives here and is broadcast so the OSC
// can show its red dot; the recording auto-stops when the file changes or on exit.
let recordingPath: string | null = null
let recStartedAt = 0

/** Effective recording folder ('' setting → the Videos/Lunoir default). */
function recordingDir(): string {
  return getSettings().recordingDir || join(app.getPath('videos'), 'Lunoir')
}

/** Turn an arbitrary title/path into a safe file-name stem. */
function safeStem(s: string): string {
  return (s || 'recording')
    .replace(/\.[^.]+$/, '') // drop any extension
    .replace(/[\\/:*?"<>|]/g, ' ') // illegal filename chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'recording'
}

function recordingState(): { recording: boolean; since: number | null } {
  return { recording: recordingPath != null, since: recordingPath ? recStartedAt : null }
}

async function startRecording(): Promise<void> {
  if (!mpv || !hasMedia || recordingPath) return
  // only record LIVE streams — on a file/VOD, stream-record dumps the read-ahead
  // cache (wrong spot, mid-GOP macroblocking); precise file clips are A-B export's job
  try {
    if ((await mpv.command(['get_property', 'seekable'])) !== false) return
  } catch { return }
  // a nice stem: mpv's media-title if it's meaningful, else the current file's base
  let stem = ''
  try {
    const title = await mpv.command(['get_property', 'media-title'])
    if (typeof title === 'string') stem = title
  } catch { /* fall through */ }
  if (!stem && plIndex >= 0 && playlist[plIndex]) stem = basename(playlist[plIndex])
  const dir = recordingDir()
  try { mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }
  const pad = (n: number): string => String(n).padStart(2, '0')
  const d = new Date()
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const out = join(dir, `${safeStem(stem)}_${ts}.mkv`)
  mpv.setProperty('stream-record', out)
  recordingPath = out
  recStartedAt = Date.now()
  broadcast('recording:state', recordingState())
}

function stopRecording(silent = false): void {
  if (!recordingPath) return
  const saved = recordingPath
  recordingPath = null
  mpv?.setProperty('stream-record', '')
  broadcast('recording:state', recordingState())
  if (!silent) broadcast('ui:toast', tr('toast.recordingSaved', { name: basename(saved) }))
}

/** Save volume / window bounds / playback position on exit (per the toggles). */
function persistState(): void {
  const s = getSettings()
  if (s.rememberVolume) setSetting('volume', lastVolume)
  // while maximized, persist the bounds we'd restore to, not the work area
  if (s.rememberWindow && win && !win.isDestroyed() && !preFsBounds) {
    // Save the rectangle we'd RESTORE to, never a temporary one: quitting from the mini
    // player (taskbar → Close) otherwise remembered its corner-sized rect and the app
    // reopened tiny. preMiniBounds already holds the pre-maximize rect when the mini
    // player was entered while maximized, so it takes precedence.
    setSetting('windowBounds', preMiniBounds ?? preMaxBounds ?? win.getBounds())
  }
  if (s.resumePlayback && resumePath && canResume()) {
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
      stopRecording(true) // a new file means the old recording is done — end it quietly
      runProbe(data)
    }
    // "watch as one": derive the clip boundaries from the timeline's chapter list. mpv
    // titles a segment boundary with the exact path we wrote into the EDL, while the
    // source files' own chapters carry their own titles — that's how we tell them apart
    // (verified for plain AND trimmed `path,in,len` entries). Without this split, a rip
    // that brings its own chapters would litter the seek bar and break clip tracking.
    if (name === 'chapter-list' && mergeOn && trimClip < 0) {
      const list = Array.isArray(data) ? (data as { time?: number; title?: string }[]) : []
      const edlPaths = new Set(playlist.map(p => p.replace(/\\/g, '/'))) // the EDL writes forward slashes
      timelineChapterTimes = list.map(c => (typeof c.time === 'number' ? c.time : 0))
      clipStarts = list
        .filter(c => typeof c.title === 'string' && edlPaths.has(c.title))
        .map(c => (typeof c.time === 'number' ? c.time : 0))
      broadcast('playlist:changed', playlistPayload()) // hand the boundaries to the OSC
      if (pendingMergeSeek >= 0 && pendingMergeSeek < clipStarts.length) {
        seekToClip(pendingMergeSeek)
        pendingMergeSeek = -1
      }
      void applyClipSpeed() // a fresh timeline starts on some clip — honour its rate
    }
    // while merged, map mpv's current chapter to the clip that CONTAINS it (a source
    // file's own chapters all belong to their own clip) so the panel highlights the
    // right row as playback crosses clip boundaries.
    if (name === 'chapter' && mergeOn && trimClip < 0 && typeof data === 'number' && data >= 0) {
      const clip = clipAt(timelineChapterTimes[data] ?? 0)
      if (clip !== plIndex) {
        plIndex = clip
        broadcast('playlist:changed', playlistPayload())
        void applyClipSpeed() // the new clip may run at a different playback rate
      }
    }
    // while trimming an isolated clip, its duration bounds the in/out handles
    if (name === 'duration' && trimClip >= 0 && typeof data === 'number' && data > 0) {
      curDur = data
      if (curOut < 0 || curOut > data) curOut = data
      broadcastTrim()
    }
    // give URL playlist items a real name once mpv resolves the media title — but
    // NOT for IPTV: there the m3u's channel name is authoritative, and the stream's
    // own title (often the raw URL) must never overwrite it.
    if (
      name === 'media-title' &&
      typeof data === 'string' &&
      data &&
      plIndex >= 0 &&
      isUrl(playlist[plIndex]) &&
      sourceType !== 'iptv'
    ) {
      if (urlTitles[playlist[plIndex]] !== data) {
        urlTitles[playlist[plIndex]] = data
        broadcast('playlist:changed', playlistPayload())
      }
      // a single opened URL's title also refines its recents entry (not a list —
      // there the media-title is a channel, and the recent is the list source)
      if (curOpen?.kind === 'url') updateRecentName(curOpen.target, data)
    }
    // keep the active-audio resolver's inputs current, re-push on any change
    if (name === 'track-list') {
      lastTracks = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []
      broadcastActiveAudio()
    } else if (name === 'aid') {
      lastAid = typeof data === 'number' ? data : false
      broadcastActiveAudio()
    } else if (name === 'seekable' && data === true && curRecentPending && curOpen?.kind === 'url') {
      // the URL proved a seekable VOD → now it may enter recents (with the resolved
      // title if we have it). A live stream reports false and is simply never added;
      // we only act on true, so a transient false at load can't wrongly drop a VOD.
      addRecent(curOpen.target, urlTitles[curOpen.target] || curOpen.target, 'url')
      curRecentPending = false
      broadcast('recents:changed')
    } else if (name === 'duration' && typeof data === 'number') {
      lastDuration = data
    } else if (name === 'volume' && typeof data === 'number') {
      lastVolume = data
    } else if (name === 'seekable' && typeof data === 'boolean') {
      lastSeekable = data // false = live → no resume position (see canResume)
    } else if (name === 'time-pos' && typeof data === 'number') {
      resumePos = data
      // throttled resume-position save; clear it once we're near the end (watched)
      if (getSettings().resumePlayback && resumePath && canResume() && Date.now() - lastPosWrite > 5000) {
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
  mpv.on('mpv-event', (event: string, msg?: { reason?: string }) => {
    broadcast('mpv:event', event)
    if (event === 'end-file') {
      broadcast('ui:loading', false)
      // mpv gave up loading this item (dead stream / unreadable file) — the missing
      // LOCAL file case is already caught in playCurrent, so this covers URLs/streams.
      // Prefer yt-dlp's own words: "members-only", "DRM protected", "video unavailable"
      // all land here as a bare "couldn't load" otherwise, which tells you nothing about
      // whether to retry, sign in, or give up.
      if (msg?.reason === 'error') {
        const why = takeYtdlError()
        broadcast('ui:toast', why || tr('main.loadFailed'))
        // an out-of-date extractor is the one cause we can actually fix, so refresh it
        if (why && YTDL_OUTDATED_RE.test(why)) refreshYtdl()
      }
    }
    if (event === 'playback-restart') {
      broadcast('ui:loading', false) // first frame is up (after any buffering)
      if (pendingResumeToast) {
        // now that playback actually started, announce the resume (not during the
        // grey loading gap — which for streams comes well before this)
        broadcast('ui:toast', tr('main.resumed', { time: pendingResumeToast }))
        pendingResumeToast = ''
      }
    }
    // resume: seek to the saved position as soon as the file is loaded (so a stream
    // buffers at the right spot); the toast waits for playback-restart above
    if (event === 'file-loaded') {
      pendingResumeToast = '' // clear any stale pending toast from a failed load
      if (getSettings().resumePlayback && resumePath && canResume()) {
        const pos = getPosition(resumePath)
        if (typeof pos === 'number' && pos > 5) {
          mpv?.command(['seek', pos, 'absolute']).catch(() => {})
          pendingResumeToast = mmss(pos)
        }
      } else if (resumePath && !canResume()) {
        clearPosition(resumePath) // self-heal: drop channel URLs written before this guard
      }
    }
  })
  mpv.on('log', (line: string) => {
    if (isDev) process.stdout.write(`[mpv] ${line}`)
    noteYtdlError(line) // keep yt-dlp's own words for the end-file toast
  })
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
    const launchFile = fileFromArgv(process.argv)
    if (launchFile) {
      setTimeout(() => openMedia(launchFile), 300)
    } else if (process.env['MMP_OPEN']) {
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
      const res = await mpv?.command(cmd)
      // A paused mpv doesn't reliably push estimated-frame-number while stepping, so
      // whoever asked for the step would be the only one to learn the new value —
      // leaving the other windows' readouts stale (the OSC stepped cleanly while the
      // burn-in in the main window drifted). Pull it once here and broadcast, so
      // every window updates through the normal property path.
      if (Array.isArray(cmd) && (cmd[0] === 'frame-step' || cmd[0] === 'frame-back-step')) {
        const f = await mpv?.command(['get_property', 'estimated-frame-number'])
        if (typeof f === 'number' && f >= 0) {
          broadcast('mpv:property', { name: 'estimated-frame-number', data: Math.round(f) })
        }
      }
      return res
    } catch {
      return null
    }
  })
  ipcMain.on('mpv:set', (_e, name: string, value: unknown) => mpv?.setProperty(name, value))
  ipcMain.on('mpv:loadfile', (_e, path: string, userAgent?: string) =>
    openMedia(path, typeof userAgent === 'string' ? userAgent : '')
  )
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
  // Context menu, in its own acrylic window. The renderer measures its own content
  // (the accordion submenus change height), so we place + reveal only once a size
  // has arrived — that way the window never flashes at the wrong size.
  ipcMain.on('menu:open', (_e, x: number, y: number, items: unknown) => {
    if (!menuWin || menuWin.isDestroyed()) return
    menuAnchor = { x: Math.round(x), y: Math.round(y) }
    menuOrigin = null // fresh open → pick the corner again
    menuShown = true
    menuOpen = true
    // right-click dismisses the OSC, same as the old in-DOM menu did
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    broadcast('ui:hide')
    animateOsc(false)
    broadcast('ui:menu', true) // main window keeps the pointer visible while we're up
    // the menu window is a dumb renderer: it draws these items and reports the size
    // it wants. Actions stay in the main window — it sends back only the item id.
    menuWin.webContents.send('menu:show', items, MENU_FOLD_MS, MENU_UNFOLD_MS)
  })
  // a leaf item was clicked: dismiss, then let the main window run its handler
  ipcMain.on('menu:invoke', (_e, id: string) => {
    hideMenu()
    // the pointer sits where the menu was; after it closes that spot can land in the
    // OSC reveal band and pop the OSC — which would cover a toast the action fires
    // (e.g. 收藏当前). Stay quiet briefly so the confirmation is actually visible.
    suppressRevealUntil = Date.now() + 1200
    // "clipfps:<clip>:<fps>" — the clips panel's right-click menu. Handled here rather
    // than forwarded: it's main-process state (it drives mpv's speed), and the menu's
    // reply only ever reaches `win`, not the panel window that raised it.
    const cf = /^clipfps:(\d+):(\d+)$/.exec(id)
    if (cf) {
      setClipFps(Number(cf[1]), Number(cf[2]))
      return
    }
    if (win && !win.isDestroyed()) win.webContents.send('menu:invoke', id)
  })
  ipcMain.on('menu:size', (_e, w: number, h: number) => {
    if (!menuWin || menuWin.isDestroyed() || !menuShown) return
    const firstSize = menuWin.getOpacity() < 1
    const tw = Math.max(1, Math.round(w))
    const th = Math.max(1, Math.round(h))
    if (firstSize) placeMenu(tw, th) // opening: snap, there's nothing to grow from
    else animateMenuTo(tw, th) // accordion: ease it open
    if (firstSize) {
      menuWin.setIgnoreMouseEvents(false)
      setWinOpacity(menuWin, 1)
      // Raise above the sibling child windows BEFORE focusing. focus() alone doesn't
      // reorder them reliably: opening the menu from a panel (right-click a clip) left
      // it *behind* that panel, showing through the acrylic as a blur — and only came
      // forward on a second right-click, because the first focus had nudged its z-order.
      menuWin.moveTop()
      menuWin.focus() // focused → DWM keeps it frosted, and gives us blur-to-dismiss
    }
  })
  // coordinated collapse: the renderer folds the submenu group to 0 over the same
  // duration while we ease the window down, then we tell it the rows can go
  ipcMain.on('menu:collapse', (_e, w: number, h: number) => {
    if (!menuWin || menuWin.isDestroyed() || !menuShown) return
    animateMenuTo(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), true, () => {
      if (menuWin && !menuWin.isDestroyed()) menuWin.webContents.send('menu:collapsed')
    })
  })
  ipcMain.on('menu:close', () => hideMenu())

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
  ipcMain.on('playlist:toggle-merge', () => toggleMerge())
  ipcMain.on('timeline:trim-clip', (_e, i: number) => toggleTrim(i)) // double-click a clip
  ipcMain.on('timeline:set-trim', (_e, which: 'in' | 'out', t: number) => setTrim(which, t))
  ipcMain.on('timeline:reset-trim', () => resetTrim())
  ipcMain.on('playlist:remove', (_e, i: number) => removeFromPlaylist(i))
  ipcMain.on('playlist:move', (_e, indices: number[], to: number) => movePlaylistItems(indices, to))
  ipcMain.on('playlist:remove-multi', (_e, indices: number[]) => removePlaylistItems(indices))
  ipcMain.on('playlist:repeat-cycle', () => cycleRepeat())
  ipcMain.on('sub:add', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: tr('dlg.addSubtitle'),
      properties: ['openFile'],
      filters: [
        { name: tr('dlg.filter.subtitles'), extensions: ['srt', 'ass', 'ssa', 'vtt', 'sub', 'sup', 'idx', 'lrc'] },
        { name: tr('dlg.filter.allFiles'), extensions: ['*'] }
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
      title: tr('dlg.addToPlaylist'),
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: tr('dlg.filter.media'), extensions: VIDEO_EXT },
        { name: tr('dlg.filter.allFiles'), extensions: ['*'] }
      ]
    })
    if (!res.canceled && res.filePaths.length) addToPlaylist(res.filePaths)
  })

  // OSC buttons (in the acrylic child window) request a panel toggle through main.
  // The right (playlist) panel is now its own acrylic window, owned by main; the
  // left (settings) panel is still rendered in the main window (Phase 1).
  ipcMain.on('ui:panel-toggle', (_e, name: string) => {
    if (name === 'playlist') togglePlaylistPanel()
    else if (name === 'settings') toggleSettingsPanel()
  })

  // 收藏 (library) overlay
  ipcMain.on('library:toggle', () => toggleLibrary())
  ipcMain.on('library:close', () => closeLibrary())
  ipcMain.handle('library:recents', () => getRecents())
  ipcMain.handle('library:favourites', () => getFavourites())
  ipcMain.on('library:play', (_e, target: string) => {
    if (typeof target !== 'string' || !target) return
    closeLibrary()
    // a saved list/playlist loads its snapshot collection; everything else opens plain
    const fav = getFavourites().find(f => f.target === target)
    if (fav && (fav.kind === 'playlist' || fav.kind === 'list')) loadFavCollection(fav)
    else openMedia(target)
  })
  // drill-in: play a specific channel/item of a saved collection, starting there
  ipcMain.on('library:open-at', (_e, target: string, index: number) => {
    const fav = getFavourites().find(f => f.target === target)
    if (!fav) return
    closeLibrary()
    loadFavCollection(fav, typeof index === 'number' ? index : 0)
  })
  ipcMain.on('library:fav-item-remove', (_e, target: string, path: string) => {
    removeFavouriteItem(target, path)
    afterFavChange()
  })
  ipcMain.on('library:save-collection', () => saveCollection())
  ipcMain.on('library:recent-remove', (_e, target: string) => {
    removeRecent(target)
    broadcast('recents:changed')
  })
  ipcMain.on('library:recents-clear', () => {
    clearRecents()
    broadcast('recents:changed')
  })
  ipcMain.on('library:fav-add', (_e, target: string) => {
    if (typeof target === 'string' && target) favouriteTarget(target)
  })
  // right-click "收藏当前": ADD only, never remove ("Save" shouldn't un-save — that
  // would mislead; deletion is the trash in the overlay). If already saved, just say so.
  ipcMain.on('library:fav-current', () => {
    if (!curOpen) return
    if (isFavourite(curOpen.target)) {
      broadcast('ui:toast', tr('toast.alreadyFav'))
    } else {
      favouriteTarget(curOpen.target) // broadcasts afterFavChange
      broadcast('ui:toast', tr('toast.favourited'))
    }
  })
  ipcMain.on('library:fav-remove', (_e, target: string) => {
    removeFavourite(target)
    afterFavChange()
  })
  ipcMain.on('library:fav-rename', (_e, target: string, name: string) => {
    if (typeof target === 'string' && typeof name === 'string') {
      renameFavourite(target, name)
      afterFavChange()
    }
  })
  ipcMain.on('library:fav-channel-remove', (_e, listTarget: string, channelUrl: string) => {
    removeFavouriteChannel(listTarget, channelUrl)
    afterFavChange()
  })

  ipcMain.handle('app:open-dialog', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: tr('dlg.openMedia'),
      properties: ['openFile'],
      filters: [
        { name: tr('dlg.filter.media'), extensions: VIDEO_EXT },
        { name: tr('dlg.filter.allFiles'), extensions: ['*'] }
      ]
    })
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
  })

  // "go live": catch a live stream back up to its edge. Seeking forward within the
  // cache does NOT work on these HLS streams (mpv reports success but the playhead
  // doesn't move — probed), so the only reliable way is to RELOAD the URL: mpv
  // re-reads the live playlist and starts at the live edge, discarding the buffered
  // catch-up. Costs a brief rebuffer, same as any player's "go live".
  ipcMain.on('mpv:go-live', async () => {
    if (!mpv) return
    try {
      const p = await mpv.command(['get_property', 'path'])
      if (typeof p === 'string' && /^https?:\/\//i.test(p)) {
        mpv.loadFile(p)
        mpv.setProperty('pause', false) // going live means playing — never land paused
      }
    } catch { /* ignore */ }
  })

  // recording (stream-record)
  ipcMain.handle('recording:get', () => recordingState())
  ipcMain.on('recording:toggle', () => {
    if (recordingPath) stopRecording()
    else startRecording()
  })
  ipcMain.handle('recording:pick-folder', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: tr('dlg.chooseRecDir'),
      defaultPath: recordingDir(),
      properties: ['openDirectory', 'createDirectory']
    })
    return res.canceled || !res.filePaths[0] ? null : res.filePaths[0]
  })

  // settings
  ipcMain.handle('app:pick-folder', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: tr('dlg.chooseShotDir'),
      defaultPath: screenshotDir(),
      properties: ['openDirectory', 'createDirectory']
    })
    return res.canceled || !res.filePaths[0] ? null : res.filePaths[0]
  })
  ipcMain.handle('settings:get', () => getSettings())
  // update check (notify-only): Home peeks (cached, setting-gated); Settings forces a fresh check
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:check-update', (_e, force: boolean) => checkUpdate(!!force))
  ipcMain.on('app:open-external', (_e, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url)
  })
  ipcMain.on('settings:set', (_e, key: keyof Settings, value: unknown) => {
    setSetting(key, value as never)
    // rebuild the native menu in the new language (its labels are resolved once at
    // build time, unlike toasts/dialogs which translate at call time)
    if (key === 'uiLanguage') buildMenu()
    // toggling the experimental "watch as one" feature: refresh the panel's canMerge
    // (show/hide its toggle); if turned OFF while merged, leave merge mode cleanly.
    // showing/hiding the strip moves everything that sits below it
    if (key === 'hideTitleBar') {
      updateVideoMargin()
      if (rightPanelWin && !rightPanelWin.isDestroyed() && rightPanelWin.isVisible()) {
        rightPanelWin.setBounds(panelBounds('right'))
      }
      if (leftPanelWin && !leftPanelWin.isDestroyed() && leftPanelWin.isVisible()) {
        leftPanelWin.setBounds(panelBounds('left'))
      }
      if (libraryWin && !libraryWin.isDestroyed() && libraryWin.isVisible()) {
        libraryWin.setBounds(libraryBounds())
      }
      layoutOsc()
    }
    if (key === 'experimentalTimeline') {
      if (!value && mergeOn) toggleMerge() // turned off while merged → leave merge mode
      else broadcast('playlist:changed', playlistPayload()) // refresh the toggle's visibility
    }
    // live-apply just the changed mpv property (languages take effect next file load)
    if (mpv) {
      if (key === 'hwdec') mpv.setProperty('hwdec', value)
      else if (key === 'deinterlace') mpv.setProperty('deinterlace', value)
      else if (key === 'audioLang') mpv.setProperty('alang', value)
      else if (key === 'subLang') mpv.setProperty('slang', value)
      else if (key === 'subsDefaultOn') mpv.setProperty('sub-visibility', value)
      else if (key === 'autoLoadSubs') mpv.setProperty('sub-auto', value ? 'fuzzy' : 'no')
      else if (key === 'subFont') mpv.setProperty('sub-font', subFontChain(String(value)))
      else if (key === 'subFontSize') mpv.setProperty('sub-font-size', value)
      else if (key === 'subSpacing') mpv.setProperty('sub-spacing', value)
      else if (key === 'subBold') mpv.setProperty('sub-bold', value)
      else if (key === 'subOutline') mpv.setProperty('sub-outline-size', value)
      else if (key === 'subMarginY') mpv.setProperty('sub-margin-y', value)
      else if (key === 'subHdrPeak') {
        mpv.setProperty('sub-hdr-peak', value)
        mpv.setProperty('image-subs-hdr-peak', value) // bitmap subs (PGS) — see applyMpvSettings
      }
      else if (key === 'keepPitch') mpv.setProperty('audio-pitch-correction', value)
      else if (key === 'audioPassthrough' || key === 'passthroughCodecs') applyAudioPassthrough()
      else if (key === 'streamQuality') mpv.setProperty('ytdl-format', YTDL_FORMAT[value as Settings['streamQuality']])
      else if (key === 'useCookies' || key === 'cookiesBrowser') applyYtdlCookies()
      else if (key === 'screenshotDir') applyScreenshotDir()
      else if (key === 'screenshotFormat') applyScreenshotFormat()
    }
    broadcast('settings:changed', getSettings()) // let other windows (e.g. screenshot) track it
  })

  // Move the window by a pointer delta — how the mini player is dragged. It only ever
  // moves, never resizes, so it can't fight the mini size the way win:set-bounds would
  // (that one clamps to WIN_MIN_W). Deltas are incremental, so a dropped event just
  // means a slightly shorter step rather than a jump.
  // Dragging the mini window, done as ABSOLUTE positioning against an anchor taken when
  // the drag starts. Two earlier attempts failed because both fed the window's own state
  // back in as the next call's input:
  //   • `b.x + dx` with a locked aspect ratio re-fitted and rounded the size every call,
  //     and the error compounded dozens of times a second — the window grew as you moved.
  //   • holding the size constant fixed that, but the POSITION still read back through
  //     getBounds(); IPC is async, so a move that hadn't landed yet made the next event
  //     compute from a stale origin and silently drop that step. The window fell further
  //     and further behind the cursor.
  // Deriving x/y/width/height from the anchor plus the cursor's total offset removes the
  // feedback entirely: nothing accumulates, and a dropped event costs nothing because the
  // next one still resolves to the correct absolute position.
  ipcMain.on('win:drag-start', () => {
    if (!win || win.isDestroyed()) return
    dragAnchor = win.getBounds()
  })
  ipcMain.on('win:drag-end', () => {
    dragAnchor = null
  })
  ipcMain.on('win:drag-move', (_e, dx: number, dy: number) => {
    if (!win || win.isDestroyed() || preFsBounds || isMaxed() || !dragAnchor) return
    win.setBounds({
      x: Math.round(dragAnchor.x + dx),
      y: Math.round(dragAnchor.y + dy),
      width: dragAnchor.width,
      height: dragAnchor.height
    })
  })
  // Settings › About: force a yt-dlp refresh now. The 14-day auto-refresh in
  // ensureYtdl() covers the normal case, but a site can break yt-dlp mid-cycle and
  // then there's nothing to do but wait — this is the escape hatch.
  ipcMain.handle('app:refresh-ytdl', async () => refreshYtdl())
  ipcMain.on('ui:toggle-mini', () => toggleMini())
  ipcMain.on('ui:go-home', () => {
    if (isMini()) toggleMini() // Home has no video to float — leave the mini player
    goHome()
  })
  ipcMain.on('ui:open-disc', () => promptOpenFolder()) // double-click Open File → folder/disc
  ipcMain.on('win:minimize', () => win?.minimize())
  ipcMain.on('win:toggle-maximize', () => {
    isMaxed() ? unfakeMaximize() : fakeMaximize()
    setTimeout(layoutOsc, 40)
  })
  ipcMain.on('win:close', () => win?.close())
  ipcMain.on('win:toggle-fullscreen', () => toggleFullscreen())
  // a panel window's resize grips resize the MAIN window (they sit over its edge).
  // The grip computes the target rect (which corner is anchored depends on the
  // docked side), main just clamps to the min size and applies it.
  ipcMain.handle('win:get-bounds', () => (win && !win.isDestroyed() ? win.getBounds() : null))
  ipcMain.on('win:set-bounds', (_e, x: number, y: number, width: number, height: number) => {
    if (!win || win.isDestroyed() || isMaxed() || preFsBounds) return
    const w = Math.max(WIN_MIN_W, Math.round(width))
    const h = Math.max(320, Math.round(height))
    // preserve the anchored edge when the size hits the minimum (x/y already carry it)
    win.setBounds({ x: Math.round(x), y: Math.round(y), width: w, height: h })
  })
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: tr('appmenu.file'),
      submenu: [
        {
          label: tr('appmenu.open'),
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const res = await dialog.showOpenDialog(win!, {
              properties: ['openFile'],
              filters: [{ name: tr('dlg.filter.media'), extensions: VIDEO_EXT }, { name: tr('dlg.filter.allFiles'), extensions: ['*'] }]
            })
            if (!res.canceled && res.filePaths[0]) mpv?.loadFile(res.filePaths[0])
          }
        },
        {
          label: tr('appmenu.openFolder'),
          accelerator: 'CmdOrCtrl+Shift+O', // reachable even though the frameless window hides the menu bar
          click: () => promptOpenFolder()
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { label: tr('appmenu.view'), submenu: [{ role: 'toggleDevTools' }, { role: 'reload' }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * The path Windows hands us when a file is opened with this app.
 *
 * Double-clicking a video, "Open with", or dropping a file on the exe all boil
 * down to the same thing: the shell runs `Lunoir.exe "D:\clip.mkv"`, passing the
 * path as a plain argument. Skip switches and the app's own path (in dev, argv[1]
 * is "."), and only accept something that actually exists.
 */
function fileFromArgv(argv: string[]): string | null {
  for (const raw of argv.slice(1)) {
    if (!raw || raw.startsWith('-')) continue
    try {
      const p = resolve(raw)
      if (p === resolve(app.getAppPath()) || p === resolve(process.execPath)) continue
      if (existsSync(p)) return p
    } catch {
      /* not a path */
    }
  }
  return null
}

/** Bring the existing window forward — a second launch should feel like a re-focus. */
function focusMainWindow(): void {
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// One player, one window: opening three files in a row should queue them into the
// running instance, not spawn three Lunoirs (which would also fight over mpv's
// fixed IPC pipe name). The second launch hands its argv to the first and exits.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    const file = fileFromArgv(argv)
    if (file) openMedia(file)
    focusMainWindow()
  })
}

app.whenReady().then(() => {
  // materialise the default screenshot / recording folders so the settings UI shows real paths
  if (!getSettings().screenshotDir) {
    setSetting('screenshotDir', join(app.getPath('pictures'), 'Lunoir'))
  }
  if (!getSettings().recordingDir) {
    setSetting('recordingDir', join(app.getPath('videos'), 'Lunoir'))
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
