// Shot file, started from the "golden-hour" Look and re-lit as a late-night desk lamp.
// t06-desk: 深夜台灯感觉的书桌：一台机械键盘、一杯茶，暖光，几乎不动，竖屏 6 秒。
import React, { useMemo } from "react";
import * as THREE from "three";
import { Stage } from "../kit/stage";
import { shot, useShot, type Vec3 } from "../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../kit/lights";
import { Steam } from "../kit/particles";
import { ease, rng } from "../kit/motion";
import { drawTexture, emissive, gradientTexture, liquid, metal, paper, plaster, plastic, porcelain, wood } from "../kit/materials";
import { cylinder, lathe, roundedBox, smoothProfile, wallWithHole } from "../kit/geometry";

/** Everything in metres; desk top is y = 0, back wall at z = -0.45. */
export const DESK = {
  /** editable */
  lampTemp: 2800,
  lampIntensity: 8,
  nightTemp: 9000,
  nightFill: 0.22,
  bounce: 0.25,
  exposure: 1.0,
  keycap: "#e8dfcc",
  keycapMod: "#6d6a66",
  keycapAccent: "#d4683a",
  caseColor: "#2b2c30",
  mugColor: "#ece6da",
  /** do not edit: lamp pose the gobo pool and steam lighting depend on */
  lampHead: [-0.2, 0.58, -0.2] as Vec3,
  lampAim: [0.02, 0.0, 0.08] as Vec3,
  wallZ: -0.45,
};
const D = DESK;

/* ------------------------------ helpers ------------------------------ */

/** a rod between two points */
const Rod: React.FC<{ a: Vec3; b: Vec3; r: number; mat: THREE.Material }> = ({ a, b, r, mat }) => {
  const { pos, quat, len } = useMemo(() => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return { pos: A.clone().add(B).multiplyScalar(0.5), quat: q, len: dir.length() };
  }, [JSON.stringify(a), JSON.stringify(b)]);
  return <mesh geometry={cylinder(r, r, len, 16)} material={mat} position={pos} quaternion={quat} castShadow />;
};

/* ------------------------------ room ------------------------------ */

