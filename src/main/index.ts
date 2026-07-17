import { app, BrowserWindow, ipcMain, dialog, Menu, screen } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { MpvController } from './mpv'

const isDev = !app.isPackaged

// Single transparent, frameless window. mpv is embedded into it via --wid: the
// mpv child surface sits *behind* Chromium's compositor, so where the React page
// is transparent the video shows through, and opaque UI (controls, title bar)
// renders on top. No multi-window sync, no native module needed.
let win: BrowserWindow | null = null
let mpv: MpvController | null = null
// bounds saved before entering (manual) fullscreen, so we can restore exactly
let preFsBounds: Electron.Rectangle | null = null

function toggleFullscreen(): void {
  if (!win) return
  if (preFsBounds) {
    win.setAlwaysOnTop(false)
    win.setBounds(preFsBounds)
    preFsBounds = null
  } else {
    preFsBounds = win.getBounds()
    const disp = screen.getDisplayMatching(win.getBounds())
    win.setBounds(disp.bounds) // full monitor bounds (covers taskbar)
    win.setAlwaysOnTop(true)
  }
  win.webContents.send('win:fullscreen', preFsBounds != null)
}

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

function createWindow(): void {
  win = new BrowserWindow({
    width: 1000,
    height: 620,
    minWidth: 480,
    minHeight: 320,
    center: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    show: false,
    title: 'MMPlayer',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.once('ready-to-show', () => {
    win?.show()
    startMpv()
  })

  win.on('closed', () => {
    mpv?.quit()
    win = null
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
  mpv.on('property', (name: string, data: unknown) =>
    win?.webContents.send('mpv:property', { name, data })
  )
  mpv.on('mpv-event', (event: string) => win?.webContents.send('mpv:event', event))
  mpv.on('log', (line: string) => isDev && process.stdout.write(`[mpv] ${line}`))
  mpv.on('connected', () => {
    win?.webContents.send('mpv:connected')
    if (process.env['MMP_TESTCOLOR']) {
      mpv?.loadFile(`av://lavfi:color=c=${process.env['MMP_TESTCOLOR']}:size=1280x720`)
    } else if (process.env['MMP_TESTSRC']) {
      mpv?.loadFile('av://lavfi:testsrc=size=1280x720:rate=30')
      if (process.env['MMP_PAUSE']) setTimeout(() => mpv?.setProperty('pause', true), 800)
    }
  })
  mpv.start({ wid: wid as unknown as number })
}

function registerIpc(): void {
  ipcMain.handle('mpv:command', (_e, cmd: any[]) => mpv?.command(cmd))
  ipcMain.on('mpv:set', (_e, name: string, value: unknown) => mpv?.setProperty(name, value))
  ipcMain.on('mpv:loadfile', (_e, path: string) => mpv?.loadFile(path))

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
  ipcMain.on('win:toggle-maximize', () =>
    win?.isMaximized() ? win.unmaximize() : win?.maximize()
  )
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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  mpv?.quit()
  app.quit()
})
