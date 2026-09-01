// Fix fr.ts: replace U+2018 (E2 80 98) and U+2019 (E2 80 99) curly apostrophes
// with escaped straight apostrophes \' so single-quoted TS strings stay valid.
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'i18n', 'fr.ts')

// Read as raw bytes and replace the UTF-8 sequences for U+2018 and U+2019
let buf = readFileSync(file)

// U+2018 = E2 80 98, U+2019 = E2 80 99
// Replace both with 0x27 (straight apostrophe) — single byte for three bytes
// We'll do it via string replacement on the hex representation, or just Buffer.from:

const src = buf.toString('binary') // latin1: preserves raw bytes as codepoints 0-255

// E2 80 98 and E2 80 99 as binary strings
const lsquo = '\xe2\x80\x98'
const rsquo = '\xe2\x80\x99'

let fixed = src
let countL = 0, countR = 0
while (fixed.includes(lsquo)) { fixed = fixed.replace(lsquo, "\\'"); countL++ }
while (fixed.includes(rsquo)) { fixed = fixed.replace(rsquo, "\\'"); countR++ }

writeFileSync(file, Buffer.from(fixed, 'binary'))
console.log(`replaced ${countL} U+2018 and ${countR} U+2019 curly quotes`)
