import { useCallback, useEffect, useRef, useState } from 'react'

export interface PlayerState {
  pause: boolean
  timePos: number
  duration: number
  volume: number
  mute: boolean
  title: string
  hasMedia: boolean
  gamma: string // video transfer fn ('pq'/'hlg'/…) → HDR badge
  audioCodec: string // audio-codec-name → format badge
  audioChannels: number // audio-params/channel-count → layout suffix
}

const initial: PlayerState = {
  pause: true,
  timePos: 0,
  duration: 0,
  volume: 100,
  mute: false,
  title: 'Lunoir',
  hasMedia: false,
  gamma: '',
  audioCodec: '',
  audioChannels: 0
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
          case 'media-title':
          case 'filename':
            return data ? { ...s, title: String(data), hasMedia: true } : s
          case 'path':
            return data ? { ...s, hasMedia: true } : s
          case 'video-params/gamma':
            return { ...s, gamma: typeof data === 'string' ? data : '' }
          case 'audio-codec-name':
            return { ...s, audioCodec: typeof data === 'string' ? data : '' }
          case 'audio-params/channel-count':
            return { ...s, audioChannels: typeof data === 'number' ? data : 0 }
          default:
            return s
        }
      })
    })
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
