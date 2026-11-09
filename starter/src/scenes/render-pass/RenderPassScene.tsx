import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Fog, Stage, useTimeline } from "../../kit/stage";
import { shot, useShot } from "../../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../../kit/lights";
import { ease, lerp, progress } from "../../kit/motion";
import { drawTexture, metal, plaster, plastic, wood } from "../../kit/materials";
import { cylinder, roundedBox } from "../../kit/geometry";
import { PassLabels, RenderPass, type SplitSpec } from "../../kit/renderPass";

/**
 * Look: Render Pass
 * A pad sampler and a cassette deck on a desk; the frame is split diagonally into
 * beauty / clay / wireframe bands that slide slowly while the camera orbits 20°.
 */
export const RENDERPASS = {
  /** editable */
  padAccent: "#ff6a2b",
  deckColor: "#c9c6bf",
  orbitDeg: 20,
  labels: { beauty: "BEAUTY", clay: "CLAY", wire: "WIREFRAME" },
  /** band seams at start and end (0..1 across the frame diagonal) */
  seamsFrom: [0.43, 0.6],
  seamsTo: [0.37, 0.54],
  clayColor: "#b9b4ab",
  wireColor: "#bcd8ff",
  wireBackground: "#24324a",
};
const R = RENDERPASS;

/** The split for a shot of `frames` frames: seams slide from seamsFrom to seamsTo. */
export const makeSplitSpec = (frames: number): SplitSpec => ({
  passes: ["beauty", "clay", "wire"],
  split: "diagonal",
  seams: (t) => {
    const k = progress(t, 0, frames - 1, ease.inOut);
    return [lerp(R.seamsFrom[0], R.seamsTo[0], k), lerp(R.seamsFrom[1], R.seamsTo[1], k)];
  },
  clayColor: R.clayColor,
  wireColor: R.wireColor,
  wireBackground: R.wireBackground,
});

/* ------------------------------ props ------------------------------ */

const Sampler: React.FC = () => {
  const W = 0.25, D = 0.25, H = 0.035;
  const pad = plastic("#3a3a3e", 0.75);
  const accent = plastic(R.padAccent, 0.6);
  const lit = [0, 5, 10, 15, 6];
  const screen = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        toneMapped: false,
        color: new THREE.Color(1.5, 1.5, 1.5),
        map: drawTexture("sampler-screen", 256, (c, s) => {
          c.fillStyle = "#0b0f0c";
          c.fillRect(0, 0, s, s);
          c.fillStyle = "#ffb45a";
          for (let i = 0; i < 48; i++) {
            const h = Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)) * s * 0.6 + 6;
            c.fillRect(8 + i * 5, s / 2 - h / 2, 3, h);
          }
        }),
      }),
    [],
  );
  return (
    <group>
      <mesh geometry={roundedBox(W, H, D, 0.008)} material={metal("#2a2a2d", 0.5)} position={[0, H / 2, 0]} castShadow receiveShadow />
      {/* 4×4 pads */}
      {Array.from({ length: 16 }, (_, i) => {
        const x = (i % 4) - 1.5, z = Math.floor(i / 4) - 1.5;
        return (
          <mesh key={i} geometry={roundedBox(0.038, 0.008, 0.038, 0.004, 2)} material={lit.includes(i) ? accent : pad} position={[0.03 + x * 0.043, H + 0.003, 0.03 + z * 0.043]} castShadow receiveShadow />
        );
      })}
      {/* screen + knobs on the left strip */}
      <mesh position={[-0.085, H + 0.0008, -0.085]} rotation-x={-Math.PI / 2} material={screen}>
        <planeGeometry args={[0.06, 0.035]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} geometry={cylinder(0.008, 0.009, 0.012, 24)} material={plastic("#d9d6cf", 0.4)} position={[-0.098 + (i % 2) * 0.03, H + 0.006, -0.03 + Math.floor(i / 2) * 0.035]} castShadow />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`b${i}`} geometry={roundedBox(0.016, 0.005, 0.009, 0.002, 1)} material={plastic(i === 0 ? R.padAccent : "#59595e", 0.5)} position={[-0.1 + (i % 2) * 0.026, H + 0.002, 0.05 + Math.floor(i / 2) * 0.02]} />
      ))}
    </group>
  );
};