const Room: React.FC = () => {
  const wallGeo = useMemo(() => wallWithHole(4, 2.6, { x: 0.02, y: 1.04, w: 0.6, h: 0.82 }, 0.12), []);
  return (
    <group>
      <mesh geometry={wallGeo} material={plaster("#5a5048")} position={[0, -0.76, D.wallZ - 0.12]} receiveShadow />
      {/* window frame */}
      {[
        [0.32, 0.28, 0.62, 0.03],
        [0.32, 1.1, 0.62, 0.03],
      ].map(([x, y, w, h], i) => (
        <mesh key={`h${i}`} geometry={roundedBox(w, h, 0.05, 0.004)} material={metal("#4a4a4c", 0.5)} position={[x, y, D.wallZ - 0.07]} />
      ))}
      {[0.035, 0.605, 0.33].map((x, i) => (
        <mesh key={`v${i}`} geometry={roundedBox(0.03, 0.82, 0.05, 0.004)} material={metal("#4a4a4c", 0.5)} position={[x, 0.69, D.wallZ - 0.07]} />
      ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.76, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#2a221c" roughness={0.85} />
      </mesh>
      <NightOutside />
    </group>
  );
};

/** Deep-blue night sky with dark towers and a few lit windows (the cool side of the contrast). */
const NightOutside: React.FC = () => {
  const sky = gradientTexture([
    [0, "#060a18"],
    [0.6, "#13203d"],
    [1, "#22325a"],
  ]);
  const r = rng(31);
  const towers = Array.from({ length: 7 }, (_, i) => ({ x: -0.6 + i * 0.3 + r() * 0.1, h: 0.9 + r() * 1.4, w: 0.22 + r() * 0.12, z: -2.6 - r() * 1.6, s: i }));
  const lit = (seed: number) =>
    drawTexture(`tower-win-${seed}`, 256, (c, s) => {
      c.fillStyle = "#0b1020";
      c.fillRect(0, 0, s, s);
      const rr = rng(seed);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 6; x++) {
          if (rr() > 0.22) continue;
          c.fillStyle = rr() > 0.5 ? "#ffcf8a" : "#a9c4ff";
          c.fillRect(x * (s / 6) + 10, y * (s / 16) + 4, s / 6 - 20, s / 16 - 8);
        }
    });
  return (
    <group>
      <mesh position={[0.3, 0.8, -6]} material={emissive("#ffffff", 0.9, sky)}>
        <planeGeometry args={[12, 6]} />
      </mesh>
      {towers.map((b, i) => (
        <mesh key={i} position={[b.x, -0.6 + b.h / 2, b.z]} material={emissive("#ffffff", 0.7, lit(40 + b.s))}>
          <boxGeometry args={[b.w, b.h, 0.3]} />
        </mesh>
      ))}
    </group>
  );
};

const Desk: React.FC = () => (
  <mesh
    geometry={roundedBox(1.8, 0.04, 1.0, 0.006)}
    material={wood({ seed: 9, light: "#7b5233", dark: "#3a2414", repeat: [1.3, 1], roughness: 0.65 })}
    position={[0.05, -0.02, 0.02]}
    castShadow
    receiveShadow
  />
);

/* ------------------------------ props ------------------------------ */

/** 75% mechanical keyboard: aluminium-look case, cream keycaps with grey mods and one orange Esc/Enter. */
const Keyboard: React.FC<{ position: Vec3; rotY: number }> = ({ position, rotY }) => {
  const u = 0.019; // 1u pitch
  const cap = 0.0172;
  // rows: list of key widths in u; row 0 is the F-row
  const rows: number[][] = [
    [1, 0.25, 1, 1, 1, 1, 0.25, 1, 1, 1, 1, 0.25, 1, 1, 1, 1, 0.25, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 1],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25, 1],
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.75, 1, 1],
    [1.25, 1.25, 1.25, 6.25, 1, 1, 1, 1, 1, 1],
  ];
  const widthU = 16;
  const caseW = widthU * u + 0.022;
  const caseD = rows.length * u + 0.026;
  const caseH = 0.022;
  const keys: { x: number; z: number; w: number; mat: THREE.Material }[] = [];
  rows.forEach((row, ri) => {
    let x = -widthU * u * 0.5;
    row.forEach((w, ki) => {
      if (w < 0.5) {
        x += w * u;
        return;
      }
      const isMod = w > 1.01 || ri === 0 || ki === row.length - 1;
      const accent = (ri === 0 && ki === 0) || (ri === 3 && w > 2);
      const mat = accent ? plastic(D.keycapAccent, 0.55) : isMod ? plastic(D.keycapMod, 0.55) : plastic(D.keycap, 0.55);
      keys.push({ x: x + (w * u) / 2, z: -caseD / 2 + 0.013 + (ri + 0.5) * u, w, mat });
      x += w * u;
    });
  });
  const capGeo = (w: number) => roundedBox(w * u - (u - cap), 0.009, cap, 0.0025, 3);
  const capTop = (w: number) => roundedBox(w * u - (u - cap) - 0.004, 0.002, cap - 0.004, 0.0009, 2);
  return (
    <group position={position} rotation-y={rotY}>
      {/* case: slight typing angle, back raised */}
      <group rotation-x={0.06} position={[0, 0.002, 0]}>
        <mesh geometry={roundedBox(caseW, caseH, caseD, 0.005)} material={metal(D.caseColor, 0.42)} position={[0, caseH / 2, 0]} castShadow receiveShadow />
        {/* plate */}
        <mesh geometry={roundedBox(caseW - 0.012, 0.003, caseD - 0.012, 0.001)} material={metal("#1a1a1c", 0.5)} position={[0, caseH + 0.0005, 0]} receiveShadow />
        {keys.map((k, i) => (
          <group key={i} position={[k.x, caseH + 0.006, k.z]}>
            <mesh geometry={capGeo(k.w)} material={k.mat} castShadow receiveShadow />
            <mesh geometry={capTop(k.w)} material={k.mat} position={[0, 0.005, 0]} receiveShadow />
          </group>
        ))}
      </group>
      {/* rubber feet */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={cylinder(0.006, 0.006, 0.003, 16)} material={plastic("#111111", 0.8)} position={[(sx * caseW) / 2.4, 0.0015, (sz * caseD) / 2.6]} />
        )),
      )}
    </group>
  );
};

