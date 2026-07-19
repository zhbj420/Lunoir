# Credits & third-party notices

Lunoir's own source code is released under the [MIT License](LICENSE). It stands
on the shoulders of the following projects, each under its own license. Lunoir
does **not** bundle their binaries in this repository — `npm run setup` downloads
them at build time from the sources below.

| Component | Role | License | Source |
| --- | --- | --- | --- |
| [mpv](https://mpv.io/) | Playback core (invoked as a separate process over IPC) | GPLv2+ / LGPLv2.1+ | Windows build by [shinchiro/mpv-winbuild-cmake](https://github.com/shinchiro/mpv-winbuild-cmake) |
| [FFmpeg](https://ffmpeg.org/) | Demuxing / decoding (inside mpv) | LGPL/GPL | bundled within the mpv build |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Online video / playlist resolution | Unlicense (public domain) | downloaded on demand |
| [MediaInfo](https://mediaarea.net/en/MediaInfo) | Track metadata (commercial codec names, HDR flavour) | BSD-2-Clause-style | [MediaArea/MediaInfo](https://github.com/MediaArea/MediaInfo) |
| [Electron](https://www.electronjs.org/) | App shell | MIT | — |
| [React](https://react.dev/) + [electron-vite](https://electron-vite.org/) | UI framework / build | MIT | — |

The interface is inspired by [IINA](https://iina.io/) (design only — no IINA code
is used).

## A note on distributing builds

Because mpv is invoked as a **separate process** over an IPC pipe (not linked or
compiled in), Lunoir's own code can be MIT-licensed. If you distribute a packaged
build that ships `mpv.exe` alongside it, that redistribution is subject to mpv's
GPL/LGPL terms — include mpv's license and a pointer to its corresponding source
(the shinchiro build above already provides this).
