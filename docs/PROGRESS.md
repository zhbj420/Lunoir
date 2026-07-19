# MMPlayer 进度与问题记录

> 每到相对重要的节点更新此文档。方案见 [PLAN.md](PLAN.md)。

## 当前状态（2026-07-19 · 蓝光/DVD 原盘 + 打开文件夹 + 双击手势）

**阶段：能放蓝光/DVD 原盘目录(bd:// / dvd://)+ 打开普通文件夹排列表 + "Open File" 双击开文件夹。真机实测通过(《红番区》UHD 原盘,标题栏正确显示碟名)。**

### 蓝光 / DVD 原盘播放
- **检测**([index.ts](../src/main/index.ts) `discInfo`):文件夹里有 `BDMV/index.bdmv` → 蓝光;`VIDEO_TS/VIDEO_TS.IFO` → DVD。接受碟根目录、或直接选中的 `BDMV`/`VIDEO_TS`。
- **播放**:设 `bluray-device`/`dvd-device` + load `bd://`/`dvd://`。**mpv/libbluray 自动选最长 title(正片)**,章节/音轨/字幕都从 title 出,右面板 Chapters / Audio & Sub 直接读。**无碟菜单**(mpv 不支持 BD-J/HDMV 交互菜单,用面板顶替)。DoVi 按 HDR10 基层放。
- **碟标题**(`discTitle`,优先级 **碟 META > .nfo > 文件夹名**):
  - **碟自带 META** `BDMV/META/DL/bdmt_*.xml` 的 `<di:name>` —— 烧进碟里、播放时一定在(mpv 其实也默认把它读成 media-title)。**主力**,因为播放时不一定扫过媒体服务器。
  - **.nfo** `<title>`(Emby/Kodi/Jellyfin 扫库才有)—— 兜底。
  - 文件夹名 —— 垫底。
  - 主进程 `force-media-title` 下发;渲染层 [usePlayer](../src/renderer/src/usePlayer.ts) `isDisc` + `pickTitle` 保险(filename 是 `bd://` 也当碟,标题栏永不漏 `bd://`)。

### 打开文件夹(普通视频文件夹)
- `openMedia` 加目录分支:`statSync` 判断是目录 → `scanFolder`(**非递归**、只扫顶层视频)排进列表。**上限 `MAX_FOLDER_SCAN=500`**,超了弹提示只取前 500;顶层没视频(如碟目录的上一级)弹 "No playable media in this folder"、**不硬加载目录**(不再静默哑火、也不递归子目录)。

### "Open File" 双击开文件夹 + 入口
- [EmptyState](../src/renderer/src/components/EmptyState.tsx):**单击** = 选文件(靠 250ms 计时器区分,故有 ~1/4 秒延迟);**双击** = 文件夹选择器(Windows 原生对话框不能文件+文件夹二合一)。提示改 "Double-click to open a folder · right-click for a URL"。
- 另加 **File 菜单 "Open Folder…" + `Ctrl+Shift+O`**(无边框窗看不到菜单栏,给了快捷键);拖文件夹也走同一套 `openMedia`。preload `openDiscDialog` → IPC `ui:open-disc` → `promptOpenFolder`。

---

## 当前状态（2026-07-19 · 四项功能:自动挂字幕 / 变速保音高 / 截图格式 / A-B 循环）

**阶段：四个之前记的待办功能落地 —— 三个设置项 + A-B 循环(带 OSC 进度条标记)。类型/构建通过;待用户实测。**

- **自动加载外挂字幕**（设置 `autoLoadSubs`,默认开）：mpv `sub-auto` = `fuzzy`(开) / `no`(关) —— 自动挂上视频旁的同名 `.srt`/`.ass`。设置页 Audio & subtitles 区。
- **变速保持音高**（`keepPitch`,默认开）：mpv `audio-pitch-correction` —— 倍速时时间拉伸、人声不变调;关掉就是老式变调快放。
- **截图格式 PNG/JPG**（`screenshotFormat`,默认 png)：mpv `screenshot-format`;选 jpg 时 `screenshot-jpeg-quality=95`(压缩几乎不可见,用户质量敏感)。`applyScreenshotFormat()` 在启动 + `settings:set` 生效。设置页 Screenshots 区下拉。
- **A-B 循环**：右键菜单一项**循环三态**(mpv `ab-loop` 命令:无A→设A / 有A→设B / 都有→清除),标签随状态变(`set start (A)` / `set end (B)` / `clear`)。OBSERVED 加 `ab-loop-a`/`ab-loop-b`([mpv.ts](../src/main/mpv.ts)),[usePlayer](../src/renderer/src/usePlayer.ts) 记 `abLoopA`/`abLoopB`('no'→null)。**OSC 进度条画标记**([Controls.tsx](../src/renderer/src/components/Controls.tsx)):`.seek-wrap` 包住 seek,A/B 两个琥珀竖标(`.ab-mark`)+ 中间淡琥珀区间(`.ab-region`)。

---

## 当前状态（2026-07-19 · 油管播放列表 / 加载切换 / 续播记忆 / 一批打磨）

**阶段：YouTube 播放列表、加载态视图切换、油管标题+作者、播放列表续播记忆 + 独立开关，外加一批交互打磨。类型/构建通过；真机实测（含 Avatar 4K + 真油管列表）。**

### YouTube 播放列表
- 贴 `/playlist?…` 链接 → [index.ts](../src/main/index.ts) `isPlaylistUrl` 判定 → `loadPlaylistUrl`：yt-dlp `--flat-playlist` **秒速枚举**全部条目（`url ||| title`），一次性刷进播放列表并播第一个，播完走现有 eof→next。枚举期 "Loading playlist…" toast，失败 "Couldn't load playlist"。只认显式 `/playlist?`；`watch?v=…&list=…` 仍当单视频。
- **列表项真标题**：`urlTitles` 映射（URL→解析标题），`playlistPayload` 里 URL 项用它、本地项用 basename。mpv 报 `media-title` 时（当前项是 URL）更新并重推列表 —— 列表不再显示 `watch?v=…`。