const CassetteDeck: React.FC = () => {
  const W = 0.36, D = 0.25, H = 0.1;
  const reel = useRef<THREE.Group>(null!);
  const reel2 = useRef<THREE.Group>(null!);
  useTimeline((t) => {
    const a = -(t / 30) * Math.PI * 1.2;
    reel.current.rotation.z = a;
    reel2.current.rotation.z = a * 0.8;
  });
  const vu = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        toneMapped: false,
        color: new THREE.Color(1.3, 1.2, 1.0),
        map: drawTexture("vu", 256, (c, s) => {
          c.fillStyle = "#f2e6c4";
          c.fillRect(0, 0, s, s);
          c.strokeStyle = "#2a2622";
          c.lineWidth = 3;
          c.beginPath();
          c.arc(s / 2, s * 1.1, s * 0.8, -Math.PI * 0.78, -Math.PI * 0.22);
          c.stroke();
          c.strokeStyle = "#c8341c";
          c.beginPath();
          c.arc(s / 2, s * 1.1, s * 0.8, -Math.PI * 0.32, -Math.PI * 0.22);
          c.stroke();
          c.strokeStyle = "#1a1a1a";
          c.lineWidth = 4;
          c.beginPath();
          c.moveTo(s / 2, s * 1.05);
          c.lineTo(s * 0.62, s * 0.3);
          c.stroke();
        }),
      }),
    [],
  );
  const front = D / 2 + 0.0008;
  const tapeShell = plastic("#e8e4dc", 0.5);
  const reelMat = plastic("#2b2b2b", 0.4);
  return (
    <group>
      <mesh geometry={roundedBox(W, H, D, 0.006)} material={metal(R.deckColor, 0.35)} position={[0, H / 2 + 0.006, 0]} castShadow receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={cylinder(0.012, 0.012, 0.006, 20)} material={plastic("#1a1a1a", 0.6)} position={[s * 0.15, 0.003, 0.09]} />
      ))}
      {/* cassette well */}
      <mesh geometry={roundedBox(0.15, 0.07, 0.01, 0.004)} material={plastic("#141416", 0.25)} position={[-0.08, H / 2 + 0.01, front - 0.004]} />
      <group position={[-0.08, H / 2 + 0.012, front + 0.002]}>
        <mesh geometry={roundedBox(0.12, 0.052, 0.006, 0.003)} material={tapeShell} castShadow />
        <mesh position={[0, 0.002, 0.0035]} material={plastic("#1c1c1c", 0.2)}>
          <planeGeometry args={[0.07, 0.018]} />
        </mesh>
        <group ref={reel} position={[-0.024, 0.002, 0.004]}>
          <mesh geometry={cylinder(0.007, 0.007, 0.002, 6)} material={reelMat} rotation-x={Math.PI / 2} />
        </group>
        <group ref={reel2} position={[0.024, 0.002, 0.004]}>
          <mesh geometry={cylinder(0.007, 0.007, 0.002, 6)} material={reelMat} rotation-x={Math.PI / 2} />
        </group>
      </group>
      {/* VU meters */}
      {[0, 1].map((i) => (
        <mesh key={i} position={[0.045 + i * 0.065, H / 2 + 0.028, front]} material={vu}>
          <planeGeometry args={[0.055, 0.035]} />
        </mesh>
      ))}
      {/* transport keys */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={`k${i}`} geometry={roundedBox(0.022, 0.014, 0.02, 0.002, 2)} material={plastic(i === 1 ? "#d4402a" : "#2a2a2c", 0.45)} position={[-0.135 + i * 0.022, 0.024, front + 0.002]} castShadow />
      ))}
      {/* level knobs */}
      {[0, 1, 2].map((i) => (
        <mesh key={`n${i}`} geometry={cylinder(0.009, 0.01, 0.012, 24)} material={metal("#d9d9d9", 0.25)} rotation-x={Math.PI / 2} position={[0.05 + i * 0.04, 0.026, front + 0.006]} castShadow />
      ))}
    </group>
  );
};

const Room: React.FC = () => (
  <group>
    <mesh userData={{ noWire: true }} geometry={roundedBox(2.2, 0.04, 1.2, 0.006)} material={wood({ seed: 31, light: "#b3a690", dark: "#6e6250", repeat: [1.2, 1], roughness: 0.55 })} position={[0, -0.02, 0]} castShadow receiveShadow />
    <mesh userData={{ noWire: true }} position={[0, 0.8, -0.55]} material={plaster("#8d8a84")} receiveShadow>
      <planeGeometry args={[4, 2]} />
    </mesh>
  </group>
);

const Shot: React.FC = () => {
  useShot({
    lens: 50,
    position: [0.1, 0.66, 0.98],
    target: [0.0, 0.03, -0.02],
    move: shot.orbit(R.orbitDeg, { ease: ease.inOut }),
    drift: { px: 2, seed: 3 },
    focus: false,
  });
  return null;
};

export const RenderPassScene: React.FC<{ durationInFrames: number }> = () => {
  const { durationInFrames } = useVideoConfig();
  const splitSpec = useMemo(() => makeSplitSpec(durationInFrames), [durationInFrames]);
  return (
    <AbsoluteFill>
      <Stage background="#1a1918" film={{ dof: false, bloom: 0.12, halation: 0.12, grain: 0.22, vignette: 0.2 }}>
        <Shot />
        <Fog color="#1a1918" near={2.2} far={5} />
        <KeyLight kind="softbox" temp={4800} intensity={5.5} position={[-1.0, 1.6, 0.9]} target={[0, 0.04, 0]} angle={30} shadowRadius={9} />
        <Bounce from="wall" temp={7000} intensity={0.45} position={[1.4, 0.5, 0.6]} />
        <SkyFill temp={9000} intensity={0.3} />
        <StudioEnv intensity={0.35} />
        <Room />
        <group position={[0.06, 0, 0.14]} rotation-y={-0.25}>
          <Sampler />
        </group>
        <group position={[-0.04, 0, -0.17]} rotation-y={0.18}>
          <CassetteDeck />
        </group>
        <RenderPass {...splitSpec} />
      </Stage>
      <PassLabels spec={splitSpec} labels={R.labels} />
    </AbsoluteFill>
  );
};

export default RenderPassScene;
