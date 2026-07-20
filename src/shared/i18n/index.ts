// Hand-rolled i18n. No library on purpose: we need this in the main process too
// (toasts, dialogs, the app menu), we don't need plural engines or async
// backends, and the install size is something we watch. It's ~40 lines.
import { en, type Key } from './en'
import { zhCN } from './zh-CN'

export type { Key }

/** Locales with an actual translation. */
export type Locale = 'en' | 'zh-CN'
/** What the setting stores — 'system' follows the OS. */
export type LangSetting = 'system' | Locale

const DICTS: Record<Locale, Partial<Record<Key, string>>> = { en, 'zh-CN': zhCN }

/** Options for the interface-language dropdown. Each label is in its own
 *  language — someone who lands on the wrong one still has to find their way
 *  out. ('System' is the exception; it's resolved, not chosen.) */
export const LANG_OPTIONS: { value: LangSetting; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' }
]

/** Map an OS locale tag ('zh-Hans-CN', 'zh-TW', 'en-GB'…) to what we ship.
 *  Traditional Chinese deliberately falls through to English rather than being
 *  served Simplified — wrong-script is worse than untranslated. */
export function resolveSystemLocale(tag: string): Locale {
  return /^zh(-|_)?(hans|cn|sg)?$/i.test(tag) || /^zh-hans/i.test(tag) ? 'zh-CN' : 'en'
}

/** The locale actually in effect, given the setting and the OS. */
export function effectiveLocale(setting: LangSetting | undefined, systemTag: string): Locale {
  return !setting || setting === 'system' ? resolveSystemLocale(systemTag) : setting
}

/** Look up `key`, substituting {name} placeholders from `vars`.
 *  Falls back: requested locale → English → the key itself (so a missing string
 *  shows up as a visible key rather than blank). */
export function translate(
  locale: Locale,
  key: Key,
  vars?: Record<string, string | number>
): string {
  const s = DICTS[locale]?.[key] ?? en[key] ?? key
  if (!vars) return s
  return s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m))
}
