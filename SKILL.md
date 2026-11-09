---
name: cinematic-3d
description: 一句话镜头描述 → 本地 three.js 场景 → 自检关键帧 → Remotion 渲出 9:16 / 16:9 / 1:1 电影感 3D 短镜头（MP4）。用户想做产品转台、3D 字、毛绒物体、黄金时刻室内光、成片/白模/线框分屏这类"电影感 3D 小片"、或说"做一个 3D 镜头 / 3D 短视频 / cinematic 3D"时使用。
---

# cinematic-3d

把一句镜头描述做成一条 3–10 秒、可直接发小红书 / 抖音的 3D 镜头。所有东西都在本地用代码生成：
没有外部模型、HDRI 或贴图下载。质感靠 `kit/`（灯光、材质、相机、后期）保底，你只负责**组合 kit**。

`<skill>` 指这个 SKILL.md 所在的目录。所有命令都在**镜头工程目录**里运行。

## 工作流：3 道闸门，2 个回路

```
① 读需求 → ② 镜头方案 ──闸门1：用户确认──→ ③ 建工程 + 搭场景
        ↑                                       ↓
        │                                ④ 关键帧自检 ──闸门2：自检不过 → 回③（一次只改一个变量）
        │                                       ↓
        └──── 用户修改意见 ←──闸门3：用户看草稿── ⑤ 代理渲染
                                                ↓ 用户说"可以"
                                           ⑥ 正式渲染 → 交付
```

### ① 读需求，选 Look
从五个 Look 里选**最接近**的一个作为起点（细节见 `references/looks/<look>.md`）：

| Look | 适合 | 镜头 |
| --- | --- | --- |
| `golden-hour` | 室内窗边、桌面静物、氛围感、生活方式 | 35mm，几乎静止 + 漂移，百叶影、光束、灰尘、蒸汽 |
| `turntable` | 产品展示：音箱、合成器、耳机、香水、手表 | 50mm，产品自转 + 慢推，棚拍 + 反射地面 |
| `render-pass` | "制作过程" / 3D 作品集 / 设计展示 | 50mm，环绕 20°，成片 / 白模 / 线框斜向分屏 |
| `jelly-type` | 一个词、品牌名、口号、节日字 | 50mm 低机位 push，字母掉落压扁回弹 |
| `fur` | 毛绒物体、冬季、柔软治愈 | 85mm 微距 dolly，逆光轮廓，微风 |

需求不在五个 Look 里时，选灯光和镜头语言最接近的那个，换主体。不要从零写场景。

### ② 镜头方案（闸门 1）
动手前先给用户一份 **≤ 8 行**的方案，等确认：

```
画幅与时长：9:16 · 6 秒 · 30fps
Look：turntable
主体与构图：前景 —；中景 白色蓝牙音箱立在水磨石台上，占画面 45% 高；后景 暗灰无缝背景
镜头运动与焦段：50mm，产品自转 70° + 慢推 0.24 m，f/4 对焦在品牌字上
主光：左前上方柔光箱 4300K；右侧墙面反射 6500K 补光（冷暖对比）
节奏：0–1 s 起势，3 s 转到正面露出品牌字，6 s 停稳
```
用户没说的项用 Look 默认值，并在方案里写出来。用户说"直接做"可以跳过等待，但方案仍要写。

### ③ 建工程 + 搭场景
```bash
node <skill>/scripts/doctor.mjs            # 第一次用、或渲染报错时（任何目录都能跑）
node <skill>/scripts/new.mjs <name> --look <look> --format 9:16 --sec 6
cd <name>
```
`new.mjs` 生成工程，并把所选 Look 的场景复制成 **`src/shot/Shot.tsx`**。这是这个镜头**唯一要改的文件**。

