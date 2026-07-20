import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// A node in the context menu. `sep` is a divider; `submenu` makes a flyout row;
// otherwise it's a clickable command (optionally `disabled` / `checked`).
export interface MenuNode {
  label?: string
  onClick?: () => void
  disabled?: boolean
  checked?: boolean
  submenu?: MenuNode[]
  sep?: boolean
}

/** A MenuNode as it crosses IPC to the acrylic menu window: data only, no
 *  handlers. `id` identifies the node so the main window can run its own onClick. */
export interface SerializedMenuNode {
  id?: string
  label?: string
  disabled?: boolean
  checked?: boolean
  sep?: boolean
  submenu?: SerializedMenuNode[]
}

// Custom (non-native) context menu so it matches the dark, frameless look instead
// of a stock Windows menu. Positioned at the cursor, clamped into the viewport;
// submenus open on hover (mouse) or click (touch) and flip to the left near the
// right edge. Dismisses on outside-click, Esc, or after a command runs.
export default function ContextMenu({
  x,
  y,
  items,
  onClose
}: {
  x: number
  y: number
  items: MenuNode[]
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const [subLeft, setSubLeft] = useState(false)
  const [openSub, setOpenSub] = useState<number | null>(null)

  // measure, then clamp into the viewport and decide submenu open direction
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let nx = x
    let ny = y
    if (x + r.width > vw - 6) nx = Math.max(6, vw - r.width - 6)
    if (y + r.height > vh - 6) ny = Math.max(6, vh - r.height - 6)
    setPos({ x: nx, y: ny })
    setSubLeft(nx + r.width + 180 > vw) // not enough room on the right for a flyout
  }, [x, y])

  // Esc closes (capture so it beats the player shortcuts)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const run = (n: MenuNode): void => {
    if (n.disabled || !n.onClick) return
    n.onClick()
    onClose()
  }

  return (
    <div
      className="ctx-backdrop"
      onMouseDown={onClose}
      onWheel={e => e.stopPropagation()}
      onContextMenu={e => {
        e.preventDefault()
        onClose()
      }}
    >
      <div
        ref={rootRef}
        className="ctx-menu"
        style={{ left: pos.x, top: pos.y }}
        onMouseDown={e => e.stopPropagation()}
        onContextMenu={e => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        {items.map((n, i) =>
          n.sep ? (
            <div key={i} className="ctx-sep" />
          ) : n.submenu ? (
            <div
              key={i}
              className={`ctx-item has-sub ${openSub === i ? 'open' : ''} ${n.disabled ? 'disabled' : ''}`}
              onMouseEnter={() => !n.disabled && setOpenSub(i)}
              onClick={e => {
                e.stopPropagation()
                if (!n.disabled) setOpenSub(openSub === i ? null : i)
              }}
            >
              <span className="ctx-check" />
              <span className="ctx-label">{n.label}</span>
              <span className="ctx-arrow">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </span>
              {openSub === i && (
                <div className={`ctx-sub ${subLeft ? 'left' : ''}`}>
                  {n.submenu.map((s, j) => (
                    <div
                      key={j}
                      className={`ctx-item ${s.disabled ? 'disabled' : ''}`}
                      onClick={e => {
                        e.stopPropagation()
                        run(s)
                      }}
                    >
                      <span className="ctx-check">{s.checked ? <Check /> : null}</span>
                      <span className="ctx-label">{s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={i} className={`ctx-item ${n.disabled ? 'disabled' : ''}`} onClick={() => run(n)}>
              <span className="ctx-check">{n.checked ? <Check /> : null}</span>
              <span className="ctx-label">{n.label}</span>
            </div>
          )
        )}
      </div>
    </div>
  )
}

const Check = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 6.5 L5 9 L9.5 3.5" />
  </svg>
)
