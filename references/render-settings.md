# 渲染设置

## 规格
| 画幅 | 尺寸 | 合成 id |
| --- | --- | --- |
| 9:16（默认） | 1080×1920 | `<name>-9x16` |
| 16:9 | 1920×1080 | `<name>-16x9` |
| 1:1 | 1080×1080 | `<name>-1x1` |

- 帧率 30（默认）或 24，写在 `shot.config.ts` 的 `fps`。
- 时长 `sec`，3–10 秒最合适；超过 15 秒渲染很久。
- 编码：H.264、CRF 18、yuv420p。`--prores` 输出 ProRes 4444（.mov，给调色）。

## 命令（都在镜头工程目录里跑）
| 命令 | 输出 | 用途 |
| --- | --- | --- |
| `node <skill>/scripts/stills.mjs` | `review/fNNNN.png`、`review/contact.png`、`review/stats.json` | 自检，默认 5 帧 |
| `stills.mjs --frames 0,45,90` | 指定帧（数字、`25%`、`last`） | 只看某段 |
| `stills.mjs --format 16:9` | 另一画幅，输出到 `review/<comp>/` | |
| `node <skill>/scripts/render.mjs --proxy` | `out/<comp>-proxy.mp4`，半分辨率、无动态模糊、CRF 23 | 给用户看草稿 |
| `render.mjs --final` | `out/<comp>.mp4` | 交付 |
| `render.mjs --final --prores` | `out/<comp>.mov` | 调色 |
| `render.mjs --final --format 1:1` | 另一个画幅 | |
| `render.mjs --comp look-fur-9x16 --final` | 任意合成 | 渲参考 Look |

每次渲染结束都会打印并写入 `out/<comp>.json`：耗时、每帧耗时、文件大小、GL 后端。

## GL 后端
- Mac：默认 `angle`（用 GPU）。
- Linux 有 GPU：`CINE_GL=angle-egl`。
- Linux 无 GPU / 云服务器：`swangle`（CPU 软渲染，每帧 2.5–6 秒）。
- 离线机器：`CINE_BROWSER=/path/to/chrome-headless-shell`，跳过 Remotion 的浏览器下载。

## 耗时参考（6 秒、1080×1920、180 帧）
| Look | 云容器 CPU（swangle） | 主要开销 |
| --- | --- | --- |
| render-pass | 2.4 s/帧 | 三遍渲染 |
| turntable | 3.2 s/帧 | 镜像反射 |
| jelly-type | 3.6 s/帧 | 透射材质 + 下落段 6 子帧模糊 |
| golden-hour | 3.7 s/帧 | 体积光 + 粒子 |
| fur | 5.3 s/帧 | 40 层壳 |

另外两种渲染的耗时（同一台 CPU 机器）：
- `--proxy`：只比正式快约 1.3 倍（每帧 2–3 s，6 秒片 5–7 分钟），因为 CPU 软渲染的固定开销大。
- `stills.mjs`：每帧 6–20 s（每帧冷启动），5 帧约 1 分钟。

M 系列 Mac 上用 GPU 会快得多；用 `doctor.mjs` 的估算看本机速度。
动态模糊的段落耗时 ≈ 子帧数倍。

## 文件大小
颗粒让 CRF 18 的文件偏大（6 秒 35–70 MB；画面平、颜色浅的果冻字只有几 MB）。平台会再压缩；需要小文件时把 `film.grain` 从 0.35 降到 0.2，或用 `--proxy` 的 CRF 23 版本。
