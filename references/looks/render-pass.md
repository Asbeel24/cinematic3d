# Look：Render Pass

书桌上的采样器 + 磁带机，画面斜向分成"成片 / 白模 / 线框"三条带，分割线缓慢滑动，镜头环绕 20°。
适合"3D 制作过程"、作品集、设计稿展示。
参考场景：`src/scenes/render-pass/RenderPassScene.tsx` → 合成 `look-render-pass-9x16`。

## 空间
- 桌面 `y = 0`（木桌 2.2 × 1.2 m），墙在 `z = -0.55`。桌子和墙标 `userData.noWire`，线框带里只剩产品。
- 采样器在 `[0.06, 0, 0.14]`，转 -0.25 rad；磁带机在 `[-0.04, 0, -0.17]`，转 0.18 rad。

## 镜头
| 项 | 值 |
| --- | --- |
| 焦段 | 50mm |
| 机位 → 注视点 | `[0.1, 0.66, 0.98]` → `[0, 0.03, -0.02]`（俯拍约 33°） |
| 运动 | `shot.orbit(20, { ease: ease.inOut })` |
| 漂移 | 2 px |
| 景深 | 关（`focus: false`，`film.dof: false`）：三条带都要清楚 |

## 分屏
`makeSplitSpec(frames)`：`passes ["beauty","clay","wire"]`，`split "diagonal"`，
分割位置从 `[0.43, 0.6]` 滑到 `[0.37, 0.54]`（`ease.inOut`）。白模色 `#b9b4ab`，线框色 `#bcd8ff`，线框底 `#24324a`。
分割线 1 px 高亮。标签 `<PassLabels>` 走 DOM，三行错开（0.2 / 0.42 / 0.64 屏高）。

## 灯光
| 灯 | 参数 |
| --- | --- |
| 主光 `softbox` | 4800K，5.5，`[-1.0, 1.6, 0.9]` → `[0, 0.04, 0]`，锥角 30°，`shadowRadius` 9 |
| 反射 `Bounce wall` | 7000K，0.45，`[1.4, 0.5, 0.6]` |
| 天光 | 9000K，0.3 |
| 环境 | 0.35 |
| 雾 | `#1a1918`，2.2–5 m |

## 后期
`background: "#1a1918"`，`film: { dof: false, bloom: 0.12, halation: 0.12, grain: 0.22, vignette: 0.2 }`

## 配置对象 `RENDERPASS`
| 字段 | 默认 | 可改 | 说明 |
| --- | --- | --- | --- |
| `padAccent` | `#ff6a2b` | ✓ | 采样器亮起的打击垫色 |
| `deckColor` | `#c9c6bf` | ✓ | 磁带机外壳 |
| `orbitDeg` | 20 | ✓ | 环绕角，10–30 |
| `labels` | BEAUTY / CLAY / WIREFRAME | ✓ | 标签文字（可写中文：成片 / 白模 / 线框） |
| `seamsFrom` / `seamsTo` | [0.43,0.6] / [0.37,0.54] | ✓ | 分割线起止位置（0 = 左上角，1 = 右下角） |

## 可调参数
| 说法 | 改动 |
| --- | --- |
| 白模多一点 | `seamsFrom/To` 第二个值 +0.08 |
| 只要两条带 | `passes: ["beauty", "wire"]`，`seams` 只返回一个值 |
| 竖直分割 | `split: "vertical"` |
| 环绕慢一点 | `orbitDeg` 20 → 12 |
| 线框更亮 | `wireColor` → `#e0eeff` |

## 换主体时
- 任何产品组合都行；桌面、墙、背景布标 `userData={{ noWire: true }}`。
- 物体面数太低时线框很空：用 `roundedBox` 的 `seg` 4 以上、`cylinder` 24 段以上。
- 屏幕、标签用 `MeshBasicMaterial` + `toneMapped: false`，否则白模带里也会发光不一致。
