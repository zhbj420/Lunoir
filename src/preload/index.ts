import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { LangSetting } from '@shared/i18n'

// Persisted user settings (the IPC contract). main/settings.ts imports this type.
export type Hwdec = 'auto' | 'auto-copy' | 'no'
export type StreamQuality = 'best' | '2160' | '1080' | '720' | '480'
export type ScreenshotFormat = 'png' | 'jpg'
/** How the OSC prints position/duration. Click the readout to cycle. */
export type TimeFormat = 'time' | 'timecode' | 'frame'
export interface Settings {
  uiLanguage: LangSetting // interface language; 'system' follows the OS locale
  scanFolderIntoPlaylist: boolean
  resumePlayback: boolean
  resumePlaylistItem: boolean // reopening a playlist link jumps back to the last video watched
  keepPitch: boolean // preserve audio pitch when changing speed (mpv audio-pitch-correction)
  audioLang: string
  subLang: string
  subsDefaultOn: boolean
  autoLoadSubs: boolean // auto-load matching external subtitle files (mpv sub-auto)
  subFont: string // mpv sub-font. '' = mpv's own 'sans-serif' default
  subFontSize: number // mpv sub-font-size
  subSpacing: number // mpv sub-spacing, -10..10
  subBold: boolean
  subOutline: number // mpv sub-outline-size
  subMarginY: number // mpv sub-margin-y — resting distance from the bottom edge
  audioPassthrough: boolean // bitstream compressed audio to an external receiver (mpv audio-spdif)
  passthroughCodecs: string // which formats to passthrough (comma list: ac3,eac3,truehd,dts,dts-hd)
  oscHideDelay: number // seconds the OSC stays before auto-hiding
  frostStrength: number // 0..100 → acrylic panel scrim alpha (lower = more see-through)
  subHdrPeak: number // peak nits for subtitles over HDR video (mpv sub-hdr-peak)
  hwdec: Hwdec
  streamQuality: StreamQuality // online (yt-dlp) max quality
  useCookies: boolean // read browser cookies for member/age-restricted/Premium content
  cookiesBrowser: string // which browser to read cookies from (yt-dlp cookies-from-browser)
  timeFormat: TimeFormat // OSC readout: 36:16 | 00:36:16:07 | frame 52831
  timecodeOverlay: boolean // always-on timecode + frame burn-in in the video corner
  screenshotSubs: boolean
  screenshotFormat: ScreenshotFormat // PNG (lossless) or JPG (high-quality, smaller)
  screenshotDir: string // where screenshots are saved ('' = Pictures/Lunoir default)
  recordingDir: string // where stream recordings are saved ('' = Videos/Lunoir default)
  rememberWindow: boolean
  rememberVolume: boolean
  volume: number
  windowBounds: { x: number; y: number; width: number; height: number } | null
}

// --- 收藏 (library): recents (auto) + favourites (manual) ---
// 'list' = an IPTV channel directory; 'playlist' = a saved play-through queue;
// 'file'/'url' play directly.
export type MediaKind = 'file' | 'url' | 'list' | 'playlist'
/** One channel inside a favourited list (snapshotted so dead ones can be deleted). */
export interface Channel {
  name: string
  url: string
  group: string
}
export interface RecentEntry {
  target: string // path / URL to reopen with
  name: string
  kind: MediaKind
  at: number // last-played epoch ms
}
export interface FavEntry {
  target: string
  name: string
  kind: MediaKind
  at: number // added epoch ms
  channels?: Channel[] // present for kind === 'list' (IPTV) — the parsed channels
  items?: { path: string; name: string }[] // present for kind === 'playlist' — the queue
}

export interface MpvProperty {
  name: string
  data: unknown
}

/** A context-menu node as it crosses IPC to the menu window: data only, no
 *  handlers. `id` is what comes back on click so the main window can run its own
 *  onClick for that node. */
export interface SerializedMenuNode {
  id?: string
  label?: string
  disabled?: boolean
  checked?: boolean
  sep?: boolean
  submenu?: SerializedMenuNode[]
}

export type RepeatMode = 'off' | 'all' | 'one'
// what the loaded list IS — a play-through queue, an IPTV channel directory, or a
// URL playlist (YouTube). Drives the right panel's label (播放列表 vs 频道) + save.
export type SourceType = 'queue' | 'iptv' | 'playlist-url'
export interface Playlist {
  items: { path: string; name: string }[]
  index: number
  repeat: RepeatMode
  shuffle: boolean
  sourceType: SourceType
}

// Per-track audio metadata from MediaInfo, keyed by stream index (mpv ff-index).
export interface ProbeStream {
  format?: string
  commercial?: string
  features?: string
  bitRate?: number
}
export interface ProbeData {
  path: string
  streams: Record<number, ProbeStream>
}

