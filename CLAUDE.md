# Lunoir — working notes for Claude

## i18n: translating a UI surface

Hand-rolled i18n in `src/shared/i18n/` (~40 lines, no library — main process needs
it too and install size is watched). How it fits together:

- `en.ts` is the source of truth: adding a key there is what makes a string
  translatable, and the `Key` type is derived from it, so a typo at a call site
  is a compile error.
- Every non-English locale is `Partial` on purpose — a missing key falls back to
  English, never to a raw key on screen.
- **Nine locales ship**: `en`, `zh-CN`, `fr`, `de`, `es`, `pt`, `ru`, `ja`, `ko`.
  en + zh are the ones we can vet; the other seven are a best-effort first pass
  (correctable per-key thanks to the fallback). The whole UI is already
  translated — there are no hardcoded strings left to extract.
- Renderer components: `const t = useT()` (from `src/renderer/src/useT.ts`), then
  `t('some.key')` / `t('osc.back', { n: 5 })`. One locale store per window;
  components re-render on language change automatically.
- Main process: `import { translate, effectiveLocale } from '../shared/i18n'`;
  `tr()` in `index.ts` wraps it.

**Adding a string:** put it in `en.ts` under a sensible prefix (`set.*`, `panel.*`,
`menu.*`…) — the `Key` type is derived from `en`, so a call-site typo is a compile
error. Then add it to `zh-CN.ts` (vet this yourself), and to the other seven
(best-effort). Do NOT translate: brand name (Lunoir), format/codec names (HDR10,
Dolby Atmos, PGS…), channel layouts, font family names — see the header in `en.ts`.

**After adding/removing/renaming any key: `npm run i18n-check`.** It reports, per
locale: missing keys (warning — English covers them), and stale keys / duplicate
keys / placeholder drift (failures — those silently drop or mangle a string). Green
means all nine dictionaries are in parity.

The empty-state / hero copy lives under the `empty.*` keys.

## After ANY change to Chinese UI text: `npm run subset-font`

The app bundles a ~100 KB Noto Sans SC subset (`'Lunoir Sans SC'`,
`src/renderer/src/assets/fonts/LunoirSansSC.woff2`) containing exactly the non-ASCII
characters found in `src/**/*.ts|tsx` — **Chinese only**: the script skips the other
locale dictionaries (`fr`/`de`/`ja`/`ko`/… use Segoe UI or system CJK fonts, so
their accents/kana/hangul must NOT pollute this SC-only bundle). New Chinese text
(incl. fullwidth punctuation) is NOT in the subset until you re-run
`npm run subset-font`, which rebuilds it from `C:\Windows\Fonts\NotoSansSC-VF.ttf`
(or `$env:NOTO_SC_VF`). Commit the regenerated `.woff2` + `subset-chars.txt`.

(Japanese and Korean deliberately use the system faces — Meiryo / Malgun Gothic,
keyed off `:root[lang^='ja'|'ko']` in `styles.css`; the CJK size/spacing bumps key
off a `data-cjk` attribute `useT` sets for zh/ja/ko alike. No bundling for those.)

Symptom of a missed glyph: one character in a line renders in a different font
(YaHei fallback) — slightly different weight/height. Fix = re-run the script.

## CJK typography rules (measured, don't relitigate — see git history of styles.css)

- Any element that can render Chinese: `font-size >= 14px`, and only sizes that
  are a whole number of device pixels at 150 % DPI (14, 16, 18… — never 13px or
  12.5px, which land on half device pixels). Below 21 device px per em, hanzi
  strokes alias and lines look uneven in any font. English tolerates small/
  fractional sizes; hanzi don't.
- **The English type scale is LOCKED. Never change a shared size/tracking/
  line-height declaration to make Chinese bigger — it silently enlarges the
  English the user already tuned against.** Scope every Chinese bump under
  `:root[lang^='zh'] .thing { … }` and leave the base rule (= the English value)
  untouched. The user reads the two languages against each other and *will* catch
  a drifted English size; I have shipped this regression more than once. When a
  surface's Chinese needs to be bigger/looser, add a `zh` override, don't edit the
  base. (Sizes that were only ever English — OSC time, format badges — stay shared.)
- Chinese `font-weight: 500+` is fine — the bundled subset keeps the variable
  wght axis, so it's real Medium/Bold, not faux.
- Characters like 可/即/双/开 sitting slightly lower/smaller at their tops is
  font-design optical compensation, present in every CJK font and in print. Not
  a bug; don't try to fix it.
- Don't add letter-spacing to Chinese beyond the existing `--ui-tracking`.

## Conventions

- The user reads Chinese; talk to them in Chinese, keep code/comments in English.
- Before opening a dev instance, announce it and let the user position windows;
  they test on a touchscreen (`@media (hover: hover)` gates all hover styles).
- Watch install size (benchmark: MPC-HC ~20 MB). devDependencies are free;
  runtime payload is not.
