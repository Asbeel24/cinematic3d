// Shot file, started from the "turntable" Look (src/scenes/turntable/Turntable.tsx).
// Edit freely: this is the only scene file of this shot. Keep the default export.
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useVideoConfig } from "remotion";
import { Fog, Stage, useTimeline } from "../kit/stage";
import { shot, useShot } from "../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../kit/lights";
import { ease, progress, rng } from "../kit/motion";
import { drawTexture, jelly, metal, noiseTexture } from "../kit/materials";
import { FONTS } from "../kit/fonts";
import { cylinder, roundedBox } from "../kit/geometry";

/**
 * Look: Turntable
 * A square glass perfume bottle with a gold cap on a stone plinth, turning slowly while the camera pushes in.
 * Studio light, glossy floor with a mirrored reflection that fades out.
 */
export const TURNTABLE = {
  /** editable */
  brand: "VELA",
  subline: "EAU DE PARFUM",
  liquidColor: "#c8862e",
  capColor: "#c9a14a",
  keyTemp: 4300,
  /** wall bounce colour temperature (keep ≥ 2000 K away from keyTemp) */
  bounceTemp: 6500,
  /** degrees the product turns over the shot (a quarter turn) */
  turn: 90,
  /** when the product faces the camera straight on, as a fraction of the shot (90/149 → frame 90 = 3 s) */
  frontAt: 90 / 149,
  background: "#302c28",
  /** do not edit */
  plinthR: 0.25,
  plinthH: 0.12,
};
const T = TURNTABLE;

/* ----------------------------- product ----------------------------- */

// bottle dimensions (m): glass body W × BH × D, square gold cap on top
const W = 0.068, D = 0.042, BH = 0.09;
const COLLAR_H = 0.008, CAP = 0.032;
const RISER_H = 0.012, RISER_R = 0.075;
const PH = BH + COLLAR_H + CAP; // product height 0.13

const Perfume: React.FC = () => {
  const label = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: drawTexture(`perfume-label-${T.brand}-${T.subline}`, 1024, (c, s) => {
          // label face is 0.036 × 0.016 → ratio 2.25, virtual wide canvas
          const ratio = 0.036 / 0.016;
          const vw = s * ratio;
          c.fillStyle = "#ece6d8";
          c.fillRect(0, 0, s, s);
          c.save();
          c.scale(1 / ratio, 1);
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillStyle = "#1e1c19";
          c.font = `700 420px ${FONTS.ui}`;
          c.fillText(T.brand, vw / 2, s * 0.42);
          c.font = `600 120px ${FONTS.ui}`;
          c.fillStyle = "#6a6256";
          c.fillText(T.subline, vw / 2, s * 0.8);
          c.restore();
        }),
        roughness: 0.55,
      }),
    [],
  );
  const gold = metal(T.capColor, 0.26);
  // three.js transmission only refracts opaque objects, so a transmissive glass shell would hide the liquid.
  // The liquid carries the transmission (amber attenuation); the glass is a clear, reflective, non-transmissive shell drawn over it.
  const liquidMat = jelly(T.liquidColor, 0.034);
  const glassShell = useMemo(
    () =>
      // black diffuse + additive blend = only the reflections and highlights are added over what is behind the glass
      new THREE.MeshPhysicalMaterial({ color: "#000000", roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 2.5, specularIntensity: 1 }),
    [],
  );
  return (
    <group>
      {/* glass body */}
      <mesh geometry={roundedBox(W, BH, D, 0.006)} material={glassShell} position={[0, BH / 2, 0]} castShadow />
      {/* perfume inside: thick glass base (10 mm) and walls (4 mm) */}
      <mesh geometry={roundedBox(W - 0.008, 0.062, D - 0.008, 0.004)} material={liquidMat} position={[0, 0.010 + 0.031, 0]} />
      {/* label on the front face */}
      <mesh position={[0, 0.045, D / 2 + 0.0004]} material={label}>
        <planeGeometry args={[0.036, 0.016]} />
      </mesh>
      {/* gold collar + square cap */}
      <mesh geometry={cylinder(0.009, 0.010, COLLAR_H, 48)} material={gold} position={[0, BH + COLLAR_H / 2, 0]} castShadow />
      <mesh geometry={roundedBox(CAP, CAP, CAP, 0.004)} material={gold} position={[0, BH + COLLAR_H + CAP / 2, 0]} castShadow />
    </group>
  );
};

