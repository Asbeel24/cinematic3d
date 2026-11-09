import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useVideoConfig } from "remotion";
import { Fog, Stage, useTimeline } from "../../kit/stage";
import { shot, useShot } from "../../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../../kit/lights";
import { ease, progress, rng } from "../../kit/motion";
import { drawTexture, metal, noiseTexture, plastic, wood } from "../../kit/materials";
import { cylinder, roundedBox } from "../../kit/geometry";

/**
 * Look: Turntable
 * A desktop synthesizer standing on a stone plinth, turning slowly while the camera pushes in.
 * Studio light, glossy floor with a mirrored reflection that fades out.
 */
export const TURNTABLE = {
  /** editable */
  brand: "TIDE · 01",
  model: "PARAPHONIC SYNTHESIZER",
  panelColor: "#d9d5cc",
  knobColors: ["#e2572b", "#e2572b", "#2b2b2b", "#2b2b2b", "#f0b429", "#2b2b2b"],
  keyTemp: 4300,
  /** degrees the product turns over the shot */
  turn: 70,
  /** when the product faces the camera straight on, as a fraction of the shot (0.62 ≈ 3.7 s of 6 s) */
  frontAt: 0.62,
  background: "#302c28",
  /** do not edit */
  plinthR: 0.25,
  plinthH: 0.12,
};
const T = TURNTABLE;

/* ----------------------------- product ----------------------------- */

