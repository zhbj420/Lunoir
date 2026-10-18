/**
 * Turn however a track spells its language into a name in the interface language.
 *
 * Track titles and sidecar filenames name languages in whatever the release group felt
 * like: `chs`, `sc`, `zh-CN`, `简`, `ChsEng`, `chs&eng`, `简英`… The old lookup was a flat
 * English map keyed by 3-letter codes, so anything else fell through and got shouted back
 * as `ZH-CN`, simplified and traditional were both just "Chinese", and the names stayed
 * English however the app was set.
 *
 * So: normalise the spelling to a BCP-47 tag, then let ICU name it — `Intl.DisplayNames`
 * covers every locale we ship, which is why none of these names need translating by hand.
 */

// spelling → BCP-47. Only whole tokens match, so `cn` in a title can't trip on a word.
const TOKEN: Record<string, string> = {
  // Chinese — the messiest, because scripts and regions both stand in for the script
  chs: 'zh-Hans', sc: 'zh-Hans', gb: 'zh-Hans', gbk: 'zh-Hans', zhs: 'zh-Hans',
  hans: 'zh-Hans', cn: 'zh-Hans', 'zh-cn': 'zh-Hans', 'zh-sg': 'zh-Hans',
  'zh-hans': 'zh-Hans', 'zh-hans-cn': 'zh-Hans',
  cht: 'zh-Hant', tc: 'zh-Hant', big5: 'zh-Hant', zht: 'zh-Hant', hant: 'zh-Hant',
  tw: 'zh-Hant', hk: 'zh-Hant', 'zh-tw': 'zh-Hant', 'zh-hk': 'zh-Hant',
  'zh-hant': 'zh-Hant', 'zh-hant-tw': 'zh-Hant',
  chi: 'zh', zho: 'zh', zh: 'zh',
  // everything else: ISO 639-1/2/B spellings that actually turn up
  eng: 'en', en: 'en', english: 'en',
  jpn: 'ja', jp: 'ja', ja: 'ja',
  kor: 'ko', kr: 'ko', ko: 'ko',
  fra: 'fr', fre: 'fr', fr: 'fr', deu: 'de', ger: 'de', de: 'de',
  spa: 'es', es: 'es', ita: 'it', it: 'it', rus: 'ru', ru: 'ru',
  por: 'pt', pt: 'pt', dut: 'nl', nld: 'nl', nl: 'nl', pol: 'pl', pl: 'pl',
  tha: 'th', th: 'th', vie: 'vi', vi: 'vi', ara: 'ar', ar: 'ar',
  hin: 'hi', hi: 'hi', ind: 'id', id: 'id', tur: 'tr', tr: 'tr', turkish: 'tr',
  swe: 'sv', sv: 'sv', dan: 'da', da: 'da', nor: 'no', no: 'no',
  fin: 'fi', fi: 'fi', ces: 'cs', cze: 'cs', cs: 'cs',
  ell: 'el', gre: 'el', el: 'el', heb: 'he', he: 'he',
  hun: 'hu', hu: 'hu', ukr: 'uk', uk: 'uk'
}

// CJK, longest first so 简体 wins over a bare 简. A word can name two languages (双语).
const CJK: [string, string[]][] = [
  ['简体中文', ['zh-Hans']], ['繁體中文', ['zh-Hant']], ['繁体中文', ['zh-Hant']],
  ['简中', ['zh-Hans']], ['繁中', ['zh-Hant']], ['简体', ['zh-Hans']],
  ['繁體', ['zh-Hant']], ['繁体', ['zh-Hant']], ['正體', ['zh-Hant']], ['正体', ['zh-Hant']],
  ['双语', ['zh', 'en']], ['雙語', ['zh', 'en']], // in practice always 中英
  ['中文', ['zh']], ['英文', ['en']], ['日文', ['ja']], ['日語', ['ja']], ['日语', ['ja']],
  ['韓語', ['ko']], ['韩语', ['ko']], ['한국어', ['ko']],
  ['简', ['zh-Hans']], ['繁', ['zh-Hant']], ['中', ['zh']],
  ['英', ['en']], ['日', ['ja']], ['韩', ['ko']], ['韓', ['ko']]
]

// kept as-is next to the language: they say something the language name doesn't
const DESCRIPTOR = /\b(sdh|cc|forced|hi)\b|特效|精校|官方|强制|默认/gi

/**
 * Split into candidate tokens: separators, and camelCase (`ChsEng` → chs, eng). The hyphen
 * survives, because it's part of a tag we want whole (`zh-CN`, `zh-Hans`) — `_` is folded
 * into it so `zh_CN` isn't torn into two languages.
 */
function tokenise(raw: string): string[] {
  return raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/_/g, '-')
    .split(/[^a-z0-9㐀-鿿가-힯-]+/)
    .filter(Boolean)
}

/** `chseng` / `sceng` — no separator, no camelCase. Try every split that leaves two
 *  known tokens; 2 chars is the shortest real code (sc, tc, cn, en…). */
function splitGlued(tok: string): string[] | null {
  for (let i = 2; i <= tok.length - 2; i++) {
    const a = TOKEN[tok.slice(0, i)]
    const b = TOKEN[tok.slice(i)]
    if (a && b && a !== b) return [a, b]
  }
  return null
}

/** Every language named in a string, in the order they appear, deduped. */
export function parseLangTags(raw: string): string[] {
  if (!raw) return []
  const out: string[] = []
  const add = (tag: string): void => {
    if (!out.includes(tag)) out.push(tag)
  }
  const eat = (tok: string): void => {
    if (TOKEN[tok]) {
      add(TOKEN[tok])
      return
    }
    // a hyphenated pair that isn't a tag of its own is two languages: `zh-en`
    if (tok.includes('-')) {
      const parts = tok.split('-').filter(Boolean)
      if (parts.length > 1 && parts.some(p => TOKEN[p])) {
        parts.forEach(eat)
        return
      }
    }
    const glued = splitGlued(tok)
    if (glued) {
      glued.forEach(add)
      return
    }
    // CJK: walk the token, taking the longest match at each position
    let rest = tok
    while (rest) {
      const hit = CJK.find(([word]) => rest.startsWith(word))
      if (hit) {
        hit[1].forEach(add)
        rest = rest.slice(hit[0].length)
      } else {
        rest = rest.slice(1)
      }
    }
  }
  tokenise(raw).forEach(eat)
  return out
}

const NAMERS = new Map<string, Intl.DisplayNames>()
function namer(locale: string): Intl.DisplayNames {
  let dn = NAMERS.get(locale)
  if (!dn) {
    dn = new Intl.DisplayNames([locale], { type: 'language' })
    NAMERS.set(locale, dn)
  }
  return dn
}

/** "chs&eng" → "简体中文·英语" (zh UI) / "Simplified Chinese·English" (en UI). */
export function langLabel(raw: string | undefined, locale: string): string {
  const tags = parseLangTags(raw || '')
  if (!tags.length) return ''
  const dn = namer(locale)
  return tags
    .map(tag => {
      try {
        return dn.of(tag) || tag
      } catch {
        return tag // a tag ICU doesn't know — show it rather than nothing
      }
    })
    .join('·')
}

/** SDH / Forced / 特效 … — worth keeping, and not a language. */
export function langDescriptors(raw: string | undefined): string {
  const found = (raw || '').match(DESCRIPTOR)
  if (!found) return ''
  const seen: string[] = []
  for (const f of found) {
    const norm = /[a-z]/i.test(f) ? f.toUpperCase() : f
    if (!seen.includes(norm)) seen.push(norm)
  }
  return seen.join(' ')
}
