import React, { useMemo } from "react";
import * as THREE from "three";
import { Fog, Stage } from "../../kit/stage";
import { shot, useShot } from "../../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../../kit/lights";
import { ease } from "../../kit/motion";
import { metal, noiseTexture, plastic } from "../../kit/materials";
import { cylinder } from "../../kit/geometry";
import { Fur } from "../../kit/fur";

/**
 * Look: Fur
 * A plush headphone resting on felt in a breeze. Rim light from behind, 85 mm macro dolly.
 */
export const FUR = {
  /** editable */
  furColor: "#efe2cf",
  rootColor: "#8a7360",
  feltColor: "#3a3438",
  background: "#2b262b",
  rimTemp: 5200,
  /** wind strength (fraction of strand length at the tip) */
  wind: 0.28,
  /** do not edit */
  shells: 40,
  strand: 0.011,
};
const F = FUR;

const CUP_R = 0.046;
const SPAN = 0.098; // cup centre x

/** Furry dome on the outside of an ear cup; axis +Y (rotated into place by the parent). */
function domeGeometry() {
  const pts: THREE.Vector2[] = [];
  const n = 28;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * CUP_R), Math.sin(a) * 0.026));
  }
  const g = new THREE.LatheGeometry(pts, 96);
  g.computeVertexNormals();
  return g;
}

/** Headband: tube along an arch over the cups. */
function bandGeometry() {
  const yc = CUP_R + 0.035;
  const curve = new THREE.CatmullRomCurve3(
    Array.from({ length: 25 }, (_, i) => {
      const a = (i / 24) * Math.PI;
      return new THREE.Vector3(Math.cos(a) * SPAN, yc + Math.sin(a) * SPAN * 1.05, 0);
    }),
  );
  return new THREE.TubeGeometry(curve, 160, 0.015, 20, false);
}

const EarCup: React.FC<{ side: 1 | -1; dome: THREE.BufferGeometry }> = ({ side, dome }) => {
  const shell = plastic("#d8cbb9", 0.55);
  const leather = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#5a4a3f", roughness: 0.48, sheen: 0.4, sheenColor: new THREE.Color("#a08a78") }),
    [],
  );
  return (
    // axis of the cup points outward along ±x
    <group position={[side * SPAN, CUP_R + 0.002, 0]} rotation-z={-side * Math.PI / 2}>
      {/* hard shell ring */}
      <mesh geometry={cylinder(CUP_R + 0.002, CUP_R + 0.002, 0.018, 64)} material={shell} position={[0, -0.006, 0]} castShadow receiveShadow />
      {/* leather cushion toward the head */}
      <mesh material={leather} position={[0, -0.02, 0]} rotation-x={Math.PI / 2} castShadow receiveShadow>
        <torusGeometry args={[CUP_R - 0.012, 0.012, 20, 64]} />
      </mesh>
      <Fur
        geometry={dome}
        position={[0, 0.003, 0]}
        shells={F.shells}
        length={F.strand}
        density={[300, 70]}
        color={F.furColor}
        rootColor={F.rootColor}
        gravity={0.3}
        wind={{ strength: F.wind, dir: [1, 0.15, 0.4], speed: 1 }}
        seed={side === 1 ? 3 : 7}
      />
    </group>
  );
};

const Headphones: React.FC = () => {
  const dome = useMemo(domeGeometry, []);
  const band = useMemo(bandGeometry, []);
  const steel = metal("#c9c6c0", 0.28);
  const yc = CUP_R + 0.035;
  return (
    <group rotation-y={-0.62}>
      <EarCup side={1} dome={dome} />
      <EarCup side={-1} dome={dome} />
      <Fur
        geometry={band}
        shells={F.shells}
        length={F.strand * 0.9}
        density={[340, 90]}
        color={F.furColor}
        rootColor={F.rootColor}
        gravity={0.3}
        wind={{ strength: F.wind, dir: [1, 0.15, 0.4], speed: 1 }}
        seed={11}
      />
      {/* steel sliders from the band ends into the cups */}
      {[1, -1].map((s) => (
        <mesh key={s} geometry={cylinder(0.0035, 0.0035, yc - CUP_R + 0.012, 16)} material={steel} position={[s * (SPAN + 0.004), CUP_R + (yc - CUP_R) / 2 + 0.006, 0]} castShadow />
      ))}
    </group>
  );
};

const Felt: React.FC = () => {
  const mat = useMemo(() => {
    const t = noiseTexture(41, 48, 512).clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
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

const Shot: React.FC = () => {
  useShot({
    lens: 85,
    position: [0.12, 0.17, 0.86],
    target: [0.06, 0.065, 0.02],
    move: shot.dolly(0.1, { ease: ease.inOut }),
    drift: { px: 2, seed: 5 },
    focus: { point: [0.075, 0.06, 0.06], aperture: 2.8 },
  });
  return null;
};

export const FurScene: React.FC<{ durationInFrames: number }> = () => (
  <Stage background={F.background} film={{ dof: true, bloom: 0.16, halation: 0.25, grain: 0.3, vignette: 0.22, exposure: 1.12 }}>
    <Shot />
    <Fog color={F.background} near={1.2} far={3.2} />
    {/* rim: behind, above, slightly camera-left */}
    <KeyLight kind="spot" temp={F.rimTemp} intensity={12} position={[-0.35, 0.55, -0.9]} target={[0, 0.08, 0]} angle={20} shadowRadius={14} />
    <Bounce from="floor" temp={3600} intensity={1.1} position={[0.5, 0.15, 0.9]} />
    <SkyFill temp={8200} groundTemp={3400} intensity={0.45} />
    <StudioEnv intensity={0.3} rotationY={2.2} />
    <Felt />
    <Headphones />
  </Stage>
);