改的顺序：
1. 文件顶部的配置对象（`GOLDEN` / `TURNTABLE` / `JELLY` / `FUR` / `RENDERPASS`）：先改标了 `editable` 的字段（文字、颜色、色温、转角……）。`do not edit` 字段是灯位和几何的依赖，不要动。
2. 换主体：用 `kit/geometry.ts`（`roundedBox` / `lathe` / `cylinder` / `smoothProfile`）和 `kit/materials.ts` 拼出新物体，替换示例里的产品组件。尺寸用**真实米制**（音箱高 0.2 m，杯子高 0.09 m）。
3. 改镜头。**换了主体就用自动取景，不要手调坐标**：
   ```ts
   useShot({ lens: 50, frame: { center: [0, 0.2, 0], size: [0.26, 0.16, 0.11], fill: 0.42, elevation: 15 },
             move: shot.dolly(0.08), focus: { point: [0, 0.2, 0.055], aperture: 4 } })
   ```
   `frame` 按主体的包围盒算出机位，让主体占画面高度的 `fill`，并落在 9:16 安全区中心。
   配合相对运动（`dolly` / `orbit` / `crane`）。焦段按主体大小选：< 10 cm 用 85，10–60 cm 用 50，整张桌子 / 房间用 35。
   多个物体时 `center` / `size` 取它们合起来的包围盒。
4. 需要字幕：`kit/overlay.tsx` 的 `<Caption>` / `<Title>`，放在 `<Stage>` 外层的 `<AbsoluteFill>` 里。

API 全在 `references/kit-api.md`。**只组合 kit，不重写底层**：不要自己写后期、不要自己建相机或灯光类、不要改 `src/kit/`。
主体的几何可以自己写：kit 的 `geometry.ts` 不够时，直接用 three 的几何体（`TorusGeometry`、`ExtrudeGeometry`、自定义 `BufferGeometry`）都可以。

### ④ 关键帧自检（闸门 2）
```bash
node <skill>/scripts/stills.mjs            # 默认第 0 / 25% / 50% / 75% / 最后一帧
```
用 Read 打开 `review/contact.png`，看 `review/stats.json`，逐项对照 `references/review-checklist.md`。
stills 打印 `WARNING: geometry produced NaN` 时先修几何（NaN 顶点会让整帧变黑）。
`--frames 0,45,90,179` 可以指定帧（联系表会按给的帧重排，适合检查某段时间里的变化）。
联系表每帧只有约 400 px 宽：看文字锐度、细纹理、焦点时，再 Read 对应的全尺寸 `review/fNNNN.png`。
不过就回到 ③，**一次只改一个变量**（一个参数；或一个组件 / 贴图的一处改动；或一次机位调整，起点和终点一起改算一次），然后重跑 stills。
第一次 stills 不算轮次，之后最多 4 轮修改。4 轮还不过，把联系表和问题交给用户。
每次在回复里写结论：哪几项 PASS、改了什么。

### ⑤ 代理渲染（闸门 3）
```bash
node <skill>/scripts/render.mjs --proxy    # 半分辨率、无动态模糊 → out/<name>-<fmt>-proxy.mp4
node <skill>/scripts/frame.mjs out/<name>-<fmt>-proxy.mp4 3   # 抽第 3 秒一帧成 PNG，Read 确认成片没问题
```
把代理片路径和联系表交给用户。用户提出修改 → 回到 ③（见下面"迭代"规则）。

### ⑥ 正式渲染 → 交付
```bash
node <skill>/scripts/render.mjs --final            # H.264 CRF 18 → out/<name>-<fmt>.mp4
node <skill>/scripts/render.mjs --final --prores   # ProRes 4444，给调色
node <skill>/scripts/render.mjs --final --format 1:1   # 另一个画幅
```
交付时写：MP4 路径、时长 / 画幅、耗时、文件大小、联系表路径。

渲染很慢（CPU 上一条 6 秒片 8–16 分钟，代理片 5–7 分钟；**fur Look 每帧 8–9 s，正式和代理都要 25 分钟左右**，代理省不了多少，可以跳过直接出正式片）：工具有前台时间上限时，把 `render.mjs` 放到后台跑。
`render.mjs` 最后才写报告文件，等它出现就是渲完了：
`timeout 590 bash -c 'until [ -f out/<comp>.json ]; do sleep 20; done'`（`<comp>` 是合成 id，如 `my-shot-9x16`、`my-shot-1x1`；代理片是 `out/<comp>-proxy.json`）。
超时没出来就再跑一次同样的等待；看进度：`grep -o 'rendered [0-9]*/[0-9]*' <日志> | tail -1`。
日志里的 `Detected differing memory amounts`、`THREE.Clock: This module has been deprecated` 是无害提示，忽略。

