export default function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-logo">
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="36" r="34" stroke="currentColor" strokeWidth="2" opacity="0.5" />
          <path d="M29 25 L50 36 L29 47 Z" fill="currentColor" />
        </svg>
      </div>
      <h1>MMPlayer</h1>
      <p>拖入视频文件，或点击下方按钮打开</p>
      <button className="open-btn" onClick={onOpen}>
        打开文件
      </button>
    </div>
  )
}
