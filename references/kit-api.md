# Kit API

所有路径都相对镜头工程的 `src/`。在 `src/shot/Shot.tsx` 里用 `../kit/...` 导入。
单位：长度**米**，时间**帧**（`t`），角度在注明处为**度**，其余为弧度，色温**开尔文**。

## 场景骨架

```tsx
import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Fog, Stage, useTimeline } from "../kit/stage";
import { shot, useShot } from "../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../kit/lights";
import { ease, progress } from "../kit/motion";
import { plastic } from "../kit/materials";
import { roundedBox } from "../kit/geometry";
import { Caption } from "../kit/overlay";

const Camera: React.FC = () => {
  useShot({ lens: 50, position: [0, 0.4, 1.3], target: [0, 0.1, 0], move: shot.push([0, 0.35, 1.1]) });
  return null;
};

const Thing: React.FC = () => {
  const ref = React.useRef<THREE.Mesh>(null!);
  const { durationInFrames } = useVideoConfig();
  useTimeline((t) => { ref.current.rotation.y = progress(t, 0, durationInFrames - 1, ease.inOut) * Math.PI / 2; });
  return <mesh ref={ref} geometry={roundedBox(0.2, 0.2, 0.2, 0.02)} material={plastic("#e04a2b")} position={[0, 0.1, 0]} castShadow receiveShadow />;
};

const Shot: React.FC<{ durationInFrames: number }> = () => (
  <AbsoluteFill>
    <Stage background="#2a2622" film={{ grain: 0.3 }}>
      <Camera />
      <Fog color="#2a2622" near={2} far={5} />
      <KeyLight kind="softbox" temp={4300} intensity={6} position={[-1.2, 1.8, 1]} target={[0, 0.1, 0]} />
      <Bounce from="wall" temp={6500} intensity={0.5} />
      <SkyFill intensity={0.25} />
      <StudioEnv intensity={0.4} />
      <Thing />
    </Stage>
    <Caption text="NEW · 2026" from={30} to={170} />
  </AbsoluteFill>
);
export default Shot;
```

`Shot.tsx` 必须 `export default` 一个组件。

其他常用导入：
```ts
import { shotConfig } from "../shot.config";   // name / format / sec / fps / seed
import { FONTS } from "../kit/fonts";            // 画布文字用的字体名
```
总帧数用 `useVideoConfig().durationInFrames`，不要写死 179。

---

## stage.tsx

### `<Stage>`
| prop | 默认 | 说明 |
| --- | --- | --- |
| `background` | `"#000000"` | 背景色（也作为清屏色） |
| `film` | 见下 | 后期参数，固定顺序：DOF → 曝光 → halation → 泛光 → ACES → 暗角 → 颗粒 |
| `samples` | `1` | 全片动态模糊子帧数。一般保持 1，用 `useMotionBlur` 只在快动作段加 |
| `shutterAngle` | `180` | 快门角 |
| `proxy` | 来自 inputProps | `render.mjs --proxy` 自动设置：关动态模糊、DOF 半分辨率 |

`film`（`FilmSettings`，都可省略）：
| 字段 | 默认 | 范围 / 说明 |
| --- | --- | --- |
| `dof` | `true` | 景深开关；焦点来自 `useShot({focus})` |
| `bloom` | `0.2` | 0–0.4 泛光 |
| `halation` | `0.3` | 0–0.4 高光红橙晕（胶片感） |
| `grain` | `0.35` | 0–0.4 颗粒，按帧号做种子 |
| `vignette` | `0.25` | 0–0.35 暗角 |
| `exposure` | `1` | 色调映射前的线性曝光 |
| `aces` | `true` | ACES 色调映射 |

### `useTimeline(fn: (t: number) => void, order = 0)`
注册一个动画函数。每帧（以及每个动态模糊子帧）调用一次，`t` 是帧号（子帧时带小数）。
只能依赖 `t`。`order` 越小越先执行：灯光 -10，默认 0，相机 10，读相机的东西 20。

