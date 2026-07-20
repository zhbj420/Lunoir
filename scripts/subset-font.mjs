// Builds the bundled CJK UI font: every non-ASCII character that appears in the
// source (i18n strings, hardcoded labels, fullwidth punctuation) is subset out
// of Noto Sans SC and written as a small woff2 the renderer @font-face's under
// the family name "Lunoir Sans SC". Re-run after adding or changing Chinese UI
// text: node scripts/subset-font.mjs
//
// Why Noto and not the system fonts: measured across a line at UI sizes, Noto's
// ink bottoms vary by ~0.2-0.3 device px per 21px em vs ~0.7-0.8px for
// Microsoft YaHei UI / SimHei, so short lines sit visibly flatter. The wght
// variation axis is kept so font-weight 500+ gets real Medium, not faux bold.
//
// The source font is not committed (17 MB); the generated subset is. The script
// reads the variable font from NOTO_SC_VF or the Windows font folder — grab
// NotoSansSC[wght].ttf from https://github.com/notofonts/noto-cjk if missing.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import subsetFont from 'subset-font'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'src', 'renderer', 'src', 'assets', 'fonts')
const outFont = join(outDir, 'LunoirSansSC.woff2')
const outChars = join(outDir, 'subset-chars.txt')

const source =
  process.env.NOTO_SC_VF ??
  ['C:\\Windows\\Fonts\\NotoSansSC-VF.ttf', 'C:\\Windows\\Fonts\\NotoSansSC[wght].ttf'].find(existsSync)
if (!source || !existsSync(source)) {
  console.error('Noto Sans SC variable font not found. Install it or point NOTO_SC_VF at NotoSansSC[wght].ttf')
  process.exit(1)
}

// Every non-ASCII char in src/**/*.ts|tsx. Sweeping comments too is deliberate:
// a few stray glyphs cost ~1 KB each, while missing one shows up as a mixed-font
// line in the UI.
async function collectChars(dir, set) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await collectChars(p, set)
    else if (/\.(ts|tsx)$/.test(e.name)) {
      for (const ch of readFileSync(p, 'utf8')) if (ch.codePointAt(0) > 0x7f) set.add(ch)
    }
  }
}

const chars = new Set()
await collectChars(join(root, 'src'), chars)
const text = [...chars].sort().join('')

const woff2 = await subsetFont(readFileSync(source), text, { targetFormat: 'woff2' })
mkdirSync(outDir, { recursive: true })
writeFileSync(outFont, woff2)
writeFileSync(outChars, text) // committed alongside so glyph-set changes show in diffs

console.log(`${chars.size} glyphs from ${source}`)
console.log(`→ ${outFont} (${(woff2.length / 1024).toFixed(1)} KB)`)
