# cinematic-3d

一个 Claude Code skill：一句话描述镜头 → 本地 three.js 场景 → 自检关键帧 → 用 Remotion 渲出 9:16 / 16:9 / 1:1 的电影感 3D 短镜头（MP4）。

所有画面都在本地用代码生成，不用下载任何 3D 模型、HDRI 或贴图。自带五种 Look：黄金时刻、转台、Render Pass、果冻字、毛发。

## 安装（3 步）

需要 Node.js 20 LTS（最低 18）、约 1 GB 磁盘。

```bash
# 1. 放到 Claude Code 的 skills 目录
git clone https://github.com/Asbeel24/cinematic3d ~/.claude/skills/cinematic-3d

# 2. 安装渲染依赖（只装一次，之后每个镜头工程都链接这一份）
cd ~/.claude/skills/cinematic-3d/starter && npm install

# 3. 环境自检（第一次会下载 Chrome Headless Shell，需要联网）
node ../scripts/doctor.mjs
```

**也可以用 zip 安装**（不需要 git）：把 `cinematic-3d.zip` 解压到 `~/.claude/skills/`（得到 `~/.claude/skills/cinematic-3d/`），然后照样做第 2、3 步。

doctor 全部 PASS 就可以用了。实测（Linux，npm 缓存热）：解压 → `npm install` 12 s → doctor 37 s；干净的 Mac 上第一次要下载依赖（约 150 MB）和 Chrome Headless Shell，大约 2–4 分钟。在 Claude Code 里直接说：

> 用 cinematic-3d 做一个 6 秒竖屏：白色蓝牙音箱在石台上慢慢转，品牌字 AURA

也可以从 [PROMPTS.md](PROMPTS.md) 里挑一条。

**一句话安装 prompt**（贴给 Claude Code）：

> 把 https://github.com/Asbeel24/cinematic3d 克隆到 ~/.claude/skills/cinematic-3d，在它的 starter 目录里 npm install，然后运行 scripts/doctor.mjs，把结果告诉我。

## 工作流

1. Claude 先给你一份 ≤ 8 行的镜头方案（画幅、Look、构图、运动、主光、节奏），你确认。
2. Claude 建工程、搭场景，渲关键帧联系表自检（曝光、对焦、几何、时间、文字、规格），不过就自己改。
3. 给你一条半分辨率草稿。你提修改意见（"光再暖一点"），Claude 每次只改一个参数并告诉你改了什么。
4. 你说可以，Claude 渲正式成片：1080p，H.264 CRF 18（可选 ProRes 4444）。

## 示例镜头

`examples/` 里有 9 条做好的镜头（都是盲测里新会话从一句话做出来的），可以直接当起点：

| 名字 | 原始 prompt | Look |
| --- | --- | --- |
| `aura-speaker` | 白色蓝牙音箱在深色石台上旋转，正面印 AURA | turntable |
| `perfume` | 一瓶香水在台上转四分之一圈，玻璃瓶身、金色瓶盖，1:1 | turntable |
| `watch` | 机械表在石台上慢慢转，光偏冷、更科技 | turntable |
| `book-glasses` | 窗边书桌上一本摊开的书和圆框眼镜，夕阳透过百叶窗 | golden-hour |
| `night-desk` | 深夜台灯下的书桌：机械键盘和一杯茶 | golden-hour |
| `radio-passes` | 复古收音机的成片 / 白模 / 线框分屏，中文标签 | render-pass |
| `hello` | "HELLO" 果冻字，粉黄薄荷绿，浅蓝背景 | jelly-type |
| `furball-gusts` | 毛绒球被风吹得一阵一阵的，1:1 | fur |
| `winter-earmuffs` | 雪地上的毛绒耳罩，冷色逆光 | fur |

```bash
node ~/.claude/skills/cinematic-3d/scripts/new.mjs my-perfume --example perfume
```

## 声音（可选）

`starter/public/sfx/` 里有 8 个用代码合成的音效：`thud` `pop` `boing` `tick` `whoosh` `chime`，以及可以循环的 `wind` `room`。它们是原创的，按 CC0 发布，可以随意商用。重新生成：`node scripts/sfx.mjs`。
在镜头里按帧放置，和画面一样是确定的：

```tsx
import { Sfx, Bed, beats } from "../kit/sound";
<>
  <Stage>…</Stage>
  <Sfx name="pop" at={24} />                 {/* 第 24 帧 */}
  <Bed name="wind" volume={0.3} />            {/* 整条循环，自动淡入淡出 */}
</>
```

果冻字的参考 Look 默认每个字母落地时有一声 `pop`，`JELLY.sound = false` 关掉。

## 手动使用

```bash
node ~/.claude/skills/cinematic-3d/scripts/new.mjs my-shot --look turntable --format 9:16 --sec 6
cd my-shot
# 编辑 src/shot/Shot.tsx
node ~/.claude/skills/cinematic-3d/scripts/stills.mjs          # 联系表 → review/contact.png
node ~/.claude/skills/cinematic-3d/scripts/render.mjs --proxy  # 草稿
node ~/.claude/skills/cinematic-3d/scripts/render.mjs --final  # 成片 → out/
```

在工程里 `npx remotion studio src/index.ts` 可以打开 Remotion 的预览界面。

## 目录

```
SKILL.md          Claude 读的工作流和规则
PROMPTS.md        30 条示例 prompt
references/       kit API、五个 Look 的配方、镜头/灯光/材质/运动、渲染设置、自检清单、故障排查
starter/          Remotion + three.js 工程模板（kit/ 是核心）
examples/         9 条做好的镜头（new.mjs --example）
scripts/          new / doctor / stills / render / frame（抽帧）/ sfx（合成音效）/ pack（打 zip）
```

## 授权

- **Remotion**：个人和 3 人以内（含）的公司免费；超过需要购买公司授权，以 [remotion.dev/license](https://remotion.dev/license) 为准。如果你要用这个 skill 对外售卖或给团队商用，请先确认 Remotion 授权。
- 字体：Inter、Fredoka，SIL Open Font License 1.1（见 `starter/public/fonts/*-OFL.txt`）。
- three.js、React Three Fiber、postprocessing：MIT。
- 示例场景、kit 代码和贴图都是原创、程序化生成的。
- 音效（`starter/public/sfx/`）：用 `scripts/sfx.mjs` 从代码合成，CC0 1.0。

## 打包

`node scripts/pack.mjs` → `dist/cinematic-3d.zip`（不含 node_modules、渲染结果和开发文档，约 1.2 MB）。
