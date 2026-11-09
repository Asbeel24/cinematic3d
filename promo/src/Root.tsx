import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/700.css";
import "@fontsource/noto-sans-sc/900.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import React from "react";
import { Composition, continueRender, delayRender } from "remotion";
import { DURATION, FPS, Promo } from "./Promo";

// every glyph the promo draws, so the subset font files are loaded before frame 0 is captured
const TEXT = "这不是Blender也AI视频是代码只要一句话毛绒耳机，逆光，85mm微距推近出片边浅景深光影百叶体积浮尘发反射玻璃柔弹性真3D每帧都由算→条电影感镜头 rendering…cinematic-3dCLAUDECODESKILLREMOTION×THREEJSIT'S.";
const fontHandle = delayRender("fonts");
Promise.all(
  ["500 50px 'Noto Sans SC'", "700 50px 'Noto Sans SC'", "900 50px 'Noto Sans SC'", "600 50px Inter", "700 50px Inter", "800 50px Inter"].map((f) =>
    document.fonts.load(f, TEXT),
  ),
).then(() => continueRender(fontHandle));

export const Root: React.FC = () => (
  <Composition id="Promo" component={Promo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
);
