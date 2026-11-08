# M1 · Kit 核心 + 黄金时刻

日期：2026-11-08 · 渲染机：Linux 云容器，4 核 CPU，无 GPU（SwiftShader，`--gl=swangle`）

## 交付物

- `starter/out/golden-hour-9x16.mp4`：1080×1920，30fps，6 秒，H.264 CRF 18，48.8 MB
- `starter/review/contact.png`：第 0 / 45 / 90 / 134 / 179 帧联系表，带 9:16 平台安全区参考线
- `starter/review/stats.json`：曝光统计

## 自检结论

| 项 | 结果 |
| --- | --- |
| 曝光 | 5 帧全部 PASS：高光裁切 ≤ 0.007%（标准 < 1%），死黑 ≤ 0.85%（标准 < 3%），平均亮度 0.44–0.46 |
| 百叶影 | 64 片百叶 + 7 根防盗网的 gobo 投在桌面和唱机上，边缘有 2.5px 柔化，加上 PCF 软阴影；6 秒内光影向右爬约 3.5° 方位角 |
| 光束 / 灰尘 | 光束是光线步进的体积光，按 gobo 调制，镜头前 0.6 m 内不加雾；灰尘只在光束里被照亮，光束外几乎看不见 |
| 暗部 | 冷色天光补光（9500K）+ 桌面反射补光，唱机底座和墙面暗部保留了细节 |
| 构图 | 前景盖碗（对焦，f/2.8）、中景唱机、背景百叶窗；盖碗始终在安全区内 |
| 运动 | 镜头 35mm，缓慢前推 + 3px 手持漂移；唱盘按 33⅓ 转/分 转动；蒸汽循环上升 |
| 确定性 | 第 90 帧渲染两次，像素差 0 |

## 耗时

- 正式渲染：每帧 3.68 秒，总计 11 分 6 秒（SwiftShader CPU）
- SPEC 的目标是"≤ 20 秒（M 系列 Mac）"。这台机器没有 GPU，没法在这里验证这个目标。需要在你的 Mac 上跑 `node scripts/render.mjs --final` 实测，M3 的 `doctor.mjs` 也会先报单帧耗时。

## Kit 里新增的东西

- `camera.ts`：`useShot({lens, position, target, move, drift, focus})`；`shot.push / dolly / orbit / pan / tilt / crane / whip`。甩镜会在它的时间窗里自动把动态模糊提到 16–32 个子帧。
- `motion.ts`：`springAt`（由超调量推出阻尼的解析弹簧，默认超调 1.5%）、`noise3D`
- `lights.tsx`：`KeyLight`（sun / softbox / spot，开尔文色温，可动画）、`makeGoboTexture`（blinds / window / leaves + 防盗网）、`Bounce`、`SkyFill`、`StudioEnv`（RoomEnvironment PMREM）、`Beam`（体积光）
- `particles.tsx`：`Dust`、`Steam`，都只在主光照到的地方亮
- `post.ts`：`ExposureEffect`、`HalationEffect`（高光 → mip 模糊 → 红橙染色 → 叠加，在 ACES 之前）；后期链顺序固定：DOF → 曝光 → halation → 泛光 → ACES → 暗角 → 颗粒
- `materials.ts`：clay / chrome / metal / plastic / glass / paper / wood / plaster / porcelain / vinyl / liquid / emissive，所有贴图都用 Canvas 程序化生成
- `geometry.ts`：roundedBox、lathe（可带壁厚）、smoothProfile、wallWithHole
- `scripts/stills.mjs`：只打包一次、复用同一个浏览器，用纯 JS 解码和编码 PNG（Remotion 自带的 ffmpeg 没有 rawvideo 输出）
- `scripts/render.mjs`：`--proxy`（0.5 倍分辨率、不开动态模糊）/ `--final [--prores]`，结束时输出耗时和文件大小

## 已知问题 / 留到 M2–M3

- 颗粒加 CRF 18 让文件偏大（6 秒 49 MB）。颗粒是这个 Look 的质感，所以码率保持不动。如果你想要更小的文件，可以把颗粒从 0.35 降到 0.25。
- `@react-three/postprocessing` 仍然没用到，M2 结束时如果还是不用就从依赖里删掉。