### `useMotionBlur(from: number, to: number, samples = 8)`
在 `[from, to]` 帧里把动态模糊提到 `samples` 个子帧（快门 180°）。代理渲染忽略它。

### `<Fog color near far />`
线性雾，`color` 一般等于 `background`，把远处融进背景。

### `useStage()`
内部状态（timeline、焦点、分屏）。镜头代码一般用不到。

---

## camera.ts

### `useShot(spec: ShotSpec)`
在组件里调用一次（组件返回 `null`）。
| 字段 | 说明 |
| --- | --- |
| `lens` | `35 \| 50 \| 85`（mm）。竖屏按 36 mm 片幅高换算 FOV，横屏和 1:1 按 24 mm |
| `frame` | **自动取景**：`{ center, size, fill = 0.42, elevation = 15, azimuth = 0 }`，见下。给了它就不用 `position` / `target` |
| `position` / `target` | 起始机位、注视点（米），不用 `frame` 时必填 |
| `move` | 主运动，见 `shot.*`，默认 `static` |
| `drift` | `{ px = 3, seed }` 手持漂移（输出像素），`false` 锁死 |
| `focus` | `{ point?, distance?, aperture = 2.8 }` 物理景深；`false` 或**不写**都是关闭。`point` 默认等于 `target` |

### 自动取景 `frame`
```ts
useShot({ lens: 85, frame: { center: [0, 0.145, 0], size: [0.05, 0.05, 0.03], fill: 0.4, elevation: 12 }, move: shot.dolly(0.03) })
```
- `center` / `size`：主体（或几个主体合起来）的包围盒中心和尺寸 `[宽, 高, 深]`，米。转动的产品用它转动时最宽的尺寸。
- `fill`：主体占画面高度的比例。0.3 有环境，0.42 默认，0.55 很满。
- `elevation`：俯视角（度）。0 平视，12–15 产品，25–35 桌面。`azimuth`：从右侧绕过去的角度（度）。
- 竖屏 9:16 时自动把主体放在平台安全区的中心（不是画面正中）；主体宽度不超过画面宽度的 70%。
- 和它一起用相对运动：`shot.dolly(距离的 5–15%)`、`shot.orbit(deg)`、`shot.crane(dy)`。`push(to)` 需要绝对坐标，不适合。
- `frameSubject(frame, lens, aspect)` 返回 `{ position, target, distance }`，需要绝对坐标时用。

### `shot.*`（每个都接受 `{ start?, end?, ease? }`，默认整条镜头、`ease.cine`）
| 构造 | 含义 |
| --- | --- |
| `shot.static()` | 不动（仍有 drift） |
| `shot.push(to: Vec3, w?)` | 机位移到 `to`，注视点不变 |
| `shot.dolly(distance, w?)` | 沿视线前进 `distance` 米（负数后退） |
| `shot.orbit(deg, w?)` | 绕注视点水平环绕 `deg` 度 |
| `shot.pan(deg, w?)` / `shot.tilt(deg, w?)` | 原地摇 / 俯仰 |
| `shot.crane(dy, w?)` | 升降 `dy` 米，注视点不变 |
| `shot.whip(dir, at, { deg = 70, frames = 8, samples = 24 })` | 在 `at ± frames` 帧里甩 `deg` 度，自动加 16–32 子帧模糊 |

`lensToFov(mm, aspect)`：焦段 → 垂直 FOV（度）。

---

## lights.tsx

