# Cinematic 3D Skill · Claude Code 实施方案

Nov 8, 2026 · @D4nN9

## 目标与范围

交付一个原创的 Claude Code skill `cinematic-3d`：用户用一句话描述镜头，Claude 用 three.js 在本地搭出真实 3D 场景，自检静帧后渲染出 9:16 / 16:9 / 1:1 的 MP4。对标 cinematic3d.vercel.app 的能力，但代码、规则、场景、素材全部自研。

**交付物**

- `cinematic-3d/` skill 文件夹：SKILL.md + references + starter 项目 + scripts + PROMPTS.md + examples
- 5 个风格（Look）的示例场景，每个附一条渲染好的 MP4
- 一键安装说明（Mac / Windows / Linux）

**不做（v1）**

- 不接入 AI 生成模型（不调用 Seedance、Midjourney 等），画面 100% 由代码生成
- 不依赖 Blender 或任何 3D 软件，不下载外部模型和 HDRI
- 不做实时网页预览器，只做离线渲染

**原创边界（给 Claude Code 的硬性约束）**

- 不得使用、参考或还原任何付费 skill 包的文件、代码或演示视频
- 示例场景的主体和构图自定，不复刻对方的 CRT 书桌、NOVA 收音机、咖啡杯镜头
- 技术手法（gobo 投影、shell fur、render pass 分屏等）属于公开图形学技术，可以自由使用
- 字体只用开源授权（OFL / Apache），音效只用 CC0 或可商用授权

## 技术栈与环境

渲染链路是 Remotion 驱动无头 Chrome，逐帧调用 three.js 画面，再编码成 MP4。所有动画都是帧号的纯函数，同一帧永远得到同一张图。

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 渲染与编码 | `remotion` + `@remotion/cli` + `@remotion/renderer` | Remotion 4 自带 ffmpeg 和 headless Chrome，所有 `@remotion/*` 包锁同一版本 |
| 3D | `three` + `@react-three/fiber` + `@react-three/drei` | 通过 `@remotion/three` 的 `<ThreeCanvas>` 挂载 |
| 后期 | `postprocessing` + `@react-three/postprocessing` | ACES、景深、泛光、颗粒、暗角；光晕等自写 Effect |
| 动态模糊 | `@remotion/motion-blur` 或自写子帧累积 | M0 实测后二选一 |
| 文字 / 叠层 | Remotion DOM 层（AbsoluteFill） | 标签、字幕用 HTML 渲染，比 3D 文字更锐 |
| 语言 | TypeScript | kit 对外 API 全部带类型 |

**运行环境**：Node.js 20 LTS（最低 18），约 1 GB 磁盘；Mac 用默认 GL（angle），Linux 服务器用 `--gl=angle-egl` 或 `swangle`。

**输出规格**：1080×1920 / 1920×1080 / 1080×1080；默认 30fps，可选 24fps；H.264 CRF 18、yuv420p，另提供 ProRes 4444 选项供二次调色。

**授权注意**：Remotion 对个人和 3 人以内的公司免费，超过需购买公司授权（以 remotion.dev/license 为准）。如果这个 skill 之后要对外售卖，README 必须写明这一点；渲染核心要抽象成一层，留出以后换成自研 Playwright + ffmpeg 渲染器的余地。

## 仓库结构

skill 本体和渲染工程分开：SKILL.md 和 references 给 Claude 读，starter 是每次新建镜头时复制出去的工程模板。

```
cinematic-3d/
├─ SKILL.md                 工作流 + 摄影/灯光/运动规则（≤ 300 行）
├─ README.md                安装 3 步 + 授权说明
├─ PROMPTS.md               30 条示例 prompt，按 Look 分组
├─ references/
│  ├─ kit-api.md            kit 全部函数签名与用法
│  ├─ looks/                每个 Look 一份精确配方（灯位、材质参数、后期值）
│  ├─ camera.md / light.md / materials.md / motion.md
│  ├─ render-settings.md    分辨率、帧率、编码、代理渲染
│  ├─ review-checklist.md   自检清单
│  └─ troubleshooting.md
├─ starter/                 Remotion + three.js 工程模板
│  ├─ package.json
│  ├─ remotion.config.ts
│  └─ src/
│     ├─ Root.tsx           注册所有 Composition（3 种画幅）
│     ├─ shot.config.ts     当前镜头参数：画幅、时长、fps、seed、look
│     ├─ kit/
│     │  ├─ camera.ts       相机运动 API
│     │  ├─ lights.tsx      主光/反射/gobo/光束/环境
│     │  ├─ materials.ts    白模/金属/果冻/毛发/玻璃
│     │  ├─ geometry.ts     圆角盒、旋转体、挡板等程序化形体
│     │  ├─ particles.tsx   灰尘、蒸汽
│     │  ├─ post.tsx        后期链与自写 Effect
│     │  ├─ renderPass.tsx  成片/白模/线框分屏
│     │  ├─ motion.ts       缓动、弹簧、漂移、种子随机数
│     │  └─ overlay.tsx     DOM 标签/字幕层
│     └─ scenes/            5 个示例场景，每个一个文件夹
├─ scripts/
│  ├─ new.mjs               复制 starter 到新项目、装依赖
│  ├─ stills.mjs            渲染关键帧 + 拼接联系表 + 曝光统计
│  ├─ render.mjs            代理渲染 / 正式渲染
│  └─ doctor.mjs            环境自检
└─ examples/                5 条成片 MP4 + 封面图
```

