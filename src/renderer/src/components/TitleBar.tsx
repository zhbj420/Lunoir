import { useT } from '../useT'

export default function TitleBar({ title }: { title: string }) {
  const t = useT()
  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <span className="title-text">{title}</span>
      </div>
      <div className="window-controls">
        <button className="win-btn" title={t('win.minimize')} onClick={() => window.mmp.minimize()}>
          <svg width="12" height="12" viewBox="0 0 10 10">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button className="win-btn" title={t('win.maximize')} onClick={() => window.mmp.toggleMaximize()}>
          <svg width="12" height="12" viewBox="0 0 10 10">
            <rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button className="win-btn win-close" title={t('win.close')} onClick={() => window.mmp.close()}>
          <svg width="12" height="12" viewBox="0 0 10 10">
            <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1" />
            <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  )
}
