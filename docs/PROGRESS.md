# MMPlayer 进度与问题记录

> 每到相对重要的节点更新此文档。方案见 [PLAN.md](PLAN.md)。

## 当前状态（2026-07-22 · v0.6.0 发布 · 实验性时间线 + 播放列表增强 + 检查更新）

**阶段：一个大版本 —— 实验性「时间线」(EDL 合并 + 逐片段修剪)、播放列表拖动排序/多选/批量删除、检查更新。类型 / i18n(9 语言 231) / 构建全绿;两个 exe 发 GitHub release。**

### 时间线（实验性,设置门控 `experimentalTimeline`,默认关）
- **Phase 1 合并**:本地队列 → 一个 mpv **EDL** 虚拟文件连续播,统一进度条 + 章节即片段分界(seek 条白刻度),点片段 / next / prev = 在一条流里 seek(不重载)。EDL 用 `%<字节>%<路径>` 前缀格式(容纳任意路径)、**不写 length → mpv 探真实时长 + 每片段暴露一个章节**(分界与当前片段白捡)。合并态禁用 shuffle。
- **Phase 2 逐片段修剪**:Timeline 里**双击片段**隔离(暂停)→ OSC 上两个**蓝色 in/out 手柄** + 蓝范围填充,拖动实时预览、**双击手柄跳播放位**、重置按钮;**再次双击提交** → EDL 带 `,in,length` 重生成(总时长/分界跟着变)。修剪**仅本会话、按路径记**(随重排走)。手感硬核点:**单一逻辑播放位 `headPos`** 驱动进度填充/时间读数/拖拽锚点,否则拖手柄时进度条和时间文字会因 flex 重排乱晃、再抓另一个手柄白条会跳;拖时白条钉住、松手停在手柄帧、播放从锚点续;3px 拖动阈值分开单击/双击。
- 设置 `pinOscInTrim`(默认开):修剪时 OSC 常驻,手柄不被自动隐藏藏掉。切走合并/修剪态时特殊 UI 全部清掉(手柄、重置、常驻)。
- **验证到的 EDL 机制**:打包 mpv(0.41)支持 `edl://`;`path,start,length` CSV 与 `%N%path,start,length` 前缀+参数都实测可用;`runProbe` 跳过 `.edl`。

### 播放列表（通用增强,非仅时间线）
- **拖动排序**(HTML5,鼠标):按光标在行**上/下半**决定插到该行前/后,拖到列表下方**空白区** = 追加到末尾;多选状态下**整组拖动**。落点蓝线(顶/底)。
- **多选**:**单击选中、Ctrl/Shift 加选/连选、双击才播放**(队列);批量**删除**(垃圾桶 / Delete 键)。IPTV **频道列表维持单击即换台**(各贴用途,不互相迁就)。选中蓝紫高亮,与"正在播"中性高亮区分。

### 检查更新（notify-only）
- 启动静默查 GitHub latest release(缓存 1h、`checkForUpdates` 可关);Home 右下角**有新版才显小按钮** → 开 release 页面下载(有 setup/portable 两个包,故不直下);设置**「关于」区**手动检查(检查中/已是最新/发现新版本·下载)。未签名 → 只提示不自动装。

### 搁置（下一轮研究）
- **时间线统一帧率 → 高帧率慢放**(120/240fps 素材按统一帧率变真慢动作):`--container-fps-override` **不穿透 EDL**(实测 120fps 片段在 EDL 里仍实时),单条拼接流做不到**逐片段**帧率重解读。待换机制 + 拿真实高帧率素材验证(合成片 `duration` 上报不可靠)。

### 发布 v0.6.0
- `package.json` 0.5.1 → 0.6.0;两个 exe(setup + portable,各 ~108MB,未签名)发 GitHub release。

---

## 当前状态（2026-07-22 · 检查更新（Home 提示 + 关于区）· 待并入 v0.6.0）

**阶段：加「检查更新」—— 只提示不自动装。Home 右下角有新版才显一个小按钮 → 开 GitHub release 页面下载;设置新增「关于」区(当前版本 + 手动检查 + 启动时检查开关)。零新依赖。攒着,和后续功能一起发 0.6.0。**

- **notify-only 的理由**:包**未签名**,自动下载安装会被 SmartScreen 拦、且需签名才能静默装,还要背上重依赖。且**开 release 页面而非直接下 exe** 是有意的 —— 有 setup / portable 两个包,让用户自己选(不少人用便携版)。彻底免弹窗只有代码签名一条路,以后再说。
- **主进程**([index.ts](../src/main/index.ts)):`fetchLatestRelease` 打 GitHub `releases/latest`(带 UA + `Accept: vnd.github+json`),`isNewer` 三段数字比对;`checkUpdate(force)` —— Home 路径走 1h 缓存 + 受 `checkForUpdates` 设置门控,设置里手动检查用 `force` 强制刷新。IPC `app:version` / `app:check-update` / `app:open-external`(`shell.openExternal`)。
- **Home**([EmptyState](../src/renderer/src/components/EmptyState.tsx)):挂载时查一次,有新版才显右下角 `.update-entry` 小按钮(star/gear 左侧),文案「New version available」,点击开页面。空状态是这个提示的合适位置 —— 播放时不打扰。
- **设置**([SettingsPanel](../src/renderer/src/components/SettingsPanel.tsx)):新增「关于」区,`Version` 行 + `Check for updates` 按钮(检查中 / 已是最新 / 发现新版本·下载 状态)+「启动时检查更新」开关(默认开)。
- i18n:13 个键 × 9 语言(en/zh 把关,其余 7 语机械翻译),`i18n-check` 222/222 齐平;字体子集已重建。