### 加载态视图切换 + OSC 不自动弹
- 提交 URL/列表 → main 立即广播 `ui:loading` → [OverlayView](../src/renderer/src/views/OverlayView.tsx) 里 `!hasMedia && !loading` 才渲染 EmptyState → **主界面瞬间消失，只剩磨砂窗口 + Loading**（跟加载单条视频一致）；失败时 `end-file` 关 loading、`hasMedia` 仍 false → **自动退回主界面**。
- **去掉加载自动弹 OSC**：移除 `!wasMedia && hasMedia → revealUi()`。加载途中不闪 OSC、出画面也不弹，干净开播；OSC 只在鼠标活动时出。

### 油管标题 + 作者
- OBSERVED 加 `metadata/by-key/uploader`；[usePlayer](../src/renderer/src/usePlayer.ts) `pickTitle(fileName, mediaTitle, author, isStream)`：**流**显示 `真标题 · 作者`（media-title + uploader），**本地**仍用文件名（躲垃圾容器标签）。实测 `The Odyssey - Spoiler Review · Chris Stuckmann`。

### 播放列表续播记忆（独立开关）
- [settings.ts](../src/main/settings.ts) 加 `playlist-progress.json`（key = 油管 `list=…`，值 = 上次那条 URL）；`loadPlaylistUrl` 枚举后若开关开且该条还在列表里就跳过去，叠加现有时间续播 → 同一条视频 + 同一时间点。每切条目更新记录；本地文件夹/单文件不参与（双击具体文件意图明确）。
- **独立设置 `resumePlaylistItem`**（默认开，与 `resumePlayback` 互相独立）：设置页 "Resume playlists" 开关。

### 一批交互打磨
- **打开 URL 浮层**：变暗 `rgba(0,0,0,.86)` + 淡入淡出（`.open` 类切 opacity/visibility）+ 边框加粗到 2px；打开即聚焦输入框。
- **网络加载转圈**：`.loading-overlay` 转圈 + "Loading…"，`playback-restart`/`end-file` 时清。
- **resume toast 时机**：从 `file-loaded` 挪到 `playback-restart`（`pendingResumeToast`）—— 流要缓冲，等真出画面才提示，不在灰屏期抢跳。
- **右键菜单盖 OSC**：菜单开时 `ui:menu-open` 让 main 藏 OSC 并压 reveal（OSC 是独立子窗口，否则会盖住菜单）；菜单 backdrop `cursor:default` 修光标在菜单外消失。
- **OSC 音量数字纯文字**：拖动圆点/滚轮时显示数字（无暗底，跟 HDR 标一样）；OSC 在时滚轮也在 OSC 处显示。

---

## 当前状态（2026-07-18 · 设置页打磨 + 网络流分辨率标）

**阶段：设置页交互打磨（自绘下拉修 native bug、动态宽度、语言/画质下拉、截图路径可改）+ OSC 网络流分辨率标。类型/构建通过。**

- **自绘下拉替换 native `<select>`**（[SettingsPanel.tsx](../src/renderer/src/components/SettingsPanel.tsx) `Select`）：Electron 无边框窗里原生 select 弹出层渲染不全（"只显示 Best" 的 bug）。改成自绘：**portal 到 `<body>`**（避开面板 `transform` 让 fixed 错位 + `overflow` 裁剪），fixed 定位在触发按钮下（贴底翻上），点外部/滚动/缩放关。hwdec/画质/cookies 浏览器/语言全用它。
- **面板动态宽度**：`.panel.left` 去掉固定 360，改用 `var(--panel-w)`（跟右面板同款：宽默认 440，小窗缩到 300）。
- **语言改下拉**：Default/English/Chinese(chi,zho)/Japanese/Korean/French/German/Spanish/Italian/Russian/Portuguese;选源没有的语言自动回落默认。
- **在线画质加 2160p (4K)**：Best/2160p/1080p/720p/480p;说明写明是**上限**、实际看源(选 2160p 源只有 1080p 还是 1080p)。
- **截图保存文件夹可改**：设置里显示当前路径（默认 `图片/Lunoir`,启动落成真实路径），**手打**(回车/失焦生效) + **浏览按钮**(原生 `dialog` 选目录)。改动即 mkdir + 设 mpv `screenshot-directory`。preload `pickFolder` / IPC `app:pick-folder`。
- **OSC 网络流分辨率标**：观察 `video-params/h`,usePlayer 记 `videoHeight`+`isStream`(path 是 http)。OSC 信息标区**仅网络流**在顶行显 `2160p`(跟 HDR 拼一行,如 `2160p HDR10`),本地不显示(已知画质、保持干净)。真·当前解码高度=真拿到的画质。

---

## 当前状态（2026-07-18 · 设置页 / 音量交互 / yt-dlp）

**阶段：左侧设置页（新面板层 + 持久化地基）、两个音量交互、YouTube/在线播放（yt-dlp 按需下载）。类型/构建通过；设置页整套待用户实测。**

