import { useRef, useState } from 'react'
import logoUrl from '../assets/logo.png'
import wordmarkUrl from '../assets/Lunoir.png'
import { useT } from '../useT'

export default function EmptyState({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  const [urlInput, setUrlInput] = useState(false)
  const [url, setUrl] = useState('')
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const submitUrl = () => {
    const u = url.trim()
    if (u) window.mmp.loadFile(u)
  }

  // single click = open a file; double click = open a Blu-ray/DVD disc folder
  // (Windows can't offer both in one native dialog, so the gesture picks). The
  // single action waits ~250ms to see if a second click makes it a double.
  const handleOpenClick = (): void => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      window.mmp.openDiscDialog()
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      onOpen()
    }, 250)
  }

  return (
    <div className="empty-state">
      <img className="brand-logo" src={logoUrl} alt="" draggable={false} />
      <div
        className="brand-name"
        role="img"
        aria-label="Lunoir"
        style={{ WebkitMaskImage: `url(${wordmarkUrl})`, maskImage: `url(${wordmarkUrl})` }}
      />
      <div className="brand-tagline">{t('empty.tagline')}</div>

      {urlInput ? (
        <div
          className="url-box"
          onContextMenu={e => {
            e.preventDefault()
            setUrlInput(false)
          }}
        >
          <input
            className="url-input"
            autoFocus
            spellCheck={false}
            placeholder={t('empty.urlPlaceholder')}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitUrl()
              else if (e.key === 'Escape') setUrlInput(false)
            }}
          />
          <button className="url-go" onClick={submitUrl} title={t('empty.urlPlay')}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M8 5 L18 12 L8 19 Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="cta-wrap">
          {/* left-click opens a file; right-click jumps straight to the URL box */}
          <button
            className="open-btn"
            onClick={handleOpenClick}
            onContextMenu={e => {
              e.preventDefault()
              setUrlInput(true)
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M8 8l4-4 4 4M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
            </svg>
            {t('empty.openFile')}
          </button>
          <div className="cta-hint">{t('empty.hint')}</div>
        </div>
      )}

      {/* settings reachable before any media plays (the OSC gear is hidden then) */}
      <button
        className="settings-entry"
        title={t('common.settings')}
        onClick={() => window.mmp.togglePanel('settings')}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54A.49.49 0 0013.9 2h-3.84c-.24 0-.44.17-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87a.49.49 0 00.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      </button>
    </div>
  )
}