---

## 当前状态（2026-07-22 · 修复 mpv stdout 管道憋死播放器 · v0.5.1）

**阶段：修一个 v0.5.0 就带着的潜在死锁 —— 看直播切几次台后整个播放器卡死在 `Loading…`,连之前能看的台也 load 不了,必须重启 Lunoir。根因不在直播逻辑,在子进程管道。**

- **根因**:`MpvController`([mpv.ts](../src/main/mpv.ts))spawn mpv 用 `stdio:['ignore','pipe','pipe']`,但代码**只读了 stderr**。mpv 的终端日志(状态行 + 每次 `loadfile` 一坨 `[component]` 行)几乎全写 **stdout** —— 没人读 → 那个 OS 管道缓冲区被填满 → mpv 下一次 `write()` **阻塞** → 整个播放器冻住。重启 = 全新空管道,所以"必须重启才好"。**切台每次吐一坨**,所以几次就犯;单看本地文件写得少,基本撞不到,故一直潜伏到 IPTV 才现形。
- **意外的对照实验**:临时把 mpv 开到 `--msg-level=all=v`(狂灌 stdout)→ 几乎秒卡;加上 stdout 排空 → 怎么都复现不出来。这一翻转锁死了病因。
- **修复**:stdout 也接上 `on('data', …)` 排空(直接丢弃,免得状态行刷屏 dev 终端;真报错仍走 stderr → `log` 事件)。**通用铁律:任何 spawn 出来的子进程,每一路 piped 流都必须读掉,否则缓冲区一满就把子进程憋死。**(项目里 MediaInfo 探测、yt-dlp 下载都已在读各自的 stdout,安全。)
- **诊断插曲**:一开始日志根本抓不到,正是因为老代码只监听 stderr(几乎是空的)——同一个 bug 的另一面,顺带修好;现在 dev 里 `[mpv]` 也能打了(默认只放行 stderr,不刷屏)。

---

## 当前状态（2026-07-21 · 收藏 library + IPTV 直播 + 录制 · v0.5.0 发布）

**阶段：Home 从「空 Open File」升级成 **收藏启动器**（最近 / 收藏 / 播放列表 / 直播源 四 tab），新增 **IPTV m3u/txt 直播**（分组 + 搜索 + 打开即刷新）、**直播录制**（MKV 流复制）。类型 / `i18n-check`(9 语言) / 构建全绿；真机逐条测过；两个 exe（setup + portable）发 GitHub release，Latest。**

### 收藏浮层 = 纯启动器（不下钻）
- **一块磨砂居中子窗**（复用侧面板那套 acrylic 窗口），入口 = OSC 最左小星标 + 空状态右下角星标；打开时藏 OSC（同右键菜单）。**点一下就播**：曾做过浮层内「点列表→看频道」的下钻，用户否掉（"点了就直接播放"）→ 频道改在**右面板**显示（和从磁盘打开 m3u 一样）。
- **4 tab 由一个扁平 favourites 存储按 `kind` 拆**：最近（`recents.json` 自动）/ 收藏（file·url）/ 播放列表（`playlist`，存队列快照）/ 直播源（`list`，存频道快照）。每行可**重命名（铅笔就地编辑）+ 删除（垃圾桶）**。
- **最近的口径**：本地文件 + **可 seek 的点播** URL 才进；**IPTV 列表和直播流都不进**（文件在 `recordOpen` 即入，URL 挂 `curRecentPending`、只在 mpv 报 `seekable===true` 才入 → 直播永不进、死链也不进）。

### IPTV 直播（`src/main/index.ts`）
- `parseChannelList`（扩展 M3U `#EXTINF group-title=…,名字` + txt `分组,#genre#`；名字在最后一个 `"` 后的逗号切，避免属性里的逗号截断）、`fetchChannels`（远程 `fetch` **必须带浏览器 UA** 否则服务器回空；本地 `readFileSync`）、`loadChannelList`、`loadFavCollection`。`openMedia` 把 `.m3u`/`.txt` 路由到这（`.m3u8` = 单流，直接进 mpv）。
- **右面板上下文标签**：`sourceType`(`queue`|`iptv`|`playlist-url`) 随 `playlistPayload` 下发 → 列表 tab 在 iptv 下叫 **频道**、普通队列叫 **播放列表**。频道按 `group-title` **分组折叠 + 搜索**（默认只展开第一组；折叠组里若含正在播的频道 → 该组头显**灰条**，不是提亮文字）。
- **保存按钮**（右面板工具行的星）上下文化：队列→存 **播放列表**（target = 各项 URL 的 content-hash，重存自动去重）；IPTV→**收藏整个 m3u 源**（`kind:list`，频道快照）。右键「收藏当前」= **只加不删**（已存则 toast「已在收藏中」，删除走浮层垃圾桶）。
- **打开即刷新**：`loadFavCollection` 重新抓源（URL 源拉最新频道、本地文件吃改动）并回写快照，**离线/失效则回落快照**；存的播放列表只播快照 items，不重抓。

