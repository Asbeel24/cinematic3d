# 故障排查

先跑 `node <skill>/scripts/doctor.mjs`，它会逐项给 PASS / FAIL 和修法。

## 环境
| 症状 | 原因 | 修法 |
| --- | --- | --- |
| `Not inside a cinematic-3d shot project` | 不在镜头工程目录里 | `cd <name>`；或先 `new.mjs` |
| `Cannot find module '@remotion/...'` | 依赖没装 | 在 `<skill>/starter` 里 `npm install`，再 `new.mjs`（会链接依赖）；或在工程里 `npm install` |
| 卡在下载 Chrome / `ENOTFOUND remotion.media` | 第一次运行要联网下载 Chrome Headless Shell | 联网重试；离线设 `CINE_BROWSER=/path/to/chrome-headless-shell` |
| 全黑帧、`mean 0.000` | WebGL 没起来 | 换后端：Mac `CINE_GL=angle`，Linux 无 GPU `CINE_GL=swangle`，Linux GPU `CINE_GL=angle-egl`。先跑 doctor：它的 test render PASS 说明后端没问题，问题在场景里（见下一行） |
| 全黑或几乎全黑、doctor 却正常 | 某个几何体有 NaN 顶点 | stills 会打印 `WARNING: geometry produced NaN`；查 `Math.pow(负数, 小数)`、`sqrt(负数)`、`0/0`，把参数夹到合法范围 |
| `Timed out evaluating page function` | 机器太忙 | stills 已自动重试一次；还超时就别同时跑别的渲染 |
| 渲染非常慢 | 用了 CPU 软渲染 | Mac 上不要设 `CINE_GL`；看 doctor 的 speed 项 |
| `No space left on device` | 正式渲染的临时帧占空间 | 清掉旧的 `out/`、`review/` |

日志里的 `Detected differing memory amounts`、`THREE.Clock: This module has been deprecated` 是无害提示，可以忽略。

## 代码
| 症状 | 原因 | 修法 |
| --- | --- | --- |
| TypeScript 报错 | | 在工程目录 `npx tsc --noEmit -p .` 看具体行 |
| `<Beam>/<Dust>/<Steam> must be inside <KeyLight>` | 粒子放在了 KeyLight 外面 | 放进 `<KeyLight>...</KeyLight>` |
| 物体不动 | 动画没写在 `useTimeline` 里，或 ref 没挂上 | `useTimeline((t) => { ref.current.xxx = f(t) })` |
| 动画只在预览里动、渲染时不动 | 用了 `useFrame` 或 state | 改成 `useTimeline` |
| 改了文字 / 颜色，贴图没变 | `drawTexture` 的 key 没包含这个参数 | key 里拼上文字和颜色 |
| 合成 id 找不到 | `shot.config.ts` 的 `name` 改过 | 合成 id = `<name>-9x16`；`--comp` 用新名字 |
| 黑色方块 / 物体看不见 | 法线反了或 `side` 不对 | `lathe` 轮廓从下往上写；平面用 `side={THREE.DoubleSide}` |
| 毛长到物体里面 | 法线朝内 | 同上，轮廓点顺序反过来 |
| 表盘 / 标签上有闪烁的碎块 | 两个面重合（z-fighting） | 贴花离开底面 0.2–0.5 mm |
| 圆面朝上而不是朝镜头 | `lathe` / `cylinder` 的轴是 +y | `faceZ(geometry)` |

## 画面
| 症状 | 修法 |
| --- | --- |
| 太暗 / 死黑多 | 先加 `Bounce` 强度（×1.5），再加 `SkyFill`，最后才动 `film.exposure` |
| 过曝 / 高光多 | 降主光强度；高调背景（粉、白）把 `exposure` 压到 0.8 |
| 画面发灰、没对比 | 降 `StudioEnv` 和 `SkyFill`，让主光方向更明显 |
| 光束看不见 | 提 `haze`；主光要瞄准开口中心；镜头别在光束里（`near` 会淡出镜头前 0.6 m） |
| 百叶影太糊 / 看不见 | `softness` 降到 2，`slats` 降低让条纹变宽，主光 `angle` 收窄到 6–7° |
| 主体是糊的 | `focus.point` 移到主体前表面；光圈 2.8 → 4 |
| 转动的产品上一端的字虚了 | 光圈 → f/5.6，`focus.point` 放在正面中心 |
| 网孔、织物纹理看不见 / 像光板 | 图案放大到画面上 3–4 px 以上，或用几何体做 |
| 白色产品像肥皂 | 加分缝线、脚垫、指示灯、不同粗糙度的面板 |
| 物体漂浮 | 底部 `y` 对齐地面；有 `castShadow` 和地面 `receiveShadow` |
| 字被平台 UI 挡住 | 看联系表上的青色线；`Caption place` 或机位调整 |
| 主体太小 / 太大 / 偏到安全区外 | 用 `useShot({ frame })` 自动取景，调 `fill` |
| 粒子 / 蒸汽在台灯下不亮 | 放在 `<KeyLight>` 里，`aperture` 放在灯罩口；不要加 gobo |
| 台灯近处的物体没有阴影 | 已自动处理（阴影近平面随灯距缩小）；仍没有就把灯抬高到 0.4 m 以上 |
| 文字贴图被拉伸 | 用"虚拟宽画布"（见 materials.md） |
| 地面上一条细横线（浅景深） | 对焦平面和地面相交处那一窄条是清楚的，正常现象，不用修 |
| 分屏标签中途从上跳到下 | 已修（每个标签整条镜头只选一次行）；想固定用 `rows={[undefined, 0.66, undefined]}` |
| 单个主体漂出白模 / 线框带 | 分割线方向要跟环绕方向一致，见 looks/render-pass.md |
| 玻璃瓶里的液体发黑 | 瓶身用 `glassShell()`，液体用 `jelly()`，不要两层透射 |
| 颗粒太重 / 文件太大 | `film.grain` 0.35 → 0.2 |
| 快速运动有频闪感 | 加 `useMotionBlur(from, to, 8)` |

## 确定性
同一帧两次渲染不一样（doctor 的 determinism FAIL，或成片闪烁）：
1. 搜 `Math.random`、`Date.now`、`performance.now`、`useFrame`，全部换掉。
2. 有没有在 `useTimeline` 里累加状态（`+=`）？改成从 `t` 直接算。
3. 自己 `document.createElement("canvas")` 画贴图时，用 `getContext("2d", { willReadFrequently: true })`（CPU 光栅，GPU 光栅的文字抗锯齿不稳定）。最好直接用 `drawTexture`。
4. 用 `scripts/_cmp.mjs a.png b.png` 比较两次 stills 的同一帧，看差在哪里。
