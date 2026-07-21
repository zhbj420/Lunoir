// Hand-rolled i18n. No library on purpose: we need this in the main process too
// (toasts, dialogs, the app menu), we don't need plural engines or async
// backends, and the install size is something we watch. It's ~40 lines.
import { en, type Key } from './en'
import { zhCN } from './zh-CN'
import { fr } from './fr'
import { de } from './de'
import { es } from './es'
import { pt } from './pt'
import { ru } from './ru'

export type { Key }

/** Locales with an actual translation. Latin/Cyrillic ones (fr/de/es/pt/ru) all
 *  render with the same Segoe UI stack as English — no font work, unlike zh. */
export type Locale = 'en' | 'zh-CN' | 'fr' | 'de' | 'es' | 'pt' | 'ru'
/** What the setting stores — 'system' follows the OS. */
export type LangSetting = 'system' | Locale

const DICTS: Record<Locale, Partial<Record<Key, string>>> = {
  en,
  'zh-CN': zhCN,
  fr,
  de,
  es,
  pt,
  ru
}

/** Options for the interface-language dropdown. Each label is in its own
 *  language — someone who lands on the wrong one still has to find their way
 *  out. ('System' is the exception; it's resolved, not chosen.) */
export const LANG_OPTIONS: { value: LangSetting; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' }
]

/** Map an OS locale tag ('zh-Hans-CN', 'de-AT', 'pt-BR'…) to what we ship. Matches
 *  on the primary subtag; regional variants collapse to the base language. Anything
 *  unmatched (incl. Traditional Chinese — wrong-script is worse than untranslated)
 *  falls through to English. */
export function resolveSystemLocale(tag: string): Locale {
  if (/^zh(-|_)?(hans|cn|sg)?$/i.test(tag) || /^zh-hans/i.test(tag)) return 'zh-CN'
  const base = tag.slice(0, 2).toLowerCase()
  if (base === 'fr' || base === 'de' || base === 'es' || base === 'pt' || base === 'ru') {
    return base
  }
  return 'en'
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
