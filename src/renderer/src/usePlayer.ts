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

export interface PlayerState {
  pause: boolean
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
  isDisc: boolean // playing a Blu-ray/DVD disc (bd:// / dvd://) → title from the folder name
  audioCodec: string // audio-codec-name → format badge
  audioChannels: number // audio-params/channel-count → layout suffix
  audioCommercial: string // active track's MediaInfo commercial name (Atmos / DTS:X …)
  abLoopA: number | null // A-B loop start (seconds) → OSC seek marker, null = unset
  abLoopB: number | null // A-B loop end (seconds)
}

const initial: PlayerState = {
  pause: true,
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
  isDisc: false,
  audioCodec: '',
  audioChannels: 0,
  audioCommercial: '',
  abLoopA: null,
  abLoopB: null
}

export function usePlayer() {
  const [state, setState] = useState<PlayerState>(initial)
  const [revealed, setRevealed] = useState(true)

  // Subscribe to mpv property changes forwarded from the main process.
  useEffect(() => {
    return window.mmp.onProperty(({ name, data }) => {
      setState(s => {
        switch (name) {
          case 'pause':
            return { ...s, pause: Boolean(data) }
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
            return {
              ...s,
              hasMedia: true,
              isStream: /^https?:\/\//i.test(p),
              isDisc: /^(bd|dvd|bluray|dvdnav):\/\//i.test(p),
              fileName: '',
              mediaTitle: '',
              author: ''
            }
          }
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
          default:
            return s
        }
      })
    })
  }, [])

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
    frameStep: (forward: boolean) =>
      window.mmp.command([forward ? 'frame-step' : 'frame-back-step']),
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
