import { app, BrowserWindow, ipcMain, dialog, Menu, screen } from 'electron'
import { join, dirname, basename, extname } from 'node:path'
import { existsSync, readdirSync, mkdirSync } from 'node:fs'
import { spawn, ChildProcess } from 'node:child_process'
import { MpvController } from './mpv'
import { removeBorderLine, setCornerPreference, CORNER_DEFAULT, CORNER_DONOTROUND } from './dwm'

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
let panelOpen = false
let hideTimer: NodeJS.Timeout | null = null
let oscAnim: NodeJS.Timeout | null = null
let oscShown = false
let oscHovered = false // pointer is over the OSC window → don't auto-hide
let hasMedia = false
// briefly ignore movement-triggered reveals after a fullscreen toggle — the
// resize emits a synthetic mousemove that can land in an edge zone and pop the OSC
let suppressRevealUntil = 0

const VIDEO_EXT = [
  'mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm', 'm4v', 'ts', 'mpg', 'mpeg',
  'm2ts', 'rmvb', '3gp', 'ogv', 'mp3', 'flac', 'aac', 'wav', 'm4a', 'ogg', 'opus'
]

// ---- Playlist ----
// We manage the list ourselves (mpv only ever holds the single current file,
// loaded via loadfile-replace), so repeat / shuffle / add / remove are all
// handled here rather than through mpv's own playlist commands.
type RepeatMode = 'off' | 'all' | 'one'
let playlist: string[] = []
let plIndex = -1
let repeatMode: RepeatMode = 'off'
// Shuffle is a persistent mode (not a one-shot reorder): the list keeps its
// display order, but auto-advance / next picks randomly. `shuffleBag` holds the
// not-yet-played indices this cycle (no repeats until it drains); `shuffleHistory`
// is the played order so Prev can step back.
let shuffleOn = false
let shuffleBag: number[] = []
let shuffleHistory: number[] = []
// When opening a file, also queue the other videos in its folder. Off by default
// (open one → list holds only that one); to be exposed as a setting later.
let scanFolderIntoPlaylist = false

