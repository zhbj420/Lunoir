# 文案校对 · 第二批（右面板 / 右键菜单 / 主进程）

隔夜做的。改法同上一份：改 `EN` / `ZH` 后面那行文字，别动 `[key]`，一条一行，换行写 `\n`，`{n}` `{v}` `{count}` `{max}` `{time}` 是占位符要保留。改完喊我读回去，然后删这个文件。

**不翻译**：Lunoir、格式/编解码名（PGS / SubRip / ASS / Dolby / DTS / PNG…）、声道（5.1 / 7.1）、画面比例数字（16:9 / 2.35:1）、分辨率、`yt-dlp`。

---

## ⚠️ 我拿不准、想请你定的几处（右面板独有，没有左面板可参照）

1. **[panel.tab.audioSub]** 我译「音轨与字幕」。左面板那个标签当初叫 "Audio & Sub"，中文可能「音频与字幕」更顺？但轨道列表里我用的是「音轨」。你定统一用哪个词。
2. **[adjust.imageSubHint]** 「图形字幕 — 仅可调位置与延迟」——「图形字幕」对 PGS/VobSub 这类，你看行不行，还是叫「位图字幕」。
3. **[menu.tcOverlay]** 「时间码角标」—— 之前你说过要「常驻角落显示时间码」，这个词你认不认。
4. **[toast.screenshotSaved]** 「截图已保存至 图片 › Lunoir」——「图片」是 Windows 的「图片」库文件夹名，`›` 是分隔符。要不要改成「图片\Lunoir」这种路径写法。
5. **轨道行的语言名**（如音轨显示 "English Dolby TrueHD 7.1"）——**这些我没翻译**，还是显示英文语言名。翻成「英语 Dolby TrueHD 7.1」会中英混排，我拿不准好不好看，留给你决定要不要做（要做的话是另一批 35 个语言词）。


## 右面板 — 标签页

[panel.tab.audioSub]
EN  Audio & Sub
ZH  音轨与字幕

[panel.tab.playlist]
EN  Playlist
ZH  播放列表

[panel.tab.chapters]
EN  Chapters
ZH  章节


## 右面板 — 播放列表

[panel.empty.queue]
EN  Nothing queued
ZH  列表为空

[panel.repeat.off]
EN  Repeat: off
ZH  循环：关闭

[panel.repeat.all]
EN  Repeat: all
ZH  循环：全部

[panel.repeat.one]
EN  Repeat: one
ZH  循环：单个

[panel.shuffle.on]
EN  Shuffle: on
ZH  随机：开

[panel.shuffle.off]
EN  Shuffle: off
ZH  随机：关

[panel.addFiles]
EN  Add files
ZH  添加文件

[panel.removeCurrent]
EN  Remove current
ZH  移除当前


## 右面板 — 章节

[panel.empty.chapters]
EN  No chapters
ZH  无章节

[panel.chapterN]
EN  Chapter {n}
ZH  第 {n} 章


## 右面板 — 音轨与字幕

[panel.sec.audio]
EN  Audio
ZH  音轨

[panel.sec.subtitles]
EN  Subtitles
ZH  字幕

[panel.empty.audio]
EN  No audio tracks
ZH  无音轨

[panel.subNone]
EN  None
ZH  无

[panel.addSub]
EN  Add subtitle…
ZH  添加字幕…

[panel.trackN]
EN  Track {n}
ZH  轨道 {n}


## 右面板 — 字幕/音频微调

[adjust.label]
EN  Adjust
ZH  调整

[adjust.active]
EN  Adjustments active
ZH  已应用微调

[adjust.reset]
EN  Reset
ZH  重置

[adjust.delay]
EN  Delay
ZH  延迟

[adjust.position]
EN  Position
ZH  位置

[adjust.size]
EN  Size
ZH  大小

[adjust.brightness]
EN  Brightness
ZH  亮度

[adjust.earlier]
EN  Earlier (−0.1s)
ZH  提前（−0.1 秒）

[adjust.later]
EN  Later (+0.1s)
ZH  延后（+0.1 秒）

[adjust.moveUp]
EN  Move up
ZH  上移

[adjust.moveDown]
EN  Move down
ZH  下移