### 硬核踩坑（发布前逮到的，别重走）
- **`force-media-title` 必须在 `loadFile` 之后设**，不能之前 —— mpv 自己 load 时的 `path` 事件会重置渲染层标题，之前设的会被抹掉、标题栏掉回丑陋的 URL 尾巴（`playlist.m3u8`）。
- **IPTV 频道绝不走 yt-dlp** —— `needsYtdl` 靠「URL 不以媒体扩展名结尾」判定，会误伤 `.php`/带 query 的流地址 → 既跳了强制标题又错误 yt-dlp'd。用 `sourceType !== 'iptv'` 拦住；且 `media-title` 处理器对 iptv **不许覆盖** `urlTitles`（m3u 里的台名才权威）。
- **播放列表/频道行的 React key 用原始 index，不用 `it.path`** —— m3u 可能重复同一 URL（多源），key 撞了会在搜索过滤后留下**组外鬼影行**。

### 错误处理
- 缺文件 / 死源过去是**静默黑屏**（mpv 清了 spinner 但没画面、无 toast，`onEnded` 只认真 EOF 故队列里死条目不自动跳）。现：`playCurrent` 对**本地文件** `existsSync` 守卫 → toast「文件不存在,请检查文件」+ 跳下一个可播的；死流/URL 走 mpv end-file `reason==='error'` → toast。

### 遗留 / 待办
- **单频道删除**（在侧面板频道列表里删死源）：下钻 backend（`library:open-at`、`removeFavouriteChannel/Item`、`lib.back`/`lib.emptyList`、`.lib-*` CSS）**休眠在 tree 里**，留给将来的侧面板频道管理 UI。
- **A-B 段落导出**（mpv 不能 stream-copy 段落 → 需要 ffmpeg 决策，见录制方案）。

---

## 当前状态（2026-07-21 · 全界面多语言收官 · 9 语言 · v0.4.0 发布）

**阶段：把整个 UI 翻完并扩到 9 种语言，配套工具链齐活，发布 v0.4.0。类型/构建过，真机逐语言 eyeball（中日重点看，其余抽查）。**

### 全界面翻译（承接 7-20 的「第一步」）
- **四个面剩下的全翻了**：设置面板（~83 条，含 6 处 `<br/>` 双段说明）、右面板（标签页/播放列表/章节/音轨字幕/微调栏）、右键菜单、**主进程**（toast + 文件对话框 + 应用菜单）。至此**无硬编码英文残留**。
- **主进程接 i18n（新东西）**：`index.ts` 加 `tr()` —— 每次调用实时从设置 + 系统语言解析 locale，toast/对话框即时跟随切换，零额外接线。**语言检测用 `app.getPreferredSystemLanguages()` 而非 `getLocale()`** —— 后者受打包语言包（electronLanguages 只含 en）限制，会导致主进程和渲染层（`navigator.language`）对 `system` 的判定不一致。应用菜单在 `uiLanguage` 改时 `buildMenu()` 重建（无边框窗口里其实看不到，仅快捷键触发的对话框可见）。
- **多行说明用 `\n` 数据化**：文案里带 `\n`，渲染层 `multiline()` 拆成 `<br/>`，**中英各自决定断行点**，不再被一处写死的英文断点绑住。
- **英文文案顺手重写**：更端庄、去掉俏皮词（chipmunky / your call / 破折号插话）。
- **文案校对走临时 doc**：`docs/copy-review*.md` 让用户直接在文件里改，读回代码后删除 —— 用户不便逐句口述时的协作方式。

### 中文排版（承接 7-20，本轮定稿）
- **字号锁定原则（写进 CLAUDE.md）**：英文尺度锁死,中文要大**只加 `:root[lang^='zh']` 覆盖**,绝不改共用基准值 —— 本会话手滑顶大英文两次(设置行、面板标签),都被用户拿基准眼睛抓出来,故立规。
- **设置面板行重排**：说明从「和控件抢横向空间」改成「标题+控件占首行、说明在下方占满整宽」→ 每条说明**右边界一致**,中文 `text-align: justify` 才能对齐(英文保持左对齐)。孤字/参差问题根治。
- 右面板分区标题（音轨/字幕/调整）中文 13px + 提亮；微调标签（延迟/位置…）与分区标题**拉开明暗层级**（标题暗 0.52、参数亮 0.82，之前反了）。

