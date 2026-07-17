import { app, BrowserWindow, ipcMain, dialog, Menu, screen } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { MpvController } from './mpv'

const isDev = !app.isPackaged

// Main transparent window hosts mpv video (via --wid). The OSC lives in a
// separate Win11 *acrylic* child window pinned to the bottom-center, so we can
// see whether the OS frosted-glass material looks good over the video.
let win: BrowserWindow | null = null
let oscWin: BrowserWindow | null = null
let mpv: MpvController | null = null
let preFsBounds: Electron.Rectangle | null = null

const OSC_H = 104
let hideTimer: NodeJS.Timeout | null = null
let paused = true
let hasMedia = false

const VIDEO_EXT = [
  'mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm', 'm4v', 'ts', 'mpg', 'mpeg',
  'm2ts', 'rmvb', '3gp', 'ogv', 'mp3', 'flac', 'aac', 'wav', 'm4a', 'ogg', 'opus'
]

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

/** Position the acrylic OSC window at the bottom-center of the main window. */
function layoutOsc(): void {
  if (!win || !oscWin || win.isDestroyed() || oscWin.isDestroyed()) return
  const b = win.getBounds()
  const w = Math.min(560, Math.max(320, b.width - 96))
  const margin = Math.max(44, Math.round(b.height * 0.09))
  oscWin.setBounds({
    x: Math.round(b.x + (b.width - w) / 2),
    y: Math.round(b.y + b.height - OSC_H - margin),
    width: Math.round(w),
    height: OSC_H
  })
}

function revealUi(): void {
  broadcast('ui:reveal')
  // The OSC only exists once a file is loaded; keep it hidden on the empty state.
  if (oscWin && !oscWin.isDestroyed()) {
    if (hasMedia && !oscWin.isVisible()) oscWin.showInactive()
    else if (!hasMedia && oscWin.isVisible()) oscWin.hide()
  }
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (hasMedia && paused) return // keep controls up while paused
    broadcast('ui:hide')
    if (oscWin && !oscWin.isDestroyed()) oscWin.hide()
  }, 2600)
}

function toggleFullscreen(): void {
  if (!win) return
  if (preFsBounds) {
    win.setAlwaysOnTop(false)
    win.setBounds(preFsBounds)
    preFsBounds = null
  } else {
    preFsBounds = win.getBounds()
    const disp = screen.getDisplayMatching(win.getBounds())
    win.setBounds(disp.bounds)
    win.setAlwaysOnTop(true)
  }
  win.webContents.send('win:fullscreen', preFsBounds != null)
  setTimeout(layoutOsc, 40)
}

function createWindows(): void {
  win = new BrowserWindow({
    width: 1000,
    height: 620,
    minWidth: 480,
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
    width: 560,
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
  const relayout = () => layoutOsc()
  win.on('move', relayout)
  win.on('resize', relayout)

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
    startMpv()
  })
  oscWin.webContents.once('did-finish-load', () => {
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
    if (name === 'pause') paused = Boolean(data)
    const wasMedia = hasMedia
    if ((name === 'path' || name === 'filename' || name === 'media-title') && data) hasMedia = true
    broadcast('mpv:property', { name, data })
    // reveal the OSC when playback state changes or a file first loads
    if (name === 'pause' || (!wasMedia && hasMedia)) revealUi()
  })
  mpv.on('mpv-event', (event: string) => broadcast('mpv:event', event))
  mpv.on('log', (line: string) => isDev && process.stdout.write(`[mpv] ${line}`))
  mpv.on('connected', () => {
    broadcast('mpv:connected')
    if (process.env['MMP_TESTSRC']) {
      mpv?.loadFile('av://lavfi:testsrc=size=1280x720:rate=30')
      if (process.env['MMP_PAUSE']) setTimeout(() => mpv?.setProperty('pause', true), 900)
    }
  })
  mpv.start({ wid: wid as unknown as number })
}

function registerIpc(): void {
  ipcMain.handle('mpv:command', (_e, cmd: any[]) => mpv?.command(cmd))
  ipcMain.on('mpv:set', (_e, name: string, value: unknown) => mpv?.setProperty(name, value))
  ipcMain.on('mpv:loadfile', (_e, path: string) => mpv?.loadFile(path))
  ipcMain.on('ui:activity', () => revealUi())

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