/** Coiled-look cable leaving the back of the keyboard. */
const Cable: React.FC = () => {
  const geo = useMemo(() => {
    const pts = [
      [-0.075, 0.004, -0.06],
      [-0.11, 0.004, -0.17],
      [-0.1, 0.004, -0.3],
      [0.05, 0.004, -0.36],
      [0.3, 0.004, -0.4],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.003, 10, false);
  }, []);
  return <mesh geometry={geo} material={plastic("#d4683a", 0.5)} castShadow receiveShadow />;
};

/** Ceramic mug of tea with a handle. */
const Mug: React.FC<{ position: Vec3 }> = ({ position }) => {
  const body = useMemo(() => lathe(smoothProfile([[0.032, 0], [0.038, 0.004], [0.04, 0.03], [0.041, 0.088]]), { thickness: 0.003 }), []);
  const handle = useMemo(() => new THREE.TorusGeometry(0.024, 0.005, 16, 48, Math.PI * 1.25), []);
  return (
    <group position={position}>
      <mesh geometry={body} material={porcelain(D.mugColor)} castShadow receiveShadow />
      <mesh geometry={handle} material={porcelain(D.mugColor)} position={[0.04, 0.046, 0]} rotation-z={-Math.PI * 0.625} castShadow />
      <mesh position={[0, 0.074, 0]} rotation-x={-Math.PI / 2} material={liquid("#6e3a12")}>
        <circleGeometry args={[0.0375, 64]} />
      </mesh>
      {/* tea-bag tag hanging over the rim */}
      <mesh geometry={roundedBox(0.016, 0.02, 0.0008, 0.0003)} material={paper("#e9d9b8")} position={[-0.012, 0.072, 0.0415]} rotation-x={0.05} castShadow />
    </group>
  );
};

/** Architect desk lamp: base, two arms, conical shade aimed at the keyboard. */
const Lamp: React.FC = () => {
  const head = new THREE.Vector3(...D.lampHead);
  const aim = new THREE.Vector3(...D.lampAim);
  const dir = aim.clone().sub(head).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  // lathe: opening (wide) at local y = 0, top at +y, so local -y looks along the aim
  const shadeProfile: [number, number][] = [
    [0.072, 0],
    [0.06, 0.03],
    [0.032, 0.075],
    [0.014, 0.1],
    [0.0, 0.102],
  ];
  const outer = useMemo(() => lathe(shadeProfile), []);
  const inner = useMemo(() => lathe(shadeProfile.map(([r, y]) => [Math.max(0, r - 0.002), y] as [number, number])), []);
  const innerMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a0").multiplyScalar(1.6), side: THREE.DoubleSide, toneMapped: false });
    return m;
  }, []);
  const arm = metal("#1f2a26", 0.4);
  const base: Vec3 = [-0.36, 0, -0.33];
  const elbow: Vec3 = [-0.34, 0.42, -0.36];
  // shade opening sits 0.045 m in front of the bulb along the aim direction; its narrow top points back
  const shadePos = head.clone().addScaledVector(dir, 0.045);
  const shadeTop = shadePos.clone().addScaledVector(dir, -0.1);
  return (
    <group>
      <mesh geometry={cylinder(0.075, 0.08, 0.018, 48)} material={arm} position={[base[0], 0.009, base[2]]} castShadow receiveShadow />
      <Rod a={[base[0], 0.018, base[2]]} b={elbow} r={0.006} mat={arm} />
      <Rod a={elbow} b={shadeTop.toArray() as Vec3} r={0.006} mat={arm} />
      <mesh geometry={cylinder(0.012, 0.012, 0.02, 24)} material={metal("#a8a49c", 0.3)} position={elbow} rotation-z={Math.PI / 2} />
      <group position={shadePos} quaternion={q}>
        {/* shade does not cast: the bulb sits inside it */}
        <mesh geometry={outer} material={metal("#1f2a26", 0.38)} />
        <mesh geometry={inner} material={innerMat} />
      </group>
      <mesh position={head} material={emissive("#ffe2b0", 4)}>
        <sphereGeometry args={[0.018, 24, 16]} />
      </mesh>
    </group>
  );
};

