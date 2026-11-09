# M3 · Skill 层

日期：2026-11-09 · 渲染机：Linux 云容器，4 核 CPU，无 GPU（SwiftShader）

## 交付物

| 文件 | 内容 |
| --- | --- |
| `SKILL.md`（150 行） | 3 道闸门的工作流、镜头方案格式、确定性 / 镜头 / 灯光 / 运动 / 构图 / 迭代规则、参考文件索引、交付格式 |
| `README.md` | 安装 3 步、一句话安装 prompt、手动用法、Remotion 授权说明 |
| `PROMPTS.md` | 30 条 prompt，五个 Look 各 6 条 |
| `references/kit-api.md` | kit 全部组件 / 函数的签名、默认值和场景骨架 |
| `references/looks/*.md` | 五个 Look 的配方：空间、镜头、灯光、后期、配置字段（可改 / 不可改）、"用户说法 → 改哪个参数"表、换主体指南 |
| `references/camera.md` · `light.md` · `materials.md` · `motion.md` | 规则和速查 |
| `references/render-settings.md` | 规格、命令、GL 后端、实测耗时、文件大小 |
| `references/review-checklist.md` | 7 类自检项 |
| `references/troubleshooting.md` | 环境 / 代码 / 画面 / 确定性 |
| `scripts/new.mjs` | 复制 starter → 新工程，写 `shot.config.ts`，把所选 Look 复制成 `src/shot/Shot.tsx`，链接（或安装）依赖 |
| `scripts/doctor.mjs` | Node、依赖、磁盘、字体、Chrome、GL、试渲 1 帧、确定性、速度估算，共 10 项 PASS / WARN / FAIL + 修法 |

## 工程结构的变化

- 每个镜头只有一个场景文件：`src/shot/Shot.tsx`（`export default`）。合成 id 是 `<name>-9x16 / -16x9 / -1x1`。
- 五个参考 Look 改名为 `look-<look>-<format>`，在每个工程里都保留，可以直接渲出来对照。
- kit 新增 `overlay.tsx`（`<Caption>` / `<Title>`，自动避开 9:16 安全区）、`materials.jelly()`。
- 转台新增 `frontAt` 字段：产品正面朝镜头的时刻。
- render-pass 和 turntable 不再写死 179 帧，改任意时长都正确。
- `stills.mjs`：当前镜头的默认合成写到 `review/`，其他合成写到 `review/<合成名>/`。

## 验收：全新会话，一句 prompt，从零出片

让一个全新的 Claude 会话只读 skill，给它一句话：

> 白色蓝牙音箱在深色石台上慢慢转，正面印 AURA，棚拍感，竖屏 6 秒。

| 项 | 结果 |
| --- | --- |
| 流程 | 方案 → `new.mjs` → `doctor`（10/10 PASS）→ 搭场景 → stills 自检 4 轮 → 代理 → 正式，全程无人改代码，没动 skill 本身 |
| 它做了什么 | 选了 turntable Look，用 `roundedBox` / `cylinder` / `drawTexture` 搭了一个原创音箱，替换示例合成器，改了机位和光圈 |
| 自检 | 第 1 轮：音箱像肥皂、字太细、台子压安全线 → 第 2 轮：加网孔纹理和粗字 → 第 3 轮：调推镜终点 → 第 4 轮：发现转到侧面时最后一个 A 虚了，光圈 4 → 5.6。最终 7 类全 PASS |
| 曝光 | 5 帧高光 0%、死黑 0%，平均亮度 0.24–0.25 |
| 成片 | 1080×1920 · 6 s · 30fps · 66.7 MB，正式渲染 8 分 47 秒（2.90 s/帧），代理 6 分 31 秒 |
| 确定性 | 没有 `Math.random` / `Date.now` / `useFrame` |
| 镜头文件 | `docs/M3-acceptance/Shot.tsx` |

**结论：达到 M3 验收标准。** 画面质量合格但不惊艳：音箱外形偏简单，网孔纹理在远处会被抹平。这次验收发现的问题已经写进文档（见下），M4 盲测会看到效果。

## 验收会话报告的 15 个文档问题，已修

1. doctor 只能在工程里跑 → 现在任何目录都能跑（不在工程里时检查 skill 自带的 starter）。
2. 没写 `shotConfig` / `FONTS` 的导入路径 → kit-api.md 加上了。
3. 转台的起始角度写的是 "-0.35 rad"，看不出正面什么时候朝镜头 → 改成 `frontAt` 字段，文档写清公式。
4. 立着的产品（音箱、香水）用默认俯拍机位拍不到正面 → turntable.md 加了两组机位预设（扁平产品 / 立式产品）。
5. 9:16 下石台必然压到右侧安全线，规则没说能不能越线 → 写明安全区只约束主体和文字，道具和背景可以越线。
6. 换主体时配置对象里哪些字段该删、该留没说 → 写了。
7. 代理渲染和 stills 的耗时没写（代理只比正式快 1.3 倍）→ render-settings.md 加上了。
8. 文件大小范围偏小 → 改成 35–70 MB。
9. 转动产品上的字一端会先虚，清单里没有这一项 → 自检清单和故障排查都加了（f/5.6）。
10. "一次只改一个变量"和"最多 4 轮"定义不清 → 写明第一次 stills 不算轮次，一个变量指一个参数或一处组件改动。
11. 联系表太小，看不清字和纹理 → SKILL.md 写明需要时 Read 全尺寸单帧。
12. 细密纹理会被 mipmap 抹平 → materials.md / kit-api.md 加了"图案元素至少 3–4 px，或用几何体"。
13. 白色产品像肥皂 → materials.md 加了做法（分缝、脚垫、指示灯、不同粗糙度）。
14. 日志里的内存警告和 THREE.Clock 提示 → 写明无害。
15. 正式渲染超过工具的前台时间上限 → SKILL.md 写明放后台跑。

## 留到 M4 / M5

- M4 盲测：从 PROMPTS.md 随机抽 5 条，在新会话里跑，记录失败原因回填 troubleshooting.md。
- M5：`examples/` 放成片和封面、zip 打包、在干净的 Mac 上验证安装。
- 目前只有单个文件编辑式的 Look；SPEC 里的 v2 Look（CRT 打字、铬 Logo 片头等）不在本期范围。
