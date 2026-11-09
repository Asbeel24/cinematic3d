# M5 打包报告

| 项 | 结果 |
| --- | --- |
| zip | `node scripts/pack.mjs` → `dist/cinematic-3d.zip`，**1.23 MB**，89 个文件，不含 node_modules。时间戳固定，两次打包字节完全一致。`unzip -t` 无错误 |
| 安装流程 | README：git clone 或解压 zip → `starter/` 里 `npm install` → `scripts/doctor.mjs`。附一句话安装 prompt |
| 干净安装模拟 | Linux 容器，新目录：解压 → `npm install` 12 s（npm 缓存热）→ doctor 37 s，11 项全 PASS。干净的 Mac 上要加上依赖下载（约 150 MB）和 Chrome Headless Shell 下载，估计 2–4 分钟。容器里没有 Mac，**没有实机验证** |
| examples/ | 9 条盲测镜头。`new.mjs <name> --example <example>` 直接开工。9 条都通过了当前 kit 的类型检查，中间帧 stills 全部 PASS |
| 声音（可选） | `scripts/sfx.mjs` 用代码合成 8 个音效（thud / pop / boing / tick / whoosh / chime / wind / room），CC0，可复现（两次生成 md5 一致）。`kit/sound.tsx` 提供 `<Sfx at>`、`<Bed>`、`beats(bpm)`。果冻字参考 Look 默认在落地帧加 pop：实测音峰在 0.8 / 1.07 / 1.33 / 1.6 s，对应第 24 / 32 / 40 / 48 帧 |
| 授权 | Remotion：个人和 3 人以内的公司免费；字体 OFL；音效 CC0；kit 和场景是原创代码 |
