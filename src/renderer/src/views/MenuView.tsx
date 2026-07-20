import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SerializedMenuNode } from '../components/ContextMenu'

// easeOutQuad as a bezier — must be the same curve main animates the window with,
// or the fold and the shrink visibly separate into two moves. The *duration* comes
// from main (MENU_FOLD_MS) so the two can never drift apart again.
const FOLD_EASE = 'cubic-bezier(0.5, 1, 0.89, 1)'

/**
 * The context menu, rendered in its own Win11 acrylic window (`?win=menu`) so it
 * frosts the video like the OSC and side panels — an in-DOM menu can only paint a
 * flat scrim, since it can't reach mpv's surface.
 *
 * This view is deliberately dumb: the main window builds the menu (keeping all its
 * onClick closures) and sends it across as plain data; we draw it, report the size
 * we want, and send back the id of whatever was clicked.
 *
 * Submenus expand *inline* (accordion, one open at a time) rather than flying out —
 * a window is a single rectangle, so a flyout would either be clipped or leave a
 * frosted empty box beside the menu. Inline also suits a touchscreen better.
 */
export default function MenuView(): React.JSX.Element {
  const [items, setItems] = useState<SerializedMenuNode[]>([])
  const [openSub, setOpenSub] = useState<string | null>(null)
  const [collapsing, setCollapsing] = useState(false)
  const [expanding, setExpanding] = useState(false)
  const foldMs = useRef(240) // both overwritten by main on every open
  const unfoldMs = useRef(200)
  const rootRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      window.mmp.onMenuShow((next, ms, upMs) => {
        foldMs.current = ms // main owns the timing for both halves of the motion
        unfoldMs.current = upMs
        setOpenSub(null) // every fresh open starts fully collapsed
        setCollapsing(false)
        setExpanding(false)
        setItems(next)
      }),
    []
  )

  // main tells us the shrink finished — only now is it safe to drop the rows
  useEffect(
    () =>
      window.mmp.onMenuCollapsed(() => {
        setCollapsing(false)
        setOpenSub(null)
      }),
    []
  )

  // Report the size we want. Main places/reveals the window only once a size has
  // arrived, so it never flashes at the placeholder size.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || items.length === 0 || collapsing) return
    const r = root.getBoundingClientRect()
    window.mmp.reportMenuSize(Math.ceil(r.width), Math.ceil(r.height))
  }, [items, openSub, collapsing])

  // Expanding: the group used to appear at full height instantly and be *revealed*
  // by the growing window — which exposed the seam between DWM resizing the frosted
  // backdrop and Chromium repainting the newly uncovered strip ("one layer lands,
  // then the other"). Animate the group open instead, slightly AHEAD of the window,
  // so the window only ever clips content that is already painted.
  useLayoutEffect(() => {
    if (!expanding) return
    const group = subRef.current
    if (!group) return
    const full = group.scrollHeight
    group.style.transition = 'none'
    group.style.height = '0px'
    void group.offsetHeight // force the 0 to land before we animate away from it
    group.style.transition = `height ${unfoldMs.current}ms ${FOLD_EASE}`
    group.style.height = `${full}px`
    const t = setTimeout(() => {
      group.style.transition = ''
      group.style.height = '' // back to auto so later measurements are honest
      setExpanding(false)
    }, unfoldMs.current + 40)
    return () => clearTimeout(t)
  }, [expanding, openSub])

  // Collapsing: fold the group to 0 here while main eases the window down by the
  // same amount over the same duration, so it reads as one motion instead of the
  // window clipping the *bottom* of the menu (the group sits in the middle).
  useLayoutEffect(() => {
    if (!collapsing) return
    const root = rootRef.current
    const group = subRef.current
    if (!root || !group) return
    const r = root.getBoundingClientRect()
    const sub = group.getBoundingClientRect().height
    group.style.transition = `height ${foldMs.current}ms ${FOLD_EASE}`
    group.style.height = '0px'
    window.mmp.collapseMenu(Math.ceil(r.width), Math.ceil(r.height - sub))
  }, [collapsing])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.mmp.closeMenu()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const run = (n: SerializedMenuNode): void => {
    if (n.disabled || !n.id) return
    window.mmp.invokeMenu(n.id) // main dismisses us, then the main window acts
  }

  const toggleSub = (key: string, open: boolean): void => {
    if (!open) {
      setCollapsing(false) // opening (or switching): swap straight over
      setOpenSub(key)
      setExpanding(true)
      return
    }
    // closing: pin the group's current height so it has something to animate from
    const group = subRef.current
    if (group) group.style.height = `${group.getBoundingClientRect().height}px`
    setCollapsing(true)
  }

  const rows: React.JSX.Element[] = []
  items.forEach((n, i) => {
    const key = n.id ?? `i${i}`
    if (n.sep) {
      rows.push(<div key={`sep${i}`} className="ctx-sep" />)
      return
    }
    if (n.submenu?.length) {
      const open = openSub === key
      rows.push(
        <div
          key={key}
          className={`ctx-item has-sub ${open && !collapsing ? 'open' : ''}`}
          onClick={() => toggleSub(key, open)}
        >
          <span className="ctx-check" />
          <span className="ctx-label">{n.label}</span>
          <span className="ctx-arrow">{open && !collapsing ? '⌄' : '›'}</span>
        </div>
      )
      if (open) {
        rows.push(
          <div className="ctx-sub-group" ref={subRef} key={`${key}-sub`}>
            {n.submenu.map((s, j) => (
              <div
                key={`${key}-${j}`}
                className={`ctx-item sub ${s.disabled ? 'disabled' : ''}`}
                onClick={() => run(s)}
              >
                <span className="ctx-check">{s.checked ? '✓' : ''}</span>
                <span className="ctx-label">{s.label}</span>
              </div>
            ))}
          </div>
        )
      }
      return
    }
    rows.push(
      <div key={key} className={`ctx-item ${n.disabled ? 'disabled' : ''}`} onClick={() => run(n)}>
        <span className="ctx-check">{n.checked ? '✓' : ''}</span>
        <span className="ctx-label">{n.label}</span>
      </div>
    )
  })

  return (
    <div className="ctx-win">
      <div className="ctx-win-inner" ref={rootRef}>
        {rows}
      </div>
    </div>
  )
}
