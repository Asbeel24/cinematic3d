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

doctor 全部 PASS 就可以用了。在 Claude Code 里直接说：

> 用 cinematic-3d 做一个 6 秒竖屏：白色蓝牙音箱在石台上慢慢转，品牌字 AURA

也可以从 [PROMPTS.md](PROMPTS.md) 里挑一条。

**一句话安装 prompt**（贴给 Claude Code）：

> 把 https://github.com/Asbeel24/cinematic3d 克隆到 ~/.claude/skills/cinematic-3d，在它的 starter 目录里 npm install，然后运行 scripts/doctor.mjs，把结果告诉我。

## 工作流

1. Claude 先给你一份 ≤ 8 行的镜头方案（画幅、Look、构图、运动、主光、节奏），你确认。
2. Claude 建工程、搭场景，渲关键帧联系表自检（曝光、对焦、几何、时间、文字、规格），不过就自己改。
3. 给你一条半分辨率草稿。你提修改意见（"光再暖一点"），Claude 每次只改一个参数并告诉你改了什么。
4. 你说可以，Claude 渲正式成片：1080p，H.264 CRF 18（可选 ProRes 4444）。

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
scripts/          new / doctor / stills / render
```

## 授权

- **Remotion**：个人和 3 人以内（含）的公司免费；超过需要购买公司授权，以 [remotion.dev/license](https://remotion.dev/license) 为准。如果你要用这个 skill 对外售卖或给团队商用，请先确认 Remotion 授权。
- 字体：Inter、Fredoka，SIL Open Font License 1.1（见 `starter/public/fonts/*-OFL.txt`）。
- three.js、React Three Fiber、postprocessing：MIT。
- 示例场景、kit 代码和贴图都是原创、程序化生成的。