### 扩到 9 语言
- **新增 7 种**：`fr` `de` `es` `pt` `ru`（拉丁/西里尔,Segoe UI 全覆盖,**零字体工作**）+ `ja` `ko`（CJK）。每种 171 key 全量,`LANG_OPTIONS` 里标签用**该语言自称**（Français / 日本語 / 한국어…）。`resolveSystemLocale` 按主子标签匹配（`de-AT`→`de`），未匹配回落英文。
- **日韩字体：系统自带，不打包** —— 复用中文的思源子集**不行**（那是简体 SC,日语汉字会显中文字形；韩文谚文可能没有）。改用 `:root[lang^='ja'|'ko']` 指系统 **Meiryo**（日,用户选的,原版比 UI 版宽）/ **Malgun Gothic**（韩）。
- **`data-cjk` 机制**：CJK 尺寸/间距覆盖原本 key `:root[lang^='zh']`,现改 key `useT` 给 zh/ja/ko 都设的 `data-cjk` 属性 —— 三种 CJK 共用一套覆盖,不重复选择器；字体栈仍按语言分。
- **subset 脚本防污染**：`subset-font.mjs` 现**跳过非中文 locale 文件** —— 否则重跑会把法语重音、西里尔、假名/谚文卷进简体子集。仍 378 字。
- **诚实定位**：en+zh 我们能把关,其余 7 种是 best-effort 初版,`Partial` 兜底 → 哪条别扭单独回退英文即可。日语用户在校对,韩语睁眼瞎先这样,靠社区反馈迭代。

### 下拉选单一串打磨（加语言暴露的）
- **溢出**：设置面板是**独立窄窗口**,`position: fixed` 下拉画不出窗口边界 → 长选项（`Auto (cópia de volta)`）被 OS 裁。修：① JS **逐项量** `scrollWidth` 取最大定宽（`width: max-content` 被 `overflow-y:auto` 连带的 x 滚动容器机制废掉;量列表自身也没用,溢出在更深的文字层）;② 若左对齐会顶出右边 → **右边缘对齐按钮、往左展开**,再 clamp 进视口。
- 滚动条换成面板同款细身（之前是系统默认老式）；**滚轮在列表内滚动、外部才关闭**（原本捕获所有滚轮一律关）。

### 工具链
- **`npm run i18n-check`**（`scripts/i18n-check.mjs`）：逐 locale 对比 en.ts,报**缺 key（警告,英文兜底）/ stale / 重复 / 占位符漂移（失败,非零退出可卡构建）**。加设置项忘补翻译能当场发现。已注入故障验证真能抓。
- **CLAUDE.md 更新**：9 locale、加 key 后跑 i18n-check、subset 只管中文（日韩系统字体）。

### 发布 v0.4.0
- `package.json` 0.3.0→0.4.0；README 补上漏掉的功能（多语言、时间码/帧号+烧录、字幕样式、Explorer 打开、shuffle/repeat）+ 9 语言徽章。两个 exe（setup+portable,各 ~108MB）已发 GitHub release,Latest,英文说明。

---

## 当前状态（2026-07-20 · 多语言基建 + 中文排版定稿 + 最大化磨砂修复）

**阶段：多语言地基铺好（第一步，仅 3 个组件已中文化）；中文排版一路排查定稿；修掉「最大化后磨砂永久死亡」。类型/构建过，真机逐条确认。**

### 多语言（第一步：基建 + 3 个组件）
- **自己写，不用 i18n 库**（[src/shared/i18n/](../src/shared/i18n/)，约 40 行）：`en.ts` 是唯一真源 + 兜底，`zh-CN.ts` 是 `Partial<>`（翻一半也能编译，漏的自动回落英文），`index.ts` 提供 `translate()` + `{name}` 插值 + 系统语言解析。**不引库的理由**：主进程也要翻译（toast/菜单/对话框），库在 main 里很别扭；复数引擎/异步后端我们一个都用不上；而且要控体积。
- **`src/shared/` 两个 tsconfig 的 `include` 都要加**（原本两边都不含 → 必撞 TS6307，这坑之前踩过两次），配 `@shared` 别名（三个 Vite 段都加）。
- **`useT.ts`**：每个窗口一个模块级 locale store，**整窗只订阅一次** `settings:changed`，组件经 `useSyncExternalStore` 取。首帧直接读 `navigator.language`，不会先闪英文。由 **`main.tsx` 无条件 import** —— 挂在组件上会漏掉尚未中文化的窗口（面板/菜单窗），它们的 `<html lang>` 就不会设，字体栈跟着失效。
- 设置项 `uiLanguage`（`'system' | 'en' | 'zh-CN'`，默认跟随系统）。设置页顶部新增 **Interface** 分区。**命名要小心**：已有的「首选音轨/字幕语言」是**媒体轨道**语言，界面语言必须叫 Interface language，否则必混。
- 已转：`EmptyState` / `TitleBar` / `Controls`。**顺带修的文案 bug**：静音键一直写 `Mute`、播放键一直写 `Play/Pause`（图标早就随状态变了，提示没跟上）→ 改为随状态；列表按钮 `Playlist` → `Tracks & playlist`（它开的面板有三个页且默认停在 Audio & Sub）。
- **未完**：设置页 / 右面板 / 右键菜单 / 主进程 toast 与菜单仍是英文 → 现在切中文是**中英混杂**，功能还不算能用。