const Synth: React.FC = () => {
  const W = 0.44, D = 0.24, H = 0.045;
  const panel = useMemo(() => {
    const tex = drawTexture(`synth-panel-${T.brand}-${T.panelColor}`, 1024, (c, s) => {
      c.fillStyle = T.panelColor;
      c.fillRect(0, 0, s, s);
      // brushed texture
      const r = rng(4);
      for (let i = 0; i < 900; i++) {
        c.strokeStyle = `rgba(0,0,0,${0.015 + r() * 0.03})`;
        c.beginPath();
        const y = r() * s;
        c.moveTo(0, y);
        c.lineTo(s, y + (r() - 0.5) * 2);
        c.stroke();
      }
      c.fillStyle = "#26231f";
      c.font = "700 46px Inter";
      c.fillText(T.brand, s * 0.06, s * 0.13);
      c.font = "600 20px Inter";
      c.fillStyle = "#5e5850";
      c.fillText(T.model, s * 0.06, s * 0.18);
      // section lines + labels
      c.strokeStyle = "#8a8378";
      c.lineWidth = 2;
      c.strokeRect(s * 0.05, s * 0.24, s * 0.9, s * 0.36);
      c.fillStyle = "#6c665c";
      c.font = "600 16px Inter";
      ["OSC", "SHAPE", "CUTOFF", "RES", "ENV", "LFO"].forEach((l, i) => c.fillText(l, s * (0.1 + i * 0.14), s * 0.57));
    });
    tex.anisotropy = 8;
    return new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.38, metalness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.4 });
  }, []);
  const screen = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: drawTexture("synth-screen", 256, (c, s) => {
          c.fillStyle = "#06090a";
          c.fillRect(0, 0, s, s);
          c.strokeStyle = "#7df3d2";
          c.lineWidth = 4;
          c.beginPath();
          for (let x = 0; x <= s; x += 2) {
            const y = s * 0.5 + Math.sin((x / s) * Math.PI * 6) * s * 0.18 * Math.exp(-x / s);
            if (x === 0) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
          c.stroke();
        }),
        toneMapped: false,
        color: new THREE.Color(1.6, 1.6, 1.6),
      }),
    [],
  );
  const frontLabel = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: drawTexture(`synth-front-${T.brand}`, 1024, (c, s) => {
          // the label is ~10.6:1, so draw on a virtual wide canvas squeezed into the square texture
          const ratio = (W - 0.01) / (H * 0.9);
          const vw = s * ratio;
          c.fillStyle = "#1e1d1b";
          c.fillRect(0, 0, s, s);
          c.save();
          c.scale(1 / ratio, 1);
          c.textBaseline = "middle";
          c.fillStyle = "#e9e3d6";
          c.font = "700 560px Inter";
          c.fillText(T.brand, vw * 0.035, s * 0.54);
          c.font = "600 230px Inter";
          c.fillStyle = "#8f887c";
          const w = c.measureText(T.model).width;
          c.fillText(T.model, vw * 0.965 - w, s * 0.56);
          c.restore();
        }),
        roughness: 0.4,
        metalness: 0.3,
      }),
    [],
  );
  const white = plastic("#f1efe9", 0.35);
  const black = plastic("#1b1b1d", 0.3);
  const keys = 18;
  const keyW = (W - 0.06) / keys;
  const blackPattern = [1, 1, 0, 1, 1, 1, 0];
  return (
    <group>
      {/* walnut cheeks */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} geometry={roundedBox(0.02, H + 0.012, D, 0.005)} material={wood({ seed: 12, light: "#8a5634", dark: "#40220f", repeat: [0.3, 0.3] })} position={[sx * (W / 2 + 0.01), (H + 0.012) / 2, 0]} castShadow receiveShadow />
      ))}
      {/* body */}
      <mesh geometry={roundedBox(W, H, D, 0.004)} material={metal("#3a3936", 0.45)} position={[0, H / 2, 0]} castShadow receiveShadow />
      {/* top panel (slightly sloped back half) */}
      <mesh position={[0, H + 0.0005, -0.035]} rotation-x={-Math.PI / 2} material={panel} receiveShadow>
        <planeGeometry args={[W - 0.004, D * 0.68]} />
      </mesh>
      {/* knobs */}
      {T.knobColors.map((col, i) => (
        <group key={i} position={[-W / 2 + 0.06 + i * 0.062, H, -0.075]}>
          <mesh geometry={cylinder(0.011, 0.012, 0.016, 32)} material={plastic(col, 0.35)} position={[0, 0.008, 0]} castShadow />
          <mesh geometry={roundedBox(0.002, 0.002, 0.008, 0.0008, 1)} material={white} position={[0, 0.0165, -0.004]} rotation-y={(i * 0.7) % 2} />
        </group>
      ))}
      {/* small knobs row */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={`s${i}`} geometry={cylinder(0.006, 0.0065, 0.01, 24)} material={metal("#c9c4bb", 0.3)} position={[-W / 2 + 0.05 + i * 0.03, H + 0.005, -0.02]} castShadow />
      ))}
      {/* brand on the front face */}
      <mesh position={[0, H / 2, D / 2 + 0.0006]} material={frontLabel}>
        <planeGeometry args={[W - 0.01, H * 0.9]} />
      </mesh>
      {/* screen */}
      <mesh position={[W / 2 - 0.075, H + 0.0012, -0.02]} rotation-x={-Math.PI / 2} material={screen}>
        <planeGeometry args={[0.07, 0.035]} />
      </mesh>
      {/* keybed */}
      <mesh geometry={roundedBox(W - 0.02, 0.006, 0.075, 0.002)} material={black} position={[0, H - 0.002, D / 2 - 0.045]} receiveShadow />
      {Array.from({ length: keys }, (_, i) => (
        <mesh key={`w${i}`} geometry={roundedBox(keyW - 0.0012, 0.009, 0.068, 0.0015, 2)} material={white} position={[-W / 2 + 0.03 + keyW * (i + 0.5), H + 0.004, D / 2 - 0.044]} castShadow receiveShadow />
      ))}
      {Array.from({ length: keys - 1 }, (_, i) => i)
        .filter((i) => blackPattern[i % 7] === 1)
        .map((i) => (
          <mesh key={`b${i}`} geometry={roundedBox(keyW * 0.58, 0.009, 0.04, 0.0015, 2)} material={black} position={[-W / 2 + 0.03 + keyW * (i + 1), H + 0.0085, D / 2 - 0.058]} castShadow />
        ))}
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
    // rotation 0 = front faces the camera (+z); it happens at frontAt of the shot
    turn.current.rotation.y = THREE.MathUtils.degToRad(T.turn * (k - ease.inOut(T.frontAt)));
  });
  return (
    <group>
      <mesh geometry={cylinder(T.plinthR, T.plinthR, T.plinthH, 128)} material={stoneMat} position={[0, T.plinthH / 2, 0]} castShadow receiveShadow />
      <group ref={turn} position={[0, T.plinthH, 0]}>
        <Synth />
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
    position: [0.0, 0.8, 1.6],
    target: [0, 0.11, 0],
    move: shot.push([0.0, 0.7, 1.36], { ease: ease.inOut }),
    drift: { px: 2, seed: 9 },
    focus: { point: [0, 0.17, 0.08], aperture: 4 },
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
