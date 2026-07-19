import { useRef } from 'react'

// A panel window docks over the main window's edge, so it covers the OS resize
// border there. These invisible grips restore resizing: dragging one resizes the
// MAIN window. For a right-docked panel the top-left stays fixed (e/s/se grips).
type Edge = 'e' | 's' | 'se'

export default function ResizeGrips({ edges }: { edges: Edge[] }) {
  const drag = useRef<{ edge: Edge; sx: number; sy: number; w: number; h: number } | null>(null)

  const onDown = (edge: Edge) => async (e: React.PointerEvent): Promise<void> => {
    if (e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const b = await window.mmp.getWinBounds()
    if (b) drag.current = { edge, sx: e.screenX, sy: e.screenY, w: b.width, h: b.height }
  }

  const onMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) return
    const w = d.edge === 's' ? d.w : d.w + (e.screenX - d.sx)
    const h = d.edge === 'e' ? d.h : d.h + (e.screenY - d.sy)
    window.mmp.setWinSize(w, h)
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
