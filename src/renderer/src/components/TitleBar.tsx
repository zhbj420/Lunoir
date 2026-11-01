import { useRef } from 'react'
import { useT } from '../useT'

export default function TitleBar({ title }: { title: string }) {
  const t = useT()
  // Same hand-drag as the mini player: -webkit-app-region: drag would make Windows
  // treat this as a caption (double-click OS-maximizes, which we then have to bounce
  // out of — a visible overshoot past the taskbar). Pointer events stay ours so
  // double-click can toggle the fake maximize.
  const dragFrom = useRef<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const lastClick = useRef(0)

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    const now = performance.now()
    if (now - lastClick.current < 400) {
      lastClick.current = 0
      window.mmp.toggleMaximize()
      return
    }
    lastClick.current = now
    dragFrom.current = { x: e.screenX, y: e.screenY }
    dragging.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const from = dragFrom.current
    if (!from) return
    const dx = e.screenX - from.x
    const dy = e.screenY - from.y
    if (!dragging.current) {
      if (Math.hypot(dx, dy) < 4) return
      dragging.current = true
      lastClick.current = 0
      window.mmp.dragWindowStart()
    }
    window.mmp.dragWindowTo(dx, dy)
  }
  const onPointerUp = (e: React.PointerEvent): void => {
    if (dragging.current) window.mmp.dragWindowEnd()
    dragFrom.current = null
    dragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div className="titlebar">
      <div
        className="titlebar-drag"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="title-text">{title}</span>
      </div>
      <div className="window-controls">
        <button className="win-btn" title={t('win.minimize')} onClick={() => window.mmp.minimize()}>
          <svg width="12" height="12" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button className="win-btn" title={t('win.maximize')} onClick={() => window.mmp.toggleMaximize()}>
          <svg width="12" height="12" viewBox="0 0 10 10">
            <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button className="win-btn win-close" title={t('win.close')} onClick={() => window.mmp.close()}>
          <svg width="12" height="12" viewBox="0 0 10 10">
            <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1" />
            <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  )
}
