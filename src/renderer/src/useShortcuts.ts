import { useEffect } from 'react'

interface Handlers {
  togglePause: () => void
  seekBy: (d: number) => void
  bumpVolume: (d: number) => void
  toggleMute: () => void
  fullscreen: () => void
  openFile: () => void
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
          break
        case 'ArrowLeft':
          h.seekBy(-5)
          break
        case 'ArrowRight':
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
          break
        case 'm':
        case 'M':
          h.toggleMute()
          break
        case 'o':
        case 'O':
          if (e.ctrlKey) h.openFile()
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
