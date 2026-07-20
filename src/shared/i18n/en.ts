// English UI strings — the source of truth AND the fallback for every other
// locale. Adding a key here is what makes it translatable; `Key` below is
// derived from this object, so a typo at a call site is a compile error.
//
// Not in here on purpose: the brand name (Lunoir), format/codec names (HDR10,
// Dolby Atmos, DTS:X, PGS, SubRip…), channel layouts and font family names.
// Those read the same in every language and translating them would be wrong.
export const en = {
  // ---- window controls ----
  'win.minimize': 'Minimize',
  'win.maximize': 'Maximize',
  'win.close': 'Close',

  // ---- empty state (no media loaded) ----
  'empty.tagline': 'Drop a video anywhere to play',
  'empty.urlPlaceholder': 'Paste a video or stream URL…',
  'empty.urlPlay': 'Play',
  'empty.openFile': 'Open File',
  'empty.hint': 'Double-click for a folder · right-click for a URL',

  // ---- OSC ----
  // Mute/unmute and play/pause are separate keys, not one "Play/Pause" label:
  // the button already swaps its icon with state, so the tooltip should follow.
  'osc.mute': 'Mute',
  'osc.unmute': 'Unmute',
  'osc.play': 'Play',
  'osc.pause': 'Pause',
  'osc.back': 'Back {n}s',
  'osc.forward': 'Forward {n}s',
  // opens the right panel, which is three tabs (Audio & Sub / Playlist /
  // Chapters) and lands on Audio & Sub — so "Playlist" alone undersells it
  'osc.panel': 'Tracks & playlist',
  'osc.timeFormat': 'Click to cycle: time · timecode · frame',

  // ---- shared across surfaces ----
  'common.settings': 'Settings'
}

export type Key = keyof typeof en