/** Travertine-ish stone: warm base + noise pores. */
const stone = () => {
  const map = drawTexture("terrazzo", 1024, (c, s) => {
    c.fillStyle = "#4b4844";
    c.fillRect(0, 0, s, s);
    const r = rng(17);
    // soft cloudy veins, not stripes
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(${60 + r() * 40},${58 + r() * 36},${54 + r() * 30},0.18)`;
      c.beginPath();
      c.ellipse(r() * s, r() * s, 20 + r() * 120, 6 + r() * 30, (r() - 0.5) * 0.6, 0, Math.PI * 2);
      c.fill();
    }
    // terrazzo chips
    for (let i = 0; i < 1100; i++) {
      const pal = ["#d9d2c5", "#b9a68a", "#8c8780", "#e7e2d8", "#a2593a"];
      c.fillStyle = pal[Math.floor(r() * pal.length)];
      c.globalAlpha = 0.5 + r() * 0.5;
      c.beginPath();
      c.ellipse(r() * s, r() * s, 1 + r() * 3.5, 0.8 + r() * 2.5, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  });
  map.repeat.set(7.2, 1.08); // camera ~2.4× closer than the reference look
  return new THREE.MeshStandardMaterial({ map, roughness: 0.75, roughnessMap: noiseTexture(19, 32), bumpMap: noiseTexture(23, 96), bumpScale: 0.4 });
};

const Product: React.FC = () => {
  const turn = useRef<THREE.Group>(null!);
  const stoneMat = useMemo(stone, []);
  const { durationInFrames } = useVideoConfig();
  useTimeline((t) => {
    const k = progress(t, 0, durationInFrames - 1, ease.inOut);
    // rotation 0 = front faces the camera (+z); it happens at frontAt of the shot
    turn.current.rotation.y = THREE.MathUtils.degToRad(T.turn * (k - ease.inOut(T.frontAt)));
  });
  return (
    <group>
      <mesh geometry={cylinder(T.plinthR, T.plinthR, T.plinthH, 128)} material={stoneMat} position={[0, T.plinthH / 2, 0]} castShadow receiveShadow />
      {/* small dark display riser */}
      <mesh geometry={cylinder(RISER_R, RISER_R, RISER_H, 96)} material={metal("#2a2a2d", 0.35)} position={[0, T.plinthH + RISER_H / 2, 0]} castShadow receiveShadow />
      <group ref={turn} position={[0, T.plinthH + RISER_H, 0]}>
        <Perfume />
      </group>
    </group>
  );
};

/** Glossy floor that fades into the background, with a mirrored copy of the product under it. */
const Floor: React.FC = () => {
  const fade = useMemo(
    () =>
      drawTexture(`floor-fade-${T.background}`, 512, (c, s) => {
        const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.55, "rgba(255,255,255,0.75)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, s, s);
      }),
    [],
  );
  const floorMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({ color: "#1c1b1a", roughness: 0.28, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, transparent: true, opacity: 0.95, alphaMap: fade }),
    [fade],
  );
  return (
    <group>
      {/* reflection: mirrored product, dimmed by the semi-opaque floor */}
      <group scale={[1, -1, 1]}>
        <Product />
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.0005, 0]} material={floorMat} receiveShadow>
        <circleGeometry args={[3, 96]} />
      </mesh>
    </group>
  );
};

const Shot: React.FC = () => {
  useShot({
    lens: 50,
    frame: { center: [0, T.plinthH + (RISER_H + PH) / 2, 0], size: [0.08, RISER_H + PH, 0.08], fill: 0.42, elevation: 13 },
    move: shot.dolly(0.05, { ease: ease.inOut }),
    drift: { px: 2, seed: 9 },
    focus: { point: [0, T.plinthH + RISER_H + 0.045, D / 2], aperture: 4 },
  });
  return null;
};

export const Turntable: React.FC<{ durationInFrames: number }> = () => (
  <Stage background={T.background} film={{ dof: true, bloom: 0.15, halation: 0.15, grain: 0.25, vignette: 0.32, exposure: 1.0 }}>
    <Shot />
    <Fog color={T.background} near={1.8} far={4.2} />
    <KeyLight kind="softbox" temp={T.keyTemp} intensity={6.5} position={[-1.2, 1.8, 1.0]} target={[0, 0.12, 0]} angle={28} shadowRadius={10} />
    <Bounce from="wall" temp={T.bounceTemp} intensity={0.5} position={[1.5, 0.4, 0.8]} />
    <SkyFill temp={8500} groundTemp={4000} intensity={0.25} />
    <StudioEnv intensity={0.4} rotationY={0.6} />
    <Product />
    <Floor />
  </Stage>
);

export default Turntable;
