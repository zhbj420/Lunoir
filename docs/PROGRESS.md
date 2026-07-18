# MMPlayer 进度与问题记录

> 每到相对重要的节点更新此文档。方案见 [PLAN.md](PLAN.md)。

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

### 全屏（多处修）
- 面板全屏到顶（`body.fullscreen .panel { top:0 }`）。
- **切全屏不弹 OSC**：main 侧切换后 350ms 屏蔽移动 reveal（避开 resize 的 synthetic mousemove）；`f` 键早返回。
- **点 tab 不再沉底 / 不冒任务栏**：主窗全屏下重获焦点时 `setAlwaysOnTop(false→true)` 强制重置 TOPMOST（弃用会冒任务栏的 `moveTop`）。根因：从 OSC 子窗开面板 → 焦点交回主窗触发。

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
- **每轨码率 + 音频子档（ffprobe 管线，方案已实测锁定 2026-07-18）** —— mpv `demux-bitrate`/`codec-profile` 对**非活动轨**为 `(unavailable)`、拿不到；**ffprobe 一次给全部流的 `bit_rate` + `profile`**（实测：ac3→bit_rate、dts→profile=DTS），跟 MPC-HC（LAV）一致。落地：setup 打包/下载 ffprobe → 主进程开片 spawn → 解析 JSON → 按 stream index 合并进 track-list → 显示码率 + `DTS-HD MA`/`Dolby TrueHD Atmos` 真名。（顺带分开两条 English DD 5.1：640k vs 448k。）系统 `C:\ffmpeg\bin\ffprobe.exe` 可先用于开发验证。
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
