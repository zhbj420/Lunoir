import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { LANG_OPTIONS, type LangSetting } from '@shared/i18n'
import { useT, type T } from '../useT'

// Render a translated string that carries \n line breaks as separate lines. The
// break points live in the copy (and differ between languages), not in the JSX.
const multiline = (s: string): ReactNode =>
  s.split('\n').map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ))

// Mirrors main/settings.ts (the renderer defines its own view of shared shapes,
// like the other components here). uiLanguage is the exception — its type comes
// from src/shared, which both sides can import.
interface Settings {
  uiLanguage: LangSetting
  scanFolderIntoPlaylist: boolean
  resumePlayback: boolean
  resumePlaylistItem: boolean
  keepPitch: boolean
  audioLang: string
  subLang: string
  subsDefaultOn: boolean
  autoLoadSubs: boolean
  subFont: string
  subFontSize: number
  subSpacing: number
  subBold: boolean
  subOutline: number
  subMarginY: number
  audioPassthrough: boolean
  passthroughCodecs: string
  oscHideDelay: number
  subHdrPeak: number
  hwdec: 'auto' | 'auto-copy' | 'no'
  streamQuality: 'best' | '2160' | '1080' | '720' | '480'
  useCookies: boolean
  cookiesBrowser: string
  timeFormat: 'time' | 'timecode' | 'frame'
  timecodeOverlay: boolean
  screenshotSubs: boolean
  screenshotFormat: 'png' | 'jpg'
  screenshotDir: string
  rememberWindow: boolean
  rememberVolume: boolean
  volume: number
  windowBounds: { x: number; y: number; width: number; height: number } | null
}

type Opt = { value: string; label: string }

// Option lists that carry prose are built from `t` at render time so they follow a
// language change like everything else. Format, codec, browser and font-family
// names are NOT translated — they read the same in every language.

// Short, value-dependent explanation shown under Hardware decoding.
const hwdecDesc = (t: T): Record<Settings['hwdec'], string> => ({
  auto: t('set.hwdec.auto'),
  'auto-copy': t('set.hwdec.autoCopy'),
  no: t('set.hwdec.off')
})

