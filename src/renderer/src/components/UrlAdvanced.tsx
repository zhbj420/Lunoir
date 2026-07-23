import { useState } from 'react'
import { useT } from '../useT'

/**
 * The collapsed "Advanced" strip under a URL box — currently just a User-Agent.
 *
 * It belongs to the SOURCE, not to the player: some live-TV providers only serve the
 * real stream to their own app's UA and quietly redirect everyone else to a placeholder
 * clip, so every channel plays the same test video. That's a property of the one URL you
 * are opening, which is why this sits here rather than in Settings — a second source
 * (which needs no UA, or a different one) is never affected.
 *
 * Only the strip is shared: the two URL boxes that host it differ in focus and key
 * handling, and prop-threading those through a common component costs more than the few
 * lines of markup it would save.
 */
export default function UrlAdvanced({
  ua,
  onChange
}: {
  ua: string
  onChange: (v: string) => void
}) {
  const t = useT()
  // open it automatically when a value carried over, so it's never silently in effect
  const [open, setOpen] = useState(ua.trim().length > 0)

  return (
    <div className="url-adv">
      <button
        className={`url-adv-toggle ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        // a filled-in UA changes what gets played, so say so while it's collapsed
        title={ua.trim() ? ua : undefined}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
        {t('url.advanced')}
        {!open && ua.trim() && <span className="url-adv-dot" />}
      </button>
      {open && (
        <input
          className="url-adv-input"
          spellCheck={false}
          placeholder={t('url.userAgent')}
          value={ua}
          onChange={e => onChange(e.target.value)}
          // the parent's box turns Enter into "play" and Escape into "close"; typing a
          // UA must not trigger either, nor leak into the player's shortcuts
          onKeyDown={e => e.stopPropagation()}
        />
      )}
    </div>
  )
}
