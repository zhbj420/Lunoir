import { useState } from 'react'
import logoUrl from '../assets/logo.png'
import wordmarkUrl from '../assets/Lunoir.png'

export default function EmptyState({ onOpen }: { onOpen: () => void }) {
  const [action, setAction] = useState<'file' | 'url'>('file')
  const [urlInput, setUrlInput] = useState(false)
  const [url, setUrl] = useState('')

  const submitUrl = () => {
    const u = url.trim()
    if (u) window.mmp.loadFile(u)
  }

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    setAction(a => (a === 'file' ? 'url' : 'file'))
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
      <div className="brand-tagline">Drop a video anywhere to play</div>

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
            placeholder="Paste a video or stream URL…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitUrl()
              else if (e.key === 'Escape') setUrlInput(false)
            }}
          />
          <button className="url-go" onClick={submitUrl} title="Play">
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M8 5 L18 12 L8 19 Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="cta-wrap">
          <button
            className={`open-btn ${action === 'url' ? 'is-url' : ''}`}
            onClick={() => (action === 'file' ? onOpen() : setUrlInput(true))}
            onContextMenu={toggle}
          >
            {action === 'file' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15V4M8 8l4-4 4 4M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 15l6-6M8 9h1M14 6l1-1a3.5 3.5 0 015 5l-1 1M10 18l-1 1a3.5 3.5 0 01-5-5l1-1" />
              </svg>
            )}
            {action === 'file' ? 'Open File' : 'Open URL'}
          </button>
          <div className="cta-hint">
            Right-click to {action === 'file' ? 'open a URL' : 'open a file'}
          </div>
        </div>
      )}
    </div>
  )
}
