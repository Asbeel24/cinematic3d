import React from "react";
import { Stage } from "../../kit/stage";
import { CubeScene } from "./CubeScene";

/** M0 cube: minimal scene to check that WebGL + post work on this machine. */
export const CubeTest: React.FC = () => (
  <Stage samples={4} film={{ dof: false, bloom: 0.25, grain: 0.35, vignette: 0.25 }} background="#14161b">
    <CubeScene />
  </Stage>
);
