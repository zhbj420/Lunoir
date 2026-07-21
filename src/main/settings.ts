// Persisted user settings + per-file playback positions, stored as JSON under
// the app's userData dir. Kept small and synchronous — reads are cached.
import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Settings, MediaKind, Channel, RecentEntry, FavEntry } from '../preload/index'

export type { Settings, MediaKind, Channel, RecentEntry, FavEntry }

const DEFAULTS: Settings = {
  uiLanguage: 'system', // follow the OS locale until the user picks one
  scanFolderIntoPlaylist: false,
  resumePlayback: true,
  resumePlaylistItem: true,
  keepPitch: true,
  audioLang: '',
  subLang: '',
  subsDefaultOn: true,
  autoLoadSubs: true,
  audioPassthrough: false,
  passthroughCodecs: 'ac3,eac3,truehd,dts,dts-hd',
  oscHideDelay: 5, // seconds the OSC lingers after activity before auto-hiding
  frostStrength: 50, // 0..100, higher = more see-through; 50 ≈ the default alpha 0.40
  subHdrPeak: 120, // dimmer than mpv's ~SDR-white default so HDR subs aren't harsh
  hwdec: 'auto',
  streamQuality: 'best',
  useCookies: false,
  cookiesBrowser: 'edge',
  subFont: 'Microsoft YaHei',
  subFontSize: 38,
  subSpacing: 0,
  subBold: false,
  subOutline: 3,
  subMarginY: 34,
  timeFormat: 'time',
  timecodeOverlay: false,
  screenshotSubs: true,
  screenshotFormat: 'png',
  screenshotDir: '',
  recordingDir: '', // where stream recordings go ('' = Videos/Lunoir default)
  rememberWindow: true,
  rememberVolume: true,
  volume: 100,
  windowBounds: null
}

let cache: Settings | null = null
const settingsFile = (): string => join(app.getPath('userData'), 'settings.json')

export function getSettings(): Settings {
  if (!cache) {
    try {
      cache = { ...DEFAULTS, ...JSON.parse(readFileSync(settingsFile(), 'utf8')) }
    } catch {
      cache = { ...DEFAULTS }
    }
  }
  return cache!
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  const s = getSettings()
  s[key] = value
  try {
    writeFileSync(settingsFile(), JSON.stringify(s, null, 2))
  } catch {
    /* ignore write errors (e.g. read-only profile) */
  }
}

// ---- per-file resume positions (kept in a separate file; can grow) ----
type Positions = Record<string, number>
let posCache: Positions | null = null
const posFile = (): string => join(app.getPath('userData'), 'positions.json')

function positions(): Positions {
  if (posCache) return posCache
  try {
    posCache = JSON.parse(readFileSync(posFile(), 'utf8'))
  } catch {
    posCache = {}
  }
  return posCache!
}

function writePositions(): void {
  try {
    writeFileSync(posFile(), JSON.stringify(positions()))
  } catch {
    /* ignore */
  }
}

export function getPosition(path: string): number | undefined {
  return positions()[path]
}

export function savePosition(path: string, seconds: number): void {
  positions()[path] = seconds
  writePositions()
}

export function clearPosition(path: string): void {
  delete positions()[path]
  writePositions()
}

// ---- per-playlist "last item" (which video in a URL playlist you got to) ----
// Keyed by a stable playlist id (e.g. YouTube's list=…), value = that item's URL.
// Combined with the per-file positions above, reopening a playlist resumes both
// the right video and the right time.
type PlaylistItems = Record<string, string>
let plCache: PlaylistItems | null = null
const plFile = (): string => join(app.getPath('userData'), 'playlist-progress.json')

function playlistItems(): PlaylistItems {
  if (plCache) return plCache
  try {
    plCache = JSON.parse(readFileSync(plFile(), 'utf8'))
  } catch {
    plCache = {}
  }
  return plCache!
}

export function getPlaylistItem(key: string): string | undefined {
  return playlistItems()[key]
}