### 设置页 = 左侧面板 + 持久化地基（全新一层）
- **持久化**：[src/main/settings.ts](../src/main/settings.ts) —— `userData/settings.json`（偏好）+ `positions.json`（续播进度），缓存读、改动写、IPC `settings:get`/`settings:set`（改动后 `broadcast('settings:changed')` 给别的窗口，如截图读 subs 偏好）。`Settings` 类型定义在 [preload](../src/preload/index.ts)（web 侧可见），main 导入。
- **左面板** [SettingsPanel.tsx](../src/renderer/src/components/SettingsPanel.tsx)：镜像右面板从左滑入（`.panel.left`，固定 360px），**OSC 齿轮打开**（原 "coming soon"）+ **空状态右下角齿轮**（无媒体时 OSC 隐藏,首屏也能进）。开关/下拉/滑条+手输框；hwdec/在线画质带**动态说明**。只有右面板推 OSC 让位（`setPanelState(panel==='playlist')`）；左面板暂不动 OSC。
- **设置项 + 生效时机**：扫描目录入列表 · **记忆播放进度**（存 pos + `file-loaded` 时 seek 回 + "Resumed from mm:ss" toast + 快看完清除）· 首选音轨/字幕语言（`alang`/`slang`，**下个文件**生效，描述已注明）· 默认字幕开关 · **hwdec** auto/auto-copy/no · **HDR 字幕亮度**（`sub-hdr-peak` 尼特，默认 120，实时，滑条+手输）· 截图含字幕 · 记忆窗口大小位置 / 音量（退出存、启动还原）。
  - **HDR 字幕过亮**：mpv 默认把字幕白映射到 ~SDR 参考白，HDR 屏上偏亮;`sub-hdr-peak=120` 压柔和,贴近 MPC。
- 生效：连接时 `applyMpvSettings()` 批量推;`settings:set` 里按 key 单独推(避免 slider 拖动时重设一堆 + 误改字幕可见性)。

### 音量两个交互（[Controls.tsx](../src/renderer/src/components/Controls.tsx) + [OverlayView](../src/renderer/src/views/OverlayView.tsx)）
- **OSC 音量条**：平时不显示数字,**按住/拖动圆点时**在滑条右侧冒出数字(松手 0.7s 隐)。放右侧因 OSC 仅 92px 高,放上面会被窗口顶裁。
- **滚轮调音量**：不再弹 OSC,改弹音量 toast（喇叭图标 + 音量条 + 数字,底部居中,1s 消失）。0/静音图标变叉。

### YouTube / 在线播放（yt-dlp 按需下载）
- 确认 mpv 带 **ytdl_hook + Lua**（实测 `Lua error` 而非"不支持"）;缺的只是 **yt-dlp**。
- **按需下载**（不打包,省体积 + 治过期）：贴一个站点 URL(非直链媒体,`needsYtdl` 判定)时,缺 yt-dlp 就从 GitHub 拉最新 `yt-dlp.exe`(~18MB)到 `userData/yt-dlp/`(带 "Fetching yt-dlp…" toast),指给 mpv `script-opts=ytdl_hook-ytdl_path=…`,再 load;有旧版(>14 天)后台刷新。非在线用户零负担。
- **在线画质**（`ytdl-format`）：Best/1080/720/480,默认 Best=最高可用(公开视频 4K 免费,不需会员;URL 不带画质,由 yt-dlp 选)。选低档=反向限带宽,下个流生效。
- **Cookies（会员/Premium/年龄限制）**：`useCookies` 开关**默认关** + `cookiesBrowser` 选(Edge/Chrome/Firefox/Brave/Opera)→ `ytdl-raw-options=cookies-from-browser=…`。本机读浏览器登录态,opt-in 尊重隐私。坑:最新 Chrome App-Bound 加密可能读不到→换 Edge/FF;个别要关浏览器。

---

## 当前状态（2026-07-18 · 右键菜单 / 倍速 / 截图 / SVP 就绪）

**阶段：加了右键上下文菜单（自绘）、倍速、截图、画面比例、SVP 帧插值就绪。均端到端验证（含真 DV 文件 + SVP 实测）。**

### 右键菜单（自绘 HTML，仅播放中）
- 新组件 [ContextMenu.tsx](../src/renderer/src/components/ContextMenu.tsx)：光标处弹、贴边翻转、子菜单（悬停 or **点击**展开，触屏友好）、点外部/Esc/选中即关；hover gate 在 `@media(hover:hover)`。
- 挂在 [OverlayView](../src/renderer/src/views/OverlayView.tsx) 视频区右键（`hasMedia` 才弹；空状态右键仍是 URL 快捷方式）。项：播放/暂停 · 上/下一个（列表>1 亮）· 上/下一章（有章节亮，`add chapter ±1`）· **倍速**子菜单 · **画面比例**子菜单（`video-aspect-override`/`keepaspect`）· **截图**子菜单 · 打开文件/URL · 全屏。
- **打开 URL 浮层**（播放中也能弹，复用 `.url-box`）；**toast** 组件（截图/变速提示）。

### 倍速
- mpv 观察 `speed`；变速时弹 toast；**≠1× 时**进度条右侧、总时长前常驻 muted `1.5×`（[Controls.tsx](../src/renderer/src/components/Controls.tsx) `.osc-speed`，纯信息样式不像按钮 —— 用户定的位置）。

### 截图
- mpv `screenshot`（含字幕）/ `screenshot video`（不含字幕）子菜单；**原始分辨率、无控件**（mpv 只截自己那层）、PNG，存 `图片/Lunoir`（主进程 `connected` 时设 `screenshot-directory/template/format`）。

### 画面比例
- 默认 / 16:9 / 4:3 / 2.35:1 / 铺满（`keepaspect=no`）；本地 state 记当前 + 勾选。

