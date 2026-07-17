import { contextBridge, ipcRenderer, webUtils } from 'electron'

export interface MpvProperty {
  name: string
  data: unknown
}

const api = {
  // --- mpv control ---
  command: (cmd: any[]): Promise<any> => ipcRenderer.invoke('mpv:command', cmd),
  set: (name: string, value: unknown): void => ipcRenderer.send('mpv:set', name, value),
  loadFile: (path: string): void => ipcRenderer.send('mpv:loadfile', path),

  onProperty: (cb: (p: MpvProperty) => void) => {
    const h = (_e: unknown, p: MpvProperty) => cb(p)
    ipcRenderer.on('mpv:property', h)
    return () => ipcRenderer.removeListener('mpv:property', h)
  },
  onEvent: (cb: (event: string) => void) => {
    const h = (_e: unknown, event: string) => cb(event)
    ipcRenderer.on('mpv:event', h)
    return () => ipcRenderer.removeListener('mpv:event', h)
  },
  onConnected: (cb: () => void) => {
    const h = () => cb()
    ipcRenderer.on('mpv:connected', h)
    return () => ipcRenderer.removeListener('mpv:connected', h)
  },

  // reveal / auto-hide coordinated across the two windows by main
  activity: (): void => ipcRenderer.send('ui:activity'),
  onReveal: (cb: () => void) => {
    const h = () => cb()
    ipcRenderer.on('ui:reveal', h)
    return () => ipcRenderer.removeListener('ui:reveal', h)
  },
  onHide: (cb: () => void) => {
    const h = () => cb()
    ipcRenderer.on('ui:hide', h)
    return () => ipcRenderer.removeListener('ui:hide', h)
  },
  onAppFocus: (cb: (focused: boolean) => void) => {
    const h = (_e: unknown, focused: boolean) => cb(focused)
    ipcRenderer.on('app:focus', h)
    return () => ipcRenderer.removeListener('app:focus', h)
  },

  // --- app / window ---
  openDialog: (): Promise<string | null> => ipcRenderer.invoke('app:open-dialog'),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  minimize: () => ipcRenderer.send('win:minimize'),
  toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
  close: () => ipcRenderer.send('win:close'),
  toggleFullscreen: () => ipcRenderer.send('win:toggle-fullscreen')
}

contextBridge.exposeInMainWorld('mmp', api)

export type MmpApi = typeof api
