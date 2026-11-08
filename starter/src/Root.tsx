import React from "react";
import { Composition } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { Stage } from "./kit/stage";
import { CubeScene } from "./scenes/m0/CubeScene";

const film = { bloom: 0.25, grain: 0.35, vignette: 0.25, aces: true };

const CubeNoBlur = () => (
  <Stage samples={1} film={film} background="#14161b"><CubeScene /></Stage>
);
const CubeAccum = () => (
  <Stage samples={8} film={film} background="#14161b"><CubeScene /></Stage>
);
const CubeRemotionMB = () => (
  <CameraMotionBlur samples={8} shutterAngle={180}>
    <Stage samples={1} film={film} background="#14161b"><CubeScene /></Stage>
  </CameraMotionBlur>
);

export const Root: React.FC = () => (
  <>
    {[
      ["M0-NoBlur", CubeNoBlur],
      ["M0-Accum8", CubeAccum],
      ["M0-RemotionMB8", CubeRemotionMB],
    ].map(([id, C]) => (
      <Composition
        key={id as string}
        id={id as string}
        component={C as React.FC}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1080}
      />
    ))}
  </>
);
