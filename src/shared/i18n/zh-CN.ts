// 简体中文。Partial on purpose — a half-finished translation still compiles, and
// any key missing here falls back to English rather than showing a raw key.
import type { Key } from './en'

export const zhCN: Partial<Record<Key, string>> = {
  'win.minimize': '最小化',
  'win.maximize': '最大化',
  'win.close': '关闭',

  'empty.tagline': '拖入视频即可播放',
  'empty.urlPlaceholder': '粘贴视频或流媒体链接…',
  'empty.urlPlay': '播放',
  'empty.openFile': '打开文件',
  'empty.hint': '双击打开文件夹 · 右键输入链接',

  'osc.mute': '静音',
  'osc.unmute': '取消静音',
  'osc.play': '播放',
  'osc.pause': '暂停',
  'osc.back': '后退 {n} 秒',
  'osc.forward': '前进 {n} 秒',
  'osc.panel': '轨道与播放列表',
  'osc.timeFormat': '点击切换:时间 · 时间码 · 帧号',

  'common.settings': '设置'
}
