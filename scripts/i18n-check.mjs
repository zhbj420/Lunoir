// Checks every locale dictionary against en.ts (the source of truth) and reports:
//   - missing keys   (in en, not translated — will silently fall back to English)
//   - stale keys     (in the locale, but no longer in en — dead weight)
//   - duplicate keys (same key twice in one file — a hand-editing slip; the second
//                     wins and the first is silently lost)
//   - placeholder drift ({n}/{v}/… present in en but missing from the translation,
//                     or vice versa — the value would render a literal or a blank)
// Exits non-zero if anything is wrong, so it can gate a build. Missing keys are a
// warning, not a failure, since the English fallback keeps the UI working — but
// they're still printed.  Run: npm run i18n-check
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'i18n')

// Every "'key':" (or "key":) at the start of a line. Values are always strings, so
// there's no risk of matching inside one — proven by the parity counts.
function parse(file) {
  const src = readFileSync(join(dir, file), 'utf8')
  const keys = []
  const dupes = new Set()
  const seen = new Set()
  const re = /^\s*(?:'|")([\w.]+)(?:'|")\s*:/gm
  let m
  while ((m = re.exec(src))) {
    const k = m[1]
    if (seen.has(k)) dupes.add(k)
    else seen.add(k)
    keys.push(k)
  }
  return { keys, dupes, values: extractValues(src) }
}

// Map key -> concatenated string-literal value (handles the few multi-line entries
// where the value sits on the next line). Good enough to find {placeholders}.
function extractValues(src) {
  const lines = src.split('\n')
  const out = {}
  const keyRe = /^\s*(?:'|")([\w.]+)(?:'|")\s*:\s*(.*)$/
  for (let i = 0; i < lines.length; i++) {
    const m = keyRe.exec(lines[i])
    if (!m) continue
    let rest = m[2].trim()
    if (rest === '') rest = (lines[i + 1] || '').trim() // value on the next line
    out[m[1]] = rest
  }
  return out
}

const placeholders = s => new Set([...(s || '').matchAll(/\{(\w+)\}/g)].map(x => x[1]))
const same = (a, b) => a.size === b.size && [...a].every(x => b.has(x))

const files = readdirSync(dir).filter(f => /\.ts$/.test(f) && f !== 'index.ts' && f !== 'en.ts')
const en = parse('en.ts')
const enKeys = new Set(en.keys)

let problems = 0
let warnings = 0
console.log(`reference: en.ts (${enKeys.size} keys)\n`)

for (const file of files) {
  const loc = parse(file)
  const locKeys = new Set(loc.keys)
  const missing = [...enKeys].filter(k => !locKeys.has(k))
  const stale = [...locKeys].filter(k => !enKeys.has(k))
  const dupes = [...loc.dupes]
  const drift = [...locKeys]
    .filter(k => enKeys.has(k))
    .filter(k => !same(placeholders(en.values[k]), placeholders(loc.values[k])))

  const flags = []
  if (missing.length) { flags.push(`${missing.length} missing`); warnings += missing.length }
  if (stale.length) { flags.push(`${stale.length} STALE`); problems += stale.length }
  if (dupes.length) { flags.push(`${dupes.length} DUPLICATE`); problems += dupes.length }
  if (drift.length) { flags.push(`${drift.length} PLACEHOLDER`); problems += drift.length }

  const tag = flags.length ? flags.join(', ') : 'ok'
  console.log(`${file.padEnd(9)} ${locKeys.size}/${enKeys.size}  ${tag}`)
  if (missing.length) console.log(`   missing:      ${missing.join(', ')}`)
  if (stale.length) console.log(`   stale:        ${stale.join(', ')}`)
  if (dupes.length) console.log(`   duplicate:    ${dupes.join(', ')}`)
  if (drift.length) console.log(`   placeholder:  ${drift.join(', ')}`)
}

console.log('')
if (problems) {
  console.error(`✗ ${problems} problem(s) — stale/duplicate/placeholder keys must be fixed.`)
  process.exit(1)
}
if (warnings) {
  console.log(`△ ${warnings} missing key(s) — will fall back to English. Not a failure.`)
} else {
  console.log('✓ all locales complete and consistent.')
}
