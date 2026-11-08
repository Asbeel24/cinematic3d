import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { Stage, useTimeline } from "../../kit/stage";
import { shot, useShot, type Vec3 } from "../../kit/camera";
import { Beam, Bounce, KeyLight, SkyFill, StudioEnv } from "../../kit/lights";
import { Dust, Steam } from "../../kit/particles";
import { lerp, progress, ease, rng } from "../../kit/motion";
import {
  drawTexture,
  emissive,
  gradientTexture,
  liquid,
  metal,
  paper,
  plaster,
  plastic,
  porcelain,
  vinyl,
  wood,
} from "../../kit/materials";
import { cylinder, lathe, roundedBox, smoothProfile, wallWithHole } from "../../kit/geometry";

/**
 * Look: Golden Hour
 * A rented room in Shenzhen, late afternoon. Record player + gaiwan tea steaming on a desk
 * by the window; the blind shadows crawl slowly across the desk.
 * Everything is in metres; desk top is y = 0.
 */

export const GOLDEN = {
  /** editable */
  sunTemp: 3300,
  sunIntensity: 7,
  skyTemp: 9500,
  haze: 0.65,
  /** sun azimuth (deg, from the window normal toward the left) at start → end */
  azimuth: [31, 34.5] as [number, number],
  elevation: [27, 26.2] as [number, number],
  labelColor: "#d5532a",
  /** do not edit: geometry the light setup depends on */
  windowX: [-0.72, 0.18] as [number, number],
  windowY: [0.24, 1.26] as [number, number],
  wallZ: -0.48,
};

const W = GOLDEN;
const winCorners: [Vec3, Vec3, Vec3, Vec3] = [
  [W.windowX[0], W.windowY[0], W.wallZ - 0.06],
  [W.windowX[1], W.windowY[0], W.wallZ - 0.06],
  [W.windowX[1], W.windowY[1], W.wallZ - 0.06],
  [W.windowX[0], W.windowY[1], W.wallZ - 0.06],
];

/** sun pose as a pure function of t */
function sun(t: number, total: number) {
  const k = progress(t, 0, total, ease.inOut);
  const az = THREE.MathUtils.degToRad(lerp(W.azimuth[0], W.azimuth[1], k));
  const el = THREE.MathUtils.degToRad(lerp(W.elevation[0], W.elevation[1], k));
  // aim at the window centre: the cone only needs to cover the opening
  const target = new THREE.Vector3((W.windowX[0] + W.windowX[1]) / 2, (W.windowY[0] + W.windowY[1]) / 2, W.wallZ);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), -Math.sin(el), Math.cos(az) * Math.cos(el));
  const pos = target.clone().addScaledVector(dir, -9);
  return { position: pos.toArray() as Vec3, target: target.toArray() as Vec3 };
}

/* ------------------------------ props ------------------------------ */

