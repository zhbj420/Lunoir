// Downloads a Windows build of mpv (mpv.exe) and extracts it into resources/mpv/.
// Run with: npm run setup
import { createWriteStream, existsSync, mkdirSync, rmSync, readdirSync, statSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import sevenBin from '7zip-min'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const destDir = join(root, 'resources', 'mpv')
const mpvExe = join(destDir, 'mpv.exe')

if (existsSync(mpvExe)) {
  console.log('✔ mpv already present at', mpvExe)
  process.exit(0)
}

// shinchiro/mpv-winbuild-cmake publishes rolling mpv releases with .7z assets.
// We pick the baseline x86_64 build (not the v3/AVX2 one) for max compatibility.
const RELEASES_API = 'https://api.github.com/repos/shinchiro/mpv-winbuild-cmake/releases?per_page=5'

function log(...a) { console.log(...a) }

async function findAsset() {
  log('→ Querying latest mpv release...')
  const res = await fetch(RELEASES_API, {
    headers: { 'User-Agent': 'mmplayer-setup', Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const releases = await res.json()
  for (const rel of releases) {
    const assets = rel.assets || []
    // baseline: mpv-x86_64-YYYYMMDD-git-xxxx.7z  (exclude -v3-)
    const asset = assets.find(a => /^mpv-x86_64-\d.*\.7z$/i.test(a.name) && !/-v3-/i.test(a.name))
      || assets.find(a => /^mpv-x86_64-.*\.7z$/i.test(a.name) && !/-v3-/i.test(a.name))
    if (asset) return asset
  }
  throw new Error('No suitable mpv asset found in recent releases')
}

async function download(url, out) {
  log('→ Downloading', url)
  const res = await fetch(url, { headers: { 'User-Agent': 'mmplayer-setup' } })
  if (!res.ok || !res.body) throw new Error(`Download failed ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(out))
}

function extract7z(archive, outDir) {
  return new Promise((resolve, reject) => {
    sevenBin.unpack(archive, outDir, err => (err ? reject(err) : resolve()))
  })
}

// mpv archives may nest files under a subfolder; flatten mpv.exe + dlls into destDir.
function flatten(dir) {
  const entries = readdirSync(dir)
  for (const name of entries) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      flatten(p)
      try { rmSync(p, { recursive: true, force: true }) } catch {}
    } else {
      const target = join(destDir, name)
      if (p !== target && !existsSync(target)) renameSync(p, target)
    }
  }
}

async function main() {
  mkdirSync(destDir, { recursive: true })
  const asset = await findAsset()
  const archive = join(tmpdir(), asset.name)
  await download(asset.browser_download_url, archive)

  // Extract straight into destDir (same drive) to avoid cross-device rename issues,
  // then flatten any nested folder the archive may contain.
  log('→ Extracting...')
  await extract7z(archive, destDir)
  flatten(destDir)

  try { rmSync(archive, { force: true }) } catch {}

  if (!existsSync(mpvExe)) throw new Error('mpv.exe not found after extraction')
  log('✔ mpv ready at', mpvExe)
}

main().catch(err => {
  console.error('✖ setup failed:', err.message)
  console.error('  You can manually place mpv.exe into resources/mpv/')
  process.exit(1)
})