### `<KeyLight>`：唯一主光
| prop | 说明 |
| --- | --- |
| `kind` | `"sun"`（远距窄锥，近平行光，可带 gobo）· `"softbox"`（宽锥软阴影）· `"spot"`（舞台聚光 / 逆光） |
| `temp` | 色温 K，默认 5600 |
| `intensity` | 强度（sun 7、softbox 4–7、spot 8–12 是常用值） |
| `position` / `target` | 灯位、照射点 |
| `animate` | `(t) => ({ position?, target?, intensity? })` 灯位动画，纯函数 |
| `gobo` | `GoboSpec`，见下 |
| `angle` | 锥半角（度）。默认 sun 9 / softbox 50 / spot 25 |
| `shadowRadius` | 阴影柔化（texel）。默认 sun 3 / softbox 12 / spot 4 |
| `shadowMapSize` | 默认 2048 |
| `penumbra` | 光锥边缘柔度 0–1（默认 sun 0.05 / softbox 1 / spot 0.35）。带 gobo 时不起作用，边缘由 gobo 的 `softness` 决定 |
| `children` | `<Beam>` / `<Dust>` / `<Steam>` 必须放在里面 |

`GoboSpec`：`{ pattern: "blinds" | "window" | "leaves", slats?, open? (0–1 透光比例), angle? (度), softness? (px/1024), bars? (防盗网竖杆数), aperture? [x0,y0,x1,y1], seed? }`

### `<Bounce from="floor" | "wall" temp? intensity? position? />`
反射补光，无阴影。默认 3800K、0.35。

### `<SkyFill temp? groundTemp? intensity? />`
半球光，冷色天光打底。默认 9500K / 3500K / 0.25。

### `<StudioEnv intensity? rotationY? />`
程序化棚拍环境反射（RoomEnvironment），默认 0.4。窗边室内场景用 0.03–0.1，产品棚拍用 0.3–0.6。

主光离被照物很近时（台灯 0.5 m），阴影相机的近平面会自动缩小，近处物体照样有阴影。

### `<Beam aperture floorY haze? steps? near? />`
体积光束（光线步进，跟随 gobo）。`aperture` 是光进入的开口四角（世界坐标，如窗洞），`floorY` 光束止于的高度。`haze` 0–1，默认 0.5。`near` 相机前多少米不加雾（默认 0.6）。

### `kelvin(K): THREE.Color`、`makeGoboTexture(spec)`、`useKeyLight()`

---

## particles.tsx（都要放在 `<KeyLight>` 里，只在光束里亮）

"光束"就是主光的光锥：有 gobo 时按 gobo 图案亮，没有 gobo 时按一个柔和的圆锥亮。
`aperture` 是一个四边形开口（世界坐标四个角），粒子只在开口靠房间一侧亮：窗光用窗洞四角；台灯这类光源用灯罩口附近、垂直于光线的一个小方框。

### `<Dust aperture floorY min max count? size? gain? seed? />`
灰尘点，`min/max` 是分布的盒子。默认 1500 颗、1.6 mm、gain 1。

### `<Steam aperture floorY origin height? width? count? period? opacity? seed? />`
热气。默认上升 0.26 m、宽 0.07 m、12 缕、周期 3.4 s、不透明度 0.42。

---

## materials.ts（全部按参数缓存，可以随便在 render 里调用）

| 函数 | 说明 |
| --- | --- |
| `clay(color = "#d9d6d0")` | 白模 |
| `chrome(roughness = 0.08)` | 镜面铬 |
| `metal(color, roughness = 0.32)` | 拉丝 / 缎面金属 |
| `plastic(color, roughness = 0.42)` | 塑料（带一点清漆） |
| `glass(tint = "#ffffff", roughness = 0.04)` | 透射玻璃（空容器） |
| `glassShell(envIntensity = 2.5)` | 有内容物的玻璃外壳：只有反射和清漆高光，加法混合、不写深度，里面的东西照常可见。内容物用 `jelly()` |
| `jelly(color, size = 0.1)` | 果冻 / 软糖：透射 + 衰减色 + 清漆，`size` 是物体厚度 |
| `paper(color)` | 纸、卡片 |
| `wood({ seed, light, dark, repeat, roughness })` | 程序化木纹 |
| `plaster(color)` | 墙面 |
| `porcelain(color)` | 瓷 |
| `vinyl()` | 黑胶 |
| `liquid(color)` | 茶、咖啡液面 |
| `emissive(color, intensity = 1, map?)` | 自发光（屏幕、指示灯） |