### 中文排版（排查过程比结论长，避免重走）
- **症状**：小字号中文「字字大小不一、高低不齐」（`双`重 `击`轻 `开`偏上），英文同字号正常。
- **根因 = 字体 hinting**。雅黑 / 雅黑 UI / 华文细黑都是为 96 DPI ClearType 做的重度 hinting，强行把笔画掰上像素网格，**笔画密的被掰得比笔画疏的多**。几乎不 hinting 的字体就没这问题。
- **定稿：`--ui-font: 'Segoe UI', 'SimHei', 'Microsoft YaHei UI', sans-serif`**（`:root[lang^='zh']`）。**黑体**当年被嫌弃正因为不做 hinting，而在高 DPI + 灰度抗锯齿下这恰是优点；且 **Windows 自带，零打包 —— 开发者看到的 = 用户看到的**。Noto Sans SC / 思源效果更好（实测），但不随 Windows 分发，**不能拿它调设计**。
- **西文字体必须排最前**：黑体自带的西文字形是半角、很丑，把 SimHei 放第一会让中文界面里所有英文都变难看。（最初把中文字体排前的理由是「一行一套字体，基线才齐」—— 这个理由**后来被证伪**：DevTools 的 Rendered Fonts 显示出问题那行本来就只有一个字体。）
- `--disable-lcd-text`（[index.ts](../src/main/index.ts)）：灰度抗锯齿替代 ClearType 次像素抗锯齿。浅色小字压深色底是次像素抗锯齿最差的场景（染 RGB 子像素 → 彩边，且每笔染的程度不同 → 显得粗细不匀）。用户实测「舒服一点」。
- `--ui-tracking: 0.02em`，只对中文（西文保持 `normal`）。曾试 0.04em，配黑体偏松。
- 空状态字号改偶数 px（150% DPI 下奇数/半像素会落在半个设备像素上）。
- **已排除、别再试**：字体回退混用（Rendered Fonts 实证单字体）；`letter-spacing: 0.02em` 有无（无差别）；`--disable-font-subpixel-positioning`（无效，已撤）；透明度 0.4→0.58（对整齐度无效，但可读性更好故保留）；**CSS `-webkit-font-smoothing`（Windows 上是空操作，Blink 只在 macOS 认它，已实测）**。
- **待观察**：黑体**只有一个字重**（无 bold 文件），中文走 `font-weight: 600/700` 会是**伪粗体**，汉字容易糊。目前用粗体的地方（`.set-sec` / `.track-sec`）还都是英文，第二步译成中文后会现形 —— 届时倾向**中文标题不用粗体**（中文本就靠字距和留白分层，不靠字重）。

### 最大化 → 磨砂永久死亡（已修）
- **症状**：最大化后空状态变黑；**缩回来也不恢复**，一直黑到重启。
- **根因是「最大化」这个窗口状态本身**（不是尺寸）—— 无边框全屏同样铺满整屏，磨砂从来没死过，这条对比锁定了病因。进入 WS_MAXIMIZE 会摧毁 DWM 背板，**`setBackgroundMaterial('acrylic')` 重申请无效，切 `'none'` 再切回（中间隔一拍以躲开 DWM 的「无变化」合并）也无效** —— 两种都试过，只有重建窗口才回来。
- **修法：假最大化**（[index.ts](../src/main/index.ts) `fakeMaximize()` / `unfakeMaximize()`）—— `setBounds` 到 `screen.getDisplayMatching().workArea`，**永不进入系统最大化态**。用 `preMaxBounds` 记还原点，`isMaxed()` 取代所有 `win.isMaximized()`。和当初「原生全屏 → 无边框全屏」是同一个套路。
- **Aero Snap / Win+↑ / 双击标题栏**仍会摸到真最大化 → `win.on('maximize')` 立刻 `unmaximize()` 再套我们自己的。这条路径会**灰一瞬但能恢复**，用户判定可接受。
- **坑**：`persistState` 必须存 `preMaxBounds` 而非当前 bounds，否则最大化时退出 → 下次开一个「工作区那么大的普通窗口」，再也缩不回去。
- 顺带抽出 `reassertBackdrop()`，`setWinOpacity` 也改调它 —— **全项目只有一处知道怎么复活磨砂**。

---

## 当前状态（2026-07-21 · Phase 4 右键菜单亚克力化 —— 磨砂化收官）

**阶段：右键菜单改成独立 Win11 亚克力窗口(`?win=menu`),UI 全部磨砂化完成。另修掉两个真 bug:磨砂会掉、逐帧长按乱跳。**