## 规则

**确定性（违反即 bug）**
- 所有随时间变化的量都写在 `useTimeline((t) => {...})` 里，只依赖 `t`（帧号，可带小数）。不要用 R3F 的 `useFrame` 做动画，也不要用 `Date.now()` / `performance.now()` / `Math.random()`。
- 随机数用 `rng(seed)` / `hash1` / `noise1D` / `noise3D`（`kit/motion.ts`），种子加上 `shotConfig.seed`。
- 贴图只用 `drawTexture` 或 `materials.ts` 的程序化纹理生成，不要下载图片。
- 想要的状态（位置、缩放、可见性）每帧都从 `t` 重新算出来，不要累加（不要写 `rotation.y += 0.01`）。

**镜头**
- 焦段只用 35 / 50 / 85mm：35 拍环境，50 拍产品，85 拍微距 / 特写。
- 一个镜头只有一个主运动（push / dolly / orbit / pan / tilt / crane / whip 选一个）。
- 静止镜头也要有 2–6 px 的漂移（`drift`，默认 3 px），只有 render-pass 这种设计展示可以用 2 px。
- 关键动作落在整秒或整拍上（30fps 时是 0 / 30 / 60 … 帧）。

**灯光**
- 一个有来由的主光（`<KeyLight>`：窗外太阳、柔光箱、聚光）加一个反射补光（`<Bounce>`）。可以再加弱的 `<SkyFill>` / `<StudioEnv>` 打底。
- 要有冷暖对比：场景里任意两盏灯（主光、反射、天光的天色或地色都算）至少有一组差 2000K 以上。常见是暖主光（3000–4500K）配冷补光（6500–9500K）；"偏冷、科技感"用冷主光（6000–6500K）配冷补光，再用暖一点的 `SkyFill groundTemp`（3500–4000K）做对比。
- 台灯、灯泡这类画面里的光源：见 `references/light.md` 的"实景光源"。
- 有光束就要有雾（`haze`）和灰尘（`<Dust>`）。
- 暗部保留细节：死黑 < 3%。暗了就先加补光，不要先拉曝光。

**运动**
- 不要线性匀速：缓动默认用 `ease.cine`，起止用 `ease.inOut`。
- 弹簧（`springAt`）超调 1–2%，果冻字例外。
- 快速运动必须有快门模糊：用 `useMotionBlur(from, to, 6–8)`，甩镜（`shot.whip`）会自动加。

**构图**
- 分前 / 中 / 后景，前景可以虚化（`focus` 对准中景主体）。
- 9:16 时主体和文字放在平台安全区内：上 8%、下 22%、右 14% 留给平台 UI。联系表上的青色细线就是这个边界。

**迭代**
- 用户说"主光再暖一点""环绕再慢一点"，只改对应的**一个参数**，并在回复里写明：`改了 GOLDEN.sunTemp：3300 → 3000`。
- 常见说法和对应参数见 `references/looks/<look>.md` 的"可调参数"表。
- 改完重跑 stills 自检，再交新的代理片。

## 参考

| 文件 | 什么时候读 |
| --- | --- |
| `references/kit-api.md` | 写代码前，查函数签名 |
| `references/looks/<look>.md` | 选定 Look 后，看配方和可调参数 |
| `references/camera.md` | 设计镜头运动、焦段、景深 |
| `references/light.md` | 布光、色温、光束 |
| `references/materials.md` | 选材质、换主体 |
| `references/motion.md` | 缓动、弹簧、节奏、动态模糊 |
| `references/render-settings.md` | 画幅、帧率、编码、代理 / 正式渲染 |
| `references/review-checklist.md` | 每次 stills 之后 |
| `references/troubleshooting.md` | 报错、黑帧、闪烁、渲染慢 |
| `PROMPTS.md` | 用户没想法时给他挑 |

## 交付格式

```
成片：/path/to/<name>/out/<name>-9x16.mp4（1080×1920 · 6 s · 30fps · 48 MB）
联系表：/path/to/<name>/review/contact.png
渲染：每帧 3.2 s，共 9 分 40 秒
自检：曝光 PASS（高光 0.01%，死黑 0%）；对焦在品牌字；安全区内
```
