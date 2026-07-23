import { useCallback, useEffect, useRef, useState } from 'react'

// Title-bar text. Streams (YouTube etc.) show the real media-title (+ uploader);
// local files prefer the filename (container title tags are often junk like
// "ENCODED BY …" and the "filename" of a URL is just its ugly last path segment).
function pickTitle(
  fileName: string,
  mediaTitle: string,
  author: string,
  isStream: boolean,
  isDisc: boolean
): string {
  // disc: mpv's filename/path is just 'bd://', so use the resolved name
  // (force-media-title). Detect the URI in fileName too, so a late 'filename'
  // event can never leave the ugly 'bd://' in the title bar.
  if (isDisc || /^(bd|dvd|bluray|dvdnav):\/\//i.test(fileName)) return mediaTitle || 'Blu-ray'
  if (isStream) {
    const base = mediaTitle || fileName || 'Lunoir'
    return author ? `${base} · ${author}` : base
  }
  return fileName || mediaTitle || 'Lunoir'
}

/** How the OSC prints position/duration — click the readout to cycle.
 *  Mirrors the preload's TimeFormat; the renderer can't import from preload. */
export type TimeFormat = 'time' | 'timecode' | 'frame'

/** mpv's own count when we have it, else derived from the clock. Stepping parks
 *  time on a frame boundary where floor(time * fps) is ambiguous, so mpv's integer
 *  is always preferred. */
export function currentFrame(s: PlayerState): number {
  if (s.frameNumber > 0) return s.frameNumber
  if (s.fps > 0 && isFinite(s.timePos) && s.timePos > 0) return Math.floor(s.timePos * s.fps)
  return 0
}

export interface PlayerState {
  pause: boolean
  fps: number // container frame rate (0 = unknown) → timecode / frame readout
  frameCount: number
  frameNumber: number // mpv's exact current frame (authoritative when stepping)
  timePos: number
  duration: number
  volume: number
  mute: boolean
  speed: number // playback speed (1 = normal)
  title: string // composed title-bar text (see pickTitle)
  fileName: string // mpv 'filename' — preferred title for local files
  mediaTitle: string // mpv 'media-title' — the real title for streams (YouTube …)
  author: string // stream uploader/channel (metadata/by-key/uploader)
  hasMedia: boolean
  gamma: string // video transfer fn ('pq'/'hlg'/…) → generic HDR fallback
  hdrFormat: string // MediaInfo HDR flavour: 'Dolby Vision'/'HDR10+'/'HDR10'/'' → refines the badge
  videoHeight: number // decoded height → resolution badge
  isStream: boolean // playing a network URL (show the resolution badge only then)
  isLive: boolean // mpv 'seekable' is false → a live stream; OSC shows ● LIVE, no seek bar
  isDisc: boolean // playing a Blu-ray/DVD disc (bd:// / dvd://) → title from the folder name
  audioCodec: string // audio-codec-name → format badge
  audioChannels: number // audio-params/channel-count → layout suffix
  audioCommercial: string // active track's MediaInfo commercial name (Atmos / DTS:X …)
  abLoopA: number | null // A-B loop start (seconds) → OSC seek marker, null = unset
  abLoopB: number | null // A-B loop end (seconds)
  merge: boolean // "watch as one" active → draw clip-boundary ticks on the seek bar
  chapters: number[] // the file's own chapter start times (s) — the Chapters tab
  clipStarts: number[] // merge mode: the CLIP boundaries, filtered out of the chapter list
                       // by main (a stitched rip also drags in its own chapters)
  clipFps: number // the current clip's frame-rate override (0 = none)
  clipSrcFps: number // …and its native rate. The OSC names one of these instead of a speed
                     // multiplier — you set a frame rate, so you read a frame rate.
  trimClip: number // clip being trimmed (−1 = not trimming) → OSC shows in/out handles
  trimIn: number // in point (seconds) of the isolated clip
  trimOut: number // out point (seconds)
}

const initial: PlayerState = {
  pause: true,
  fps: 0,
  frameCount: 0,
  frameNumber: 0,
  timePos: 0,
  duration: 0,
  volume: 100,
  mute: false,
  speed: 1,
  title: 'Lunoir',
  fileName: '',
  mediaTitle: '',
  author: '',
  hasMedia: false,
  gamma: '',
  hdrFormat: '',
  videoHeight: 0,
  isStream: false,
  isLive: false,
  isDisc: false,
  audioCodec: '',
  audioChannels: 0,
  audioCommercial: '',
  abLoopA: null,
  abLoopB: null,
  merge: false,
  chapters: [],
  clipStarts: [],
  clipFps: 0,
  clipSrcFps: 0,
  trimClip: -1,
  trimIn: 0,
  trimOut: 0
}

// The playlist payload arrives on every panel change; without this the boundary array
// would be a fresh object each time and re-render the OSC for nothing.
const sameNums = (a: number[], b: number[] | undefined): boolean =>
  !!b && a.length === b.length && a.every((v, i) => v === b[i])

export function usePlayer() {
  const [state, setState] = useState<PlayerState>(initial)
  const [revealed, setRevealed] = useState(true)
  // pending "we're playing again" update — see the pause handling below
  const unpauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // while frame-stepping we ignore 'playing' outright, then re-read the real state
  const steppingUntil = useRef(0)
  const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Subscribe to mpv property changes forwarded from the main process.
  useEffect(() => {
    return window.mmp.onProperty(({ name, data }) => {
      // mpv's frame-step means "play one frame, then pause again", so every step
      // blips pause false→true and the play/pause button flickers (badly, when an
      // arrow key is held). Pausing is applied at once; *unpausing* is deferred a
      // moment, and a pause arriving first cancels it — so a step never shows, while
      // a real play still lands (just fractionally later).
      if (name === 'pause') {
        if (unpauseTimer.current) {
          clearTimeout(unpauseTimer.current)
          unpauseTimer.current = null
        }
        if (data) {
          setState(s => (s.pause ? s : { ...s, pause: true }))
        } else if (Date.now() < steppingUntil.current) {
          // mid-step: mpv doesn't always emit the matching pause=true in time, so a
          // timer alone still lets the button blink. Ignore it; the resync below
          // restores the truth once stepping stops.
        } else {
          unpauseTimer.current = setTimeout(() => {
            unpauseTimer.current = null
            setState(s => (s.pause ? { ...s, pause: false } : s))
          }, 120)
        }
        return
      }
      setState(s => {
        switch (name) {
          case 'time-pos':
            // any playback position means media is loaded (robust against
            // missing the one-shot path/filename event on late subscribe)
            return typeof data === 'number'
              ? { ...s, timePos: data, hasMedia: true }
              : s
          case 'duration':
            return typeof data === 'number' && data > 0
              ? { ...s, duration: data, hasMedia: true }
              : s
          case 'volume':
            return { ...s, volume: typeof data === 'number' ? data : s.volume }
          case 'mute':
            return { ...s, mute: Boolean(data) }
          case 'container-fps':
            return { ...s, fps: typeof data === 'number' && data > 0 ? data : 0 }
          case 'estimated-frame-number':
            return { ...s, frameNumber: typeof data === 'number' && data >= 0 ? Math.round(data) : s.frameNumber }
          case 'estimated-frame-count':
            return { ...s, frameCount: typeof data === 'number' && data > 0 ? Math.round(data) : 0 }
          case 'speed':
            return { ...s, speed: typeof data === 'number' ? data : s.speed }
          case 'filename': {
            if (!data) return s
            const fileName = String(data)
            return { ...s, hasMedia: true, fileName, title: pickTitle(fileName, s.mediaTitle, s.author, s.isStream, s.isDisc) }
          }
          case 'media-title': {
            if (!data) return s
            const mediaTitle = String(data)
            return { ...s, hasMedia: true, mediaTitle, title: pickTitle(s.fileName, mediaTitle, s.author, s.isStream, s.isDisc) }
          }
          case 'metadata/by-key/uploader': {
            const author = typeof data === 'string' ? data : ''
            return { ...s, author, title: pickTitle(s.fileName, s.mediaTitle, author, s.isStream, s.isDisc) }
          }
          case 'path': {
            if (!data) return s
            // new file → reset the title parts; isStream/isDisc pick the title source
            const p = String(data)
            const stream = /^https?:\/\//i.test(p)
            return {
              ...s,
              hasMedia: true,
              isStream: stream,
              // assume a network stream is live until 'seekable' proves it's a
              // seekable VOD — so a live reload never flashes the seek bar before
              // seekable arrives (local files/discs default to not-live → bar shows)
              isLive: stream,
              isDisc: /^(bd|dvd|bluray|dvdnav):\/\//i.test(p),
              fileName: '',
              mediaTitle: '',
              author: ''
            }
          }
          case 'seekable':
            // a non-seekable network stream is live (local files & VOD are seekable);
            // gate on isStream so a local file's transient false at load isn't "live"
            return { ...s, isLive: s.isStream && data === false }
          case 'video-params/gamma':
            return { ...s, gamma: typeof data === 'string' ? data : '' }
          case 'video-params/h':
            return { ...s, videoHeight: typeof data === 'number' ? data : s.videoHeight }
          case 'audio-codec-name':
            return { ...s, audioCodec: typeof data === 'string' ? data : '' }
          case 'audio-params/channel-count':
            // only accept a real positive count; don't let a transient null/0 (which
            // mpv emits mid-track-switch) wipe the badge's "5.1" back out
            return typeof data === 'number' && data > 0 ? { ...s, audioChannels: data } : s
          case 'ab-loop-a':
            // number = point set; mpv sends 'no' (string) when cleared
            return { ...s, abLoopA: typeof data === 'number' && isFinite(data) ? data : null }
          case 'ab-loop-b':
            return { ...s, abLoopB: typeof data === 'number' && isFinite(data) ? data : null }
          case 'chapter-list': {
            // the file's OWN chapters (Chapters tab). Merge-mode boundary ticks do NOT
            // come from here — main filters them into `clipStarts` (see below).
            const times = Array.isArray(data)
              ? (data as { time?: number }[]).map(c => c.time).filter((t): t is number => typeof t === 'number')
              : []
            return { ...s, chapters: times }
          }
          default:
            return s
        }
      })
    })
  }, [])

  // "watch as one": follow the merge flag AND the clip boundaries from the playlist
  // payload, so the OSC draws a tick per clip (and only then — a normal file's own
  // chapters never draw ticks).
  useEffect(
    () =>
      window.mmp.onPlaylistChanged(p => {
        const cf = p.clipFps ?? 0
        const csf = p.clipSrcFps ?? 0
        setState(s =>
          s.merge === p.merge &&
          s.clipFps === cf &&
          s.clipSrcFps === csf &&
          sameNums(s.clipStarts, p.clipStarts)
            ? s
            : { ...s, merge: p.merge, clipStarts: p.clipStarts ?? [], clipFps: cf, clipSrcFps: csf }
        )
      }),
    []
  )
  // Timeline trim edit → OSC in/out handles
  useEffect(
    () => window.mmp.onTrim(s => setState(st => ({ ...st, trimClip: s.clip, trimIn: s.in, trimOut: s.out }))),
    []
  )

  // don't leave a deferred unpause pending after teardown
  useEffect(
    () => () => {
      if (unpauseTimer.current) clearTimeout(unpauseTimer.current)
      if (resyncTimer.current) clearTimeout(resyncTimer.current)
    },
    []
  )

  // The active audio track's commercial format (Atmos / DTS:X …) + native channel
  // count are resolved in main and pushed here; the OSC badge reads them. This is
  // the authoritative channel source for the badge (fires on every track switch,
  // unlike audio-params/channel-count).
  useEffect(() => {
    return window.mmp.onActiveAudio(a =>
      setState(s => ({
        ...s,
        audioCommercial: a?.commercial ?? '',
        audioChannels: a && a.channels > 0 ? a.channels : s.audioChannels
      }))
    )
  }, [])

  // The video HDR flavour (Dolby Vision / HDR10+ / HDR10) from MediaInfo — refines
  // the gamma-based HDR badge, which can't tell DV from HDR10 (both are PQ).
  useEffect(() => {
    return window.mmp.onVideoHdr(hdr =>
      setState(s => ({ ...s, hdrFormat: typeof hdr === 'string' ? hdr : '' }))
    )
  }, [])

  // Reveal / auto-hide is coordinated by main across both windows.
  useEffect(() => {
    const offR = window.mmp.onReveal(() => setRevealed(true))
    const offH = window.mmp.onHide(() => setRevealed(false))
    return () => {
      offR()
      offH()
    }
  }, [])

  // Compensate the acrylic scrim when the app is inactive (see styles.css).
  useEffect(() => {
    return window.mmp.onAppFocus(focused => {
      document.body.classList.toggle('app-inactive', !focused)
    })
  }, [])

  const reveal = useCallback(() => window.mmp.activity(), [])

  // Controls auto-hide during playback and while paused; they stay only when
  // nothing is loaded (the empty state). Pausing still calls revealUi(), so the
  // OSC lingers ~3.5s after a pause before fading.
  const showUi = revealed || !state.hasMedia

  const actions = useRef({
    togglePause: () => window.mmp.command(['cycle', 'pause']),
    seekTo: (sec: number) => window.mmp.command(['seek', sec, 'absolute']),
    seekBy: (d: number) => window.mmp.command(['seek', d, 'relative']),
    frameStep: (forward: boolean) => {
      // hold the "paused" icon steady across the step (frame-step briefly unpauses),
      // and re-read the real state shortly after the last one
      steppingUntil.current = Date.now() + 260
      if (resyncTimer.current) clearTimeout(resyncTimer.current)
      resyncTimer.current = setTimeout(async () => {
        resyncTimer.current = null
        const paused = await window.mmp.command(['get_property', 'pause'])
        setState(s => (s.pause === Boolean(paused) ? s : { ...s, pause: Boolean(paused) }))
      }, 300)
      window.mmp.command([forward ? 'frame-step' : 'frame-back-step'])
    },
    setVolume: (v: number) => {
      const vol = Math.max(0, Math.min(150, Math.round(v)))
      window.mmp.set('volume', vol)
      setState(s => ({ ...s, volume: vol }))
    },
    openFile: async () => {
      const p = await window.mmp.openDialog()
      if (p) window.mmp.loadFile(p)
    },
    fullscreen: () => window.mmp.toggleFullscreen()
  }).current

  const toggleMute = useCallback(() => window.mmp.set('mute', !state.mute), [state.mute])

  return { state, showUi, reveal, ...actions, toggleMute }
}
