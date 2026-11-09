# cinematic-3d promo

18.5 s, 9:16, 30 fps promo cut from the skill's own milestone renders (M1–M4) plus one new jelly-type shot ("3D").
Not part of the skill package (`scripts/pack.mjs` does not include it).

```bash
npm install
# footage: copy the milestone mp4s into public/ (see Promo.tsx for names); jelly-3d.mp4 is
# look-jelly-type-9x16 rendered with JELLY.word = "3D", fill 0.3, sec 3.5
python3 scripts/audio.py public/promo-audio.wav   # procedural 120 BPM soundtrack, CC0
npx remotion render src/index.ts Promo out/cinematic-3d-promo.mp4 --crf 18
```

Timeline (frames @30): 0–90 hook (这不是 Blender / 也不是 AI 视频 / rapid cuts / 是代码) · 90–150 one-line prompt ·
150–210 result · 210–405 光影 / 毛发 / 反射 / 玻璃 / 柔光 / 弹性 · 405–450 真 3D (beauty/clay/wire) · 450–555 end card.