[adjust.smaller]
EN  Smaller
ZH  缩小

[adjust.larger]
EN  Larger
ZH  放大

[adjust.dimmer]
EN  Dimmer
ZH  调暗

[adjust.brighter]
EN  Brighter
ZH  调亮

[adjust.imageSubHint]
EN  Image subtitle — position & delay only
ZH  图形字幕 — 仅可调位置与延迟


## 右键菜单

[menu.previous]
EN  Previous
ZH  上一个

[menu.next]
EN  Next
ZH  下一个

[menu.prevChapter]
EN  Previous chapter
ZH  上一章

[menu.nextChapter]
EN  Next chapter
ZH  下一章

[menu.speed]
EN  Speed
ZH  播放速度

[menu.speedNormal]
EN  Normal
ZH  正常

[menu.aspect]
EN  Aspect ratio
ZH  画面比例

[menu.aspectStretch]
EN  Stretch to fill
ZH  拉伸铺满

[menu.abStart]
EN  A-B loop: set start (A)
ZH  A-B 循环：设起点 (A)

[menu.abEnd]
EN  A-B loop: set end (B)
ZH  A-B 循环：设终点 (B)

[menu.abClear]
EN  A-B loop: clear
ZH  A-B 循环：清除

[menu.screenshot]
EN  Screenshot
ZH  截图

[menu.tcOverlay]
EN  Timecode overlay
ZH  时间码角标

[menu.openFile]
EN  Open file…
ZH  打开文件…

[menu.openUrl]
EN  Open URL…
ZH  打开 URL…

[menu.fullscreen]
EN  Fullscreen
ZH  全屏

（播放/暂停复用 osc.play / osc.pause，已是「播放」「暂停」）


## 提示浮层（截图、变速等）

[toast.speedNormal]
EN  Normal speed
ZH  正常速度

[toast.speed]
EN  Speed {v}×
ZH  速度 {v}×

[toast.screenshotSaved]
EN  Screenshot saved to Pictures › Lunoir
ZH  截图已保存至 图片 › Lunoir

[toast.loading]
EN  Loading…
ZH  加载中…


## 主进程 — 提示

[main.fetchingYtdl]
EN  Fetching yt-dlp…
ZH  正在获取 yt-dlp…

[main.ytdlFailed]
EN  Couldn't fetch yt-dlp
ZH  yt-dlp 获取失败

[main.loadingPlaylist]
EN  Loading playlist…
ZH  正在加载播放列表…

[main.playlistFailed]
EN  Couldn't load playlist
ZH  播放列表加载失败

[main.noMedia]
EN  No playable media in this folder
ZH  此文件夹中没有可播放的媒体

[main.folderTruncated]
EN  Folder has {count} videos — loading the first {max}
ZH  文件夹内有 {count} 个视频 — 仅加载前 {max} 个

[main.resumed]
EN  Resumed from {time}
ZH  已从 {time} 继续播放


## 主进程 — 对话框标题 + 文件类型

[dlg.selectFolder]
EN  Select a folder (a video folder, or a Blu-ray/DVD disc)
ZH  选择文件夹（视频文件夹，或蓝光 / DVD 原盘）

[dlg.addSubtitle]
EN  Add Subtitle
ZH  添加字幕

[dlg.addToPlaylist]
EN  Add to Playlist
ZH  添加到播放列表

[dlg.openMedia]
EN  Open Media
ZH  打开媒体

[dlg.chooseShotDir]
EN  Choose screenshot folder
ZH  选择截图文件夹

[dlg.filter.subtitles]
EN  Subtitles
ZH  字幕文件

[dlg.filter.media]
EN  Media
ZH  媒体文件

[dlg.filter.allFiles]
EN  All Files
ZH  所有文件


## 原生应用菜单（无边框窗口里看不到，只有快捷键 Ctrl+O / Ctrl+Shift+O 会触发对话框）

[appmenu.file]
EN  File
ZH  文件

[appmenu.open]
EN  Open…
ZH  打开…

[appmenu.openFolder]
EN  Open Folder…
ZH  打开文件夹…

[appmenu.view]
EN  View
ZH  视图