纹理：`noiseTexture(seed, scale, size)`、`woodTexture(seed, light, dark)`、`grooveTexture()`、`gradientTexture(stops)`、
`drawTexture(key, size, (ctx, size) => { ... })`：在方形 Canvas 上画任意贴图（标签、屏幕、面板印字），按 `key` 缓存。
细密图案（网孔、织物、细线）在成片距离下会被贴图过滤抹平：单个图案元素在画面上至少要 3–4 px。
实际做法是把图案画大、画稀，或者用真实几何（一排 `cylinder` 小孔）代替贴图。
画文字时用 `FONTS.ui`（Inter 400/600/700）或 `FONTS.round`（Fredoka 600），例如 `ctx.font = \`700 64px ${FONTS.ui}\``。
长条标签要在方形画布上做"虚拟宽画布"：`ctx.scale(1 / ratio, 1)` 后按宽画布坐标画，贴到 `ratio` 比例的面上。

毛发不是材质，是组件：见 `fur.tsx`。

---

## geometry.ts

| 函数 | 说明 |
| --- | --- |
| `roundedBox(w, h, d, r = 0.01, seg = 4)` | 圆角盒（几乎所有产品外壳） |
| `cylinder(rTop, rBottom, h, seg = 64)` | 圆柱 / 圆台（旋钮、底座、脚垫） |
| `lathe(profile: [r, y][], { segments = 96, thickness? })` | 旋转体；给 `thickness` 得到有壁厚的杯 / 碗 |
| `smoothProfile(ctrl: [r, y][], samples = 48)` | 少量控制点 → 平滑轮廓，配合 `lathe` |
| `wallWithHole(w, h, { x, y, w, h }, depth = 0.12)` | 带窗洞的墙 |
| `slatPositions(count, top, bottom)` | 百叶片高度列表 |
| `rod(a, b, r = 0.002, seg = 16)` | 两点之间的圆杆（眼镜腿、线缆、桌腿）。几何已经放在世界坐标，mesh 不要再设位置 |
| `ring(rOuter, rInner, depth, seg = 96)` | 扁圆环（表圈、表带环、镜框），轴向 +y |
| `torus(R, r, arc = 2π)` | 圆环管（杯把、圆框），轴向 +z |
| `bentSheet(w, d, lift = 0.01)` | 中间拱起的薄片（书页、纸、布），平躺在 y = 0，带 UV |
| `faceZ(geometry)` | 把轴向 +y 的几何（lathe、cylinder、ring）转成轴向 +z，正面朝镜头 |

`lathe` / `cylinder` / `ring` 的轴都是 +y（立着）。要让圆面朝镜头（表盘、镜头、喇叭）就 `faceZ(...)`。
贴在另一个面上的薄片（表盘印字、贴纸、标签）要离开那个面 0.2–0.5 mm，否则两个面重合会闪（z-fighting）。

物体底面放在 `y = 0`，桌面 / 地面也是 `y = 0`。接触面要贴实，不要悬空。

---

## motion.ts

| 函数 | 说明 |
| --- | --- |
| `ease.cine` | `cubicBezier(.2,.8,.2,1)`，默认缓动 |
| `ease.inOut` / `ease.in` / `ease.out` / `ease.linear` | 其他缓动；`linear` 只给漂移、自转这类恒速量 |
| `progress(t, from, to, ease = ease.cine)` | `t` 在 `[from, to]` 里的缓动 0–1 |
| `lerp(a, b, k)`、`clamp01(x)` | |
| `springAt(t, { start = 0, settle = 24, overshoot = 0.015 })` | 解析欠阻尼弹簧 0 → 1，`settle` 帧内稳定 |
| `rng(seed)` | mulberry32，返回 `() => [0,1)` |
| `hash1(n, seed)` | 整数 → [0,1) |
| `noise1D(x, seed)` / `noise3D(x, y, z, seed)` | 平滑值噪声 [-1,1] |
| `cubicBezier(x1, y1, x2, y2)` | 自定义缓动 |
| `sec(s, fps)` | 秒 → 帧 |