export function savePlaylistItem(key: string, item: string): void {
  if (playlistItems()[key] === item) return // no-op: avoid needless writes on re-play
  playlistItems()[key] = item
  try {
    writeFileSync(plFile(), JSON.stringify(playlistItems()))
  } catch {
    /* ignore */
  }
}

// ---- recently played (auto) + favourites (manual) ----
// Both back the 「收藏」overlay. A recent is written on every open; a favourite
// is a deliberate keep. Entry types live in preload (the IPC contract).
const RECENTS_CAP = 20
let recCache: RecentEntry[] | null = null
const recFile = (): string => join(app.getPath('userData'), 'recents.json')

function recents(): RecentEntry[] {
  if (recCache) return recCache
  try {
    const parsed = JSON.parse(readFileSync(recFile(), 'utf8'))
    recCache = Array.isArray(parsed) ? parsed : []
  } catch {
    recCache = []
  }
  return recCache!
}

function writeRecents(): void {
  try {
    writeFileSync(recFile(), JSON.stringify(recents()))
  } catch {
    /* ignore */
  }
}

export function getRecents(): RecentEntry[] {
  return recents()
}

/** Record (or bump to the top) a played item; caps the list, newest first. */
export function addRecent(target: string, name: string, kind: MediaKind): void {
  const list = recents().filter(e => e.target !== target)
  list.unshift({ target, name, kind, at: Date.now() })
  recCache = list.slice(0, RECENTS_CAP)
  writeRecents()
}

/** Refine a recent's display name once the real title is known (URLs mostly). */
export function updateRecentName(target: string, name: string): void {
  const e = recents().find(x => x.target === target)
  if (!e || !name || e.name === name) return
  e.name = name
  writeRecents()
}

export function removeRecent(target: string): void {
  recCache = recents().filter(e => e.target !== target)
  writeRecents()
}

export function clearRecents(): void {
  recCache = []
  writeRecents()
}

let favCache: FavEntry[] | null = null
const favFile = (): string => join(app.getPath('userData'), 'favourites.json')

function favourites(): FavEntry[] {
  if (favCache) return favCache
  try {
    const parsed = JSON.parse(readFileSync(favFile(), 'utf8'))
    favCache = Array.isArray(parsed) ? parsed : []
  } catch {
    favCache = []
  }
  return favCache!
}

function writeFavourites(): void {
  try {
    writeFileSync(favFile(), JSON.stringify(favourites(), null, 2))
  } catch {
    /* ignore */
  }
}

export function getFavourites(): FavEntry[] {
  return favourites()
}

export function isFavourite(target: string): boolean {
  return favourites().some(e => e.target === target)
}

/** Add a favourite (no-op if already saved), newest first. */
export function addFavourite(entry: FavEntry): void {
  if (isFavourite(entry.target)) return
  favourites().unshift(entry)
  writeFavourites()
}

export function removeFavourite(target: string): void {
  favCache = favourites().filter(e => e.target !== target)
  writeFavourites()
}

/** Give a saved item a custom display name (the auto-derived one is often ugly). */
export function renameFavourite(target: string, name: string): void {
  const e = favourites().find(x => x.target === target)
  const n = name.trim()
  if (!e || !n || e.name === n) return
  e.name = n
  writeFavourites()
}

/** Refresh a favourited list's channel snapshot (re-fetched from its source on open). */
export function updateFavouriteChannels(target: string, channels: Channel[]): void {
  const e = favourites().find(x => x.target === target)
  if (!e || e.kind !== 'list') return
  e.channels = channels
  writeFavourites()
}

/** Drop one channel from a favourited list's snapshot (delete a dead source). */
export function removeFavouriteChannel(listTarget: string, channelUrl: string): void {
  const e = favourites().find(x => x.target === listTarget)
  if (!e || !e.channels) return
  e.channels = e.channels.filter(c => c.url !== channelUrl)
  writeFavourites()
}

/** Drop one item from a saved playlist's snapshot. */
export function removeFavouriteItem(playlistTarget: string, path: string): void {
  const e = favourites().find(x => x.target === playlistTarget)
  if (!e || !e.items) return
  e.items = e.items.filter(i => i.path !== path)
  writeFavourites()
}
