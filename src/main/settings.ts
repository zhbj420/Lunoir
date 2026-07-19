// Persisted user settings + per-file playback positions, stored as JSON under
// the app's userData dir. Kept small and synchronous — reads are cached.
import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Settings } from '../preload/index'

export type { Settings }

const DEFAULTS: Settings = {
  scanFolderIntoPlaylist: false,
  resumePlayback: true,
  resumePlaylistItem: true,
  audioLang: '',
  subLang: '',
  subsDefaultOn: true,
  subHdrPeak: 120, // dimmer than mpv's ~SDR-white default so HDR subs aren't harsh
  hwdec: 'auto',
  streamQuality: 'best',
  useCookies: false,
  cookiesBrowser: 'edge',
  screenshotSubs: true,
  screenshotDir: '',
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