---

## overlay.tsx（DOM 文字层，放在 `<Stage>` 同级）

### `<Caption text from to fade? place? size? color? pill? font? weight? tracking? />`
| prop | 默认 | 说明 |
| --- | --- | --- |
| `from` / `to` | — | 出现 / 消失的帧 |
| `fade` | 12 | 淡入淡出帧数 |
| `place` | `"bottom"` | `"bottom"`（安全区下沿上方）· `"top"` · `"center"` |
| `size` | 44 | 1080 宽时的字号 px |
| `pill` | `false` | 深色胶囊底，亮画面上保证可读 |
| `font` | `"ui"` | `"ui"`（Inter）或 `"round"`（Fredoka） |

### `<Title title kicker? from to color? font? />`
居中大标题 + 小字。

`SAFE = { top: .08, bottom: .22, right: .14, left: .06 }`，`fadeAt(t, { from, to, fade })`。

---

## renderPass.tsx

### `<RenderPass passes split seams clayColor? wireColor? wireBackground? />`
放在 `<Stage>` 里。`passes` 是 `["beauty", "clay", "wire"]` 的子集（按顺序排成带），`split` 为 `"diagonal"` 或 `"vertical"`，
`seams(t) => number[]` 返回分割位置（0–1）。物体加 `userData={{ noWire: true }}` 时不出现在线框带里（墙、桌子）。

### `<PassLabels spec labels? rows? />`
每条带的 DOM 标签，放在 `<Stage>` 外层。默认自动把每个标签放在画面上沿或下沿（哪边露出的带更宽就放哪边），避开画面中心的主体。
`rows` 可以手动给每个标签的高度（0–1），一般不需要。`makeSplitSpec(frames)` 见 render-pass 场景。
标签可以写中文：字体会回退到系统中文字体（苹方、思源黑体等），skill 本身不带中文字体。

---

## fur.tsx

### `<Fur geometry shells? length? density? color? rootColor? thickness? gravity? wind? seed? castShadow? {...groupProps} />`
| prop | 默认 | 说明 |
| --- | --- | --- |
| `geometry` | — | 要长毛的几何体（需要 UV） |
| `shells` | 48 | 32–64 层壳，越多越细腻越慢 |
| `length` | 0.012 | 毛长（米） |
| `density` | [220, 220] | 每个 UV 单位的毛根数（u, v）。按表面实际尺寸给，让每根毛约 1 mm 间距 |
| `color` / `rootColor` | | 毛尖色 / 根部色（自阴影） |
| `thickness` | 0.85 | 毛根粗细（格子比例） |
| `gravity` | 0.35 | 毛尖下垂（毛长的比例） |
| `wind` | `{ strength: .25, dir: [1,0,.3], speed: 1, gust? }` | 风。默认按时间缓慢"呼吸"（strength × 0.65±0.35，`speed` 调呼吸快慢）。`gust: (秒) => 倍数` 时改用你的包络 |

阵风（"一阵一阵"）：`import { Fur, gusts } from "../kit/fur"`，`wind={{ strength: 0.4, dir: [1,0.15,0.4], gust: gusts({ at: [1, 2, 4], base: 0.25, peak: 1.2 }) }}`。快起慢落；阵风点放在整秒或节拍上。

---

## fonts.tsx

`FONTS = { ui: "Inter", round: "Fredoka" }`。`<FontGate>` 由 `Root.tsx` 自动包住每个镜头，字体加载完才开始渲染。
3D 文字用 `src/kit/fonts/fredoka-600.typeface.json` + three 的 `TextGeometry`（见 jelly-type）。
其他 OFL 字体：`node <skill>/scripts/font2typeface.mjs in.woff out.typeface.json`。
