// Shot file, started from the "fur" Look (src/scenes/fur/FurScene.tsx).
// b29-earmuffs: plush earmuffs resting on snow, cold rim light from behind, 85 mm macro dolly.
import React, { useMemo } from "react";
import * as THREE from "three";
import { Fog, Stage } from "../kit/stage";
import { shot, useShot } from "../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../kit/lights";
import { ease } from "../kit/motion";
import { noiseTexture, plastic } from "../kit/materials";
import { Fur } from "../kit/fur";
import { shotConfig } from "../shot.config";

export const FUR = {
  /** editable */
  furColor: "#efcfcf",
  rootColor: "#8e6466",
  bandColor: "#c79aa0",
  snowColor: "#e9eef5",
  background: "#6c7d94",
  rimTemp: 8000,
  rimIntensity: 12,
  wind: 0.28,
  /** do not edit */
  shells: 40,
  strand: 0.012,
};
const F = FUR;

const R = 0.047; // muff radius
const FLAT = 0.72; // muff thickness along its axis (x), fraction of R
const SPAN = 0.1; // muff centre x

/** A flattened fluffy ball; poles on ±y so the pinch points sit at top / bottom. */
function muffGeometry() {
  const g = new THREE.SphereGeometry(R, 96, 64);
  g.scale(FLAT, 1, 1);
  g.computeVertexNormals();
  return g;
}

/** Thin plastic headband arching between the inner tops of the muffs. */
function bandGeometry() {
  const x0 = SPAN - R * FLAT * 0.55;
  const y0 = R * 1.55;
  const curve = new THREE.CatmullRomCurve3(
    Array.from({ length: 25 }, (_, i) => {
      const a = (i / 24) * Math.PI;
      return new THREE.Vector3(Math.cos(a) * x0, y0 + Math.sin(a) * 0.085, 0);
    }),
  );
  return new THREE.TubeGeometry(curve, 160, 0.0045, 16, false);
}

const Earmuffs: React.FC = () => {
  const muff = useMemo(muffGeometry, []);
  const band = useMemo(bandGeometry, []);
  const bandMat = plastic(F.bandColor, 0.5);
  return (
    <group rotation-y={-0.62} position-y={-0.01}>
      {[1, -1].map((s) => (
        <Fur
          key={s}
          geometry={muff}
          position={[s * SPAN, R, 0]}
          shells={F.shells}
          length={F.strand}
          density={[300, 150]}
          color={F.furColor}
          rootColor={F.rootColor}
          gravity={0.4}
          wind={{ strength: F.wind, dir: [1, 0.15, 0.4], speed: 1 }}
          seed={(s === 1 ? 3 : 7) + shotConfig.seed}
        />
      ))}
      <mesh geometry={band} material={bandMat} castShadow receiveShadow />
    </group>
  );
};

const Snow: React.FC = () => {
  const mat = useMemo(() => {
    const t = noiseTexture(57 + shotConfig.seed, 64, 512).clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 10);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: F.snowColor, roughness: 0.92, bumpMap: t, bumpScale: 0.8 });
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} material={mat} receiveShadow>
      <planeGeometry args={[6, 6]} />
    </mesh>
  );
};

// right muff (x = +SPAN) after rotation-y -0.62 sits at ≈ (0.081, R, 0.058)
const Camera: React.FC = () => {
  useShot({
    lens: 85,
    frame: { center: [0, 0.085, 0], size: [0.24, 0.17, 0.2], fill: 0.42, elevation: 12 },
    move: shot.dolly(0.08, { ease: ease.inOut }),
    drift: { px: 2, seed: 5 + shotConfig.seed },
    focus: { point: [0.085, 0.05, 0.095], aperture: 2.8 },
  });
  return null;
};

const Shot: React.FC<{ durationInFrames: number }> = () => (
  <Stage background={F.background} film={{ dof: true, bloom: 0.16, halation: 0.2, grain: 0.3, vignette: 0.22, exposure: 1.0 }}>
    <Camera />
    <Fog color={F.background} near={1.2} far={3.6} />
    {/* cold rim: behind, above, slightly camera-left (low winter sun through overcast) */}
    <KeyLight kind="spot" temp={F.rimTemp} intensity={F.rimIntensity} position={[-0.35, 0.55, -0.9]} target={[0, 0.08, 0]} angle={20} shadowRadius={14} />
    {/* warm-ish snow bounce in front */}
    <Bounce from="floor" temp={5000} intensity={1.0} position={[0.5, 0.15, 0.9]} />
    <SkyFill temp={9000} groundTemp={3800} intensity={0.5} />
    <StudioEnv intensity={0.3} rotationY={2.2} />
    <Snow />
    <Earmuffs />
  </Stage>
);

export default Shot;
