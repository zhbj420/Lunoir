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
  audioLang: '',
  subLang: '',
  subsDefaultOn: true,
  subHdrPeak: 120, // dimmer than mpv's ~SDR-white default so HDR subs aren't harsh
  hwdec: 'auto',
  streamQuality: 'best',
  useCookies: false,
  cookiesBrowser: 'edge',
  screenshotSubs: true,
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
