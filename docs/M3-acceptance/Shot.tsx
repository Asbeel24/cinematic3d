// Shot file, started from the "turntable" Look (src/scenes/turntable/Turntable.tsx).
// Edit freely: this is the only scene file of this shot. Keep the default export.
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useVideoConfig } from "remotion";
import { Fog, Stage, useTimeline } from "../kit/stage";
import { shot, useShot } from "../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../kit/lights";
import { ease, progress, rng } from "../kit/motion";
import { drawTexture, noiseTexture, plastic } from "../kit/materials";
import { FONTS } from "../kit/fonts";
import { shotConfig } from "../shot.config";
import { cylinder, roundedBox } from "../kit/geometry";

/**
 * Look: Turntable
 * A white Bluetooth speaker ("AURA") standing on a dark stone plinth, turning slowly while the camera pushes in.
 * Studio light, glossy floor with a mirrored reflection that fades out.
 */
export const TURNTABLE = {
  /** editable */
  brand: "AURA",
  /** speaker shell (white) */
  bodyColor: "#ece8e1",
  /** grille fabric */
  panelColor: "#e2ded6",
  brandColor: "#2a2826",
  keyTemp: 4300,
  /** degrees the product turns over the shot */
  turn: 70,
  background: "#302c28",
  /** do not edit */
  plinthR: 0.25,
  plinthH: 0.12,
};
const T = TURNTABLE;

/* ----------------------------- product ----------------------------- */

/** White fabric-front Bluetooth speaker, ~0.26 × 0.16 × 0.11 m, origin at the bottom centre. */
const SP = { W: 0.26, H: 0.16, D: 0.11, r: 0.022, foot: 0.004 };

const Speaker: React.FC = () => {
  const { W, H, D, r, foot } = SP;
  const gW = W - 2 * r - 0.004; // grille spans the flat part of the front face
  const gH = H - 2 * r - 0.004;
  const grille = useMemo(() => {
    const ratio = gW / gH;
    const tex = drawTexture(`speaker-grille-v2-${T.brand}-${T.panelColor}-${T.brandColor}-${shotConfig.seed}`, 1024, (c, s) => {
      c.fillStyle = T.panelColor;
      c.fillRect(0, 0, s, s);
      // perforated grille: hex dot grid on a virtual wide canvas (no stretching)
      {
        const vw0 = s * ratio;
        c.save();
        c.scale(1 / ratio, 1);
        const pitch = s * 0.022;
        c.fillStyle = "rgba(60,56,50,0.38)";
        for (let row = 0, y = pitch * 0.6; y < s; row++, y += pitch * 0.866) {
          for (let x = (row % 2) * pitch * 0.5 + pitch * 0.5; x < vw0; x += pitch) {
            c.beginPath();
            c.arc(x, y, pitch * 0.2, 0, Math.PI * 2);
            c.fill();
          }
        }
        c.restore();
      }
      // clean band behind the brand so it stays readable
      c.fillStyle = T.panelColor;
      c.fillRect(0, s * 0.36, s, s * 0.28);
      // brand, drawn on a virtual wide canvas so it is not stretched
      const vw = s * ratio;
      c.save();
      c.scale(1 / ratio, 1);
      c.fillStyle = T.brandColor;
      c.textBaseline = "middle";
      c.textAlign = "center";
      c.font = `700 ${Math.round(s * 0.2)}px ${FONTS.ui}`;
      const letters = T.brand.split("");
      const track = s * 0.075;
      const widths = letters.map((l) => c.measureText(l).width);
      const total = widths.reduce((a, b) => a + b, 0) + track * (letters.length - 1);
      let x = vw / 2 - total / 2;
      letters.forEach((l, i) => {
        c.fillText(l, x + widths[i] / 2, s * 0.5);
        x += widths[i] + track;
      });
      c.restore();
    });
    tex.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, bumpMap: noiseTexture(41 + shotConfig.seed, 160), bumpScale: 0.15 });
  }, [gW, gH]);
  const shell = plastic(T.bodyColor, 0.4);
  const rubber = plastic("#1f1e1d", 0.7);
  const button = plastic("#dcd8d0", 0.5);
  const led = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.5, 1.8), toneMapped: false }), []);
  return (
    <group>
      {/* rubber foot strip */}
      <mesh geometry={roundedBox(W - 0.04, foot, D - 0.03, 0.0015, 2)} material={rubber} position={[0, foot / 2, 0]} castShadow receiveShadow />
      {/* shell */}
      <mesh geometry={roundedBox(W, H, D, r, 6)} material={shell} position={[0, foot + H / 2, 0]} castShadow receiveShadow />
      {/* fabric grille with printed brand */}
      <mesh position={[0, foot + H / 2, D / 2 + 0.0008]} material={grille} receiveShadow>
        <planeGeometry args={[gW, gH]} />
      </mesh>
      {/* top buttons */}
      {[-1, 0, 1].map((i) => (
        <mesh key={i} geometry={cylinder(0.0075, 0.008, 0.003, 32)} material={button} position={[i * 0.03, foot + H + 0.0012, -0.005]} castShadow />
      ))}
      {/* status LED */}
      <mesh geometry={cylinder(0.0018, 0.0018, 0.001, 16)} material={led} position={[0.07, foot + H + 0.0004, -0.005]} />
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
  map.repeat.set(3, 0.45);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.75, roughnessMap: noiseTexture(19, 32), bumpMap: noiseTexture(23, 96), bumpScale: 0.4 });
};

const Product: React.FC = () => {
  const turn = useRef<THREE.Group>(null!);
  const stoneMat = useMemo(stone, []);
  const { durationInFrames } = useVideoConfig();
  useTimeline((t) => {
    const k = progress(t, 0, durationInFrames - 1, ease.inOut);
    turn.current.rotation.y = THREE.MathUtils.degToRad(-T.turn / 2 + T.turn * k) - 0.175;
  });
  return (
    <group>
      <mesh geometry={cylinder(T.plinthR, T.plinthR, T.plinthH, 128)} material={stoneMat} position={[0, T.plinthH / 2, 0]} castShadow receiveShadow />
      <group ref={turn} position={[0, T.plinthH, 0]}>
        <Speaker />
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
    position: [0.0, 0.62, 1.6],
    target: [0, 0.2, 0],
    move: shot.push([0.0, 0.6, 1.5], { ease: ease.inOut }),
    drift: { px: 2, seed: 9 + shotConfig.seed },
    focus: { point: [0, 0.2, SP.D / 2], aperture: 5.6 },
  });
  return null;
};

export const Turntable: React.FC<{ durationInFrames: number }> = () => (
  <Stage background={T.background} film={{ dof: true, bloom: 0.15, halation: 0.15, grain: 0.25, vignette: 0.32, exposure: 1.0 }}>
    <Shot />
    <Fog color={T.background} near={1.8} far={4.2} />
    <KeyLight kind="softbox" temp={T.keyTemp} intensity={6.5} position={[-1.2, 1.8, 1.0]} target={[0, 0.12, 0]} angle={28} shadowRadius={10} />
    <Bounce from="wall" temp={6500} intensity={0.5} position={[1.5, 0.4, 0.8]} />
    <SkyFill temp={8500} groundTemp={4000} intensity={0.25} />
    <StudioEnv intensity={0.4} rotationY={0.6} />
    <Product />
    <Floor />
  </Stage>
);

export default Turntable;
