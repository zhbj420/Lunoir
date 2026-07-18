import { useCallback, useEffect, useRef, useState } from 'react'

export interface PlayerState {
  pause: boolean
  timePos: number
  duration: number
  volume: number
  mute: boolean
  title: string // shown in the title bar — the file name (media-title only as fallback)
  fileName: string // mpv 'filename' — preferred title; guards against junk title tags
  hasMedia: boolean
  gamma: string // video transfer fn ('pq'/'hlg'/…) → generic HDR fallback
  hdrFormat: string // MediaInfo HDR flavour: 'Dolby Vision'/'HDR10+'/'HDR10'/'' → refines the badge
  audioCodec: string // audio-codec-name → format badge
  audioChannels: number // audio-params/channel-count → layout suffix
  audioCommercial: string // active track's MediaInfo commercial name (Atmos / DTS:X …)
}

const initial: PlayerState = {
  pause: true,
  timePos: 0,
  duration: 0,
  volume: 100,
  mute: false,
  title: 'Lunoir',
  fileName: '',
  hasMedia: false,
  gamma: '',
  hdrFormat: '',
  audioCodec: '',
  audioChannels: 0,
  audioCommercial: ''
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
          case 'filename':
            // the file name is the preferred title-bar text
            return data ? { ...s, title: String(data), fileName: String(data), hasMedia: true } : s
          case 'media-title':
            // many remuxes stuff junk into the container title tag ("ENCODED BY
            // CHDMON"), which mpv surfaces as media-title. Only use it when there's
            // no filename yet (e.g. a network stream).
            if (!data) return s
            return { ...s, hasMedia: true, title: s.fileName ? s.title : String(data) }
          case 'path':
            return data ? { ...s, hasMedia: true } : s
          case 'video-params/gamma':
            return { ...s, gamma: typeof data === 'string' ? data : '' }
          case 'audio-codec-name':
            return { ...s, audioCodec: typeof data === 'string' ? data : '' }
          case 'audio-params/channel-count':
            // only accept a real positive count; don't let a transient null/0 (which
            // mpv emits mid-track-switch) wipe the badge's "5.1" back out
            return typeof data === 'number' && data > 0 ? { ...s, audioChannels: data } : s
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