### SVP 帧插值就绪（不打包 SVP）
- mpv IPC 管道从动态改**固定 `\\.\pipe\mpvpipe`**（[mpv.ts](../src/main/mpv.ts)）—— SVP 默认就叫 `mpvpipe`，用户 SVP 里配好 mpv 目标即自动生效，**零额外配置**。**无 UI、无开关、无检测**：SVP 才是插帧开关（跟 MPC 一样靠 SVP 托盘/热键控制），mpv 遇到 vapoursynth 滤镜会自动把帧取回内存，`hwdec=auto` 也能工作，故不需要我们切 `auto-copy`。没装 SVP 的用户对这条管道完全无感。**权衡**：固定管道 → 同机一次只跑一个实例。（曾加过检测+菜单开关，实测发现开关不是真开关、误导，已删。）

### 右面板
- **Audio & Sub 调到第一位 + 设为默认 tab**（`useState<Tab>('tracks')`）。

---

## 当前状态（2026-07-18 · Phase 2 续：OSC 商业名标 / DV / 标题栏 / 播放列表工具条 / 触屏 hover）

**阶段：在 MediaInfo 管线之上继续铺开 —— OSC 音频/HDR 标升商业名（含 Dolby Vision）、标题栏正名、播放列表工具条重整、触屏粘滞 hover 根治。全部端到端验证或类型/构建通过，待提交。**

### OSC 音频标升商业名（当前轨）
- 主进程按 `aid` + `track-list`（`ff-index`）+ MediaInfo 探测结果解析**当前音轨**的商业名，广播 `audio:active` `{commercial, features, channels}`；OSC（[Controls.tsx](../src/renderer/src/components/Controls.tsx) `audioBadge`）按措辞规则拼字。
- 措辞：TrueHD+Atmos→`Atmos TrueHD`；DD+ +Atmos→`Atmos`；DTS:X→`DTS:X`；DTS-HD MA/HRA→原名；**对象/无损母带名不带声道**，基础编码（DD+/DD/DTS/AAC/无Atmos TrueHD）**带声道**（`DD+ 5.1`）。探不到商业名回落 mpv codec 简写。
- **声道数改用 track-list `demux-channel-count`**（每轨可靠、切轨必刷新、原生声道），经 `audio:active` 下发；`audio-params/channel-count` 处理器加固：瞬时 `null/0` 不再冲掉「5.1」。

### DV / HDR10 / HDR10+ 标（Phase 2 待办 · 已做）
- mpv 里 DV 与 HDR10 都是 PQ、分不出 → **MediaInfo 读视频轨 `HDR_Format`**：含「Dolby Vision」→`Dolby Vision`（任何 profile 5/7/8.1 都一个标）；`2094`/`HDR10+`→`HDR10+`；`2086`/`HDR10`→`HDR10`。主进程开片探测后广播 `video:hdr`，OSC `hdrLabel(gamma, hdrFormat)` 用它、**探不到回落 gamma→`HDR`**。（实测：用户那个 Avengers CHD 其实是 HDR10 而非 DV，尽管文件名带 UHD BluRay —— MediaInfo 报 `SMPTE ST 2086`。真 DV 文件待用户实测。）

### 标题栏正名（用文件名）
- mpv `media-title` 优先容器 `title` 标签，remux 常塞垃圾（`ENCODED BY CHDMON`）→ 标题栏改**优先 `filename`**（[usePlayer.ts](../src/renderer/src/usePlayer.ts) 加 `fileName` 字段，`media-title` 只在无文件名时兜底，如网络流）。

### 播放列表工具条重整（[RightPanel.tsx](../src/renderer/src/components/RightPanel.tsx)）
- **重复三态三图标**（不靠高亮）：off=`→|`（放到底停）/ all=循环圈 / one=循环圈+`1`。
- **Shuffle 改真·开关（持久模式）**：列表显示序不变，自动续播/下一首走随机；`shuffleBag` 一轮内不重复（抽空后 Repeat-All 才重洗，否则停）；`shuffleHistory` 支持上一首回退；`playIndex`/next/prev/onEnded 全 shuffle 感知；add/remove/openMedia 后 `resyncShuffle` 重建 bag。IPC `playlist:toggle-shuffle`，payload 加 `shuffle`。
- **四图标统一规格**：viewBox 24 + 内容撑 4–20 + stroke 1.8；shuffle 图标重画（干净 Feather 式）。
- **`.tool.on` 高亮**：从「只调亮字色」改**填充底**（同 `.ib.on` 语言、方角）；重复按钮去掉 `.on`（图标已表状态）。

### 触屏粘滞 hover 根治（用户在用触屏）
- 触屏把 tap 模拟成**粘滞 hover**（点完残留高亮，直到点别处）。全 app **14 组按钮类 `:hover` 全部 gate 进 `@media (hover: hover)`**（[styles.css](../src/renderer/src/styles.css)）：鼠标体验不变，触屏不触发。滑块拇指的两处 hover（拖动放大）保留。

---

## 当前状态（2026-07-18 · Phase 2 起：每轨码率 + 音频子档）

**阶段：Phase 2 第一项落地 —— 右面板 Audio & Sub 每条音轨显示「码率 + 商业格式名」（Dolby TrueHD Atmos / DTS-HD MA + DTS:X …）。已端到端验证（TrueHD Atmos 7.1 + DTS:X 的真实 remux，自截图 + 用户确认）。**

### 关键改道：ffprobe → MediaInfo（体积从 ~113MB 降到 9.3MB）
- 原计划打包 **ffprobe**（BtbN 静态构建）。实测那个自含 ffprobe.exe **113MB** —— 用户质疑「MPC-HC 整包才 20MB」，一针见血：那 100MB 是 BtbN「全家桶」构建（塞了所有编解码器/滤镜/libplacebo/vulkan/x264…），**不是探测元数据本身需要的**；MPC-HC 小是因为用精简版 LAV。
- 改用 **MediaInfo CLI**：专职元数据解析器，**单个自含 `MediaInfo.exe` 9.3MB**，BSD 类许可（比 GPL/LGPL ffmpeg 更适合要开源的 MIT 项目）。数据还更好 —— `Format_Commercial_IfAny` 直接给「Dolby TrueHD with Dolby Atmos」「DTS-HD MA + DTS:X」这类商业名（含 Atmos，ffprobe 的 `profile` 给不出）。