// The active audio track's MediaInfo fields (for the OSC's commercial-name badge).
export interface ActiveAudio {
  commercial: string
  features: string
  channels: number // native (demuxer) channel count of the active track
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
  // per-track audio metadata (bitrate + commercial format) probed by MediaInfo
  onProbe: (cb: (p: ProbeData) => void): Unsubscribe =>
    subscribe('media:probe', (p: ProbeData) => cb(p)),
  // the active audio track's commercial format, resolved in main (for the OSC badge)
  onActiveAudio: (cb: (a: ActiveAudio) => void): Unsubscribe =>
    subscribe('audio:active', (a: ActiveAudio) => cb(a)),
  // the video track's HDR flavour (Dolby Vision / HDR10+ / HDR10 / '') from MediaInfo
  onVideoHdr: (cb: (hdr: string) => void): Unsubscribe =>
    subscribe('video:hdr', (hdr: string) => cb(hdr)),

  // reveal / auto-hide coordinated across the two windows by main
  activity: (): void => ipcRenderer.send('ui:activity'),
  // context menu open/close — main hides the OSC while it's up (see main)
  setMenuOpen: (open: boolean): void => ipcRenderer.send('ui:menu-open', open),
  // context menu lives in its own acrylic window: the main window asks main to open
  // it at a screen point, the menu window reports the size it wants and can close
  // itself (after a command / Esc). Main places + reveals it once a size arrives.
  openMenu: (x: number, y: number, items: SerializedMenuNode[]): void =>
    ipcRenderer.send('menu:open', x, y, items),
  closeMenu: (): void => ipcRenderer.send('menu:close'),
  // collapsing a submenu is coordinated: we fold the group while main eases the
  // window down, and only drop the rows once main says the shrink is done
  collapseMenu: (w: number, h: number): void => ipcRenderer.send('menu:collapse', w, h),
  onMenuCollapsed: (cb: () => void): Unsubscribe => subscribe('menu:collapsed', () => cb()),
  reportMenuSize: (w: number, h: number): void => ipcRenderer.send('menu:size', w, h),
  onMenuShow: (
    cb: (items: SerializedMenuNode[], foldMs: number, unfoldMs: number) => void
  ): Unsubscribe =>
    subscribe('menu:show', (items: SerializedMenuNode[], foldMs: number, unfoldMs: number) =>
      cb(items, foldMs, unfoldMs)
    ),
  // menu window → main window: run the handler for this item, then it closes
  invokeMenu: (id: string): void => ipcRenderer.send('menu:invoke', id),
  // is the menu window up? the main window keeps the cursor visible while it is
  onMenuState: (cb: (open: boolean) => void): Unsubscribe =>
    subscribe('ui:menu', (open: boolean) => cb(open)),
  onMenuInvoke: (cb: (id: string) => void): Unsubscribe =>
    subscribe('menu:invoke', (id: string) => cb(id)),
  // pointer entered/left the OSC window — main pauses auto-hide while it's over
  setOscHover: (hovering: boolean): void => ipcRenderer.send('ui:osc-hover', hovering),
  onReveal: (cb: () => void): Unsubscribe => subscribe('ui:reveal', () => cb()),
  onHide: (cb: () => void): Unsubscribe => subscribe('ui:hide', () => cb()),
  onAppFocus: (cb: (focused: boolean) => void): Unsubscribe =>
    subscribe('app:focus', (focused: boolean) => cb(focused)),
  onFullscreen: (cb: (fs: boolean) => void): Unsubscribe =>
    subscribe('win:fullscreen', (fs: boolean) => cb(fs)),
  onMaximized: (cb: (max: boolean) => void): Unsubscribe =>
    subscribe('win:maximized', (max: boolean) => cb(max)),

  // --- playlist ---
  getPlaylist: (): Promise<Playlist> => ipcRenderer.invoke('playlist:get'),
  playIndex: (i: number): void => ipcRenderer.send('playlist:play', i),
  playNext: (): void => ipcRenderer.send('playlist:next'),
  playPrev: (): void => ipcRenderer.send('playlist:prev'),
  toggleShuffle: (): void => ipcRenderer.send('playlist:toggle-shuffle'),
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
  onSettingsPanelState: (cb: (open: boolean) => void): Unsubscribe =>
    subscribe('ui:settings-open', (open: boolean) => cb(open)),
  onPanelWidth: (cb: (w: number) => void): Unsubscribe =>
    subscribe('ui:panel-width', (w: number) => cb(w)),
  onPanelReveal: (cb: (open: boolean) => void): Unsubscribe =>
    subscribe('panel:reveal', (open: boolean) => cb(open)),