## Kit API 规格

kit 是这个 skill 的核心资产。Claude 写镜头时只组合 kit，不重写底层，这样每条视频的质感都有保底。

**确定性铁律（违反即 bug）**

1. 一切随时间变化的量都由 `useCurrentFrame()` 算出，禁用 R3F 的 `useFrame` 做动画、禁用 `Date.now()` / `performance.now()`
2. 禁用 `Math.random()`，统一用 `kit/motion.ts` 里的种子随机数（mulberry32），种子来自 `shot.config.ts`
3. 材质贴图、噪声、百叶遮罩全部用 Canvas / DataTexture 程序化生成；异步加载（字体）用 `delayRender` / `continueRender`
4. 颗粒等逐帧噪声用帧号作种子
5. 验收：同一帧渲染两次，像素差异为 0

**接口草案**（Claude Code 可调整命名，但功能要覆盖）

```ts
// camera.ts —— 一个镜头只允许一个主运动
shot.lens(35 | 50 | 85)                         // 焦段，换算成 FOV
shot.push(from, to, {ease})                     // 推近
shot.dolly(fromZ, toZ, {ease})                  // 轨道前后
shot.orbit(deg, {target, ease})                 // 环绕
shot.pan / shot.tilt / shot.crane(...)
shot.whip(dir, atFrame, {samples: 16..32})      // 甩镜 + 强制动态模糊
shot.drift({px: 2..6, seed})                    // 手持微漂移，默认开
shot.focus(target | distance, {aperture})       // 物理景深

// motion.ts
ease.cine = cubicBezier(.2,.8,.2,1)            // 默认缓动
springAt(frame, {overshoot: 0.01..0.02})       // 默认超调 1–2%
rng(seed) / noise1D / noise3D

// lights.tsx
<KeyLight kind="sun|softbox|spot" temp={K} />  // 唯一主光，色温用开尔文
<Bounce from="floor|wall" />                   // 反射补光
<Gobo pattern="blinds|window|leaves" />        // SpotLight.map 投影
<Beam haze={0..1} />                           // 体积光锥（加法着色器）
<StudioEnv />                                  // RoomEnvironment 生成的 PMREM 环境

// materials.ts
clay(), chrome(), plastic(color), glass(), jelly(color), fur({shells: 32..64}), paper()

// post.tsx —— 固定顺序
<Film dof bloom={0.2} halation={0.3} grain={0.35} vignette={0.25} aces />

// renderPass.tsx
<RenderPass passes={["beauty","clay","wire"]} split="diagonal" label />
```

**关键实现要点**

- **百叶窗投影**：Canvas 生成条纹图贴到 `SpotLight.map`，开阴影和软阴影；条纹密度、角度、边缘柔度可调
- **光束里的灰尘**：光锥用加法混合 + 沿轴衰减 + 噪声；灰尘用 Points，着色器里按到光锥轴线的距离提亮，光束外几乎不可见
- **光晕 halation**：高光阈值 → 模糊 → 偏红橙染色 → 叠加回去，放在 ACES 之前
- **Render pass**：同一场景渲染到 2–3 个 RenderTarget（白模用 `scene.overrideMaterial`），用带动画的斜线遮罩合成，分割线加 1px 高亮；标签走 DOM 叠层
- **果冻字**：开源字体转 typeface JSON → `Text3D` 大倒角；`MeshPhysicalMaterial` 透射 + 清漆；下落用弹簧，落地做压扁-回弹（这个 Look 允许超调超过 2%）
- **毛发**：shell texturing，32–64 层壳，哈希噪声做 alpha test，重力和风由帧号驱动
- **动态模糊**：默认每帧 8 子帧，甩镜时 16–32 子帧；快门角默认 180°

## 五种 Look 与示例场景

v1 的五种 Look 覆盖产品镜头、标题字、氛围空镜和“这是代码做的”的展示。主体选用音乐和深圳元素，和竞品拉开距离。每个场景默认 9:16、6 秒、30fps。

