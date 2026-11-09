// Shot file, started from the "render-pass" Look (src/scenes/render-pass/RenderPassScene.tsx).
// Edit freely: this is the only scene file of this shot. Keep the default export.
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Fog, Stage, useTimeline } from "../kit/stage";
import { shot, useShot } from "../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../kit/lights";
import { ease, lerp, progress } from "../kit/motion";
import { chrome, drawTexture, metal, plaster, plastic, wood } from "../kit/materials";
import { FONTS } from "../kit/fonts";
import { cylinder, faceZ, ring, rod, roundedBox, torus } from "../kit/geometry";
import { PassLabels, RenderPass, type SplitSpec } from "../kit/renderPass";

/**
 * Look: Render Pass
 * A pad sampler and a cassette deck on a desk; the frame is split diagonally into
 * beauty / clay / wireframe bands that slide slowly while the camera orbits 20°.
 */
export const RENDERPASS = {
  /** editable */
  orbitDeg: 20,
  labels: { beauty: "成片", clay: "白模", wire: "线框" },
  /** band seams at start and end (0..1 across the frame diagonal) */
  seamsFrom: [0.37, 0.5],
  seamsTo: [0.43, 0.56],
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

/* ------------------------------ radio ------------------------------ */

const FEET = 0.008;
const CW = 0.34, CH = 0.2, CD = 0.14; // cabinet
const CY = FEET + CH / 2;
const FRONT = CD / 2 + 0.001; // front panel surface

const dialTexture = () =>
  drawTexture("radio-dial-v1", 1024, (c, s) => {
    const ratio = 0.118 / 0.048;
    c.save();
    c.scale(1 / ratio, 1);
    const W = s * ratio;
    c.fillStyle = "#f0c879";
    c.fillRect(0, 0, W, s);
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "rgba(255,240,200,0.35)");
    g.addColorStop(1, "rgba(120,60,10,0.35)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, s);
    c.strokeStyle = "#3a2210";
    c.fillStyle = "#3a2210";
    c.lineWidth = 10;
    c.beginPath();
    c.moveTo(W * 0.06, s * 0.62);
    c.lineTo(W * 0.94, s * 0.62);
    c.stroke();
    for (let i = 0; i <= 40; i++) {
      const x = W * (0.06 + 0.88 * (i / 40));
      const big = i % 5 === 0;
      c.lineWidth = big ? 10 : 5;
      c.beginPath();
      c.moveTo(x, s * 0.62);
      c.lineTo(x, s * (big ? 0.42 : 0.5));
      c.stroke();
    }
    c.font = `700 ${s * 0.2}px ${FONTS.ui}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const nums = ["55", "60", "70", "80", "100", "120", "140", "160", "MC"];
    nums.forEach((n, i) => c.fillText(n, W * (0.06 + 0.88 * (i / 8)), s * 0.24));
    c.font = `600 ${s * 0.13}px ${FONTS.ui}`;
    c.fillText("AM  ·  BROADCAST", W / 2, s * 0.83);
    c.restore();
  });

const Grille: React.FC = () => {
  const r = 0.056;
  const bars = [-0.042, -0.028, -0.014, 0, 0.014, 0.028, 0.042];
  const cloth = drawTexture("radio-cloth-v1", 512, (c, s) => {
    c.fillStyle = "#8a7258";
    c.fillRect(0, 0, s, s);
    c.strokeStyle = "rgba(60,40,25,0.55)";
    c.lineWidth = 6;
    for (let i = 0; i < s; i += 16) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, s); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(s, i); c.stroke();
    }
  });
  const clothMat = useMemo(() => new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.9 }), [cloth]);
  return (
    <group position={[-0.078, CY, FRONT]}>
      <mesh geometry={faceZ(cylinder(r, r, 0.002, 48))} material={clothMat} position={[0, 0, 0.0012]} receiveShadow />
      <mesh geometry={faceZ(ring(r + 0.006, r - 0.001, 0.006, 64))} material={metal("#c8a560", 0.28)} position={[0, 0, 0.003]} castShadow />
      {bars.map((y) => {
        const hl = Math.sqrt(r * r - y * y) - 0.001;
        return <mesh key={y} geometry={rod([-hl, y, 0.0045], [hl, y, 0.0045], 0.0016, 12)} material={chrome(0.12)} castShadow />;
      })}
    </group>
  );
};

const Dial: React.FC = () => {
  const needle = useRef<THREE.Mesh>(null!);
  const { durationInFrames } = useVideoConfig();
  const face = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(1.15, 1.05, 0.9), map: dialTexture() }),
    [],
  );
  useTimeline((t) => {
    needle.current.position.x = lerp(-0.03, 0.012, progress(t, 0, durationInFrames - 1, ease.inOut));
  });
  return (
    <group position={[0.07, CY + 0.03, FRONT]}>
      <mesh geometry={roundedBox(0.132, 0.062, 0.006, 0.004, 4)} material={metal("#c8a560", 0.28)} position={[0, 0, 0.003]} castShadow />
      <mesh position={[0, 0, 0.0064]} material={face}>
        <planeGeometry args={[0.118, 0.048]} />
      </mesh>
      <mesh ref={needle} position={[0, 0.002, 0.0069]}>
        <planeGeometry args={[0.0018, 0.04]} />
        <meshBasicMaterial color="#c8341c" toneMapped={false} />
      </mesh>
    </group>
  );
};

const Radio: React.FC = () => {
  const case_ = wood({ seed: 7, light: "#9a6a42", dark: "#4f2f1a", repeat: [1, 1], roughness: 0.42 });
  const panel = plastic("#e4d8bf", 0.5);
  const knob = plastic("#3b2418", 0.35);
  const brass = metal("#c8a560", 0.28);
  return (
    <group>
      <mesh geometry={roundedBox(CW, CH, CD, 0.02, 6)} material={case_} position={[0, CY, 0]} castShadow receiveShadow />
      {/* cream front panel, 1 mm proud of the cabinet */}
      <mesh geometry={roundedBox(CW - 0.03, CH - 0.03, 0.006, 0.008, 4)} material={panel} position={[0, CY, FRONT - 0.003]} castShadow receiveShadow />
      <Grille />
      <Dial />
      {[0.04, 0.1].map((x) => (
        <group key={x} position={[x, CY - 0.045, FRONT]}>
          <mesh geometry={faceZ(cylinder(0.014, 0.016, 0.016, 32))} material={knob} position={[0, 0, 0.008]} castShadow />
          <mesh geometry={faceZ(ring(0.0165, 0.0135, 0.003, 32))} material={brass} position={[0, 0, 0.0015]} />
        </group>
      ))}
      {/* carry handle */}
      <mesh geometry={torus(0.1, 0.006, Math.PI, 32)} material={plastic("#2a1a12", 0.5)} position={[0, FEET + CH - 0.004, 0]} scale={[1, 0.38, 1]} castShadow />
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} geometry={cylinder(0.011, 0.012, 0.008, 24)} material={brass} position={[x, FEET + CH + 0.002, 0]} castShadow />
      ))}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} geometry={cylinder(0.009, 0.01, FEET, 24)} material={plastic("#1c1c1c", 0.7)} position={[sx * 0.14, FEET / 2, sz * 0.05]} castShadow />
      )))}
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
    frame: { center: [0, 0.115, 0], size: [0.38, 0.24, 0.22], fill: 0.45, elevation: 30 },
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
        <KeyLight kind="softbox" temp={4800} intensity={5.5} position={[-1.0, 1.6, 0.9]} target={[0, 0.1, 0]} angle={30} shadowRadius={9} />
        <Bounce from="wall" temp={7000} intensity={0.45} position={[1.4, 0.5, 0.6]} />
        <SkyFill temp={9000} intensity={0.3} />
        <StudioEnv intensity={0.35} />
        <Room />
        <group rotation-y={0.3}>
          <Radio />
        </group>
        <RenderPass {...splitSpec} />
      </Stage>
      <PassLabels spec={splitSpec} labels={R.labels} rows={[undefined, 0.66, undefined] as unknown as number[]} />
    </AbsoluteFill>
  );
};

export default RenderPassScene;