  // --- app / window ---
  openDialog: (): Promise<string | null> => ipcRenderer.invoke('app:open-dialog'),
  openDiscDialog: (): void => ipcRenderer.send('ui:open-disc'), // Blu-ray/DVD folder picker
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('app:pick-folder'),

  // --- recording (stream-record) ---
  goLive: (): void => ipcRenderer.send('mpv:go-live'), // jump to a live stream's edge
  toggleRecording: (): void => ipcRenderer.send('recording:toggle'),
  getRecording: (): Promise<{ recording: boolean; since: number | null }> =>
    ipcRenderer.invoke('recording:get'),
  onRecordingState: (cb: (s: { recording: boolean; since: number | null }) => void): Unsubscribe =>
    subscribe('recording:state', (s: { recording: boolean; since: number | null }) => cb(s)),
  pickRecordingFolder: (): Promise<string | null> => ipcRenderer.invoke('recording:pick-folder'),
  // --- 收藏 (library overlay) ---
  toggleLibrary: (): void => ipcRenderer.send('library:toggle'),
  closeLibrary: (): void => ipcRenderer.send('library:close'),
  onLibraryReveal: (cb: (open: boolean) => void): Unsubscribe =>
    subscribe('library:reveal', (open: boolean) => cb(open)),
  getRecents: (): Promise<RecentEntry[]> => ipcRenderer.invoke('library:recents'),
  getFavourites: (): Promise<FavEntry[]> => ipcRenderer.invoke('library:favourites'),
  // open a recent/favourite (or any target) — same path as drag / Open File
  playTarget: (target: string): void => ipcRenderer.send('library:play', target),
  removeRecent: (target: string): void => ipcRenderer.send('library:recent-remove', target),
  clearRecents: (): void => ipcRenderer.send('library:recents-clear'),
  addFavourite: (target: string): void => ipcRenderer.send('library:fav-add', target),
  favouriteCurrent: (): void => ipcRenderer.send('library:fav-current'), // right-click 收藏当前
  onCurrentFav: (cb: (fav: boolean) => void): Unsubscribe =>
    subscribe('library:current-fav', (fav: boolean) => cb(fav)),
  // the right panel's bottom button: save the whole collection (queue → a saved
  // playlist; IPTV → the m3u source). onCollectionSaved drives its saved/unsaved state.
  saveCollection: (): void => ipcRenderer.send('library:save-collection'),
  onCollectionSaved: (cb: (saved: boolean) => void): Unsubscribe =>
    subscribe('library:collection-saved', (saved: boolean) => cb(saved)),
  removeFavourite: (target: string): void => ipcRenderer.send('library:fav-remove', target),
  renameFavourite: (target: string, name: string): void =>
    ipcRenderer.send('library:fav-rename', target, name),
  removeFavouriteChannel: (listTarget: string, channelUrl: string): void =>
    ipcRenderer.send('library:fav-channel-remove', listTarget, channelUrl),
  removeFavouriteItem: (playlistTarget: string, path: string): void =>
    ipcRenderer.send('library:fav-item-remove', playlistTarget, path),
  // drill-in: play a specific channel/item of a saved collection, starting there
  openAt: (target: string, index: number): void => ipcRenderer.send('library:open-at', target, index),
  onRecentsChanged: (cb: () => void): Unsubscribe => subscribe('recents:changed', () => cb()),
  onFavouritesChanged: (cb: () => void): Unsubscribe => subscribe('favourites:changed', () => cb()),

  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]): void =>
    ipcRenderer.send('settings:set', key, value),
  onToast: (cb: (msg: string) => void): Unsubscribe =>
    subscribe('ui:toast', (msg: string) => cb(msg)),
  onLoading: (cb: (loading: boolean) => void): Unsubscribe =>
    subscribe('ui:loading', (loading: boolean) => cb(loading)),
  onSettingsChanged: (cb: (s: Settings) => void): Unsubscribe =>
    subscribe('settings:changed', (s: Settings) => cb(s)),
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  minimize: (): void => ipcRenderer.send('win:minimize'),
  toggleMaximize: (): void => ipcRenderer.send('win:toggle-maximize'),
  close: (): void => ipcRenderer.send('win:close'),
  toggleFullscreen: (): void => ipcRenderer.send('win:toggle-fullscreen'),
  // panel-window resize grips → resize the main window
  getWinBounds: (): Promise<{ x: number; y: number; width: number; height: number } | null> =>
    ipcRenderer.invoke('win:get-bounds'),
  setWinBounds: (x: number, y: number, width: number, height: number): void =>
    ipcRenderer.send('win:set-bounds', x, y, width, height)
}

contextBridge.exposeInMainWorld('mmp', api)

export type MmpApi = typeof api
