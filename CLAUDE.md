# Lunoir — working notes for Claude

## i18n: translating a UI surface

Hand-rolled i18n in `src/shared/i18n/` (~40 lines, no library — main process needs
it too and install size is watched). How it fits together:

- `en.ts` is the source of truth: adding a key there is what makes a string
  translatable, and the `Key` type is derived from it, so a typo at a call site
  is a compile error.
- `zh-CN.ts` is `Partial` on purpose — a missing key falls back to English, never
  to a raw key on screen.
- Renderer components: `const t = useT()` (from `src/renderer/src/useT.ts`), then
  `t('some.key')` / `t('osc.back', { n: 5 })`. One locale store per window;
  components re-render on language change automatically.
- Main process: `import { translate, effectiveLocale } from '../shared/i18n'`.

To translate a surface (SettingsPanel, RightPanel, MenuView and OverlayView still
have hardcoded strings): move each literal into `en.ts` under a sensible prefix
(`set.*`, `panel.*`, `menu.*`…), add the Chinese to `zh-CN.ts`, replace the
literal with `t(...)`. Do NOT translate: the brand name (Lunoir), format/codec
names (HDR10, Dolby Atmos, PGS…), channel layouts, font family names — see the
header comment in `en.ts`.

The empty-state / hero copy lives under the `empty.*` keys in both files.

## After ANY change to Chinese UI text: `npm run subset-font`

The app bundles a ~25 KB Noto Sans SC subset (`'Lunoir Sans SC'`,
`src/renderer/src/assets/fonts/LunoirSansSC.woff2`) containing exactly the
non-ASCII characters found in `src/**/*.ts|tsx`. New Chinese text (including
fullwidth punctuation) is NOT in the subset until you re-run
`npm run subset-font`, which rebuilds it from `C:\Windows\Fonts\NotoSansSC-VF.ttf`
(or `$env:NOTO_SC_VF`). Commit the regenerated `.woff2` + `subset-chars.txt`.

Symptom of a missed glyph: one character in a line renders in a different font
(YaHei fallback) — slightly different weight/height. Fix = re-run the script.

## CJK typography rules (measured, don't relitigate — see git history of styles.css)

- Any element that can render Chinese: `font-size >= 14px`, and only sizes that
  are a whole number of device pixels at 150 % DPI (14, 16, 18… — never 13px or
  12.5px, which land on half device pixels). Below 21 device px per em, hanzi
  strokes alias and lines look uneven in any font. English tolerates small/
  fractional sizes; hanzi don't.
- The stylesheet still has ~30 declarations at 10–13.5px from the English-only
  era. When translating a surface, bump the ones that now carry Chinese.
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
