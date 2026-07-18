// Downloads the Windows binaries MMPlayer bundles:
//   · mpv.exe        → resources/mpv/        (the playback core)
//   · MediaInfo.exe  → resources/mediainfo/  (per-track metadata: bitrate + audio format)
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
const mpvDir = join(root, 'resources', 'mpv')
const mpvExe = join(mpvDir, 'mpv.exe')
const miDir = join(root, 'resources', 'mediainfo')
const miExe = join(miDir, 'MediaInfo.exe')

function log(...a) { console.log(...a) }

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

// Extract only files named `name` from the archive, flat (no nested dirs), into
// outDir. Uses 7za's `e` (extract-flat) with a recursive filename filter so we
// pull a single tool out of an archive without unpacking the whole thing.
function extractFileFlat(archive, name, outDir) {
  return new Promise((resolve, reject) => {
    sevenBin.cmd(['e', archive, `-o${outDir}`, name, '-r', '-y'], err =>
      err ? reject(err) : resolve()
    )
  })
}

// ---------------------------------------------------------------- mpv --------

// shinchiro/mpv-winbuild-cmake publishes rolling mpv releases with .7z assets.
// We pick the baseline x86_64 build (not the v3/AVX2 one) for max compatibility.
const MPV_RELEASES_API =
  'https://api.github.com/repos/shinchiro/mpv-winbuild-cmake/releases?per_page=5'

async function findMpvAsset() {
  log('→ Querying latest mpv release...')
  const res = await fetch(MPV_RELEASES_API, {
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

// mpv archives may nest files under a subfolder; flatten mpv.exe + dlls into destDir.
function flatten(dir, destDir) {
  const entries = readdirSync(dir)
  for (const name of entries) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      flatten(p, destDir)
      try { rmSync(p, { recursive: true, force: true }) } catch {}
    } else {
      const target = join(destDir, name)
      if (p !== target && !existsSync(target)) renameSync(p, target)
    }
  }
}

async function setupMpv() {
  if (existsSync(mpvExe)) {
    log('✔ mpv already present at', mpvExe)
    return
  }
  mkdirSync(mpvDir, { recursive: true })
  const asset = await findMpvAsset()
  const archive = join(tmpdir(), asset.name)
  await download(asset.browser_download_url, archive)

  // Extract straight into destDir (same drive) to avoid cross-device rename issues,
  // then flatten any nested folder the archive may contain.
  log('→ Extracting mpv...')
  await extract7z(archive, mpvDir)
  flatten(mpvDir, mpvDir)
  try { rmSync(archive, { force: true }) } catch {}

  if (!existsSync(mpvExe)) throw new Error('mpv.exe not found after extraction')
  log('✔ mpv ready at', mpvExe)
}

// ----------------------------------------------------------- MediaInfo -------

// MediaInfo CLI reads per-track metadata (bitrate + commercial audio format like
// "DTS-HD Master Audio" / "Dolby TrueHD with Dolby Atmos") that mpv can't report
// for non-active tracks. It's a purpose-built metadata parser: a single ~9MB
// self-contained MediaInfo.exe (no codec bundle), BSD-licensed. Binaries live on
// mediaarea.net; we resolve the latest version tag from GitHub.
const MI_RELEASE_API = 'https://api.github.com/repos/MediaArea/MediaInfo/releases/latest'
const MI_FALLBACK_VERSION = '26.05' // used if the GitHub API is unreachable

async function findMediaInfoVersion() {
  try {
    const res = await fetch(MI_RELEASE_API, {
      headers: { 'User-Agent': 'mmplayer-setup', Accept: 'application/vnd.github+json' }
    })
    if (res.ok) {
      const rel = await res.json()
      const v = String(rel.tag_name || '').replace(/^v/i, '').trim()
      if (/^\d+\.\d+/.test(v)) return v
    }
  } catch {
    /* fall through to pinned version */
  }
  return MI_FALLBACK_VERSION
}

async function setupMediaInfo() {
  if (existsSync(miExe)) {
    log('✔ MediaInfo already present at', miExe)
    return
  }
  mkdirSync(miDir, { recursive: true })
  const version = await findMediaInfoVersion()
  const url = `https://mediaarea.net/download/binary/mediainfo/${version}/MediaInfo_CLI_${version}_Windows_x64.zip`
  const archive = join(tmpdir(), `mediainfo-cli-${version}.zip`)
  await download(url, archive)

  log('→ Extracting MediaInfo.exe...')
  await extractFileFlat(archive, 'MediaInfo.exe', miDir)
  try { rmSync(archive, { force: true }) } catch {}

  if (!existsSync(miExe)) throw new Error('MediaInfo.exe not found after extraction')
  log('✔ MediaInfo ready at', miExe)
}

async function main() {
  await setupMpv()
  await setupMediaInfo()
}

main().catch(err => {
  console.error('✖ setup failed:', err.message)
  console.error('  You can manually place mpv.exe into resources/mpv/ and')
  console.error('  MediaInfo.exe (CLI) into resources/mediainfo/.')
  process.exit(1)
})