| Look | 示例场景（原创主体） | 镜头运动 | 关键技术 | M1 性能目标（M 系列 Mac） |
| --- | --- | --- | --- | --- |
| Render Pass | 书桌上的采样器 + 磁带机，成片 / 白模 / 线框斜向分屏 | 缓慢 orbit 20° | 多 RenderTarget 合成、DOM 标签 | ≤ 20 秒 |
| 果冻字 Jelly Type | 任意单词逐字掉落，压扁回弹后静止 | 低机位 push | Text3D 倒角、透射材质、弹簧 | ≤ 45 秒 |
| 毛发 Fur | 一只毛绒耳机或毛绒字母在微风里 | 85mm 微距 dolly | shell fur、轮廓光 | ≤ 40 秒 |
| 转台 Turntable | 一台合成器或音箱立在石台上，品牌字可换 | 产品自转 + 慢 push | 棚拍环境光、反射地面 | ≤ 20 秒 |
| 黄金时刻 Golden Hour | 深圳出租屋窗边，黑胶唱机 + 盖碗茶冒热气，百叶影慢慢爬过桌面 | 几乎静止 + drift | gobo、光束、灰尘、蒸汽 | ≤ 20 秒 |

每个 Look 在 `references/looks/<look>.md` 里写成精确配方：灯位坐标和色温、材质参数、后期数值、可改的字段（文字、颜色、主体）、不该改的字段。Claude 新建镜头时从最接近的 Look 复制起步。

v2 可加：屏幕打字（CRT / 终端）、铬金属 Logo 片头、玻璃折射、城市夜景航拍。

## SKILL.md 工作流与规则

SKILL.md 的核心是一条带三道闸门的工作流：方案要你确认，画面要过 Claude 自检，草稿要你过目，然后才跑正式渲染。

&#91;embedded content: 镜头工作流 · 3 道闸门，2 个回路\]

自检不过就回到搭场景一步，你的修改意见也回到这里；两条回路都是一次只改一个变量。

**镜头方案格式**（第 2 步交给用户的内容）：画幅与时长 · Look · 主体与构图（前 / 中 / 后景）· 镜头运动与焦段 · 主光方向与色温 · 节奏（关键帧在第几秒）。不超过 8 行。

**规则（写进 SKILL.md）**

- **镜头**：焦段只用 35 / 50 / 85mm；每个镜头一个主运动；静止镜头也要有 2–6 px/帧的漂移；关键动作落在整拍或整秒
- **灯光**：一个有来由的主光 + 一个反射补光；主光和环境要有冷暖对比；光束里要有雾和灰尘；暗部保留细节
- **运动**：禁止线性匀速；弹簧超调 1–2%（果冻字例外）；快速运动必须有快门模糊
- **构图**：前 / 中 / 后景分层，前景允许虚化；9:16 主体在平台安全区内
- **复用**：只组合 kit，不重写底层；新镜头从最接近的 Look 复制起步
- **迭代**：用户说“主光再暖一点”“环绕再慢一点”时，只改对应的一个参数，在回复里写明改了哪个值、从多少改到多少

**自检清单**（`references/review-checklist.md`）

- 曝光：`stats.json` 中高光裁切 < 1%、死黑 < 3%
- 对焦：主体清晰，景深焦平面落在主体上
- 几何：无穿模、无悬空物体、接触面有接触阴影
- 时间：相邻帧无闪烁，颗粒不“卡住”
- 文字：可读，不被平台 UI 遮挡
- 规格：画幅、时长、帧率与方案一致，首尾无黑帧

## 脚本与 CLI

四个脚本是 Claude 在工作流里唯一要调用的命令，参数尽量少，输出要能被 Claude 直接读懂。

| 脚本 | 用法 | 输出 |
| --- | --- | --- |
| `doctor.mjs` | `node scripts/doctor.mjs` | Node 版本、磁盘空间、Chrome 与 GL 后端、试渲染 1 帧的耗时，逐项 PASS / FAIL + 修复建议 |
| `new.mjs` | `node scripts/new.mjs <name> --look golden-hour --format 9:16 --sec 6` | 在当前目录生成镜头工程、写好 `shot.config.ts`、装好依赖 |
| `stills.mjs` | `node scripts/stills.mjs [--frames 0,25%,50%,75%,last]` | 单帧 PNG + 一张联系表 `review/contact.png` + `review/stats.json`（平均亮度、高光/暗部裁切占比） |
| `render.mjs` | `node scripts/render.mjs --proxy` / `--final [--prores]` | proxy：0.5 倍分辨率、关掉动态模糊；final：全分辨率 MP4 + 耗时与文件大小 |

