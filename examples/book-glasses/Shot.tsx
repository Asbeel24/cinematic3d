// Shot file, started from the "golden-hour" Look (src/scenes/golden-hour/GoldenHour.tsx).
// Edit freely: this is the only scene file of this shot. Keep the default export.
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { Stage, useTimeline } from "../kit/stage";
import { shot, useShot, type Vec3 } from "../kit/camera";
import { Beam, Bounce, KeyLight, SkyFill, StudioEnv } from "../kit/lights";
import { Dust } from "../kit/particles";
import { lerp, progress, ease, rng } from "../kit/motion";
import {
  drawTexture,
  emissive,
  glass,
  gradientTexture,
  liquid,
  metal,
  paper,
  plaster,
  plastic,
  porcelain,
  vinyl,
  wood,
} from "../kit/materials";
import { cylinder, lathe, roundedBox, smoothProfile, wallWithHole } from "../kit/geometry";

/**
 * Look: Golden Hour
 * A rented room in Shenzhen, late afternoon. Record player + gaiwan tea steaming on a desk
 * by the window; the blind shadows crawl slowly across the desk.
 * Everything is in metres; desk top is y = 0.
 */

export const GOLDEN = {
  /** editable */
  sunTemp: 3000,
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

/* ---------------------------- open book ---------------------------- */

const PAGE_W = 0.15; // one page, across the spine (x)
const PAGE_D = 0.22; // along the spine (z)
const BLOCK_T = 0.011; // page block thickness at the outer edge

/** top-surface height of one half, u = 0 at the spine, 1 at the outer edge */
const pageTop = (uu: number) => { const u = Math.min(1, Math.max(0, uu)); return 0.004 + 0.014 * Math.pow(Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5), 0.7) - 0.004 * u * u; };

/** extruded cross-section of one page block (x from spine 0 → PAGE_W), extruded along z */
function pageBlockGeo() {
  const s = new THREE.Shape();
  const n = 32;
  s.moveTo(0, 0);
  s.lineTo(PAGE_W, 0);
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    s.lineTo(u * PAGE_W, pageTop(u) - 0.0004);
  }
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: PAGE_D, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -PAGE_D / 2);
  return g;
}

