# 运动

## 铁律
- 所有动画写在 `useTimeline((t) => { ... })`，只依赖 `t`，每帧从头算出状态，不累加。
- 不用 `useFrame`、`Date.now()`、`performance.now()`、`Math.random()`。
- 总帧数用 `useVideoConfig().durationInFrames`，不要写死。

## 缓动
| 缓动 | 用途 |
| --- | --- |
| `ease.cine`（默认） | 快起慢停：推镜、物体滑入 |
| `ease.inOut` | 有始有终的运动：环绕、自转、太阳移动 |
| `ease.out` | 落定、淡入 |
| `ease.in` | 离场、加速下落 |
| `ease.linear` | 只给恒速量：唱盘转动、风扇、磁带轴 |

`progress(t, from, to, ease)` → 0–1；`lerp(a, b, k)` 插值。

## 弹簧
`springAt(t, { start, settle = 24, overshoot = 0.015 })` 返回 0 → 1，带 1.5% 超调。
- 物体弹入：`scale = springAt(t, { start: 20 })`。
- 超调 1–2%。只有果冻字可以更大（它用自己的压扁公式）。
- `settle` 是稳定所需帧数：轻物体 12–18，重物体 24–36。

## 节奏
- 关键动作落在整秒（30fps：0 / 30 / 60 / 90 …）或音乐整拍（帧 = fps × 60 / BPM × n）。
- 6 秒镜头的常见结构：0–1 s 起势 → 1–4 s 主动作 → 4–6 s 落定、留白给字幕。
- 首帧和尾帧都要是好看的画面（会被当封面、会被循环播放）。

## 动态模糊
- 默认关（`samples = 1`），慢镜头不需要。
- 快速运动（下落、甩、弹出）在那一段加：`useMotionBlur(from, to, 6–8)`。
- 甩镜 `shot.whip` 自动 16–32 子帧。
- 子帧时 `t` 是小数，所以动画公式要对小数 `t` 连续（不要 `Math.floor(t)`）。
- 代理渲染不带动态模糊，判断动作节奏用代理，判断拖影用正式渲染或 stills（stills 带模糊）。

## 随机
`rng(seed)` 生成序列，`hash1(i, seed)` 按序号取值，`noise1D(t * 0.05, seed)` 做慢变化。
种子加上 `shotConfig.seed`（`import { shotConfig } from "../shot.config"`），例如 `rng(17 + shotConfig.seed)`：用户说"换一种随机分布"时只改 `seed`。
参考 Look 里的种子是写死的（保证参考片可复现）；新写的随机代码按上面的方式加。
