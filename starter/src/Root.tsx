import React from "react";
import { Composition } from "remotion";
import { shotConfig } from "./shot.config";
import { GoldenHour } from "./scenes/golden-hour/GoldenHour";
import { CubeTest } from "./scenes/test/CubeTest";
import { Turntable } from "./scenes/turntable/Turntable";
import { FontGate } from "./kit/fonts";
import { RenderPassScene } from "./scenes/render-pass/RenderPassScene";
import { JellyType } from "./scenes/jelly-type/JellyType";
import { FurScene } from "./scenes/fur/FurScene";
import Shot from "./shot/Shot";

export const FORMATS = {
  "9:16": { width: 1080, height: 1920, id: "9x16" },
  "16:9": { width: 1920, height: 1080, id: "16x9" },
  "1:1": { width: 1080, height: 1080, id: "1x1" },
} as const;

/** Reference Looks, registered as look-<name>-<format>. Read-only: edit src/shot/Shot.tsx instead. */
export const LOOKS: Record<string, React.FC<{ durationInFrames: number }>> = {
  "golden-hour": GoldenHour,
  turntable: Turntable,
  "render-pass": RenderPassScene,
  "jelly-type": JellyType,
  fur: FurScene,
};

const register = (id: string, Scene: React.FC<{ durationInFrames: number }>, duration: number, fps: number) =>
  Object.values(FORMATS).map((f) => (
    <Composition
      key={`${id}-${f.id}`}
      id={`${id}-${f.id}`}
      component={() => (
        <FontGate>
          <Scene durationInFrames={duration} />
        </FontGate>
      )}
      durationInFrames={duration}
      fps={fps}
      width={f.width}
      height={f.height}
    />
  ));

export const Root: React.FC = () => {
  const { fps, sec, name } = shotConfig;
  const duration = Math.round(sec * fps);
  return (
    <>
      {/* the current shot: <name>-9x16 / -16x9 / -1x1 */}
      {register(name, Shot, duration, fps)}
      {Object.entries(LOOKS).flatMap(([look, Scene]) => register(`look-${look}`, Scene, duration, fps))}
      {/* environment check used by doctor.mjs */}
      <Composition id="test-cube" component={CubeTest} durationInFrames={30} fps={30} width={540} height={540} />
    </>
  );
};
