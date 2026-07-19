import { useRef } from 'react'

// A panel window docks over the main window's edge, so it covers the OS resize
// border there. These invisible grips restore resizing: dragging one resizes the
// MAIN window. The right-docked panel exposes e/s/se (top-left anchored); the
// left-docked panel exposes w/s/sw (top-right anchored — the left edge moves).
type Edge = 'e' | 'w' | 's' | 'se' | 'sw'

const WIN_MIN_W = 850 // = WIN_MIN_W in main; keep the anchored edge fixed at the min
const WIN_MIN_H = 320

export default function ResizeGrips({ edges }: { edges: Edge[] }) {
  const drag = useRef<{
    edge: Edge
    sx: number
    sy: number
    x: number
    y: number
    w: number
    h: number
  } | null>(null)

  const onDown = (edge: Edge) => async (e: React.PointerEvent): Promise<void> => {
    if (e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const b = await window.mmp.getWinBounds()
    if (b) drag.current = { edge, sx: e.screenX, sy: e.screenY, x: b.x, y: b.y, w: b.width, h: b.height }
  }

  const onMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) return
    const dx = e.screenX - d.sx
    const dy = e.screenY - d.sy
    let { x } = d
    let w = d.w
    let h = d.h
    if (d.edge === 'e' || d.edge === 'se') w = d.w + dx
    if (d.edge === 'w' || d.edge === 'sw') {
      w = Math.max(WIN_MIN_W, d.w - dx)
      x = d.x + d.w - w // right edge stays fixed
    }
    if (d.edge === 's' || d.edge === 'se' || d.edge === 'sw') h = Math.max(WIN_MIN_H, d.h + dy)
    window.mmp.setWinBounds(x, d.y, w, h)
  }

  const onUp = (e: React.PointerEvent): void => {
    drag.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  return (
    <>
      {edges.map(edge => (
        <div
          key={edge}
          className={`resize-grip resize-${edge}`}
          onPointerDown={onDown(edge)}
          onPointerMove={onMove}
          onPointerUp={onUp}
        />
      ))}
    </>
  )
}