### 管线（setup → 主进程 → 面板）
- **setup**（[scripts/download-mpv.mjs](../scripts/download-mpv.mjs)）：mpv 之后再从 mediaarea.net 下 MediaInfo CLI（版本号从 GitHub `MediaArea/MediaInfo` latest tag 解析，失败回落 26.05），用 `7zip-min` 的 `cmd(['e', …])` **只抽 `MediaInfo.exe`** 到 `resources/mediainfo/`。幂等（存在即跳过）。
- **主进程**（[src/main/index.ts](../src/main/index.ts)）：`resolveMediaInfoPath()`；mpv `path` 属性变化时（**唯一开片总闸**，涵盖菜单/拖拽/播放列表/URL）`runProbe(file)` —— 仅本地文件（跳 URL / `av://` / `bd://`），杀掉在飞的旧进程，`spawn MediaInfo --Output=JSON`，解析音轨成 `{ffIndex(=StreamOrder): {format, commercial, features, bitRate}}`，广播 `media:probe`。旧片结果用 `probeTarget` 守卫丢弃。
- **join 键**：mpv `track-list/N/ff-index`（ffmpeg 绝对流序）== MediaInfo `StreamOrder`。实测确认：mpv 对这些轨 `demux-bitrate` 就是 `undefined`（正是本功能存在的理由），ff-index=1,2 对齐 StreamOrder=1,2。
- **面板**（[src/renderer/src/components/RightPanel.tsx](../src/renderer/src/components/RightPanel.tsx)）：`onProbe` 收 `media:probe` 存 `probe` state（开片先清空防陈旧），按 `ff-index` join。`audioTrackLabel(t, ff)`：格式名优先 `commercial`（把「with Dolby Atmos」压成「Atmos」），退回 mpv codec 名 + 子档（AAC「LC」→「AAC LC」）；码率优先 MediaInfo，退回 mpv `demux-bitrate`。字幕/OSC 标暂不动。
- **dev 钩子**：`MMP_LEFT` 把窗口停到左边缘（只在设了 env 时，方便测试截图不挡视线）。**并入将来 MMP_* 清理清单**。

### 待打磨 / 待定
- 长标签（如「English Dolby TrueHD Atmos 7.1 · 4777 kbps」）在 440px 面板下可能被裁剪（有 title 悬浮提示兜底）—— 看用户是否要调排版（换行/缩写/Mbps）。
- OSC 音频标是否也升级成商业名（现仍是 `DD+ 5.1` 简写）—— 可选跟进。

---

## 当前状态（2026-07-18）

**阶段：字幕微调面板 + OSC 弹出/全屏交互打磨 + OSC 内容信息标（HDR / 音频格式）。均已提交，准备开 phase 2。**

### 右面板：Audio & Sub 页 + 字幕微调（已做）
- Tracks 标签正名 **Audio & Sub**；面板加宽 340→440（主进程 `PANEL_W` 同步 444，差 4px 为 OSC 让位）。
- 每条音/字幕轨下加 **Delay 步进器**（±0.1s，带符号、真减号字形、归零禁用态）。
- 字幕区底部 **可折叠「ADJUST」底条**（钉底、易达）：Delay / Position（↑↓ = sub-pos）/ Size（sub-scale）/ Brightness。
  - **Brightness** 借 `sub-color` 把纯白压灰 → 治 **HDR 下 SRT 过亮刺眼**（社区标准解法，文本字幕生效）。
  - **降级**：图形字幕（PGS/VobSub，按当前轨 `codec` 判定）自动禁用 Size/Brightness、只留 Position/Delay + 提示；无字幕时全禁用。
  - 底条做成「从属可展开」形态：引导箭头前置 + 压暗（0.34）轻于区块头；`grid-rows 0fr→1fr` + 淡入平滑展开；收起时有值则亮小圆点。
- mpv 观察新增：`audio-delay`/`sub-delay`/`sub-pos`/`sub-scale`。

### OSC 弹出逻辑（多处修）
- **暂停/播放不弹**：main 去掉 pause 属性触发 reveal；键盘 space/k 早返回不走 onActivity。
- **进窗不弹**：`.app` onMouseEnter 起 guard，离进入点移动 <50px 一律不 reveal（挡住"贴边进入即弹"）。
- **底部只中间区弹**：`y>h-150` 加 x 中间带（窗宽 20%–80%）；底部角落 / 任务栏侧进入不触发；顶部标题条仍整条。
- **移动阈值** 60→100（更钝）。
- **面板不外泄**：面板根 stopPropagation mousemove/wheel（不再误弹 OSC / 误改音量）；`.panel { cursor: default }` 保光标可见。
- **隐藏 OSC 划过不弹**：OSC 窗 `onMouseMove` 仅在已显示时 keep-alive；main「离开 OSC→reveal」加 `oscShown` 前提。

