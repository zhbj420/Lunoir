import { useState } from 'react'
import logoUrl from '../assets/logo.png'
import wordmarkUrl from '../assets/Lunoir.png'

export default function EmptyState({ onOpen }: { onOpen: () => void }) {
  const [urlInput, setUrlInput] = useState(false)
  const [url, setUrl] = useState('')

  const submitUrl = () => {
    const u = url.trim()
    if (u) window.mmp.loadFile(u)
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
          {/* left-click opens a file; right-click jumps straight to the URL box */}
          <button
            className="open-btn"
            onClick={onOpen}
            onContextMenu={e => {
              e.preventDefault()
              setUrlInput(true)
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V4M8 8l4-4 4 4M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
            </svg>
            Open File
          </button>
          <div className="cta-hint">Right-click to open a URL</div>
        </div>
      )}
    </div>
  )
}
