import { contextBridge, ipcRenderer, webUtils } from 'electron'

export interface MpvProperty {
  name: string
  data: unknown
}

export type RepeatMode = 'off' | 'all' | 'one'
export interface Playlist {
  items: { path: string; name: string }[]
  index: number
  repeat: RepeatMode
}

type Unsubscribe = () => void

// Subscribe to an ipc channel; returns a void cleanup suitable for useEffect
// (ipcRenderer.removeListener returns the emitter, which we must not leak back).
function subscribe(channel: string, listener: (...args: any[]) => void): Unsubscribe {
  const h = (_e: unknown, ...args: any[]): void => listener(...args)
  ipcRenderer.on(channel, h)
  return () => {
    ipcRenderer.removeListener(channel, h)
  }
}

const api = {
  // --- mpv control ---
  command: (cmd: any[]): Promise<any> => ipcRenderer.invoke('mpv:command', cmd),
  set: (name: string, value: unknown): void => ipcRenderer.send('mpv:set', name, value),
  loadFile: (path: string): void => ipcRenderer.send('mpv:loadfile', path),

  onProperty: (cb: (p: MpvProperty) => void): Unsubscribe =>
    subscribe('mpv:property', (p: MpvProperty) => cb(p)),
  onEvent: (cb: (event: string) => void): Unsubscribe =>
    subscribe('mpv:event', (event: string) => cb(event)),
  onConnected: (cb: () => void): Unsubscribe => subscribe('mpv:connected', () => cb()),

  // reveal / auto-hide coordinated across the two windows by main
  activity: (): void => ipcRenderer.send('ui:activity'),
  // pointer entered/left the OSC window — main pauses auto-hide while it's over
  setOscHover: (hovering: boolean): void => ipcRenderer.send('ui:osc-hover', hovering),
  onReveal: (cb: () => void): Unsubscribe => subscribe('ui:reveal', () => cb()),
  onHide: (cb: () => void): Unsubscribe => subscribe('ui:hide', () => cb()),
  onAppFocus: (cb: (focused: boolean) => void): Unsubscribe =>
    subscribe('app:focus', (focused: boolean) => cb(focused)),
  onFullscreen: (cb: (fs: boolean) => void): Unsubscribe =>
    subscribe('win:fullscreen', (fs: boolean) => cb(fs)),

  // --- playlist ---
  getPlaylist: (): Promise<Playlist> => ipcRenderer.invoke('playlist:get'),
  playIndex: (i: number): void => ipcRenderer.send('playlist:play', i),
  playNext: (): void => ipcRenderer.send('playlist:next'),
  playPrev: (): void => ipcRenderer.send('playlist:prev'),
  shufflePlaylist: (): void => ipcRenderer.send('playlist:shuffle'),
  removeFromPlaylist: (i: number): void => ipcRenderer.send('playlist:remove', i),
  addToPlaylist: (): void => ipcRenderer.send('playlist:add'),
  cycleRepeat: (): void => ipcRenderer.send('playlist:repeat-cycle'),
  addSubtitle: (): void => ipcRenderer.send('sub:add'),
  onPlaylistChanged: (cb: (p: Playlist) => void): Unsubscribe =>
    subscribe('playlist:changed', (p: Playlist) => cb(p)),

  // --- side panels ---
  togglePanel: (name: string): void => ipcRenderer.send('ui:panel-toggle', name),
  setPanelState: (open: boolean): void => ipcRenderer.send('ui:panel-state', open),
  onPanelToggle: (cb: (name: string) => void): Unsubscribe =>
    subscribe('ui:panel-toggle', (name: string) => cb(name)),
  onPanelState: (cb: (open: boolean) => void): Unsubscribe =>
    subscribe('ui:panel-open', (open: boolean) => cb(open)),

  // --- app / window ---
  openDialog: (): Promise<string | null> => ipcRenderer.invoke('app:open-dialog'),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  minimize: (): void => ipcRenderer.send('win:minimize'),
  toggleMaximize: (): void => ipcRenderer.send('win:toggle-maximize'),
  close: (): void => ipcRenderer.send('win:close'),
  toggleFullscreen: (): void => ipcRenderer.send('win:toggle-fullscreen')
}

contextBridge.exposeInMainWorld('mmp', api)

export type MmpApi = typeof api
