// Shot file, started from the "fur" Look (src/scenes/fur/FurScene.tsx).
// A pompom (fur ball) resting on felt; wind comes in gusts.
import React, { useMemo } from "react";
import * as THREE from "three";
import { useVideoConfig } from "remotion";
import { Fog, Stage, useTimeline } from "../kit/stage";
import { shot, useShot } from "../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../kit/lights";
import { ease, noise1D } from "../kit/motion";
import { noiseTexture } from "../kit/materials";
import { Fur } from "../kit/fur";
import { shotConfig } from "../shot.config";

export const FUR = {
  /** editable */
  furColor: "#efe2cf",
  rootColor: "#8a7360",
  feltColor: "#3a3438",
  background: "#2b262b",
  rimTemp: 5200,
  /** calm wind between gusts (fraction of strand length at the tip) */
  wind: 0.12,
  /** wind at the peak of a gust */
  gust: 0.6,
  /** gust peaks (seconds) */
  gustAt: [1, 2, 4],
  /** do not edit */
  shells: 40,
  strand: 0.011,
};
const F = FUR;

const CORE_R = 0.03; // core sphere radius; fur adds ~1.1 cm
const BALL_Y = CORE_R + 0.002; // core sits on the felt, bottom fur pressed into it

/** smooth gust envelope 0..1: fast rise, slower decay, peak at each `gustAt` second */
function gustEnvelope(t: number, fps: number) {
  let g = 0;
  for (const s of F.gustAt) {
    const x = (t - s * fps) / fps; // seconds from the peak
    const w = x < 0 ? 0.35 : 0.6; // rise 0.35 s, fall 0.6 s
    g = Math.max(g, Math.exp(-(x * x) / (2 * w * w)));
  }
  // a little turbulence on top so gusts are not identical
  return g * (0.85 + 0.15 * noise1D(t / 7, 17 + shotConfig.seed));
}

const FurBall: React.FC = () => {
  const { fps } = useVideoConfig();
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(CORE_R, 96, 64);
    g.computeVertexNormals();
    return g;
  }, []);
  // mutable wind object read by <Fur> every frame; speed ~0 freezes Fur's own breathing at 0.65
  const wind = useMemo(() => ({ strength: F.wind, dir: [1, 0.1, 0.35] as [number, number, number], speed: 0.0001 }), []);
  useTimeline((t) => {
    wind.strength = (F.wind + (F.gust - F.wind) * gustEnvelope(t, fps)) / 0.65;
  }, -5);
  return (
    <Fur
      geometry={geo}
      position={[0, BALL_Y, 0]}
      shells={F.shells}
      length={F.strand}
      density={[190, 95]}
      color={F.furColor}
      rootColor={F.rootColor}
      gravity={0.35}
      wind={wind}
      seed={3 + shotConfig.seed}
    />
  );
};

const Felt: React.FC = () => {
  const mat = useMemo(() => {
    const t = noiseTexture(41, 48, 512).clone();
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; // noise tile is not seamless: mirror to hide the seam
    t.repeat.set(6, 6);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: F.feltColor, roughness: 1, bumpMap: t, bumpScale: 0.6 });
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} material={mat} receiveShadow>
      <planeGeometry args={[4, 4]} />
    </mesh>
  );
};

const Camera: React.FC = () => {
  const R = CORE_R + F.strand;
  useShot({
    lens: 85,
    frame: { center: [0, R, 0], size: [2 * R, 2 * R, 2 * R], fill: 0.42, elevation: 12 },
    move: shot.dolly(0.06, { ease: ease.inOut }),
    drift: { px: 2, seed: 5 + shotConfig.seed },
    focus: { point: [0, BALL_Y + 0.005, R * 0.9], aperture: 4 },
  });
  return null;
};

const Shot: React.FC<{ durationInFrames: number }> = () => (
  <Stage background={F.background} film={{ dof: true, bloom: 0.16, halation: 0.25, grain: 0.3, vignette: 0.22, exposure: 1.12 }}>
    <Camera />
    <Fog color={F.background} near={1.2} far={3.2} />
    {/* rim: behind, above, slightly camera-left */}
    <KeyLight kind="spot" temp={F.rimTemp} intensity={12} position={[-0.35, 0.55, -0.9]} target={[0, 0.04, 0]} angle={20} shadowRadius={14} />
    <Bounce from="floor" temp={3600} intensity={1.1} position={[0.5, 0.15, 0.9]} />
    <SkyFill temp={8200} groundTemp={3400} intensity={0.45} />
    <StudioEnv intensity={0.3} rotationY={2.2} />
    <Felt />
    <FurBall />
  </Stage>
);
export default Shot;