### 全屏（改用原生全屏）
- **改用 `win.setFullScreen(true/false)`（OS 原生全屏状态）**，弃用「手动 `setBounds(屏幕)+alwaysOnTop`」那套。实测(2026-07-18):真全屏、视频正常、OSC 子窗仍浮在上面、**Windows 通知不再把窗口踢到后面**(系统按全屏应用管 z-order)。连带删掉之前所有 `alwaysOnTop`/`screen-saver`/`moveTop`/focus-re-assert 的 z-order hack —— 全交给系统。
- 面板全屏到顶（`body.fullscreen .panel { top:0 }`）。
- **切全屏不弹 OSC**：main 侧切换后 350ms 屏蔽移动 reveal（避开 resize 的 synthetic mousemove）；`f` 键早返回。
- **窗口适配 = 标准 contain**（MPC 式）：开片 `fitWindowToVideo` 把窗口摆成视频比例好铺满；之后自由拉窗口,mpv 保持视频比例 letterbox/pillarbox（竖向拉大→上下黑、横向满；横向拉宽→两侧黑）。**不锁窗口比例**（曾试 `setAspectRatio` 锁定,反而害了自由拉伸 + 全屏还原,已删）。

### 动画
- 面板开合 `easeOutExpo`（`cubic-bezier(0.16,1,0.3,1)`，~0.42s，快冲 + 长收尾）；**OSC 横向位移同步补间**（主进程同款曲线，连宽度一起），不再瞬跳。

### OSC 内容信息标 + 轨道命名清理（已做）
- OSC **按钮行齿轮左侧**挂两个小标（上下堆叠、纯文字无底纹、同亮度）：**HDR** + **音频格式**（OSC 用简写 `DD+ 5.1`/`TrueHD 7.1`）。SDR 不显示 HDR。源：`video-params/gamma`（pq/hlg→HDR）、`audio-codec-name` + `audio-params/channel-count`。OSC 上限 560→620。
- **音轨命名清理**：remux 常把整串发行文件名塞进 track title → 丢弃（按分辨率/来源 token 或「多点无空格」判定），改拼 **语言 + 全称格式 + 声道 + 码率**（`English Dolby TrueHD 7.1`）；有意义的 title（Commentary）保留。
- **字幕两栏式**：左 = 干净名字（语言 + SDH/Forced，剥掉格式 token），右 = 格式小标签（`SubRip`/`PGS`/`ASS`/`VobSub`…）。
- **字幕位置修复**：`sub-pos` clamp 由 0–100 改 **0–150**（mpv 实际范围，`--list-options` 确认）、步长 1→2 → 可把字幕**下推进下方黑 bar**；此前卡在 100（视频底）进不去。
- **可编辑数字框**：Adjust 各项（Delay/Position/Size/Brightness）数字改为**可输入框**，回车/失焦解析并 **clamp 到 min/max**；范围按 mpv 放开（Delay ±1000s、Position 0–150、Size 0–10000%、Brightness 0–100%）；框内打字/方向键不穿透触发播放器快捷键。
- **进度条位置**：`.osc-seek` 用 `position: relative; top: -8px` **只上移进度条**、按钮行不动、OSC 高度不变。
- **动态右面板宽 + 派生最小窗宽**：面板宽随窗口 `clamp(窗宽 − OSC_MIN(480) − 80, 300, 440)` —— ≥1000 满 440,越小越窄到 300,始终保证 OSC ≥480 不挤变形；主进程 `panelW()` 算、resize 时 `pushPanelWidth` 推给渲染层写 `--panel-w`,OSC 布局用同一函数。**窗口最小宽 = 300+480+80 = 860**(派生,`fitWindowToVideo` 下限同步)。面板边加 `width` easeOutExpo 过渡(拉窗口时边缘平滑跟随;OSC 独立按目标宽摆放,不受影响)。标题栏文字调暗到 `--text-dim`。
- **已知固有限制(诊断确认)**：无边框窗口 resize 时右/下侧有条**重绘延迟缝**(拖越快越大、松手即合)。实测切 `backgroundMaterial:'none'` 缝照旧 → **不是磨砂/DWM,是 Chromium 无边框窗口固有异步重绘**,无干净解(原生 window-proc 不值)。且 **主窗口 acrylic 是 mpv `--wid` 显示的必要条件**——切 none/不透明底会灰/黑屏,主窗口材质**不可改**。

### Phase 2 待办
- **Dolby Vision 标识**：mpv 里 DV 与 HDR10 的 transfer 都是 pq、无稳定「是 DV」属性 → 现 DV 片显示 HDR。需拿 **DV Profile 5 文件实测** mpv 报的 `video-params`/`track-list` 再拆出 `Dolby Vision`。
- ~~**每轨码率 + 音频子档（ffprobe 管线）**~~ ✅ **已完成（2026-07-18，改用 MediaInfo 而非 ffprobe）** —— 见顶部「Phase 2 起」章节。ffprobe 自含 exe 113MB 过大，改用 9.3MB 的 MediaInfo CLI，商业名更全（含 Atmos / DTS:X）。
- 两侧面板 + 标题栏 **真亚克力窗口化**（一直挂着的「一把做」）。
- 可调宽度面板（用户提过「以后可能」）。
- GitHub 开源准备（README / LICENSE / `package.json` name→lunoir / mpv 许可声明）—— 不急。

## 当前状态（2026-07-17 · 深夜）

**阶段：双窗口定型（主亚克力窗 + 独立亚克力 OSC 子窗），OSC 动画 / DWM 边框阴影 / IINA 风格右面板 / 窗口自适应视频比例均完成。下一步 Chapters 验证 + Tracks 页 + 面板亚克力化。**

### 架构现状（修正上一版"单窗口"表述）
最终落地为**两个窗口**：主窗（`backgroundMaterial:'acrylic'`，mpv `--wid` 视频）+ 独立 OSC 子窗（同样亚克力，贴底居中，跟随主窗）。独立 OSC 窗是必须的——CSS `backdrop-filter` 隔着 mpv 那层采样不到视频，只有真·亚克力窗口才能磨砂到视频上。