- **磨砂"一弄就没"的根因(两个叠加,已修)** —— 困扰很久、以为是玄学的问题:
  1. **`setOpacity(<1)` 会把窗口变成分层窗口(WS_EX_LAYERED),而分层窗口不能有 DWM backdrop** → OSC/面板每次淡入淡出都把亚克力弄死,且我们从不重设 → 一直是平的,只有最小化+还原(重建窗口)才回来。修法:所有 opacity 走 `setWinOpacity()`,回到完全不透明时**重新申请一次 backdrop**,且只在"真的降到 1 以下过"时才申请(否则每次都申请会闪)。
  2. **点 OSC 后把焦点弹回主窗** → OSC 变非激活,Win11 把非激活窗口的亚克力渲染成纯色。已删掉那段弹焦点(任务栏问题现在由无边框全屏+置顶解决,不再依赖它)。
- **Phase 4:右键菜单 → 亚克力窗口**：菜单窗是**纯展示层** —— 主窗照旧构建菜单(onClick 闭包全留在原地),序列化成纯数据发过去,菜单窗只负责画 + 报尺寸,点击回传 id 由主窗执行。避免了把 toast/URL 浮层/宽高比状态全搬进菜单窗。
  - **子菜单改为手风琴就地展开**(一次只开一个),不做飞出式:窗口是单个矩形,飞出要么被裁、要么留一块空的磨砂方块;就地展开也更适合触屏。基建与飞出式共用,以后想换只需改渲染那一小块。
  - **定位**:开菜单时定一次角(必要时翻转),之后展开**只夹取不翻转** —— 否则每次尺寸变化重算翻转会让菜单乱跳。
  - **动画调优(踩了一串坑)**:① `easeOutCubic` 前 30% 走完 70% 距离,长尾被读成"两步" → 换 **easeOutQuad**;② 收起时**窗口必须领先内容**,否则窗口比内容高的那条区域显示未重绘像素 = **叠影**;③ 展开/收起**感知时长要相等**(感知 = 内容动画的时长);④ 时长曾写在渲染层和主进程两处,改一处就悄悄失配 → 改为**主进程唯一来源,开菜单时下发**;⑤ `.ctx-win` 的 scrim 改为**铺满整个窗口**(`min-height:100vh`),内层另建 `.ctx-win-inner` 供测量 —— 否则窗口比内容高时会露出没加暗色的纯亚克力条。
  - 残留:展开时仍有极微弱的两层错位感,是**动画亚克力窗口尺寸的物理限制**(DWM 背板与 Chromium 重绘天然不同步),用户判定可接受,定稿。
  - **鼠标指针**:菜单打开会隐藏 OSC → 主窗进入 `.ui-hidden`(`cursor:none`),旧的 DOM 菜单靠全屏 `.ctx-backdrop` 保住指针,窗口版没有 → 新增 `ui:menu` 广播 + `.app.ui-hidden.menu-open { cursor: default }`。