const hwdecOpts = (t: T): Opt[] => [
  { value: 'auto', label: t('opt.hwdec.auto') },
  { value: 'auto-copy', label: t('opt.hwdec.autoCopy') },
  { value: 'no', label: t('opt.hwdec.off') }
]
const qualityOpts = (t: T): Opt[] => [
  { value: 'best', label: t('opt.quality.best') },
  { value: '2160', label: '2160p (4K)' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' }
]
// Subtitle faces. mpv's own default ('sans-serif') resolves to whatever the system
// picks, which on Japanese releases often lacks Simplified-only glyphs (们/吗) and
// substitutes just those characters — visibly clashing mid-line.
const subFontOpts = (t: T): Opt[] => [
  { value: 'Microsoft YaHei', label: '微软雅黑 (Microsoft YaHei)' },
  { value: 'Microsoft JhengHei', label: '微軟正黑體 (JhengHei)' },
  { value: 'SimHei', label: '黑体 (SimHei)' },
  { value: 'Source Han Sans SC', label: '思源黑体 (Source Han Sans)' },
  { value: 'Noto Sans CJK SC', label: 'Noto Sans CJK' },
  { value: 'Yu Gothic UI', label: '游ゴシック (Yu Gothic)' },
  { value: 'Segoe UI', label: 'Segoe UI' },
  { value: 'sans-serif', label: t('opt.subFont.system') }
]

const screenshotFmtOpts = (t: T): Opt[] => [
  { value: 'png', label: t('opt.shot.png') },
  { value: 'jpg', label: t('opt.shot.jpg') }
]
// mpv audio-spdif codec names → human labels (Atmos rides on TrueHD, DTS:X on DTS-HD)
const PASSTHROUGH_CODECS = [
  { code: 'ac3', label: 'Dolby Digital (AC-3)' },
  { code: 'eac3', label: 'Dolby Digital Plus' },
  { code: 'truehd', label: 'Dolby TrueHD / Atmos' },
  { code: 'dts', label: 'DTS' },
  { code: 'dts-hd', label: 'DTS-HD / DTS:X' }
]
const BROWSER_OPTS: Opt[] = [
  { value: 'edge', label: 'Edge' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'brave', label: 'Brave' },
  { value: 'opera', label: 'Opera' }
]
// language codes match track tags (a few carry variants, e.g. Chinese chi/zho)
const langOpts = (t: T): Opt[] => [
  { value: '', label: t('common.default') },
  { value: 'eng', label: t('opt.lang.english') },
  { value: 'chi,zho', label: t('opt.lang.chinese') },
  { value: 'jpn', label: t('opt.lang.japanese') },
  { value: 'kor', label: t('opt.lang.korean') },
  { value: 'fre', label: t('opt.lang.french') },
  { value: 'ger', label: t('opt.lang.german') },
  { value: 'spa', label: t('opt.lang.spanish') },
  { value: 'ita', label: t('opt.lang.italian') },
  { value: 'rus', label: t('opt.lang.russian') },
  { value: 'por', label: t('opt.lang.portuguese') }
]
// 'System' is the only translatable label here — the rest name themselves.
const uiLangOpts = (t: T): Opt[] =>
  LANG_OPTIONS.map(o => (o.value === 'system' ? { ...o, label: t('opt.uiLang.system') } : o))

// Custom dropdown — native <select> popups render broken in this frameless window.
// The list is portaled to <body> (escaping the panel's transform + overflow) and
// positioned at the trigger via fixed coords; it closes on outside click / scroll.
function Select({ value, options, onChange }: { value: string; options: Opt[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const label = options.find(o => o.value === value)?.label ?? value

  const openMenu = (): void => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const listH = options.length * 32 + 8 // item height (28) + gap, keep in sync with .set-dropdown-item
    const up = r.bottom + listH > window.innerHeight - 8
    setBox({ top: up ? r.top - listH - 4 : r.bottom + 4, left: r.left, width: r.width })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (): void => setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('wheel', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('wheel', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        className={`set-dropdown ${open ? 'open' : ''}`}
        onMouseDown={e => e.stopPropagation()}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <span className="set-dropdown-label">{label}</span>
        <svg className="set-dropdown-chev" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open &&
        box &&
        createPortal(
          <div
            className="set-dropdown-list"
            style={{ top: box.top, left: box.left, minWidth: box.width }}
            onMouseDown={e => e.stopPropagation()}
          >
            {options.map(o => (
              <button
                key={o.value}
                className={`set-dropdown-item ${o.value === value ? 'sel' : ''}`}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}

// A small editable number field: type + Enter/blur commits (clamped to [min,max]).
function NumInput({
  value,
  min,
  max,
  onChange
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const [text, setText] = useState<string | null>(null)
  const commit = (): void => {
    if (text === null) return
    const n = parseInt(text, 10)
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
    setText(null)
  }
  return (
    <input
      className="set-num-input"
      type="text"
      inputMode="numeric"
      value={text !== null ? text : String(value)}
      onChange={e => setText(e.target.value)}
      onFocus={e => {
        setText(String(value))
        e.currentTarget.select()
      }}
      onBlur={commit}
      onKeyDown={e => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          commit()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          setText(null)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`switch ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    >
      <span className="switch-knob" />
    </button>
  )
}

// A labelled row: title + optional description on the left, a control on the right.
function Row({
  label,
  desc,
  children
}: {
  label: string
  desc?: React.ReactNode
  children: React.ReactNode
}) {
  // Label and control share the top line; the description sits BELOW them at full
  // panel width. Keeping the description out of the flex row gives every one of
  // them the same right edge (the panel's), which is what lets justify line up —
  // when it shared the row, a wide control (a dropdown) squeezed it to a different
  // width than a narrow one (a toggle), so no two blocks aligned.
  return (
    <div className="set-row">
      <div className="set-head">
        <div className="set-label">{label}</div>
        <div className="set-control">{children}</div>
      </div>
      {desc && <div className="set-desc">{desc}</div>}
    </div>
  )
}

// Left-hand settings panel (opened from the OSC gear). Reads/writes settings via
// the main process; changes apply immediately.
export default function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const [s, setS] = useState<Settings | null>(null)
  const [pathEdit, setPathEdit] = useState<string | null>(null) // non-null while typing the folder

  useEffect(() => {
    window.mmp.getSettings().then(setS)
    return window.mmp.onSettingsChanged(setS)
  }, [])

  // optimistic local update + persist to main
  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    setS(prev => (prev ? { ...prev, [key]: value } : prev))
    window.mmp.setSetting(key, value)
  }

  const browseFolder = async (): Promise<void> => {
    const dir = await window.mmp.pickFolder()
    if (dir) set('screenshotDir', dir)
  }

  // passthrough codec set (persisted as a comma list, kept in a canonical order)
  const hasCodec = (c: string): boolean => (s?.passthroughCodecs ?? '').split(',').includes(c)
  const toggleCodec = (c: string, on: boolean): void => {
    const cur = new Set((s?.passthroughCodecs ?? '').split(',').filter(Boolean))
    if (on) cur.add(c)
    else cur.delete(c)
    set('passthroughCodecs', PASSTHROUGH_CODECS.filter(x => cur.has(x.code)).map(x => x.code).join(','))
  }

  return (
    <div
      className={`panel left ${open ? 'open' : ''}`}
      onMouseMove={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div className="panel-tabs">
        <button className="panel-tab active">{t('common.settings')}</button>
        <span className="panel-tabs-spacer" />
        <button className="panel-collapse" title={t('common.collapse')} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l-4 4 4 4M7 4l-4 4 4 4" />
          </svg>
        </button>
      </div>

      {s && (
        <div className="panel-body settings-body">
          <div className="set-sec">{t('set.sec.interface')}</div>
          <Row label={t('set.uiLang.label')} desc={t('set.uiLang.desc')}>
            <Select
              value={s.uiLanguage}
              options={uiLangOpts(t)}
              onChange={v => set('uiLanguage', v as Settings['uiLanguage'])}
            />
          </Row>

          <div className="set-sec">{t('set.sec.playlist')}</div>
          <Row label={t('set.scanFolder.label')} desc={t('set.scanFolder.desc')}>
            <Toggle on={s.scanFolderIntoPlaylist} onChange={v => set('scanFolderIntoPlaylist', v)} />
          </Row>
          <Row label={t('set.resume.label')} desc={t('set.resume.desc')}>
            <Toggle on={s.resumePlayback} onChange={v => set('resumePlayback', v)} />
          </Row>
          <Row label={t('set.resumePlaylist.label')} desc={t('set.resumePlaylist.desc')}>
            <Toggle on={s.resumePlaylistItem} onChange={v => set('resumePlaylistItem', v)} />
          </Row>

          <div className="set-sec">{t('set.sec.audioSubs')}</div>
          <Row label={t('set.keepPitch.label')} desc={t('set.keepPitch.desc')}>
            <Toggle on={s.keepPitch} onChange={v => set('keepPitch', v)} />
          </Row>
          <Row label={t('set.passthrough.label')} desc={multiline(t('set.passthrough.desc'))}>
            <Toggle on={s.audioPassthrough} onChange={v => set('audioPassthrough', v)} />
          </Row>
          {s.audioPassthrough && (
            <div className="set-suboptions">
              {PASSTHROUGH_CODECS.map(c => (
                <Row key={c.code} label={c.label}>
                  <Toggle on={hasCodec(c.code)} onChange={v => toggleCodec(c.code, v)} />
                </Row>
              ))}
            </div>
          )}
          <Row label={t('set.audioLang.label')} desc={multiline(t('set.audioLang.desc'))}>
            <Select value={s.audioLang} options={langOpts(t)} onChange={v => set('audioLang', v)} />
          </Row>
          <Row label={t('set.subLang.label')} desc={multiline(t('set.subLang.desc'))}>
            <Select value={s.subLang} options={langOpts(t)} onChange={v => set('subLang', v)} />
          </Row>
          <Row label={t('set.subsDefault.label')}>
            <Toggle on={s.subsDefaultOn} onChange={v => set('subsDefaultOn', v)} />
          </Row>
          <Row label={t('set.autoLoadSubs.label')} desc={t('set.autoLoadSubs.desc')}>
            <Toggle on={s.autoLoadSubs} onChange={v => set('autoLoadSubs', v)} />
          </Row>
          <Row label={t('set.hdrSubPeak.label')} desc={multiline(t('set.hdrSubPeak.desc'))}>
            <div className="set-slider">
              <input
                type="range"
                className="set-range"
                min={50}
                max={400}
                step={5}
                value={Math.min(400, Math.max(50, s.subHdrPeak))}
                onChange={e => set('subHdrPeak', Number(e.target.value))}
              />
              <NumInput value={s.subHdrPeak} min={10} max={10000} onChange={v => set('subHdrPeak', v)} />
            </div>
          </Row>

          <div className="set-sec">{t('set.sec.subAppearance')}</div>
          <Row label={t('set.subFont.label')} desc={t('set.subFont.desc')}>
            <Select value={s.subFont} options={subFontOpts(t)} onChange={v => set('subFont', v)} />
          </Row>
          <Row label={t('set.subSize.label')}>
            <div className="set-slider">
              <input
                type="range"
                className="set-range"
                min={20}
                max={80}
                step={1}
                value={Math.min(80, Math.max(20, s.subFontSize))}
                onChange={e => set('subFontSize', Number(e.target.value))}
              />
              <NumInput value={s.subFontSize} min={10} max={200} onChange={v => set('subFontSize', v)} />
            </div>
          </Row>
          <Row label={t('set.subSpacing.label')} desc={t('set.subSpacing.desc')}>
            <div className="set-slider">
              <input
                type="range"
                className="set-range"
                min={-3}
                max={10}
                step={0.5}
                value={Math.min(10, Math.max(-3, s.subSpacing))}
                onChange={e => set('subSpacing', Number(e.target.value))}
              />
              <NumInput value={s.subSpacing} min={-10} max={10} onChange={v => set('subSpacing', v)} />
            </div>
          </Row>
          <Row label={t('set.subOutline.label')} desc={t('set.subOutline.desc')}>
            <div className="set-slider">
              <input
                type="range"
                className="set-range"
                min={0}
                max={10}
                step={0.5}
                value={Math.min(10, Math.max(0, s.subOutline))}
                onChange={e => set('subOutline', Number(e.target.value))}
              />
              <NumInput value={s.subOutline} min={0} max={20} onChange={v => set('subOutline', v)} />
            </div>
          </Row>
          <Row label={t('set.subBold.label')}>
            <Toggle on={s.subBold} onChange={v => set('subBold', v)} />
          </Row>
          <Row label={t('set.subMargin.label')} desc={t('set.subMargin.desc')}>
            <div className="set-slider">
              <input
                type="range"
                className="set-range"
                min={0}
                max={200}
                step={2}
                value={Math.min(200, Math.max(0, s.subMarginY))}
                onChange={e => set('subMarginY', Number(e.target.value))}
              />
              <NumInput value={s.subMarginY} min={0} max={400} onChange={v => set('subMarginY', v)} />
            </div>
          </Row>

          <div className="set-sec">{t('set.sec.video')}</div>
          <Row label={t('set.hwdec.label')} desc={hwdecDesc(t)[s.hwdec]}>
            <Select value={s.hwdec} options={hwdecOpts(t)} onChange={v => set('hwdec', v as Settings['hwdec'])} />
          </Row>
          <Row label={t('set.quality.label')} desc={t('set.quality.desc')}>
            <Select value={s.streamQuality} options={qualityOpts(t)} onChange={v => set('streamQuality', v as Settings['streamQuality'])} />
          </Row>
          <Row label={t('set.cookies.label')} desc={t('set.cookies.desc')}>
            <Toggle on={s.useCookies} onChange={v => set('useCookies', v)} />
          </Row>
          {s.useCookies && (
            <Row label={t('set.cookiesFrom.label')}>
              <Select value={s.cookiesBrowser} options={BROWSER_OPTS} onChange={v => set('cookiesBrowser', v)} />
            </Row>
          )}

          <div className="set-sec">{t('set.sec.screenshots')}</div>
          <Row label={t('set.shotSubs.label')} desc={t('set.shotSubs.desc')}>
            <Toggle on={s.screenshotSubs} onChange={v => set('screenshotSubs', v)} />
          </Row>
          <Row label={t('set.shotFormat.label')} desc={t('set.shotFormat.desc')}>
            <Select value={s.screenshotFormat} options={screenshotFmtOpts(t)} onChange={v => set('screenshotFormat', v as Settings['screenshotFormat'])} />
          </Row>
          <div className="set-row col">
            <div className="set-text">
              <div className="set-label">{t('set.shotDir.label')}</div>
              <div className="set-desc">{t('set.shotDir.desc')}</div>
            </div>
            <div className="set-path">
              <input
                className="set-path-input"
                spellCheck={false}
                value={pathEdit !== null ? pathEdit : s.screenshotDir}
                onChange={e => setPathEdit(e.target.value)}
                onFocus={() => setPathEdit(s.screenshotDir)}
                onBlur={() => {
                  if (pathEdit !== null && pathEdit.trim()) set('screenshotDir', pathEdit.trim())
                  setPathEdit(null)
                }}
                onKeyDown={e => {
                  e.stopPropagation()
                  if (e.key === 'Enter') e.currentTarget.blur()
                  else if (e.key === 'Escape') {
                    setPathEdit(null)
                    e.currentTarget.blur()
                  }
                }}
              />
              <button className="set-path-btn" title={t('set.shotDir.browse')} onClick={browseFolder}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="set-sec">{t('set.sec.controls')}</div>
          <Row
            label={t('set.oscDelay.label')}
            desc={
              <>
                {t('set.oscDelay.desc1')}
                <br />
                {t('set.oscDelay.desc2')}
              </>
            }
          >
            <div className="set-slider">
              <input
                type="range"
                className="set-range"
                min={1}
                max={15}
                step={1}
                value={Math.min(15, Math.max(1, s.oscHideDelay))}
                onChange={e => set('oscHideDelay', Number(e.target.value))}
              />
              <NumInput value={s.oscHideDelay} min={1} max={120} onChange={v => set('oscHideDelay', v)} />
            </div>
          </Row>

          <div className="set-sec">{t('set.sec.window')}</div>
          <Row label={t('set.rememberWindow.label')}>
            <Toggle on={s.rememberWindow} onChange={v => set('rememberWindow', v)} />
          </Row>
          <Row label={t('set.rememberVolume.label')}>
            <Toggle on={s.rememberVolume} onChange={v => set('rememberVolume', v)} />
          </Row>
        </div>
      )}
    </div>
  )
}