### OSC 浮现/消失动画（已定手感）
- 弃用 `show()`/CSS opacity（会触发 Windows 原生"放大弹出" + 半透明矩形残留的"叠层感"）。
- 改为主进程 `animateOsc(reveal)`：`setOpacity()` + `setBounds()` 把**整块亚克力窗**当一个整体淡入+上浮 / 淡出+下沉（出现 260ms、消失 190ms，cubic-out/quad-in，位移 22px）。首次 `showInactive` 在全透明时完成，规避原生开窗动画。
- 唤起手势：仅当鼠标**向下累计移动 > 60px**（原 34，用户要求加大）或靠近顶/底边才弹，避免过灵敏。

### DWM 边框线 / 阴影（koffi 直调）
- Win11 对**圆角+亚克力**窗口强制画 1px 边框线 + 投影，Electron 的 `hasShadow/roundedCorners` 关不掉。
- 新增依赖 **`koffi`**（预编译 FFI，无需 build），新建 [src/main/dwm.ts](../src/main/dwm.ts) 直调 `DwmSetWindowAttribute`。
- `DWMWA_BORDER_COLOR = DWMWA_COLOR_NONE` → **边框线已删（用户确认）**。
- 阴影：DWM 无浓淡旋钮，`showInactive` 已吃"非活动窗口淡版"，用户确认**当前淡阴影可接受**，保留圆角不改直角。

### IINA 风格右面板（已做）
- 新组件 [RightPanel.tsx](../src/renderer/src/components/RightPanel.tsx)：顶部 **PLAYLIST / CHAPTERS** 标签（大写+字距+短下划线），正在播放 **▶ + 方角整行高亮**，淡分割线，紧凑行距，底部**窗口按钮式工具条**（循环 off→all→one / 随机 / 添加 / 删除，均无圆角、边到边）。
- 关闭改由 **OSC 列表按钮** toggle；面板开时列表按钮显示按下态（`.ib.on`，经 `ui:panel-open` 广播）。
- 主进程管理列表：`repeatMode`、`shufflePlaylist`、`addToPlaylist`、`removeFromPlaylist`、`cycleRepeat`（mpv 只持有当前单文件，故都在主进程做）。Chapters 接 mpv `chapter-list`/`chapter`。
- 背景近不透（0.99）灰调统一 OSC；**两侧面板最终转真亚克力窗口，留到后面一起做**（已记入记忆）。逐条时长暂缓。

### 窗口自适应视频比例（已做）
- 观察 `video-params/aspect`，视频加载后把主窗口客户区调成视频比例 → **窗口模式无黑边**（全屏才因屏幕比例出现黑 bar）。保持当前宽度、按比例调高度、居中、限制在工作区内。
- `lastAspect` 守卫：**同比例不 resize**（连续同比例剧集不跳）；全屏/最大化时不动。已量验：1000×563 AR=1.776 ≈ 16:9。
- 顺带把窗口 OS 标题从 `MMPlayer` 正名为 `Lunoir`（index.html `<title>`）。

### 标题栏「外置」+ 杂项打磨（已做）
- **标题栏移出视频**：mpv `--video-margin-ratio-top` 在顶部留一条（比例=TITLEBAR_H/窗口高，DPI 无关），视频画到它下面；AR 自适应改成让**视频区**贴合比例（窗口高 = 视频高 + 32）。有视频时标题栏是**灰条**（`body.has-media`），空状态透明透出磨砂桌面，全屏隐藏（`body.fullscreen`，margin 归零）。磨砂版标题栏并入以后「两侧面板亚克力化」一把做。
- **OSC 上下微抖修复**：`revealUi` 里 `animateOsc(true)` 只在 `!oscShown` 时跑——OSC 已在位时鼠标移动只刷新隐藏计时，不再对 DPI ±1px 反复补间。
- **OSC 磨砂通透度**：`--panel` scrim alpha 56%→44%（非活动 66%→54%），露更多亚克力磨砂。调这个 alpha 就是「更透/更实」的旋钮。
- **OSC 自动隐藏** 2000→3500ms。
- **Open File**：右键**直接**弹 URL 输入框（去掉「先切按钮再点」两步）。
- **dev 空窗修复**：`electron-vite dev` 频繁重启把 HTTP 缓存搞坏 → `ERR_CACHE_READ_FAILURE` 空窗。`if (isDev) app.commandLine.appendSwitch('disable-http-cache')` 根治。
- **命令报错刷屏修复**：`mpv:command` 处理器 try/catch 返回 null，吞掉「mpv not connected / property unavailable」这类预期拒绝。

### 下一步
- Chapters 用带章节文件验证；之后 Tracks（音轨+字幕合一页）；两侧面板+标题栏亚克力化；字幕加载。

---

## 当前状态（2026-07-17 · 下午）

**阶段：黑屏根因定位并修复，改为单窗口架构，视频+OSC 端到端跑通（我方截图验证）。**

### 黑屏根因（重要）
用 GDI 截屏做隔离诊断，逐步定位：
1. 透明窗口本身正常（绿底+红方块测试通过）。
2. mpv **单体独立窗口**能正常显示 + 被截屏捕获。
3. **把 mpv 用 `--wid` 嵌进 Electron(Chromium) 的窗口时，若该窗口页面不透明，Chromium 合成器会盖住 mpv 子窗口 → 黑屏。**
4. **解法**：单个**透明** Electron 窗口 + **透明页面** + mpv `--wid` 嵌入。mpv 子层在 Chromium 合成面之后，页面透明处透出视频，不透明控件浮于其上。**无需多窗口同步、无需原生模块。**

