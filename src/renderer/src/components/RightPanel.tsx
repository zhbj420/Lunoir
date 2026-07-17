import { useEffect, useState } from 'react'

type Tab = 'playlist' | 'chapters'
type RepeatMode = 'off' | 'all' | 'one'
interface Playlist {
  items: { path: string; name: string }[]
  index: number
  repeat: RepeatMode
}
interface Chapter {
  title?: string
  time: number
}

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0
  const s = Math.floor(t % 60)
  const m = Math.floor((t / 60) % 60)
  const h = Math.floor(t / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// The right-hand context panel. Tabbed so it can grow: Playlist and Chapters
// now, Tracks (audio + subtitle) later.
export default function RightPanel({ open }: { open: boolean }) {
  const [tab, setTab] = useState<Tab>('playlist')
  const [pl, setPl] = useState<Playlist>({ items: [], index: -1, repeat: 'off' })
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [curChapter, setCurChapter] = useState(-1)

  // playlist state, pushed from main
  useEffect(() => {
    let mounted = true
    window.mmp.getPlaylist().then(p => mounted && setPl(p))
    return window.mmp.onPlaylistChanged(p => setPl(p))
  }, [])

  // chapters: fetch on mount / file change, and follow live position
  useEffect(() => {
    let mounted = true
    const refresh = async () => {
      try {
        const list = await window.mmp.command(['get_property', 'chapter-list'])
        if (mounted) setChapters(Array.isArray(list) ? list : [])
      } catch {
        if (mounted) setChapters([])
      }
      try {
        const c = await window.mmp.command(['get_property', 'chapter'])
        if (mounted) setCurChapter(typeof c === 'number' ? c : -1)
      } catch {
        if (mounted) setCurChapter(-1)
      }
    }
    refresh()
    const off = window.mmp.onProperty(({ name, data }) => {
      if (name === 'chapter') setCurChapter(typeof data === 'number' ? data : -1)
      else if (name === 'chapter-list') setChapters(Array.isArray(data) ? (data as Chapter[]) : [])
      else if (name === 'path' || name === 'filename') refresh()
    })
    return () => {
      mounted = false
      off()
    }
  }, [])

  const repeat: RepeatMode = pl.repeat

  return (
    <div className={`panel ${open ? 'open' : ''}`}>
      <div className="panel-tabs">
        <button className={`panel-tab ${tab === 'playlist' ? 'active' : ''}`} onClick={() => setTab('playlist')}>
          Playlist
        </button>
        <button className={`panel-tab ${tab === 'chapters' ? 'active' : ''}`} onClick={() => setTab('chapters')}>
          Chapters
        </button>
        <span className="panel-tabs-spacer" />
      </div>

      {tab === 'playlist' ? (
        <>
          <div className="panel-body">
            {pl.items.length === 0 ? (
              <div className="panel-empty">Nothing queued</div>
            ) : (
              pl.items.map((it, i) => (
                <div
                  key={it.path}
                  className={`pl-item ${i === pl.index ? 'active' : ''}`}
                  title={it.name}
                  onClick={() => window.mmp.playIndex(i)}
                >
                  <span className="pl-mark">
                    {i === pl.index ? (
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
                        <path d="M1 0.5 L8 4.5 L1 8.5 Z" />
                      </svg>
                    ) : (
                      <span className="pl-idx">{i + 1}</span>
                    )}
                  </span>
                  <span className="pl-name">{it.name}</span>
                </div>
              ))
            )}
          </div>

          <div className="panel-tools">
            <button
              className={`tool ${repeat !== 'off' ? 'on' : ''}`}
              title={repeat === 'off' ? 'Repeat: off' : repeat === 'all' ? 'Repeat: all' : 'Repeat: one'}
              onClick={() => window.mmp.cycleRepeat()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3l3 3-3 3" />
                <path d="M20 6H8a4 4 0 0 0-4 4v1" />
                <path d="M7 21l-3-3 3-3" />
                <path d="M4 18h12a4 4 0 0 0 4-4v-1" />
              </svg>
              {repeat === 'one' && <span className="tool-badge">1</span>}
            </button>
            <button className="tool" title="Shuffle" onClick={() => window.mmp.shufflePlaylist()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 4l3 3-3 3" />
                <path d="M3 20h4c1.3 0 2.5-.6 3.3-1.7L15 11" />
                <path d="M3 7h4c1.3 0 2.5.6 3.3 1.7l.7 1" />
                <path d="M18 20l3-3-3-3" />
                <path d="M21 17h-4c-.9 0-1.8-.3-2.5-.9" />
              </svg>
            </button>
            <span className="panel-tools-spacer" />
            <button className="tool" title="Add files" onClick={() => window.mmp.addToPlaylist()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              className="tool"
              title="Remove current"
              disabled={pl.index < 0}
              onClick={() => pl.index >= 0 && window.mmp.removeFromPlaylist(pl.index)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16" />
                <path d="M6 7l1 13h10l1-13" />
                <path d="M9 7V4h6v3" />
              </svg>
            </button>
          </div>
        </>
      ) : (
        <div className="panel-body">
          {chapters.length === 0 ? (
            <div className="panel-empty">No chapters</div>
          ) : (
            chapters.map((ch, i) => (
              <div
                key={i}
                className={`pl-item ${i === curChapter ? 'active' : ''}`}
                onClick={() => window.mmp.set('chapter', i)}
              >
                <span className="pl-mark">
                  {i === curChapter ? (
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
                      <path d="M1 0.5 L8 4.5 L1 8.5 Z" />
                    </svg>
                  ) : (
                    <span className="pl-idx">{i + 1}</span>
                  )}
                </span>
                <span className="pl-name">{ch.title || `Chapter ${i + 1}`}</span>
                <span className="pl-time">{fmt(ch.time)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
