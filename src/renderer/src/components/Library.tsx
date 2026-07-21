import { useEffect, useRef, useState } from 'react'
import { useT } from '../useT'

// Mirrors the preload RecentEntry/FavEntry shape (renderer can't import from preload).
type Kind = 'file' | 'url' | 'list' | 'playlist'
interface Entry {
  target: string
  name: string
  kind: Kind
  at: number
  channels?: { name: string; url: string; group: string }[]
  items?: { path: string; name: string }[]
}
type Tab = 'recent' | 'saved' | 'playlists' | 'live'

export default function Library() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('recent') // 最近 has content on first open
  const [recents, setRecents] = useState<Entry[]>([])
  const [favs, setFavs] = useState<Entry[]>([])
  const [editing, setEditing] = useState<string | null>(null) // target being renamed
  const [draft, setDraft] = useState('')
  const revert = useRef(false)

  const startRename = (e: Entry): void => {
    revert.current = false
    setDraft(e.name)
    setEditing(e.target)
  }
  const commitRename = (): void => {
    const tgt = editing
    if (tgt && !revert.current && draft.trim()) window.mmp.renameFavourite(tgt, draft)
    revert.current = false
    setEditing(null)
  }

  useEffect(() => {
    const loadR = (): void => void window.mmp.getRecents().then(setRecents)
    const loadF = (): void => void window.mmp.getFavourites().then(setFavs)
    loadR()
    loadF()
    const offR = window.mmp.onRecentsChanged(loadR)
    const offF = window.mmp.onFavouritesChanged(loadF)
    return () => {
      offR()
      offF()
    }
  }, [])

  const play = (target: string): void => window.mmp.playTarget(target) // main closes the overlay

  // one flat store of favourites, split by kind across the tabs
  const saved = favs.filter(e => e.kind === 'file' || e.kind === 'url')
  const playlists = favs.filter(e => e.kind === 'playlist')
  const live = favs.filter(e => e.kind === 'list')
  const list = tab === 'recent' ? recents : tab === 'saved' ? saved : tab === 'playlists' ? playlists : live
  const empty =
    tab === 'recent'
      ? t('lib.emptyRecent')
      : tab === 'saved'
        ? t('lib.emptyFav')
        : tab === 'playlists'
          ? t('lib.emptyPlaylists')
          : t('lib.emptyLive')

  const TABS: { id: Tab; label: string }[] = [
    { id: 'recent', label: t('lib.recent') },
    { id: 'saved', label: t('lib.favourites') },
    { id: 'playlists', label: t('lib.playlists') },
    { id: 'live', label: t('lib.live') }
  ]

  return (
    <div className="library">
      <div className="lib-head">
        <div className="lib-tabs">
          {TABS.map(x => (
            <button key={x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <button className="lib-close" title={t('common.close')} onClick={() => window.mmp.closeLibrary()}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6 L18 18 M18 6 L6 18" />
          </svg>
        </button>
      </div>

      <div className="lib-body">
        {list.length === 0 ? (
          <div className="lib-empty">{empty}</div>
        ) : (
          <ul className="lib-list">
            {list.map(e => {
              const count = e.channels?.length ?? e.items?.length
              return (
                <li
                  key={e.target}
                  className="lib-row"
                  onClick={() => editing !== e.target && play(e.target)}
                  title={e.target}
                >
                  <KindIcon kind={e.kind} />
                  {editing === e.target ? (
                    <input
                      className="lib-name-edit"
                      autoFocus
                      spellCheck={false}
                      value={draft}
                      onClick={ev => ev.stopPropagation()}
                      onChange={ev => setDraft(ev.target.value)}
                      onBlur={commitRename}
                      onKeyDown={ev => {
                        ev.stopPropagation()
                        if (ev.key === 'Enter') ev.currentTarget.blur()
                        else if (ev.key === 'Escape') {
                          revert.current = true
                          ev.currentTarget.blur()
                        }
                      }}
                    />
                  ) : (
                    <span className="lib-name">{e.name}</span>
                  )}
                  {count != null && <span className="lib-count">{count}</span>}
                  <div className="lib-actions" onClick={ev => ev.stopPropagation()}>
                    {tab === 'recent' ? (
                      <>
                        <button className="lib-act" title={t('lib.addFav')} onClick={() => window.mmp.addFavourite(e.target)}>
                          <IcStarOutline />
                        </button>
                        <button className="lib-act" title={t('lib.remove')} onClick={() => window.mmp.removeRecent(e.target)}>
                          <IcClose />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="lib-act" title={t('lib.rename')} onClick={() => startRename(e)}>
                          <IcPencil />
                        </button>
                        <button className="lib-act" title={t('lib.remove')} onClick={() => window.mmp.removeFavourite(e.target)}>
                          <IcTrash />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function KindIcon({ kind }: { kind: Kind }) {
  if (kind === 'url')
    return (
      <svg className="lib-kind" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M9.5 14.5 L14.5 9.5 M8 11 L6 13 a3.5 3.5 0 0 0 5 5 l2-2 M16 13 l2-2 a3.5 3.5 0 0 0 -5 -5 l-2 2" />
      </svg>
    )
  if (kind === 'playlist')
    return (
      <svg className="lib-kind" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7 h11 M5 11 h11 M5 15 h6 M16 13 l5 3 -5 3 Z" />
      </svg>
    )
  if (kind === 'list')
    return (
      <svg className="lib-kind" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5 h11 M4 9 h11 M4 13 h7 M18 12 v7 l3 -1.6 M18 12 a2.4 2.4 0 1 0 0 4.8" />
      </svg>
    )
  return (
    <svg className="lib-kind" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="14" rx="1.6" />
      <path d="M10 9 L15 12 L10 15 Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

const IcStarOutline = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M12 4 l2.35 4.9 5.4.7 -3.95 3.7 1.0 5.3 -4.8 -2.6 -4.8 2.6 1.0 -5.3 -3.95 -3.7 5.4 -.7 Z" />
  </svg>
)
const IcTrash = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 7 h14 M10 7 V5 h4 v2 M6.5 7 l.8 12 a1 1 0 0 0 1 .9 h7.4 a1 1 0 0 0 1 -.9 l.8 -12" />
  </svg>
)
const IcClose = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" />
  </svg>
)
const IcPencil = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20 h4 L18.5 9.5 a1.5 1.5 0 0 0 -4 -4 L4 16 Z M13.5 6.5 l4 4" />
  </svg>
)
