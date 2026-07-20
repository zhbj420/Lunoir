import { useEffect, useRef } from 'react'

// Min gap between frame steps while an arrow key is *held*. Single taps are never
// throttled. frame-back-step is expensive in mpv (it seeks + re-decodes), so
// letting the ~30/s key auto-repeat through unthrottled makes it crawl.
const FRAME_STEP_MS = 50

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
  // Latched for the duration of one arrow-key hold. mpv's frame-step means "play
  // one frame, then pause again", so `paused` momentarily flips to false while
  // stepping; re-reading it on every auto-repeat would drop us into the seek
  // branch mid-hold and rocket to the end of the file. Decide once, on the first
  // press, and stick with it until keyup.
  const arrowMode = useRef<'step' | 'seek' | null>(null)
  const lastStep = useRef(0)

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
        case 'ArrowRight': {
          const forward = e.key === 'ArrowRight'
          if (!e.repeat || arrowMode.current === null) {
            arrowMode.current = h.paused ? 'step' : 'seek'
          }
          if (arrowMode.current === 'step') {
            // taps always step; held repeats are rate-limited so mpv keeps up
            const now = performance.now()
            if (!e.repeat || now - lastStep.current >= FRAME_STEP_MS) {
              lastStep.current = now
              h.frameStep(forward)
            }
            return
          }
          h.seekBy(forward ? 5 : -5)
          break
        }
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
    // release the latch when the hold ends — or if focus is lost mid-hold, which
    // would otherwise swallow the keyup and leave us stuck in one mode
    const clearArrow = (e?: KeyboardEvent) => {
      if (!e || e.key === 'ArrowLeft' || e.key === 'ArrowRight') arrowMode.current = null
    }
    const onKeyUp = (e: KeyboardEvent) => clearArrow(e)
    const onBlur = () => clearArrow()

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [h])
}