const isUrl = (p: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(p)

function playlistPayload() {
  return {
    items: playlist.map(p => ({ path: p, name: basename(p) })),
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

/** Open media the user picked. By default the list holds just this item; with
 *  scanFolderIntoPlaylist on, the whole folder is queued (a future setting). */
function openMedia(target: string): void {
  if (isUrl(target) || !scanFolderIntoPlaylist) {
    playlist = [target]
    plIndex = 0
  } else {
    const dir = dirname(target)
    let files: string[] = []
    try {
      files = readdirSync(dir)
        .filter(f => VIDEO_EXT.includes(extname(f).slice(1).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map(f => join(dir, f))
    } catch {
      /* ignore */
    }
    if (!files.length) files = [target]
    playlist = files
    const norm = (s: string) => s.replace(/\\/g, '/').toLowerCase()
    plIndex = Math.max(0, files.findIndex(f => norm(f) === norm(target)))
  }
  resyncShuffle() // new list → reseed the shuffle bag
  playCurrent()
}

function playCurrent(): void {
  if (plIndex < 0 || plIndex >= playlist.length) return
  mpv?.loadFile(playlist[plIndex])
  mpv?.setProperty('pause', false) // always start playing on load
  broadcast('playlist:changed', playlistPayload())
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
  for (const w of [win, oscWin]) {
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

function revealUi(): void {
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
    if (!oscWin || oscWin.isDestroyed() || !oscShown) return
    if (oscAnim) {
      clearInterval(oscAnim)
      oscAnim = null
    }
    oscWin.setOpacity(1)
    oscWin.setBounds(oscRestBounds())
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

function createWindows(): void {
  win = new BrowserWindow({
    width: 1000,
    height: 620,
    minWidth: WIN_MIN_W,
    minHeight: 320,
    // MMP_LEFT: dev-only — park the window at the left edge so test screenshots
    // don't sit under other UI (normal launch stays centered).
    ...(process.env['MMP_LEFT'] ? { x: 40, y: 60 } : { center: true }),
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
    focusable: true,
    hasShadow: false,
    roundedCorners: true,
    parent: win,
    show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  loadRenderer(oscWin, 'win=osc')

  // keep the OSC glued to the main window
  win.on('move', () => layoutOsc())
  win.on('resize', () => {
    layoutOsc()
    updateVideoMargin() // keep the reserved title strip proportional as height changes
    pushPanelWidth() // panel width tracks the window width
  })

  // broadcast app active/inactive so the renderer can compensate the acrylic
  // (Win11 lightens acrylic on inactive windows)
  const updateFocus = () =>
    broadcast(
      'app:focus',
      BrowserWindow.getAllWindows().some(w => !w.isDestroyed() && w.isFocused())
    )
  for (const w of [win, oscWin]) {
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

  win.on('closed', () => {
    if (oscWin && !oscWin.isDestroyed()) oscWin.close()
    mpv?.quit()
    win = null
  })
  oscWin.on('closed', () => {
    oscWin = null
  })
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
    const wasMedia = hasMedia
    if ((name === 'path' || name === 'filename' || name === 'media-title') && data) hasMedia = true
    broadcast('mpv:property', { name, data })
    // a new file loaded → drop stale probe + HDR badge, re-probe its tracks
    if (name === 'path' && typeof data === 'string') {
      lastProbe = {}
      broadcast('video:hdr', '') // clear until MediaInfo re-resolves (gamma fallback covers HDR meanwhile)
      runProbe(data)
    }
    // keep the active-audio resolver's inputs current, re-push on any change
    if (name === 'track-list') {
      lastTracks = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []
      broadcastActiveAudio()
    } else if (name === 'aid') {
      lastAid = typeof data === 'number' ? data : false
      broadcastActiveAudio()
    }
    // reveal the OSC only when a file first loads — not on pause/play toggles
    if (!wasMedia && hasMedia) revealUi()
    // advance / repeat when the current item ends
    if (name === 'eof-reached' && data === true) onEnded()
    // fit the window to the video's aspect ratio (no letterbox in windowed mode)
    if (name === 'video-params/aspect' && typeof data === 'number') fitWindowToVideo(data)
  })
  mpv.on('mpv-event', (event: string) => broadcast('mpv:event', event))
  mpv.on('log', (line: string) => isDev && process.stdout.write(`[mpv] ${line}`))
  mpv.on('connected', () => {
    broadcast('mpv:connected')
    updateVideoMargin() // reserve the title strip from the start
    // screenshots (context-menu action) → Pictures/Lunoir, PNG, named after the
    // source + playback timestamp
    const shotDir = join(app.getPath('pictures'), 'Lunoir')
    try { mkdirSync(shotDir, { recursive: true }) } catch { /* ignore */ }
    mpv!.setProperty('screenshot-directory', shotDir)
    mpv!.setProperty('screenshot-template', '%F_%wH-%wM-%wS')
    mpv!.setProperty('screenshot-format', 'png')
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

  // side panels (playlist / settings) live in the main window; the OSC buttons
  // (in the acrylic child window) request a toggle through main
  ipcMain.on('ui:panel-toggle', (_e, name: string) =>
    win?.webContents.send('ui:panel-toggle', name)
  )
  // overlay reports whether a panel is open, so the OSC can move out of the way
  // and its list button can show a pressed state
  ipcMain.on('ui:panel-state', (_e, open: boolean) => {
    if (panelOpen === open) return
    panelOpen = open
    slideOscToRest() // glide the OSC to re-center, in sync with the panel's slide
    broadcast('ui:panel-open', open)
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

  ipcMain.on('win:minimize', () => win?.minimize())
  ipcMain.on('win:toggle-maximize', () => {
    win?.isMaximized() ? win.unmaximize() : win?.maximize()
    setTimeout(layoutOsc, 40)
  })
  ipcMain.on('win:close', () => win?.close())
  ipcMain.on('win:toggle-fullscreen', () => toggleFullscreen())
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
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    { label: 'View', submenu: [{ role: 'toggleDevTools' }, { role: 'reload' }] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
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