- **逐帧长按乱跳(已修)**([useShortcuts.ts](../src/renderer/src/useShortcuts.ts)):mpv 的 `frame-step` 是"播一帧再暂停",这一瞬 `paused` 变 false;而按键自动重复(~30/s)每次都重新判断 `paused`,撞上那个窗口就掉进 `seekBy(5)` → 连着几十次直接飞到片尾。改为**按下第一下就锁定模式**(step/seek)直到 keyup(失焦也复位),长按重复限流 50ms(`frame-back-step` 开销大,吃不消 30/s)。
- **配置隔离**：mpv 启动加 `--no-config`,不再读用户 `%APPDATA%\mpv\` 下的个人配置(之前会把用户的 input.conf 快捷键带进 app)。

---

## 当前状态（2026-07-20 · 标题栏灰 + OSC 磨砂回归修复 + 无边框全屏 + HDR 字幕定性）

**阶段：修一串真机暴露的问题 —— OSC 磨砂被 `focusable:false` 干掉、全屏点 OSC 冒任务栏、标题栏色差、HDR 字幕设置无效(定性为 mpv 引擎限制)。类型/构建过。**

- **标题栏灰**([styles.css](../src/renderer/src/styles.css) `body.has-media .titlebar`):纯 CSS 磨砂**做不到** —— 播放时那 32px 背后是 **mpv 的黑 margin**(video 被 `video-margin-ratio-top` 推下去),不是主窗亚克力(亚克力只在空状态/没被 mpv 盖住时透出来)。折中:播放态取**失焦时亚克力的纯色 fallback `rgb(62,62,63)`**(用户取色),让 空↔播 尽量不跳。~~真磨砂得把标题栏做成独立亚克力子窗(未做)。~~ **→ 已否决,见下方「标题栏真磨砂 = 死路」。**

> **标题栏透明 / 真磨砂 = 死路(已定论,勿再提)**
> 原始诉求是让标题栏**透出后面的桌面和窗口**(像空状态那样)。挡路的是 **mpv 那块不透明表面**:mpv 经 `--wid` 嵌入、铺满整个客户区,`--video-margin-ratio-top` 只把**画面**推下去,顶上那 32px 仍是 **mpv 自己画的黑**。它在 Chromium 合成层之后、却在窗口亚克力之前 → **CSS 再透明也只能透出 mpv 的黑,透不到桌面**(空状态能透,是因为那会儿 mpv 没在铺)。
> 改做独立亚克力子窗也没用:磨的是同一片黑 → 出来还是暗灰,**和现在的纯色看不出区别**,还白搭上去不掉的 DWM 阴影 + resize 时跟不上主窗的重绘缝(整条顶栏上比侧面板明显得多)。
> **纯色 `rgb(62,62,63)` 是这条路上的正确答案,不是妥协。**
- **OSC 磨砂回归修复**(关键)([index.ts](../src/main/index.ts)):Phase 1 给 OSC 加的 `focusable:false` **会让 Win11 拒绝渲染它的 acrylic backdrop**(退成纯灰,无磨砂)—— 面板 `focusable:true` 所以正常,OSC 不正常。改回 `focusable:true`;副作用(全屏点按钮激活子窗、抢前台)用 `oscWin.on('focus') → win.focus()` **把焦点弹回主窗**化解(OSC 无文本输入,不需保留焦点)。真机 A/B(`MMP_OSC_FOCUSABLE` env 开关)实锤是它。
- **无边框全屏 → 修任务栏冒头**([index.ts](../src/main/index.ts) `toggleFullscreen`/`syncFsTopmost`):原生 `setFullScreen(true)` 下 **Electron 忽略 `setAlwaysOnTop`**,所以点 OSC 抢前台那一帧 shell 会把任务栏弹出来、压不住。改成**无边框全屏**(铺满整块显示器 `screen.getDisplayMatching().bounds` + `setAlwaysOnTop(true,'screen-saver')`),置顶盖在任务栏 z 序上 → 任务栏那帧落在窗口后面、看不见。置顶与"app 是否在前台"绑定(`syncFsTopmost`,接进 `updateFocus`)→ Alt-Tab 切走自动松开、不赖在别的程序上;`fsWasMaximized` 记原最大化态、退出还原。
- **HDR 字幕亮度(定性 = mpv 引擎限制,非本项目 bug)**:`sub-hdr-peak`(文字/ASS)+ 新增 `image-subs-hdr-peak`(位图/PGS)都接了([index.ts](../src/main/index.ts) `applyMpvSettings` + `settings:set`)。但**真机 + IPC 实测**:PGS 字幕对 `image-subs-hdr-peak` 从 10→10000、`blend-subtitles` yes/video、`target-trc=pq` **全程零反应**(`sub-visibility` 关→开确认重合成有效)。查证 mpv issue #13673/#13680/#16523 —— gpu-next 的 HDR 字幕亮度**只对文字字幕生效,位图(PGS)引擎没接**。MPC 能压是渲染器层缩放叠加层,mpv 不暴露此开关。设置保留(对 SRT/ASS 有效)。曾试 `--blend-subtitles=yes` 已回退(对 PGS 无用 + 会让 SVP 补帧把字幕卷入插值)。
- **顺带发现(待办)**:bundled mpv **没传 `--no-config`**,会读用户 `%APPDATA%\mpv\input.conf` → 个人快捷键泄漏进 app。该做配置隔离(独立 config-dir),未做。

---

## 当前状态（2026-07-19 · 音频直通开关 + OSC 自动隐藏时长可调）

**阶段：两个设置项 —— 音频直通(bitstream 到外接功放/解码器)+ OSC 自动隐藏时长可调。类型/构建过;待用户实测。**

- **音频直通**(mpv `audio-spdif`):[settings](../src/main/settings.ts) `audioPassthrough:false` + `passthroughCodecs:'ac3,eac3,truehd,dts,dts-hd'`;[index.ts](../src/main/index.ts) `applyAudioPassthrough()`(开→ `audio-spdif` 设为勾选的格式,关→空=软解),在 `applyMpvSettings` 和 `settings:set` 里生效。[SettingsPanel](../src/renderer/src/components/SettingsPanel.tsx) 主开关默认关;**打开后**下面 `.set-suboptions`(左边框缩进)列出 5 个格式子开关(AC-3 / E-AC-3 / TrueHD·Atmos / DTS / DTS-HD·DTS:X),关闭时收起。**不做自动 fallback**(用户无硬件可测,按需自选)。
- **OSC 自动隐藏时长**:[settings](../src/main/settings.ts) `oscHideDelay:5`(秒);`revealUi` 的隐藏定时器从硬编码 5000ms 改读 `getSettings().oscHideDelay*1000`(悬停 linger 走同一路径,一并生效)。[SettingsPanel](../src/renderer/src/components/SettingsPanel.tsx) 新增 **Controls** 分区,滑条 1–15s + 数字框(手输可到 120s),默认 5(说明第二行标 `Default = 5 seconds`)。

---

## 当前状态（2026-07-19 · 面板亚克力化 Phase 2:左设置面板 + 互斥 + 动画打磨）

**阶段：左（设置）面板也成独立亚克力窗口(复用右面板那套);两面板互斥+双侧让 OSC;动画/缩放/配色打磨。类型/构建过;真机迭代确认。**

- **左设置面板**([index.ts](../src/main/index.ts) `leftPanelWin = makePanelWindow('settings')`,[PanelView](../src/renderer/src/views/PanelView.tsx) kind=settings)。`OverlayView` 里内嵌 `SettingsPanel` + 所有面板 state/effect 全删 —— 两面板现在都由主进程拥有/开关。
- **互斥 + 双侧让 OSC**:`oscRestBounds` 改为在左右两侧各减去 `panelW`,OSC 居中于中间空档;`togglePlaylistPanel`/`toggleSettingsPanel` 开一个前先关另一个(`closeRightPanel`/`closeLeftPanel`),都 `slideOscToRest` 让 OSC 平滑 glide(右面板开→左移,设置开→右移)。**理由**:两个 440px 面板 + OSC 在普通窗宽下塞不下。
- **动画打磨**(见 Phase 1 的"内容滑"结论 —— 窗口不能滑出界):**预热**(加载时 `showInactive`@opacity0,消除首次开的系统缩放动画);淡入淡出 easeOutCubic 两向(关闭时磨砂不滞后);**关闭 120ms 快速消失**(平移感靠内容 translateX,磨砂框不必逗留)。曾试"窗口逐帧 resize 长出来"求真滑入,实测吃亚克力**重绘缝 + 内容重影**,已弃(录屏确认)。
- **缩放条**([ResizeGrips](../src/renderer/src/components/ResizeGrips.tsx))扩展:右面板 e/s/se(左上角锚),左面板 w/s/sw(右上角锚,左边缘移动);grip 算好目标 rect 发 `win:set-bounds`,主进程 clamp 到最小尺寸。
- **配色/文案**:设置开关"开"态改**品牌蓝→紫渐变 + 白圆点**(统一 Open File 按钮);`Row` 的 `desc` 支持 ReactNode,两个语言设置的说明硬换行(`Default = …` 独占第二行,不再吊在上一行尾)。

---

## 当前状态（2026-07-19 · 面板亚克力化 Phase 1:右面板成独立亚克力窗口）

**阶段：把右（playlist/chapters/audio&sub）面板从主窗口内嵌 DOM 改成真·Win11 亚克力子窗口(克隆 OSC 那套)——终于能磨砂到视频上。方案见 [plan](../.claude/plans/synchronous-giggling-kernighan.md)。类型/构建过;真机迭代中。**

- **架构**:`broadcast()` 从硬编码 `[win, oscWin]` 改为扇出到面板窗口([index.ts](../src/main/index.ts));[App.tsx](../src/renderer/src/App.tsx) `?win=panel&kind=…` 路由 → 新 [PanelView](../src/renderer/src/views/PanelView.tsx)(挂 `usePlayer`+`useShortcuts`、加 `body.panel-win`、Esc 关);`RightPanel` 从 [OverlayView](../src/renderer/src/views/OverlayView.tsx) 移除;**主进程接管开关**(`ui:panel-toggle` playlist → `togglePlaylistPanel`)。
- **窗口**:`makePanelWindow` 克隆 OSC 选项(acrylic、frameless、`parent:win`、`show:false`),**直角**(`CORNER_DONOTROUND`,贴边)。`panelBounds` 从 `win.getBounds()` 算(右边条,标题栏下,全屏顶到 0),`layoutPanel` 在 move/resize/全屏跟随;保留 `panelOpen → oscRestBounds/slideOscToRest` 让 OSC 让位。
- **动画(关键权衡)**:独立窗口没法裁剪到父窗口,窗口一滑就飘到桌面外 → 改成**窗口原地淡入淡出 + 内容在窗口内 translateX 滑入**(超出被窗口裁掉)。`panel:reveal` IPC 通知渲染层滑内容。关闭时 opacity 0 + `setIgnoreMouseEvents(true)`(不挡视频、不触发系统缩放动画)。CSS:`body.panel-win .panel` 填满窗口、透明(用 `--panel` 磨砂 scrim)、`overflow:hidden` 裁内容滑动。
- **缩放条**([ResizeGrips](../src/renderer/src/components/ResizeGrips.tsx)):面板窗口盖住主窗口右/右下的 OS 缩放边 → 在面板**右/下/右下角**(藏在 8px 磨砂内边距里、不碰滚动条/折叠键/工具栏)放隐形 grip,拖它们经 `win:get-bounds`/`win:set-size` 缩放**主窗口**(右 docked → 左上角钉死)。
- **OSC `focusable:false`**:点 OSC 按钮不再激活子窗口抢前台 → 修复**全屏点 OSC 暂停冒出任务栏**;OSC 无文本输入,点击/拖动照常。

---

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