/** curved page surface carrying the printed texture */
function pageSurfaceGeo() {
  const g = new THREE.PlaneGeometry(PAGE_W, PAGE_D, 40, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(PAGE_W / 2, 0, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, pageTop(p.getX(i) / PAGE_W));
  g.computeVertexNormals();
  return g;
}

const pageTexture = (side: number) =>
  drawTexture(`page-text-${side}`, 1024, (c, s) => {
    c.fillStyle = "#efe6d2";
    c.fillRect(0, 0, s, s);
    // texture maps PAGE_W (u) x PAGE_D (v); lines run across u
    const r = rng(40 + side);
    const marginIn = side === 0 ? 0.12 : 0.16;
    const marginOut = side === 0 ? 0.16 : 0.12;
    const lineH = s * 0.028;
    // chapter heading on the right page
    let y0 = s * 0.1;
    if (side === 1) {
      c.fillStyle = "#3b3128";
      c.fillRect(s * 0.32, s * 0.12, s * 0.36, s * 0.022);
      y0 = s * 0.24;
    }
    c.fillStyle = "#5a4e44";
    for (let y = y0; y < s * 0.9; y += lineH) {
      let x = s * marginIn;
      const end = s * (1 - marginOut) - (r() < 0.12 ? s * 0.3 : 0);
      while (x < end) {
        const w = s * (0.02 + r() * 0.07);
        c.fillRect(x, y, Math.min(w, end - x), lineH * 0.42);
        x += w + s * 0.012;
      }
    }
    // page number
    c.fillRect(s * 0.48, s * 0.94, s * 0.04, s * 0.014);
  });

const Book: React.FC<{ position: Vec3; rotY?: number }> = ({ position, rotY = 0 }) => {
  const block = useMemo(pageBlockGeo, []);
  const surface = useMemo(pageSurfaceGeo, []);
  const cover = "#3e2a2a";
  return (
    <group position={position} rotation-y={rotY}>
      {/* hard cover, open flat, just wider than the pages */}
      <mesh geometry={roundedBox(PAGE_W * 2 + 0.012, 0.003, PAGE_D + 0.012, 0.0012)} material={plastic(cover, 0.7)} position={[0, 0.0015, 0]} castShadow receiveShadow />
      {[-1, 1].map((sx) => (
        <group key={sx} position={[0, 0.003, 0]} scale={[sx, 1, 1]}>
          <mesh geometry={block} material={paper("#e6dcc6")} castShadow receiveShadow />
          <mesh geometry={surface} receiveShadow castShadow>
            <meshStandardMaterial map={pageTexture(sx < 0 ? 0 : 1)} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/* ----------------------- round glasses ----------------------------- */

const RIM_R = 0.023;
const RIM_T = 0.0014;

/** cylinder between two points */
const Rod: React.FC<{ a: Vec3; b: Vec3; r: number; mat: THREE.Material }> = ({ a, b, r, mat }) => {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return { pos: va.clone().add(vb).multiplyScalar(0.5), quat: q, len: d.length() };
  }, [a, b]);
  return <mesh geometry={cylinder(r, r, len, 12)} material={mat} position={pos} quaternion={quat} castShadow />;
};

const Glasses: React.FC<{ position: Vec3; rotY?: number }> = ({ position, rotY = 0 }) => {
  const frame = metal("#b48f55", 0.28);
  const rim = useMemo(() => new THREE.TorusGeometry(RIM_R, RIM_T, 12, 72), []);
  const bridge = useMemo(() => new THREE.TorusGeometry(0.0085, 0.0011, 8, 24, Math.PI), []);
  const lens = useMemo(() => new THREE.CircleGeometry(RIM_R, 48), []);
  const cy = RIM_R + RIM_T;
  const cx = RIM_R + 0.0085;
  return (
    <group position={position} rotation-y={rotY}>
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <mesh geometry={rim} material={frame} position={[sx * cx, cy, 0]} castShadow />
          <mesh geometry={lens} material={glass("#f4efe6", 0.02)} position={[sx * cx, cy, 0]} />
          {/* hinge stub + temple running back and down to the desk */}
          <Rod a={[sx * (cx + RIM_R), cy + 0.004, 0]} b={[sx * (cx + RIM_R + 0.004), cy + 0.004, -0.008]} r={0.0012} mat={frame} />
          <Rod a={[sx * (cx + RIM_R + 0.004), cy + 0.004, -0.008]} b={[sx * (cx + RIM_R + 0.008), 0.012, -0.125]} r={0.001} mat={frame} />
          <Rod a={[sx * (cx + RIM_R + 0.008), 0.012, -0.125]} b={[sx * (cx + RIM_R + 0.008), 0.0012, -0.14]} r={0.0012} mat={plastic("#2a1f18", 0.5)} />
        </group>
      ))}
      <mesh geometry={bridge} material={frame} position={[0, cy + 0.006, 0]} castShadow />
    </group>
  );
};

/** two closed books stacked against the wall (back layer) */
const BookStack: React.FC = () => (
  <group position={[0.5, 0, -0.34]} rotation-y={-0.2}>
    <mesh geometry={roundedBox(0.2, 0.032, 0.27, 0.003)} material={plastic("#2f4d5a", 0.75)} position={[0, 0.016, 0]} castShadow receiveShadow />
    <mesh geometry={roundedBox(0.17, 0.026, 0.235, 0.003)} material={plastic("#9c6a3a", 0.75)} position={[0.01, 0.045, 0.005]} rotation-y={0.12} castShadow receiveShadow />
  </group>
);

/* ------------------------------ shot ------------------------------- */

const GLASSES_POS: Vec3 = [0.03, 0, 0.15];

const Shot: React.FC<{ total: number }> = ({ total }) => {
  useShot({
    lens: 35,
    position: [0.14, 0.3, 0.66],
    target: [-0.04, 0.06, -0.06],
    move: shot.push([0.13, 0.295, 0.625], { ease: ease.inOut }),
    drift: { px: 3, seed: 4 },
    focus: { point: [GLASSES_POS[0], 0.03, GLASSES_POS[2] + 0.01], aperture: 2.8 },
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
      </KeyLight>
      <Bounce from="floor" temp={3600} intensity={0.3} />
      <SkyFill temp={W.skyTemp} intensity={0.3} />
      <StudioEnv intensity={0.04} />
      <Room />
      <Desk />
      <Book position={[-0.06, 0, -0.12]} rotY={0.18} />
      <Glasses position={GLASSES_POS} rotY={-0.35} />
      <BookStack />
    </Stage>
  );
};

export default GoldenHour;