`stills.mjs` 的联系表是自检循环的关键：Claude 用 Read 打开这张图就能一次看到整个镜头的节奏。联系表上叠加 9:16 平台安全区（小红书 / 抖音 UI 遮挡区域）的细线，正式渲染时不带。

## 里程碑与验收标准

按 M0→M5 顺序做，每个里程碑结束时 Claude Code 必须停下来，交出验收物等我确认，再进入下一步。M1 是质感闸门：黄金时刻不达标，就不铺开做其他 Look。

| 里程碑 | 内容 | 验收标准 |
| --- | --- | --- |
| M0 技术验证 | 跑通 Remotion + ThreeCanvas + postprocessing；确定性测试；动态模糊两种方案对比 | 一个旋转立方体带 ACES + 颗粒渲出 3 秒 MP4；同帧两次渲染像素差为 0；一页结论：后期和动态模糊用哪种方案、每帧耗时 |
| M1 Kit 核心 + 黄金时刻 | camera / motion / lights（含 gobo、光束）/ particles / post 全部完成；做出黄金时刻场景 | 9:16 6 秒 MP4 + 联系表；百叶影边缘柔和、光束里可见灰尘、暗部不死黑；渲染 ≤ 20 秒；**我审过质感才能进 M2** |
| M2 其余四个 Look | Render Pass、果冻字、毛发、转台 | 每个 Look 一条成片 + 联系表，达到「五种 Look」表里的性能目标 |
| M3 Skill 层 | SKILL.md、references、PROMPTS.md、四个脚本 | 在全新的 Claude Code 会话里，只给一句 prompt，能从 0 做出一条合格镜头，全程无人工改代码 |
| M4 盲测 | 用 PROMPTS.md 里随机抽 5 条在新会话里跑 | ≥ 4 条一次成片或一轮自修后成片；记录失败原因并回填 troubleshooting.md |
| M5 打包（可选声音） | README 安装流程、一句话安装 prompt、zip 打包；可选：CC0 音效库 + `<Audio>` 卡点 | 在另一台干净的 Mac 上 5 分钟内装好并跑通 doctor；zip ≤ 5 MB（不含 node\_modules） |

## 给 Claude Code 的启动指令

用法：把本文档导出为 Markdown，放到空仓库根目录命名为 `SPEC.md`，在该目录启动 Claude Code，粘贴下面这段。

```markdown
你要实现一个原创的 Claude Code skill：cinematic-3d。完整规格在 ./SPEC.md，先通读一遍。

工作方式：
1. 严格按 SPEC 里的里程碑 M0→M5 推进。每个里程碑开始前，用 3–5 行写出计划；结束时停下，交出验收物（MP4 路径、联系表、耗时），等我确认再继续。
2. 每个里程碑一个 git commit，message 写明里程碑编号。
3. 确定性铁律不可违反：动画只用 useCurrentFrame()，禁用 useFrame / Math.random / Date.now。
4. 不下载外部 3D 模型、HDRI、贴图；形体和贴图全部程序化生成。字体只用 OFL/Apache 授权。
5. 不得参考、搜索或使用任何付费 skill 包（包括 cinematic3d.vercel.app 和 superprofile 上的同类产品）的文件。
6. 每次改完画面，先跑 scripts/stills.mjs，用 Read 看联系表自检，再决定是否正式渲染。自检结论写进回复。
7. 遇到 SPEC 没覆盖的技术选择，选最简单可行的方案，在回复里用一句话说明理由。

现在从 M0 开始。
```

## 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| `@react-three/postprocessing` 在 ThreeCanvas 里不按 Remotion 帧号刷新 | 后期丢帧或与画面错位 | M0 先验证；不行就自建 EffectComposer，在帧号变化时手动 render |
| 无头 Chrome 的 WebGL 在 Linux / Windows 上行为不一 | 别人机器上渲不出来 | doctor.mjs 自动测 GL 后端；文档写清 `--gl` 参数的取值 |
| 动态模糊子帧让渲染时间翻 8–32 倍 | 超出性能目标 | 默认只在快速运动段开启；proxy 渲染关闭 |
| 程序化形体看起来“塑料感” | 质感不如竞品 | 质感靠灯光和后期兑现：M1 单独设质感闸门，不达标不铺开 |
| Claude 每次重写底层而不是复用 kit | 质量飘忘、耗时变长 | SKILL.md 明确「只组合 kit、从最近的 Look 复制起步」；M3 用新会话测试 |
| Remotion 公司授权（3 人以上） | 对外售卖时的合规问题 | README 写明；渲染层抽象，v2 评估自研 Playwright + ffmpeg 渲染器 |
| 与竞品画面过于相似 | 侵权争议、品牌模糊 | 主体用音乐 / 深圳元素，完全自定构图；不用竞品的镜头作参考图 |
