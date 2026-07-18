import { useEffect } from 'react'

interface Handlers {
  togglePause: () => void
  seekBy: (d: number) => void
  frameStep: (forward: boolean) => void
  paused: boolean
  bumpVolume: (d: number) => void
  toggleMute: () => void
  fullscreen: () => void
  openFile: () => void
  next: () => void
  prev: () => void
  onActivity: () => void
}

/** Global keyboard shortcuts, attached in whichever window has focus. */
export function useShortcuts(h: Handlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          h.togglePause()
          return // pause/play shouldn't pop the OSC
        // paused: step one frame ("盯帧"), without popping the OSC; playing: seek ∓5s
        case 'ArrowLeft':
          if (h.paused) {
            h.frameStep(false)
            return
          }
          h.seekBy(-5)
          break
        case 'ArrowRight':
          if (h.paused) {
            h.frameStep(true)
            return
          }
          h.seekBy(5)
          break
        case 'ArrowUp':
          h.bumpVolume(5)
          break
        case 'ArrowDown':
          h.bumpVolume(-5)
          break
        case 'f':
        case 'F':
          h.fullscreen()
          return // fullscreen toggle shouldn't pop the OSC
        case 'm':
        case 'M':
          h.toggleMute()
          break
        case 'o':
        case 'O':
          if (e.ctrlKey) h.openFile()
          break
        case '>':
        case '.':
          h.next()
          break
        case '<':
        case ',':
          h.prev()
          break
        default:
          return
      }
      h.onActivity()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [h])
}