const Room: React.FC = () => {
  const wallGeo = useMemo(
    () =>
      wallWithHole(4, 2.6, { x: W.windowX[0], y: W.windowY[0] + 0.8, w: W.windowX[1] - W.windowX[0], h: W.windowY[1] - W.windowY[0] }, 0.14),
    [],
  );
  const winW = W.windowX[1] - W.windowX[0];
  const winH = W.windowY[1] - W.windowY[0];
  const cx = (W.windowX[0] + W.windowX[1]) / 2;
  const cy = (W.windowY[0] + W.windowY[1]) / 2;
  const alu = metal("#9a958c", 0.45);
  const bars = metal("#7d7a74", 0.5);
  // blind slats: lowered over the whole window, tilted open
  const slatPitch = 0.026;
  const slats = Math.floor((winH - 0.03) / slatPitch);
  return (
    <group>
      {/* back wall with window opening (casts the window-shaped shadow) */}
      <mesh geometry={wallGeo} material={plaster("#d6c6ae")} position={[0, -0.8, W.wallZ - 0.14]} castShadow receiveShadow />
      {/* side wall (right), mostly out of frame, gives bounce context */}
      <mesh position={[1.1, 0.5, 0.3]} rotation-y={-Math.PI / 2} material={plaster("#d6c6ae")} receiveShadow>
        <planeGeometry args={[2.4, 2.6]} />
      </mesh>
      {/* window sill */}
      <mesh geometry={roundedBox(winW + 0.12, 0.025, 0.2, 0.004)} material={plaster("#e4d9c6")} position={[cx, W.windowY[0] - 0.012, W.wallZ - 0.04]} castShadow receiveShadow />
      {/* aluminium frame + sliding mullion */}
      {[
        [cx, W.windowY[1] - 0.02, winW, 0.04],
        [cx, W.windowY[0] + 0.02, winW, 0.04],
      ].map(([x, y, w, h], i) => (
        <mesh key={`h${i}`} geometry={roundedBox(w, h, 0.05, 0.004)} material={alu} position={[x, y, W.wallZ - 0.09]} castShadow />
      ))}
      {[W.windowX[0] + 0.02, W.windowX[1] - 0.02, cx + 0.03].map((x, i) => (
        <mesh key={`v${i}`} geometry={roundedBox(0.04, winH, 0.05, 0.004)} material={alu} position={[x, cy, W.wallZ - 0.09 - (i === 2 ? 0.02 : 0)]} castShadow />
      ))}
      {/* security bars (防盗网) outside; their shadow is carried by the gobo */}
      {Array.from({ length: 7 }, (_, i) => W.windowX[0] + ((i + 1) * winW) / 8).map((x, i) => (
        <mesh key={`b${i}`} geometry={cylinder(0.006, 0.006, winH + 0.2, 12)} material={bars} position={[x, cy, W.wallZ - 0.3]} />
      ))}
      <mesh geometry={cylinder(0.006, 0.006, winW + 0.2, 12)} material={bars} position={[cx, W.windowY[0] + winH * 0.38, W.wallZ - 0.3]} rotation-z={Math.PI / 2} />
      {/* venetian blind; its shadow on the desk is carried by the gobo, so slats don't cast */}
      {Array.from({ length: slats }, (_, i) => W.windowY[1] - 0.03 - i * slatPitch).map((y, i) => (
        <mesh key={`s${i}`} position={[cx, y, W.wallZ + 0.03]} rotation-x={0.62} geometry={roundedBox(winW - 0.02, 0.0012, 0.025, 0.0005, 1)} material={plastic("#e9e1d2", 0.55)} />
      ))}
      <mesh geometry={roundedBox(winW - 0.01, 0.03, 0.035, 0.004)} material={plastic("#e9e1d2", 0.55)} position={[cx, W.windowY[1] - 0.012, W.wallZ + 0.03]} />
      <mesh geometry={roundedBox(winW - 0.01, 0.01, 0.03, 0.003)} material={plastic("#e9e1d2", 0.55)} position={[cx, W.windowY[1] - 0.03 - slats * slatPitch, W.wallZ + 0.03]} />
      {/* floor (barely visible) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.76, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#6b5a49" roughness={0.8} />
      </mesh>
      <Outside />
    </group>
  );
};

/** Sky and a hazy silhouette of the next-door buildings. */
const Outside: React.FC = () => {
  const sky = gradientTexture([
    [0, "#9fb4c9"],
    [0.45, "#f1c38d"],
    [0.75, "#ffb067"],
    [1, "#f6a35e"],
  ]);
  const r = rng(21);
  const blocks = Array.from({ length: 9 }, (_, i) => ({
    x: -2.4 + i * 0.6 + r() * 0.2,
    h: 0.6 + r() * 1.6,
    w: 0.45 + r() * 0.35,
    z: -3.2 - r() * 2.2,
  }));
  return (
    <group>
      <mesh position={[-0.2, 1.0, -7]} material={emissive("#ffffff", 2.4, sky)}>
        <planeGeometry args={[14, 7]} />
      </mesh>
      {blocks.map((b, i) => (
        <mesh key={i} position={[b.x, -0.6 + b.h / 2, b.z]} material={emissive("#c99a76", 0.9 - (b.z + 3.2) * -0.12)}>
          <boxGeometry args={[b.w, b.h, 0.3]} />
        </mesh>
      ))}
    </group>
  );
};

const Desk: React.FC = () => (
  <group>
    <mesh
      geometry={roundedBox(2.1, 0.04, 1.08, 0.006)}
      material={wood({ seed: 5, light: "#a7764c", dark: "#5c3820", repeat: [1.4, 1], roughness: 0.42 })}
      position={[0.05, -0.02, 0.06]}
      castShadow
      receiveShadow
    />
  </group>
);

const RecordPlayer: React.FC<{ position: Vec3; rotY?: number }> = ({ position, rotY = 0 }) => {
  const platter = useRef<THREE.Group>(null!);
  useTimeline((t) => {
    // 33⅓ rpm
    platter.current.rotation.y = -(t / 30) * (33.333 / 60) * Math.PI * 2;
  });
  const label = drawTexture("label", 512, (c, s) => {
    c.fillStyle = W.labelColor;
    c.fillRect(0, 0, s, s);
    c.strokeStyle = "rgba(255,240,220,0.75)";
    c.lineWidth = 6;
    for (const rr of [0.42, 0.36]) {
      c.beginPath();
      c.arc(s / 2, s / 2, s * rr, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = "rgba(255,240,220,0.85)";
    c.fillRect(s * 0.18, s * 0.62, s * 0.64, s * 0.03);
    c.fillRect(s * 0.3, s * 0.68, s * 0.4, s * 0.02);
    c.beginPath();
    c.moveTo(s * 0.5, s * 0.2);
    c.lineTo(s * 0.62, s * 0.4);
    c.lineTo(s * 0.38, s * 0.4);
    c.fill();
  });
  const plinthH = 0.085;
  return (
    <group position={position} rotation-y={rotY}>
      <mesh geometry={roundedBox(0.44, plinthH, 0.35, 0.012)} material={wood({ seed: 8, light: "#7a4b2c", dark: "#3b2212", repeat: [0.6, 0.6], roughness: 0.38 })} position={[0, plinthH / 2 + 0.012, 0]} castShadow receiveShadow />
      {[[-0.18, -0.14], [0.18, -0.14], [-0.18, 0.14], [0.18, 0.14]].map(([x, z], i) => (
        <mesh key={i} geometry={cylinder(0.018, 0.02, 0.012, 24)} material={metal("#2a2a2a", 0.6)} position={[x, 0.006, z]} castShadow />
      ))}
      <group ref={platter} position={[-0.045, plinthH + 0.012, 0]}>
        <mesh geometry={cylinder(0.148, 0.148, 0.018, 96)} material={metal("#c9c6c0", 0.28)} position={[0, 0.009, 0]} castShadow receiveShadow />
        <mesh geometry={cylinder(0.1495, 0.1495, 0.002, 128)} material={vinyl()} position={[0, 0.019, 0]} castShadow receiveShadow />
        <mesh position={[0, 0.0202, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[0.046, 64]} />
          <meshStandardMaterial map={label} roughness={0.7} />
        </mesh>
        <mesh geometry={cylinder(0.0035, 0.0035, 0.03, 16)} material={metal("#dcdcdc", 0.15)} position={[0, 0.03, 0]} />
      </group>
      {/* tonearm */}
      <group position={[0.165, plinthH + 0.012, -0.1]}>
        <mesh geometry={cylinder(0.022, 0.024, 0.02, 32)} material={metal("#1d1d1f", 0.5)} position={[0, 0.01, 0]} castShadow />
        <mesh geometry={cylinder(0.008, 0.008, 0.045, 16)} material={metal("#c8c8c8", 0.2)} position={[0, 0.04, 0]} castShadow />
        <group position={[0, 0.06, 0]} rotation-y={0.62}>
          <mesh geometry={cylinder(0.0045, 0.0045, 0.23, 16)} material={metal("#d4d4d4", 0.18)} rotation-x={Math.PI / 2} position={[0, 0, 0.115]} castShadow />
          <mesh geometry={roundedBox(0.018, 0.008, 0.035, 0.002)} material={metal("#1d1d1f", 0.4)} position={[0, -0.006, 0.235]} castShadow />
          <mesh geometry={cylinder(0.014, 0.014, 0.03, 24)} material={metal("#1d1d1f", 0.45)} rotation-x={Math.PI / 2} position={[0, 0, -0.035]} castShadow />
        </group>
      </group>
      {/* speed knob */}
      <mesh geometry={cylinder(0.014, 0.014, 0.012, 32)} material={metal("#c8c4bc", 0.3)} position={[-0.17, plinthH + 0.018, 0.14]} castShadow />
    </group>
  );
};

const Gaiwan: React.FC<{ position: Vec3 }> = ({ position }) => {
  const bowl = useMemo(
    () => lathe(smoothProfile([[0.022, 0], [0.026, 0.004], [0.04, 0.02], [0.05, 0.042], [0.054, 0.058]]), { thickness: 0.0025 }),
    [],
  );
  const foot = useMemo(() => lathe([[0.0, 0], [0.024, 0], [0.025, 0.006], [0.021, 0.006]]), []);
  const saucer = useMemo(
    () => lathe(smoothProfile([[0, 0], [0.045, 0.0], [0.06, 0.006], [0.068, 0.012]]), { thickness: 0.0025 }),
    [],
  );
  const lid = useMemo(
    () => lathe(smoothProfile([[0.0, 0.03], [0.02, 0.028], [0.04, 0.016], [0.05, 0.004], [0.053, 0.0]]), { thickness: 0.002 }),
    [],
  );
  const rim = drawTexture("blue-rim", 256, (c, s) => {
    c.fillStyle = "#f3f0ea";
    c.fillRect(0, 0, s, s);
    c.fillStyle = "#3d5a8a";
    c.fillRect(0, s * 0.06, s, s * 0.035);
    c.fillRect(0, s * 0.94, s, s * 0.02);
  });
  const bowlMat = useMemo(() => {
    const m = (porcelain() as THREE.MeshPhysicalMaterial).clone();
    m.map = rim;
    return m;
  }, [rim]);
  return (
    <group position={position}>
      <mesh geometry={saucer} material={porcelain()} castShadow receiveShadow />
      <group position={[0, 0.006, 0]}>
        <mesh geometry={foot} material={porcelain()} castShadow />
        <mesh geometry={bowl} material={bowlMat} position={[0, 0.006, 0]} castShadow receiveShadow />
        {/* tea */}
        <mesh position={[0, 0.048, 0]} rotation-x={-Math.PI / 2} material={liquid("#7a4614")}>
          <circleGeometry args={[0.0475, 64]} />
        </mesh>
        {/* lid set ajar: slid back and tilted, leaving a crescent for steam */}
        <group position={[-0.012, 0.064, -0.006]} rotation={[0.16, 0, 0.1]}>
          <mesh geometry={lid} material={porcelain()} castShadow receiveShadow />
          <mesh geometry={lathe([[0, 0.028], [0.011, 0.028], [0.012, 0.034], [0.009, 0.042], [0, 0.043]])} material={porcelain()} castShadow />
        </group>
      </group>
    </group>
  );
};

const Sleeves: React.FC = () => {
  const art = (key: string, bg: string, fg: string, kind: number) =>
    drawTexture(`sleeve-${key}`, 512, (c, s) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, s, s);
      c.fillStyle = fg;
      if (kind === 0) {
        for (let i = 0; i < 6; i++) c.fillRect(s * 0.1, s * (0.15 + i * 0.11), s * (0.8 - i * 0.1), s * 0.05);
      } else {
        c.beginPath();
        c.arc(s * 0.62, s * 0.4, s * 0.22, 0, Math.PI * 2);
        c.fill();
        c.fillRect(0, s * 0.72, s, s * 0.04);
      }
    });
  return (
    <group position={[0.62, 0, -0.39]}>
      <mesh position={[0, 0.155, 0]} rotation={[-0.12, -0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.31, 0.31, 0.004]} />
        <meshStandardMaterial map={art("a", "#2f5d62", "#e9d8b4", 0)} roughness={0.85} />
      </mesh>
      <mesh position={[-0.06, 0.155, 0.02]} rotation={[-0.08, -0.12, 0.0]} castShadow receiveShadow>
        <boxGeometry args={[0.31, 0.31, 0.004]} />
        <meshStandardMaterial map={art("b", "#c99a2e", "#2b2420", 1)} roughness={0.85} />
      </mesh>
    </group>
  );
};

/* ------------------------------ shot ------------------------------- */

const Shot: React.FC<{ total: number }> = ({ total }) => {
  useShot({
    lens: 35,
    position: [0.2, 0.36, 1.14],
    target: [0.0, 0.15, -0.12],
    move: shot.push([0.185, 0.35, 1.09], { ease: ease.inOut }),
    drift: { px: 3, seed: 4 },
    focus: { point: [0.14, 0.05, 0.28], aperture: 2.8 },
  });
  void total;
  return null;
};

export const GoldenHour: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const total = durationInFrames - 1;
  return (
    <Stage
      background="#120c08"
      film={{ dof: true, bloom: 0.18, halation: 0.3, grain: 0.35, vignette: 0.28, exposure: 1.0 }}
    >
      <Shot total={total} />
      <KeyLight
        kind="sun"
        temp={W.sunTemp}
        intensity={W.sunIntensity}
        position={sun(0, total).position}
        target={sun(0, total).target}
        animate={(t) => sun(t, total)}
        angle={6.5}
        shadowRadius={4}
        gobo={{ pattern: "blinds", slats: 64, open: 0.5, angle: -3, softness: 2.5, bars: 7, aperture: [0, 0, 1, 1] }}
      >
        <Beam aperture={winCorners} floorY={0} haze={W.haze} steps={40} />
        <Dust aperture={winCorners} floorY={0} min={[-0.7, 0.0, -0.45]} max={[0.6, 1.1, 0.55]} count={1600} size={1.8} gain={2.2} />
        <Steam aperture={winCorners} floorY={0} origin={[0.155, 0.07, 0.29]} />
      </KeyLight>
      <Bounce from="floor" temp={3600} intensity={0.3} />
      <SkyFill temp={W.skyTemp} intensity={0.3} />
      <StudioEnv intensity={0.04} />
      <Room />
      <Desk />
      <RecordPlayer position={[-0.17, 0, -0.2]} rotY={0.12} />
      <Gaiwan position={[0.14, 0, 0.28]} />
      <Sleeves />
    </Stage>
  );
};
