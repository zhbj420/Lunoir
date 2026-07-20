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
  'common.settings': 'Settings',
  'common.collapse': 'Collapse panel',
  'common.default': 'Default',

  // ---- settings panel ----
  // Register: plain, complete sentences. State what the setting does and what it
  // costs. No jokes, no winking asides, no "your call".
  'set.sec.interface': 'Interface',
  'set.sec.playlist': 'Playlist',
  'set.sec.audioSubs': 'Audio & subtitles',
  'set.sec.subAppearance': 'Subtitle appearance',
  'set.sec.video': 'Video',
  'set.sec.screenshots': 'Screenshots',
  'set.sec.controls': 'Controls',
  'set.sec.window': 'Window',

  'set.uiLang.label': 'Interface language',
  'set.uiLang.desc':
    "The language used for Lunoir's menus and settings. Separate from the preferred audio and subtitle languages below, which select tracks within the video.",

  // Multi-line descriptions carry their own \n breaks; the renderer splits on them
  // so each language wraps where it reads best, rather than at a fixed English break.

  'set.scanFolder.label': 'Scan folder into playlist',
  'set.scanFolder.desc': 'When you open a file, also queue the other videos in its folder.',
  'set.resume.label': 'Resume playback',
  'set.resume.desc': 'Remember the position in each file and return to it when the file is reopened.',
  'set.resumePlaylist.label': 'Resume playlists',
  'set.resumePlaylist.desc': 'Reopening a playlist link returns to the last video watched in it.',

  'set.keepPitch.label': 'Keep pitch when changing speed',
  'set.keepPitch.desc':
    'Time-stretch the audio so voices keep their natural pitch at higher playback speeds.',
  'set.passthrough.label': 'Audio passthrough',
  'set.passthrough.desc':
    'Send compressed audio as a bitstream to an external receiver or DAC, which decodes it instead of Lunoir.\nRequires hardware that supports the format. Unsupported formats will play no sound.',
  'set.audioLang.label': 'Preferred audio language',
  'set.subLang.label': 'Preferred subtitle language',
  // Audio and subtitle share the same English wording but have separate keys so
  // the Chinese can say "audio track" vs "subtitle" in each.
  'set.audioLang.desc':
    "Select this language automatically when a file is opened.\nDefault uses the file's own track order.",
  'set.subLang.desc':
    "Select this language automatically when a file is opened.\nDefault uses the file's own track order.",
  'set.subsDefault.label': 'Subtitles on by default',
  'set.autoLoadSubs.label': 'Auto-load external subtitles',
  'set.autoLoadSubs.desc': 'Load matching .srt and .ass files found alongside the video.',
  'set.hdrSubPeak.label': 'HDR subtitle brightness',
  'set.hdrSubPeak.desc':
    'Peak luminance, in nits, for text subtitles (SRT/ASS) over HDR video. Lower values are dimmer.\nImage subtitles (PGS, as used on Blu-ray) are not supported by mpv. SDR playback is unaffected.',

  'set.subFont.label': 'Font',
  'set.subFont.desc':
    'Applies to text subtitles (SRT/ASS without their own styling). Choose a face with full coverage of your subtitle language; missing glyphs fall back to another face mid-sentence.',
  'set.subSize.label': 'Font size',
  'set.subSpacing.label': 'Letter spacing',
  'set.subSpacing.desc': 'Additional space between characters.',
  'set.subOutline.label': 'Outline',
  'set.subOutline.desc':
    'Thickness of the dark border that keeps subtitles legible over bright scenes.',
  'set.subBold.label': 'Bold',
  'set.subMargin.label': 'Distance from bottom',
  'set.subMargin.desc':
    'The default resting position. Adjust ▸ subtitle position in the right panel offsets the current video without changing this value.',

  'set.hwdec.label': 'Hardware decoding',
  'set.hwdec.auto': 'GPU decoding. Most efficient, as frames stay in video memory.',
  'set.hwdec.autoCopy':
    'GPU decoding with frames copied back to system memory. Required by CPU filters such as SVP.',
  'set.hwdec.off': 'Software decoding on the CPU. Most compatible, but more demanding.',
  'set.quality.label': 'Online video quality',
  'set.quality.desc':
    'An upper limit. Actual quality still depends on the source: a video capped at 1080p plays at 1080p regardless of this setting. Best selects the highest the source offers. Applies to the next stream.',
  'set.cookies.label': 'Use browser cookies',
  'set.cookies.desc':
    'Reads cookies from your signed-in browser so member, age-restricted and Premium videos can play. Disabled by default.',
  'set.cookiesFrom.label': 'Cookies from',

  'set.shotSubs.label': 'Include subtitles',
  'set.shotSubs.desc': 'Include the on-screen subtitles in the saved image.',
  'set.shotFormat.label': 'Format',
  'set.shotFormat.desc':
    'PNG is lossless. JPG produces much smaller files at quality 95, where the loss is close to invisible.',
  'set.shotDir.label': 'Save folder',
  'set.shotDir.desc': 'Where screenshots are saved. Enter a path or browse for one.',
  'set.shotDir.browse': 'Browse…',

  'set.oscDelay.label': 'Auto-hide delay',
  'set.oscDelay.desc1':
    'How long the on-screen controls remain visible after the pointer stops moving.',
  'set.oscDelay.desc2': 'Default is 5 seconds.',

  'set.rememberWindow.label': 'Remember size & position',
  'set.rememberVolume.label': 'Remember volume',

  // option lists (format, codec and browser names are never translated)
  'opt.hwdec.auto': 'Auto',
  'opt.hwdec.autoCopy': 'Auto (copy back)',
  'opt.hwdec.off': 'Off (software)',
  'opt.quality.best': 'Best',
  'opt.shot.png': 'PNG (lossless)',
  'opt.shot.jpg': 'JPG (high quality)',
  'opt.subFont.system': 'System default (sans-serif)',
  'opt.lang.english': 'English',
  'opt.lang.chinese': 'Chinese',
  'opt.lang.japanese': 'Japanese',
  'opt.lang.korean': 'Korean',
  'opt.lang.french': 'French',
  'opt.lang.german': 'German',
  'opt.lang.spanish': 'Spanish',
  'opt.lang.italian': 'Italian',
  'opt.lang.russian': 'Russian',
  'opt.lang.portuguese': 'Portuguese',
  'opt.uiLang.system': 'System'
}

export type Key = keyof typeof en