/** A closed notebook and pencil under the lamp, for the left of the pool. */
const Notebook: React.FC = () => (
  <group position={[-0.2, 0, 0.2]} rotation-y={0.25}>
    <mesh geometry={roundedBox(0.15, 0.012, 0.21, 0.002)} material={paper("#3e4c5e")} position={[0, 0.006, 0]} castShadow receiveShadow />
    <mesh geometry={cylinder(0.0035, 0.0035, 0.17, 6)} material={plastic("#d9b24a", 0.5)} position={[0.03, 0.0155, 0.0]} rotation={[Math.PI / 2, 0, 0.2]} castShadow />
  </group>
);

/* ------------------------------ shot ------------------------------- */

const Camera: React.FC = () => {
  useShot({
    lens: 35,
    position: [0.16, 0.4, 0.86],
    target: [0.0, 0.09, -0.04],
    // almost still: 3 cm push over 6 s
    move: shot.push([0.155, 0.392, 0.835], { ease: ease.inOut }),
    drift: { px: 3, seed: 4 },
    focus: { point: [0.02, 0.03, 0.06], aperture: 2.8 },
  });
  return null;
};

const MUG: Vec3 = [0.12, 0, 0.22];
// the lamp's shade opening (used only as the clip plane for the steam lighting)
const shadeOpening: [Vec3, Vec3, Vec3, Vec3] = [
  [D.lampHead[0] - 0.1, D.lampHead[1] - 0.07, D.lampHead[2] - 0.1],
  [D.lampHead[0] + 0.1, D.lampHead[1] - 0.07, D.lampHead[2] - 0.1],
  [D.lampHead[0] + 0.1, D.lampHead[1] - 0.07, D.lampHead[2] + 0.1],
  [D.lampHead[0] - 0.1, D.lampHead[1] - 0.07, D.lampHead[2] + 0.1],
];

export const DeskLamp: React.FC<{ durationInFrames: number }> = () => (
  <Stage background="#07080c" film={{ dof: true, bloom: 0.22, halation: 0.32, grain: 0.32, vignette: 0.3, exposure: D.exposure }}>
    <Camera />
    {/* desk lamp: a wide spot through an all-open, heavily blurred gobo = soft round pool;
        the gobo also gives Steam its key-light mask */}
    <KeyLight
      kind="spot"
      temp={D.lampTemp}
      intensity={D.lampIntensity}
      position={D.lampHead}
      target={D.lampAim}
      angle={40}
      shadowRadius={6}
      gobo={{ pattern: "blinds", open: 1, slats: 1, softness: 90, aperture: [0.2, 0.2, 0.8, 0.8] }}
    >
      <Steam aperture={shadeOpening} floorY={0} origin={[MUG[0], 0.08, MUG[2]]} height={0.22} opacity={0.5} />
    </KeyLight>
    <Bounce from="floor" temp={3000} intensity={D.bounce} />
    <SkyFill temp={D.nightTemp} groundTemp={3000} intensity={D.nightFill} />
    <StudioEnv intensity={0.05} />
    <Room />
    <Desk />
    <Lamp />
    <Keyboard position={[0.0, 0, 0.04]} rotY={-0.28} />
    <Cable />
    <Mug position={MUG} />
    <Notebook />
  </Stage>
);

export default DeskLamp;
