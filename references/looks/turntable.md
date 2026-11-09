# Look：转台 Turntable

一个产品立在深色水磨石台上缓慢自转，镜头慢推。棚拍柔光、地面反射渐隐、暗背景。
参考场景：`src/scenes/turntable/Turntable.tsx` → 合成 `look-turntable-9x16`。示例主体是原创桌面合成器 "TIDE · 01"。

## 空间
- 地面 `y = 0`；石台半径 0.25 m、高 0.12 m，台面 `y = 0.12`。产品放在台面上。
- 反射：产品组以 `scale-y = -1` 镜像到地面下，上面盖一张半透明光面圆盘（不透明度 0.95，边缘渐隐）。

## 镜头
| 项 | 值 |
| --- | --- |
| 焦段 | 50mm |
| 机位 → 注视点 | `[0, 0.8, 1.6]` → `[0, 0.11, 0]` |
| 运动 | `shot.push([0, 0.7, 1.36], { ease: ease.inOut })` |
| 产品 | 整条镜头转 `turn` = 70°：`rotation.y = turn·(k − kFront)`，`k = progress(t, 0, 最后一帧, ease.inOut)`，`kFront = ease.inOut(frontSec·fps / (总帧数 − 1))`。`rotation.y = 0` 时产品正面朝镜头，发生在第 `frontSec` = 3.7 秒（按秒算，改片长不会跑偏） |
| 漂移 | 2 px |
| 景深 | 对焦产品前脸 `[0, 0.17, 0.08]`，f/4 |

## 灯光
| 灯 | 参数 |
| --- | --- |
| 主光 `KeyLight kind="softbox"` | 4300K，强度 6.5，位置 `[-1.2, 1.8, 1.0]`，瞄准 `[0, 0.12, 0]`，锥角 28°，`shadowRadius` 10 |
| 反射 `Bounce wall` | 6500K，0.5，位置 `[1.5, 0.4, 0.8]` |
| 天光 `SkyFill` | 8500K / 4000K，0.25 |
| 环境 `StudioEnv` | 0.4，`rotationY` 0.6（产品高光来自这里） |
| 雾 `Fog` | 背景色，1.8–4.2 m |

## 后期
`background: "#302c28"`，`film: { dof: true, bloom: 0.15, halation: 0.15, grain: 0.25, vignette: 0.32, exposure: 1.0 }`

## 材质
- 石台：深灰底 `#4b4844` + 1100 颗彩色碎石（`drawTexture`，按种子），`map.repeat (3, 0.45)`，粗糙 0.75。
- 产品：面板 `drawTexture` 印字 + `plastic` / `metal` / `wood` 组合。品牌字画在"虚拟宽画布"上（见 kit-api → drawTexture）。

## 配置对象 `TURNTABLE`
| 字段 | 默认 | 可改 | 说明 |
| --- | --- | --- | --- |
| `brand` | `"TIDE · 01"` | ✓ | 前脸大字 |
| `model` | `"PARAPHONIC SYNTHESIZER"` | ✓ | 前脸小字 |
| `panelColor` | `#d9d5cc` | ✓ | 面板色 |
| `knobColors` | 6 色 | ✓ | 旋钮色 |
| `keyTemp` | 4300 | ✓ | 主光色温 |
| `bounceTemp` | 6500 | ✓ | 墙面反射色温，和 `keyTemp` 至少差 2000K |
| `turn` | 70 | ✓ | 总转角（度）。≤ 120，否则速度太快 |
| `frontSec` | 3.7 | ✓ | 正面对镜头的时刻（秒）。想让品牌字在第 3 秒正对：3。超过片长时按最后一帧算 |
| `background` | `#302c28` | ✓ | 背景 / 雾色。保持深色，反射才好看 |
| `plinthR` / `plinthH` | 0.25 / 0.12 | ✗ | 灯位、机位按这个尺寸定 |

## 可调参数
| 说法 | 改动 |
| --- | --- |
| 转慢一点 | `turn` 70 → 50 |
| 推得更近 | `push` 终点 `[0, 0.7, 1.36]` → `[0, 0.66, 1.2]` |
| 光更冷 / 更科技 | `keyTemp` 4300 → 6500，`bounceTemp` 6500 → 9000，`SkyFill groundTemp` 4000（留一点暖做对比），`background` 偏蓝灰 `#1d2126` |
| 背景更亮 | `background` → `#4a4540`（同时雾色跟着变） |
| 反射更弱 | 地面圆盘 `opacity` 0.95 → 0.97 |
| 换品牌字 | `brand` / `model` |
| 正面早一点 / 晚一点出现 | `frontSec` 3.7 → 3 / 4.5 |

## 换主体时
- 新产品放在台面 `y = plinthH` 上，宽度不超过石台直径的 90%（0.45 m）。新产品的**正面朝 +z**（建模时就让正面对着镜头）。
- 配置对象里 `model` / `knobColors` / `panelColor` 是合成器专用的：换主体时删掉，换成新产品自己的字段（如 `bodyColor`、`brandColor`），保留 `brand`、`keyTemp`、`turn`、`frontSec`、`background`。
- **取景用 `frame`，不要手调坐标**：
  ```ts
  useShot({ lens: 50, frame: { center: [0, T.plinthH + H / 2, 0], size: [W, H, W], fill: 0.42, elevation: 15 },
            move: shot.dolly(0.1, { ease: ease.inOut }), drift: { px: 2 }, focus: { point: [0, T.plinthH + H / 2, D / 2], aperture: 4 } })
  ```
  `size` 的宽和深都用产品最宽的尺寸（它在转）。扁平看顶面的产品（键盘、手柄）`elevation` 25–30；立着看正面的（音箱、香水）12–15。
  小产品（< 10 cm：手表、戒指、耳机）用 `lens: 85`、`fill` 0.35–0.45。
- 机位很近时（小产品），石台贴图的 `map.repeat` 按拉近的倍数放大（`(3, 0.45)` → `(9, 1.35)`），否则碎石像彩纸片；石台在画面里只露一角也没关系。
- 小产品下面放一个垫子 / 展示托（`roundedBox` 圆角大一点，或 `lathe` 做的圆台），不要直接躺在大石台上。
- 正面有字的产品转动时，字的两端离焦平面距离不同：光圈用 f/4–5.6，`focus.point` 放在正面中心。
- 9:16 下 50mm 拍石台，石台（0.5 m 宽）会压到右侧 14% 安全线：这是允许的，安全区只约束**主体和文字**，台子、背景、地面可以越线。
- 产品组件同时用在正常组和镜像组里，所以不要在产品里放灯。
- `target.y` 和 `focus.point.y` 始终放在产品高度的中部（台面 0.12 + 产品高 / 2）。
- **玻璃瓶 + 液体（香水、酒瓶、药瓶）**：瓶身用 `glassShell()`（只出高光和清漆反射、加法混合，不挡后面的东西），液体用 `jelly(color, size)` 做实心体，尺寸比瓶内腔小 1–4 mm，避免和瓶壁 z-fight。不要给瓶身也用 `jelly()` / 高透射：两层透射叠加在 swangle 下会发黑或出 NaN。瓶盖、标签照常用 `metal` / `plastic` / `drawTexture`。
