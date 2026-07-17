import { useCallback, useEffect, useRef, useState } from 'react'

export interface PlayerState {
  pause: boolean
  timePos: number
  duration: number
  volume: number
  mute: boolean
  title: string
  hasMedia: boolean
}

const initial: PlayerState = {
  pause: true,
  timePos: 0,
  duration: 0,
  volume: 100,
  mute: false,
  title: 'MMPlayer',
  hasMedia: false
}

export function usePlayer() {
  const [state, setState] = useState<PlayerState>(initial)
  const [revealed, setRevealed] = useState(true)
  const hideTimer = useRef<number | null>(null)

  // Subscribe to mpv property changes forwarded from the main process.
  useEffect(() => {
    return window.mmp.onProperty(({ name, data }) => {
      setState(s => {
        switch (name) {
          case 'pause':
            return { ...s, pause: Boolean(data) }
          case 'time-pos':
            return { ...s, timePos: typeof data === 'number' ? data : s.timePos }
          case 'duration':
            return { ...s, duration: typeof data === 'number' ? data : s.duration }
          case 'volume':
            return { ...s, volume: typeof data === 'number' ? data : s.volume }
          case 'mute':
            return { ...s, mute: Boolean(data) }
          case 'media-title':
          case 'filename':
            return data ? { ...s, title: String(data), hasMedia: true } : s
          case 'path':
            return data ? { ...s, hasMedia: true } : s
          default:
            return s
        }
      })
    })
  }, [])

  const reveal = useCallback(() => {
    setRevealed(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setRevealed(false), 2600)
  }, [])

  // Controls stay visible whenever paused or nothing is loaded.
  const showUi = revealed || state.pause || !state.hasMedia

  const actions = useRef({
    togglePause: () => window.mmp.command(['cycle', 'pause']),
    seekTo: (sec: number) => window.mmp.command(['seek', sec, 'absolute']),
    seekBy: (d: number) => window.mmp.command(['seek', d, 'relative']),
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
