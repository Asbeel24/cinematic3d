# 材质

所有材质都来自 `kit/materials.ts`，贴图全是 Canvas 程序化生成。**不要下载图片或模型。**

## 选材质
| 物体 | 材质 | 说明 |
| --- | --- | --- |
| 产品外壳（塑料） | `plastic(color, 0.35–0.55)` | 粗糙度越低越亮；哑光 0.6 |
| 金属件、旋钮、支架 | `metal(color, 0.25–0.4)` | 浅色金属 `#c9c6c0`，深色 `#2a2a2d` |
| 镜面 / Logo | `chrome(0.05–0.1)` | 需要 `StudioEnv` ≥ 0.3 才有东西可反射 |
| 玻璃杯、瓶子 | `glass(tint)` | 慢，尽量少 |
| 软糖、果冻、3D 字 | `jelly(color, size)` | `size` = 物体厚度 |
| 木头 | `wood({ seed, light, dark, repeat })` | `repeat` 跟物体长度成比例 |
| 墙 | `plaster(color)` | |
| 瓷器 | `porcelain(color)` | |
| 纸、卡片、封套 | `paper(color)` 或 `drawTexture` 画图案 | |
| 屏幕、指示灯 | `emissive(color, intensity, map?)` 或 `MeshBasicMaterial({ toneMapped: false })` | |
| 白模 | `clay()` | render-pass 自动套用 |
| 毛绒 | `<Fur>` 组件 | 见 kit-api |

## 贴图
```ts
const label = drawTexture("brand-label-v1", 1024, (c, s) => {
  c.fillStyle = "#1a1a1a"; c.fillRect(0, 0, s, s);
  c.fillStyle = "#f2efe8"; c.font = `700 ${s * 0.12}px ${FONTS.ui}`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("AURA", s / 2, s / 2);
});
```
- `key` 要包含所有会变的参数（文字、颜色），否则改了也拿缓存。
- 贴到长条面上要做"虚拟宽画布"：面宽高比 `ratio`，先 `c.scale(1 / ratio, 1)` 再按 `s * ratio` 的宽度画，否则字被拉伸。
- 文字只用 `FONTS.ui`（Inter）/ `FONTS.round`（Fredoka）。
- 随机图案（碎石、噪点）用 `rng(seed)`。
- 细密图案（音箱网孔、织物、拉丝）在 1–1.5 m 外会被 mipmap 抹平，看起来像一块光板：图案元素放大到画面上 3–4 px 以上，或者用几何体做孔 / 凸起。
- 白色产品容易"像一块肥皂"：靠分缝线（两个 `roundedBox` 拼接留 1 mm 缝）、不同粗糙度的面板、脚垫、指示灯这些细节来读出"这是一个产品"。

## 质感要点
- 真实物体没有完美的 0 粗糙度和纯白 / 纯黑：白用 `#ece8e1` 左右，黑用 `#1c1c1c` 左右。
- 圆角：现实里所有边都有倒角，`roundedBox` 的 `r` 至少 2 mm。
- 尺寸用真实米制：手机 0.15 m、音箱 0.2 m、杯子 0.09 m、书桌高 0.75 m。
- 表面细节（螺丝、缝线、印字）比材质参数更能拉开质感。
