// 简体中文。Partial on purpose — a half-finished translation still compiles, and
// any key missing here falls back to English rather than showing a raw key.
import type { Key } from './en'

export const zhCN: Partial<Record<Key, string>> = {
  'win.minimize': '最小化',
  'win.maximize': '最大化',
  'win.close': '关闭',

  'empty.tagline': '拖入视频开始播放',
  'empty.urlPlaceholder': '粘贴视频或流媒体链接…',
  'empty.urlPlay': '播放',
  'empty.openFile': '打开文件',
  'empty.hint': '双击打开文件夹 · 右键打开 URL',

  'osc.mute': '静音',
  'osc.unmute': '取消静音',
  'osc.play': '播放',
  'osc.pause': '暂停',
  'osc.back': '后退 {n} 秒',
  'osc.forward': '前进 {n} 秒',
  'osc.panel': '轨道与播放列表',
  'osc.timeFormat': '点击切换:时间 · 时间码 · 帧号',

  'common.settings': '设置',
  'common.collapse': '收起面板',
  'common.default': '默认',

  // ---- 设置面板 ----
  'set.sec.interface': '界面',
  'set.sec.playlist': '播放列表',
  'set.sec.audioSubs': '音频与字幕',
  'set.sec.subAppearance': '字幕外观',
  'set.sec.video': '视频',
  'set.sec.screenshots': '截图',
  'set.sec.controls': '控制栏',
  'set.sec.window': '窗口',

  'set.uiLang.label': '界面语言',
  'set.uiLang.desc': 'Lunoir 应用自身界面语言，与音轨及字幕语言无关联。',

  'set.scanFolder.label': '扫描文件夹到播放列表',
  'set.scanFolder.desc': '打开文件时，同时将所在文件夹中的视频一并加入列表。',
  'set.resume.label': '播放进度记忆',
  'set.resume.desc': '记住每个文件的播放进度，当再次打开时回到上一次的播放进度。',
  'set.resumePlaylist.label': '播放列表进度记忆',
  'set.resumePlaylist.desc': '再次打开播放列表时，从上一次最后播放的视频开始。',

  'set.keepPitch.label': '倍速保持音高',
  'set.keepPitch.desc': '倍速播放时保持人声原本的音调。',
  'set.passthrough.label': '音频直通',
  'set.passthrough.desc':
    '将原始音频信号直接输出至外接设备解码。\n需要硬件支持相应格式，遇到不支持的格式将没有声音。',
  'set.audioLang.label': '首选音轨语言',
  'set.subLang.label': '首选字幕语言',
  'set.audioLang.desc': '打开文件时自动选择该语言的音轨。\n默认按文件内嵌的音轨排序。',
  'set.subLang.desc': '打开文件时自动选择该语言的字幕。\n默认按文件内嵌的字幕排序。',
  'set.subsDefault.label': '默认显示字幕',
  'set.autoLoadSubs.label': '自动加载外挂字幕',
  'set.autoLoadSubs.desc': '加载视频同一路径下的同名 .srt 与 .ass 字幕。',
  'set.hdrSubPeak.label': 'HDR 字幕亮度',
  'set.hdrSubPeak.desc':
    '播放 HDR 视频时文本字幕（SRT/ASS）的峰值亮度。\n单位：尼特，数值越低字幕越暗。mpv 未支持图形字幕（如蓝光所用的 PGS 字幕）的亮度调节。SDR 视频播放不受影响。',

  'set.subFont.label': '字体',
  'set.subFont.desc': '调整文本字幕（SRT/ASS）字体。\n建议选择可以覆盖对应语言的字体。',
  'set.subSize.label': '字号',
  'set.subSpacing.label': '字间距',
  'set.subSpacing.desc': '调整字符之间的间距。',
  'set.subOutline.label': '描边',
  'set.subOutline.desc': '字幕深色描边的粗细，使字幕在明亮画面上依然清晰。',
  'set.subBold.label': '粗体',
  'set.subMargin.label': '距底部距离',
  'set.subMargin.desc':
    '全局调整距离视频底部的距离。\n右侧面板的「调整 ▸ 字幕位置」只对当前影片做偏移，不会改变此处的全局设置。',

  'set.hwdec.label': '硬件解码',
  'set.hwdec.auto': 'GPU 解码。效率最佳，视频画面始终留在显存中。',
  'set.hwdec.autoCopy': 'GPU 解码后将画面拷回内存。SVP 等 CPU 滤镜需要此模式。',
  'set.hwdec.off': '由 CPU 进行软件解码。兼容性最好，但开销更大。',
  'set.quality.label': '在线视频画质',
  'set.quality.desc':
    '设定最高值，实际画质仍取决于片源：最高只有 1080p 的视频，无论此处如何设置都只能以 1080p 播放。\n选择「最高」则取片源提供的最高画质。\n设置变更会在下一个视频流开始时生效。',
  'set.cookies.label': '使用浏览器 Cookie',
  'set.cookies.desc':
    '读取浏览器中已登录的 Cookie，可按你的会员等级播放对应平台的会员专属高清画质。默认关闭。',
  'set.cookiesFrom.label': 'Cookie 来源',

  'set.shotSubs.label': '包含字幕',
  'set.shotSubs.desc': '将画面上的字幕一并保存进截图。',
  'set.shotFormat.label': '格式',
  'set.shotFormat.desc': 'PNG 为无损格式。JPG 会将质量设置在 95，在控制文件体积的同时保证画质。',
  'set.shotDir.label': '保存路径',
  'set.shotDir.desc': '截图保存的位置。可直接输入路径，或点击浏览选择。',
  'set.shotDir.browse': '浏览…',

  'set.oscDelay.label': '控制器自动隐藏时间',
  'set.oscDelay.desc1': '鼠标停止移动后，控制器保持显示的时间。',
  'set.oscDelay.desc2': '默认为 5 秒。',

  'set.rememberWindow.label': '记住窗口大小与位置',
  'set.rememberVolume.label': '记住音量',

  'opt.hwdec.auto': '自动',
  'opt.hwdec.autoCopy': '自动回拷',
  'opt.hwdec.off': '关闭（软件解码）',
  'opt.quality.best': '最高',
  'opt.shot.png': 'PNG（无损）',
  'opt.shot.jpg': 'JPG（高质量）',
  'opt.subFont.system': '系统默认（sans-serif）',
  'opt.lang.english': '英语',
  'opt.lang.chinese': '中文',
  'opt.lang.japanese': '日语',
  'opt.lang.korean': '韩语',
  'opt.lang.french': '法语',
  'opt.lang.german': '德语',
  'opt.lang.spanish': '西班牙语',
  'opt.lang.italian': '意大利语',
  'opt.lang.russian': '俄语',
  'opt.lang.portuguese': '葡萄牙语',
  'opt.uiLang.system': '跟随系统'
}
