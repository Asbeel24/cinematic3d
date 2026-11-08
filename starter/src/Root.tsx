import React from "react";
import { Composition } from "remotion";
import { shotConfig } from "./shot.config";
import { GoldenHour } from "./scenes/golden-hour/GoldenHour";
import { CubeTest } from "./scenes/test/CubeTest";

export const FORMATS = {
  "9:16": { width: 1080, height: 1920, id: "9x16" },
  "16:9": { width: 1920, height: 1080, id: "16x9" },
  "1:1": { width: 1080, height: 1080, id: "1x1" },
} as const;

const SCENES: Record<string, React.FC<{ durationInFrames: number }>> = {
  "golden-hour": GoldenHour,
};

export const Root: React.FC = () => {
  const { fps, sec } = shotConfig;
  const duration = Math.round(sec * fps);
  return (
    <>
      {Object.entries(SCENES).flatMap(([name, Scene]) =>
        Object.values(FORMATS).map((f) => (
          <Composition
            key={`${name}-${f.id}`}
            id={`${name}-${f.id}`}
            component={() => <Scene durationInFrames={duration} />}
            durationInFrames={duration}
            fps={fps}
            width={f.width}
            height={f.height}
          />
        )),
      )}
      {/* environment check used by doctor.mjs */}
      <Composition id="test-cube" component={CubeTest} durationInFrames={30} fps={30} width={540} height={540} />
    </>
  );
};
