# M0 技术验证 · 结论

日期：2026-11-08 · 环境：Linux 云容器，4 核 CPU，**无 GPU**（WebGL 走 SwiftShader 软件渲染，`--gl=swangle`）

## 结论一句话

Remotion 4.0.541 + `@remotion/three` + R3F 9 + `postprocessing` 6 跑通；同帧两次渲染像素差为 0；
**后期用自建 EffectComposer（postprocessing 库的 Effect 类），动态模糊用自写子帧累积**。

## 1. 链路

`<Stage>`（kit/stage.tsx）= `<ThreeCanvas>` + 一个 Driver：

1. `@remotion/three` 在渲染模式下把 R3F 设为 `frameloop="never"`，每次帧号变化调用一次 `advance()`。
2. Driver 在 `useFrame(…, 1)` 里**只做渲染驱动、不做动画**：读取 `useCurrentFrame()` 存的帧号，调用 `composer.render(0)`。
3. 动画写在 `useTimeline(t => …)` 里，`t` 是帧号（开启动态模糊时是子帧，如 44.78）。函数只依赖 `t`，所以是纯函数。
4. 后期链：SubframePass（HDR 半浮点累积）→ EffectPass[Bloom → ACES → Vignette → Grain]。颗粒以帧号为种子。

## 2. 确定性

| 测试 | 结果 |
| --- | --- |
| `M0-Accum8` 第 45 帧渲染两次（8 子帧 + 泛光 + 颗粒） | 1080×1080 全部像素差 **0** |

注意：`advance(performance.now())` 是 `@remotion/three` 内部调用，时间戳只会进 R3F 的 clock；kit 不读 clock，`composer.render(0)` 显式传 0，所以 postprocessing 的 `time` uniform 恒为 0，不引入不确定性。

## 3. 后期方案：自建 composer，不用 `@react-three/postprocessing`

- `@react-three/postprocessing` 的 `<EffectComposer>` 用 R3F 的 `delta` 驱动 `time` uniform，而 `delta` 来自 `performance.now()`，违反铁律 1。
- 更关键：动态模糊必须在 **HDR 线性空间、后期之前**累积子帧，再整体做一次泛光/ACES/颗粒。`@react-three/postprocessing` 没法在它前面插一个"渲 N 次再平均"的 Pass。
- 所以直接用 `postprocessing` 的 `EffectComposer` / `EffectPass` / 内置 Effect，加自写 `GrainEffect`（以及 M1 的 Halation）。依赖里仍保留 `@react-three/postprocessing`，暂不使用，M1 结束时如果仍无用就删掉。

## 4. 动态模糊对比（8 样本、180° 快门、1080×1080、90 帧）

| 方案 | 总耗时 | 文件 | 画面 |
| --- | --- | --- | --- |
| 无模糊（基线） | 38 秒 | 27.6 MB | — |
| **自写子帧累积**（kit） | 2 分 31 秒 | 28 MB | 模糊正确；颗粒保持锐利（只加一次） |
| `@remotion/motion-blur` `<CameraMotionBlur>` | 2 分 54 秒 | 13.7 MB | 模糊可用，但 8 个样本各自带颗粒再平均，**颗粒被抹平**；泛光/ACES 在显示空间平均，高光偏灰；页面上同时存在 8 个 WebGL context |

选择自写子帧累积：结果更物理（线性空间平均）、颗粒正确、只占一个 WebGL context，并且可以只在快速运动段开启（`samples` 可按段设置）。

## 5. 耗时（每帧，本机 SwiftShader CPU）

- 无模糊：约 0.25 秒/帧
- 8 子帧：约 1.5 秒/帧（约 6 倍；不到 8 倍是因为后期只做一次）

这是**无 GPU 的软件渲染**，只说明链路可行，不代表 M 系列 Mac 的速度。按经验，GPU（ANGLE/Metal）比 SwiftShader 快一个数量级以上；M1 的"≤20 秒"目标需要在你的 Mac 上实测（M3 的 `doctor.mjs` 会给出单帧耗时）。

## 6. 环境发现

- Remotion 默认会从 remotion.media 下载 Chrome Headless Shell；无法联网时，用 `CINE_BROWSER=<chrome-headless-shell 路径>` 指定已有浏览器（remotion.config.ts 已支持）。doctor.mjs 要检查这一项。
- three r187 已移除 `PCFSoftShadowMap`；软阴影在 M1 用 `PCFShadowMap` + `shadow.radius` 或 VSM 解决（百叶影的柔边需要它）。
- 颗粒 + CRF 18 让文件偏大（3 秒约 28 MB）。正式渲染保持 CRF 18；proxy 渲染关掉颗粒/降分辨率即可。

## 交付物

- `out/M0-Accum8.mp4`：旋转立方体 + 自写动态模糊 + ACES + 泛光 + 颗粒（3 秒，验收主片）
- `out/M0-NoBlur.mp4`、`out/M0-RemotionMB8.mp4`：对比片
- `out/compare45.png`：第 45 帧三方案对比（无模糊 / 子帧累积 / Remotion MB）
