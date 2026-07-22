<p align="center">
  <img src="assets/logo.png" alt="Lunoir player" width="30%">
</p>

<img src="assets/Lunoir.png" alt="Lunoir player" width="20%">

### A beautiful media player for Windows — think **IINA**, powered by **mpv**.

Frameless and frosted-glass, plays essentially anything, and built for people who
care about frame accuracy and colour fidelity. Electron + React wrapping an
[mpv](https://mpv.io/) core in a clean Win11 acrylic UI.

![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6)
![License](https://img.shields.io/badge/license-MIT-green)
![Languages](https://img.shields.io/badge/languages-9-blueviolet)
[![Latest release](https://img.shields.io/github/v/release/zhbj420/Lunoir?label=download&color=blueviolet)](https://github.com/zhbj420/Lunoir/releases/latest)

## ⬇️ Download

**[→ Get the latest release](https://github.com/zhbj420/Lunoir/releases/latest)** — grab
`Lunoir-<version>-setup.exe` (installer) or `-portable.exe` (no install needed). Windows 10 / 11.

> The build is unsigned, so Windows SmartScreen may warn on first run — click
> **More info → Run anyway**.

> Lunoir is an **independent** project, not affiliated with or endorsed by
> [IINA](https://iina.io/) or [mpv](https://mpv.io/) — the interface is *inspired by*
> IINA's design; none of IINA's code is used. Early and actively developed, so expect
> the occasional rough edge.

## Screenshots

<p align="center">
  <img src="docs/screenshots/playing.png" alt="Lunoir playing a video — the floating OSC frosts the frame" width="100%">
</p>

| Home | Settings | Audio &amp; subtitle tracks |
| :---: | :---: | :---: |
| ![Home screen](docs/screenshots/home.png) | ![Settings panel](docs/screenshots/settings.png) | ![Audio and subtitle track panel](docs/screenshots/panel.png) |

## Why Lunoir?

VLC is everywhere but dated; PotPlayer is powerful but closed and bundles extras;
MPC-HC is light but looks like 2009; [**mpv**](https://mpv.io/) is the best engine
going but ships no real GUI. Lunoir is the missing middle: **mpv's rendering
quality in a genuinely nice Windows interface** — essentially *IINA for Windows*.
Open source (MIT), no telemetry, no ads, no bundleware.

## Features

**Playback (mpv core)**
- Plays essentially everything mpv/FFmpeg does — MKV, MP4, MOV, TS, M2TS, WebM…
- `gpu-next` rendering: Dolby Vision, HDR10 / HDR10+ tone-mapping, 10-bit
- Blu-ray / DVD disc **folders** (`bd://` / `dvd://`), plays the main title
- Online video & **playlists** via yt-dlp (YouTube, etc.)
- **Live TV / IPTV** — load `.m3u` / `.txt` channel lists (local or URL); channels
  group by their `group-title` into collapsible, searchable sections. Live streams
  show a `● LIVE` badge with one-tap “go live”, and can be **recorded** to MKV
  (stream-copy, no re-encode)
- **Timeline** *(experimental)* — watch a folder of clips as **one continuous
  video** (a single seek bar with clip-boundary ticks), and **trim each clip's
  in/out** with draggable handles on the bar. Built on mpv's native EDL — no
  re-encoding, no temp files left behind

**Interface**
- Floating IINA-style OSC that frosts the video (real Win11 acrylic window)
- Acrylic side panels — playlist / chapters / audio & subtitle tracks, and settings
- **Playlist** you can actually manage — drag to reorder, multi-select
  (Ctrl / Shift), double-click to play, batch-delete
- **收藏 — a frosted “saved & recent” launcher**: recently played (local + URL),
  plus saved files, URLs, playlists, and IPTV sources — each renamable and
  deletable. Save the current queue as a playlist or the current channel list as a
  source, right from the panel
- **9 interface languages** — English, 简体中文, Français, Deutsch, Español,
  Português, Русский, 日本語, 한국어 (auto-detects your Windows language)
- Frameless, drag-and-drop, opens files straight from Explorer (file associations)
- Right-click context menu, remembers window size & volume

**For frame-accurate work**
- Time / **timecode** (SMPTE `HH:MM:SS:FF`) / **frame-number** readout — click to cycle
- True single-frame stepping, and an optional always-on corner **burn-in** that
  screenshots capture
- Rich track info via MediaInfo — commercial audio names (Dolby TrueHD / Atmos,
  DTS-HD) and an HDR-flavour badge (DV / HDR10 / HDR10+)

**Niceties**
- Screenshots (PNG / JPG, with or without subtitles, custom folder, named by title + position)
- **Subtitle styling** — font, size, spacing, outline, position — plus per-video
  delay / position / size / brightness tweaks
- A-B loop, playback speed (keeps pitch), shuffle / repeat, auto-load external subtitles
- Audio passthrough (bitstream to a receiver), adjustable OSC auto-hide delay
- Resume playback — per file *and* per playlist

## Requirements

- Windows 10 / 11 (acrylic effects look best on Win11)
- [Node.js](https://nodejs.org/) 18+ (to build from source)

## Getting started

```bash
npm install      # install dependencies
npm run setup    # download mpv + MediaInfo into resources/
npm run dev      # launch in development
```

## Building an installer

```bash
npm run dist     # produce a Windows installer in dist/
```

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space / K | Play / Pause |
| ← / → | Seek ∓5s |
| ← / → | Step frame (When Paused) |
| ↑ / ↓ | Volume ±5 |
| F | Fullscreen |
| M | Mute |
| Ctrl+O | Open file |

More actions live in the **right-click menu** and the **settings panel**.

## How it works

mpv renders video into the main window via `--wid` and is controlled over a JSON
IPC named pipe. The frosted controls (OSC) and the side panels are **separate
Win11 acrylic child windows** layered over the video — the only way to get the
system frosted-glass effect to actually sample the mpv video underneath. The
React renderer is window-agnostic; the Electron main process owns mpv, the
windows, and their layout/animation.

## Credits

Powered by [mpv](https://mpv.io/), [FFmpeg](https://ffmpeg.org/),
[yt-dlp](https://github.com/yt-dlp/yt-dlp) and
[MediaInfo](https://mediaarea.net/en/MediaInfo); UI inspired by
[IINA](https://iina.io/). See [CREDITS.md](CREDITS.md) for licenses.

## Acknowledgments

Built by [@zhbj420](https://github.com/zhbj420) together with [Claude](https://www.anthropic.com/claude) (Anthropic) as a pair-programmer — from the first prototype to this release.

## License

[MIT](LICENSE) © 2026 Yao666
