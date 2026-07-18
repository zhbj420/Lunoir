import { app, BrowserWindow, ipcMain, dialog, Menu, screen } from 'electron'
import { join, dirname, basename, extname } from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
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
// When opening a file, also queue the other videos in its folder. Off by default
// (open one → list holds only that one); to be exposed as a setting later.
let scanFolderIntoPlaylist = false

const isUrl = (p: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(p)

function playlistPayload() {
  return {
    items: playlist.map(p => ({ path: p, name: basename(p) })),
    index: plIndex,
    repeat: repeatMode
  }
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
  playCurrent()
}

function playNext(): void {
  if (plIndex < playlist.length - 1) playIndex(plIndex + 1)
}

function playPrev(): void {
  if (plIndex > 0) playIndex(plIndex - 1)
}

/** What to do when the current item ends (driven by mpv's eof-reached). */
function onEnded(): void {
  if (repeatMode === 'one') {
    playCurrent() // replay the same file
  } else if (plIndex < playlist.length - 1) {
    playNext()
  } else if (repeatMode === 'all' && playlist.length > 0) {
    playIndex(0) // wrap around
  }
}

/** Shuffle the list in place, keeping the currently-playing item selected. */
function shufflePlaylist(): void {
  if (playlist.length < 2) return
  const current = plIndex >= 0 ? playlist[plIndex] : null
  for (let i = playlist.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[playlist[i], playlist[j]] = [playlist[j], playlist[i]]
  }
  if (current) plIndex = playlist.indexOf(current)
  broadcast('playlist:changed', playlistPayload())
}

/** Append files to the list; start playing if nothing was queued before. */
function addToPlaylist(paths: string[]): void {
  const fresh = paths.filter(p => p && !playlist.includes(p))
  if (!fresh.length) return
  const wasEmpty = playlist.length === 0
  playlist.push(...fresh)
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
      playCurrent()
      return
    }
  }
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
    center: true,
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
  ipcMain.on('playlist:shuffle', () => shufflePlaylist())
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
