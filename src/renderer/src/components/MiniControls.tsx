import { useT } from '../useT'

/**
 * Controls for the mini player (PiP). Deliberately NOT the OSC: at ~480px the OSC's
 * row of icons would be a few pixels each. The shape here is what small floating
 * players converge on — one big primary button in the middle, one small escape hatch
 * in a corner, a hairline of progress — and it's drawn in the main window's DOM
 * rather than a fourth acrylic child window, because CSS can't frost the video anyway
 * and a plain scrim is what reads right at this size.
 *
 * The window itself is the drag region, so there's no click-to-pause here: pressing
 * the picture moves the window. That's the same trade every system PiP makes, and it's
 * why the play button is large.
 *
 * `show` comes from main polling the cursor against the window rectangle, not from CSS
 * :hover — a drag region hands its mouse events to the OS, so the renderer never sees
 * hover over the picture. Untouched, this is pure video; point at the window and the
 * controls fade in.
 */
export default function MiniControls({
  show,
  pause,
  timePos,
  duration,
  onToggle,
  onExit
}: {
  show: boolean
  pause: boolean
  timePos: number
  duration: number
  onToggle: () => void
  onExit: () => void
}) {
  const t = useT()
  const pct = duration > 0 ? Math.max(0, Math.min(100, (timePos / duration) * 100)) : 0

  return (
    <div className={`mini-ui ${show ? 'show' : ''}`}>
      <button className="mini-play" onClick={onToggle} title={pause ? t('osc.play') : t('osc.pause')}>
        {pause ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4 L20 12 L7 20 Z" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4.4" height="16" rx="1" />
            <rect x="13.6" y="4" width="4.4" height="16" rx="1" />
          </svg>
        )}
      </button>
      <button className="mini-exit" onClick={onExit} title={t('mini.exit')}>
        {/* arrows breaking outward — "put it back to a full window" */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6M21 3l-8 8M9 21H3v-6M3 21l8-8" />
        </svg>
      </button>
      {/* read-only: at this width a drag would fight the window drag and land nowhere near */}
      <div className="mini-bar">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
