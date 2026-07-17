# MMPlayer

A media player with an [mpv](https://mpv.io/) core and an [IINA](https://iina.io/)-inspired interface, built with Electron + React.

## Architecture

- **Core**: `mpv.exe` embedded via `--wid` for video rendering, controlled over a JSON IPC named pipe.
- **Main process** (`src/main`): spawns/controls mpv, manages a two-window setup — a frameless *video window* (mpv output) with a transparent *UI window* floating on top for the controls.
- **Renderer** (`src/renderer`): React UI — floating OSC control bar, title bar, drag-and-drop, keyboard shortcuts.

## Setup

```bash
npm install      # install dependencies
npm run setup    # download mpv.exe into resources/mpv/
npm run dev      # launch in development
```

## Build

```bash
npm run dist     # produce a Windows installer in dist/
```

## Shortcuts

| Key | Action |
| --- | --- |
| Space / K | Play / Pause |
| ← / → | Seek ∓5s |
| ↑ / ↓ | Volume ±5 |
| F | Fullscreen |
| M | Mute |
| Ctrl+O | Open file |

## Status

First milestone: basic playback (open, play/pause, seek, volume, fullscreen).
Planned: playlist, subtitle/audio track switching, speed control, screenshots, filters.