### 架构定案：单窗口
- 一个 `frame:false, transparent:true` 窗口，mpv `--wid` 嵌入。
- React：透明背景（透出视频）+ 标题栏/空状态/OSC（不透明元素叠加）。
- 放弃三窗口方案（复杂且不必要）。
- 已用 `MMP_TESTSRC=1` + GDI 截屏验证：真实 app 视频显示正常、OSC 两行布局叠加正常、标题栏正常。

### 本轮 UI 打磨（2026-07-17 晚）
- 用户确认视频能放。反馈：控件偏小、不要蓝色、位置太低、只有透明没磨砂；双击是"最大化"非真全屏且应能切回；用户为 **150% DPI**。
- OSC 调整：放大图标/间距/滑条、去蓝改中性白（--accent 白）、上移（bottom 46px）、面板加宽。
- **去掉 `.osc` 的 backdrop-filter**：它会把面板提升为合成层、渲染到 mpv 画面**之后**（导致"看不到 OSC"）；且它本就采样不到透明洞后的 mpv，无用。改纯半透明底。已截图确认 OSC 正常浮于视频上。
- **真全屏修复**：Electron `setFullScreen` 在透明无边框窗上只表现为最大化。改为**手动全屏**——记录全屏前 bounds，进入时 setBounds 到显示器物理全边界 + alwaysOnTop（盖任务栏），再次触发恢复原尺寸。已截图确认整屏铺满。
- 截图工具须按 150% DPI 换算（物理=逻辑×1.5）；自动隐藏靠真实鼠标移动触发，SetCursorPos 合成移动不触发（仅影响我的截图，不影响用户）。

### 待办
- **磨砂取视频色**：仍需小 Win11 亚克力子窗口叠在 OSC 区域（in-page backdrop-filter 无法采样 mpv）。下一步做。
- 待用户确认真全屏来回切换、控件打磨后的观感。

---

## 历史状态（2026-07-17 · 上午，已废弃三窗口方案）

**阶段：重构为三窗口 + Win11 亚克力 OSC，等待用户视觉确认。**

### 本轮改动（2026-07-17）
- 用户反馈：有声音无画面（黑屏）；控制条与 IINA 差别大；磨砂应取视频颜色；全屏时控件占比要小。
- 定路线：磨砂取视频色走 **Win11 亚克力**（不写原生渲染插件）。
- 架构重构为**三窗口**：`videoWin`(mpv) + `overlayWin`(透明交互层，修黑屏方案A：去 parent/backgroundColor) + `oscWin`(`backgroundMaterial:'acrylic'` 小窗口，贴底居中，系统实时磨砂身后视频取色)。
- OSC 重做对齐 IINA：两行布局（上排 音量·快退/播放/快进·设置/列表；下排 时间—进度—时间），固定 600×96 居中，全屏占比自然变小。
- 渲染层拆分：同一 index.html 用 `?win=overlay|osc` 分流；抽出 `usePlayer`/`useShortcuts` 共享逻辑；显隐由主进程协调广播。
- 冒烟测试：6 electron + 1 mpv 正常拉起，亚克力窗口未崩溃，构建通过。
- **待用户确认**：黑屏是否已修（视频透出）、亚克力磨砂是否取到视频色、三窗口跟随/层级是否稳、OSC 外观是否接近 IINA、设置/播放列表为占位。

---

## 历史状态（2026-07-16）

**阶段：M2 完成，等待用户视觉确认；M3 待启动。**

### 已完成并验证
- ✅ 项目脚手架：electron-vite + React + TS，构建（`npm run build`）通过。
- ✅ mpv 内核：`npm run setup` 从 shinchiro 源下载 mpv v0.41 到 `resources/mpv/`，`mpv.exe --version` 正常。
- ✅ 双窗口 + 嵌入：冒烟测试确认 electron 主/渲染进程与 mpv 子进程正常拉起、无崩溃；mpv 携带 `--wid=<HWND>` 与 IPC 管道启动 —— 核心链路打通。
- ✅ 已实现功能（代码层面）：打开文件（拖拽/菜单/按钮/Ctrl+O）、播放暂停、进度条、音量/静音、全屏、悬浮 OSC 自动隐藏、键盘快捷键。

### 待确认（需用户在屏幕上验证）
- ⏳ 视频画面是否正常显示。
- ⏳ 控制条是否半透明浮于视频之上、自动隐藏是否正常。
- ⏳ 窗口拖动/缩放时视频与界面是否跟手（透明窗口缩放为主要风险点）。

## 已知问题 / 风险

| # | 问题 | 状态 | 备注 |
| --- | --- | --- | --- |
| 1 | 本机 npm 拦截 postinstall 脚本，electron 二进制未自动安装 | 已绕过 | 手动 Expand-Archive 缓存 zip 到 `node_modules/electron/dist` + 写 `path.txt`。重装依赖后可能需重做。 |
| 2 | Windows 透明无边框窗口缩放边缘可能"飘"/闪烁 | 待验证 | Electron 透明窗口的已知限制，M3 需重点处理。 |
| 3 | mpv 下载源 zhongfly 已 404 | 已解决 | 改用 shinchiro/mpv-winbuild-cmake。 |
| 4 | 跨盘符解压 EXDEV（temp 在 C:，项目在 D:） | 已解决 | 直接解压到 `resources/mpv`，不经临时目录 rename。 |
| 5 | Vite 版本与 electron-vite 2.3 peer 冲突 | 已解决 | Vite 锁定 ^5。 |

## 下一步

1. 用户运行 `npm run dev`，反馈实际画面 / 截图。
2. 依反馈进入 **M3**：界面细节打磨、透明窗口缩放处理。
3. `npm run dist` 打包 Windows 安装程序。

## 变更日志

- **2026-07-16**：项目启动；确定技术栈（Electron+React、内置 mpv）；完成 M0/M1/M2；建立 PLAN/PROGRESS 文档与协作约定。
