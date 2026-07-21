import { useCallback, useSyncExternalStore } from 'react'
import { effectiveLocale, translate, type Key, type LangSetting, type Locale } from '@shared/i18n'

// One locale store per window. Each of our windows (main / OSC / panels / menu)
// is its own JS context, so this module runs once per window and costs a single
// settings:changed subscription — not one per component.
//
// The initial value comes from the browser locale so the very first paint is
// already in the right language; the persisted setting arrives a tick later and
// overrides it (only visible if the user picked a language that differs from
// the OS one, and only for that first frame).
let locale: Locale = effectiveLocale('system', navigator.language)
const listeners = new Set<() => void>()

// styles.css keys off two things on <html>:
//  - lang: picks the per-language font stack (zh → bundled SC; ja/ko → system CJK).
//  - data-cjk: set for every CJK locale (zh/ja/ko), drives the shared size/spacing
//    bumps those scripts need at small sizes, so we don't repeat the selectors per
//    language. Latin/Cyrillic locales leave it off and keep the tuned English sizes.
const CJK = new Set(['zh-CN', 'ja', 'ko'])
function markHtml(loc: Locale): void {
  const el = document.documentElement
  el.lang = loc
  if (CJK.has(loc)) el.setAttribute('data-cjk', '')
  else el.removeAttribute('data-cjk')
}
markHtml(locale)

function apply(next: Locale): void {
  if (next === locale) return
  locale = next
  markHtml(next)
  listeners.forEach(l => l())
}

const fromSettings = (s: { uiLanguage?: LangSetting }): Locale =>
  effectiveLocale(s.uiLanguage, navigator.language)

window.mmp.getSettings().then(s => apply(fromSettings(s)))
window.mmp.onSettingsChanged(s => apply(fromSettings(s)))

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export type T = (key: Key, vars?: Record<string, string | number>) => string

/** Translate function bound to the current interface language. Re-renders the
 *  calling component when the language changes. */
export function useT(): T {
  const loc = useSyncExternalStore(subscribe, () => locale)
  return useCallback<T>((key, vars) => translate(loc, key, vars), [loc])
}
