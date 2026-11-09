// Shot file, started from the "turntable" Look (src/scenes/turntable/Turntable.tsx).
// Edit freely: this is the only scene file of this shot. Keep the default export.
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useVideoConfig } from "remotion";
import { Fog, Stage, useTimeline } from "../kit/stage";
import { shot, useShot } from "../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../kit/lights";
import { ease, progress, rng } from "../kit/motion";
import { chrome, drawTexture, metal, noiseTexture, plastic } from "../kit/materials";
import { FONTS } from "../kit/fonts";
import { cylinder, lathe, roundedBox } from "../kit/geometry";

/**
 * Look: Turntable
 * A desktop synthesizer standing on a stone plinth, turning slowly while the camera pushes in.
 * Studio light, glossy floor with a mirrored reflection that fades out.
 */
export const TURNTABLE = {
  /** editable */
  brand: "ORBIT",
  model: "AUTOMATIC",
  dialColor: "#1a2430",
  accent: "#3fd2ff",
  keyTemp: 5600,
  bounceTemp: 8000,
  /** degrees the product turns over the shot */
  turn: 50,
  /** when the product faces the camera straight on, as a fraction of the shot */
  frontAt: 0.5,
  background: "#1d2126",
  /** do not edit */
  plinthR: 0.25,
  plinthH: 0.12,
};
const T = TURNTABLE;

/* ----------------------------- product ----------------------------- */
// Watch (real size): 41 mm case, strap looped round a felt cushion, dial faces +z.
const CY = 0.0315; // case centre height above the plinth top (= strap loop radius)
const CASE_R = 0.0205;
const Z_BACK = 0.0315; // case back sits on the strap loop
const Z_DIAL = 0.0412;
const DIAL_R = 0.0172;
const SHIFT_Z = -0.02; // move the watch back so the case is near the turn axis

const Hand: React.FC<{ len: number; w: number; tail: number; z: number; lume?: boolean; mat: THREE.Material; handRef?: React.Ref<THREE.Group> }> = ({ len, w, tail, z, lume, mat, handRef }) => (
  <group ref={handRef} position={[0, 0, z]}>
    <mesh geometry={roundedBox(w, len + tail, 0.0005, 0.0002, 1)} material={mat} position={[0, (len - tail) / 2, 0]} castShadow />
    {lume && <mesh geometry={roundedBox(w * 0.45, len * 0.62, 0.0004, 0.00015, 1)} material={plastic("#dff6f4", 0.5)} position={[0, len * 0.55, 0.0003]} />}
  </group>
);

const Watch: React.FC = () => {
  const hourRef = useRef<THREE.Group>(null!);
  const minRef = useRef<THREE.Group>(null!);
  const secRef = useRef<THREE.Group>(null!);
  const { fps } = useVideoConfig();
  useTimeline((t) => {
    // 10:09:30 at frame 0, smooth sweep (8 beats/s reads as continuous)
    const s = 30 + t / fps;
    const m = 9 + s / 60;
    const h = 10 + m / 60;
    secRef.current.rotation.z = -(s / 60) * Math.PI * 2;
    minRef.current.rotation.z = -(m / 60) * Math.PI * 2;
    hourRef.current.rotation.z = -(h / 12) * Math.PI * 2;
  });
  const dial = useMemo(() => {
    const map = drawTexture(`watch-dial-${T.brand}-${T.model}-${T.dialColor}-${T.accent}`, 1024, (c, s) => {
      const cx = s / 2;
      const g = c.createRadialGradient(cx, cx, 0, cx, cx, cx);
      g.addColorStop(0, T.dialColor);
      g.addColorStop(1, "#0b1016");
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      // sunburst
      const r = rng(31);
      for (let i = 0; i < 720; i++) {
        const a = (i / 720) * Math.PI * 2;
        c.strokeStyle = `rgba(160,200,230,${0.02 + r() * 0.05})`;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * 30, cx + Math.sin(a) * 30);
        c.lineTo(cx + Math.cos(a) * cx, cx + Math.sin(a) * cx);
        c.stroke();
      }
      // minute track
      c.strokeStyle = "#c9d6e0";
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const r0 = cx * (i % 5 === 0 ? 0.88 : 0.91), r1 = cx * 0.96;
        c.lineWidth = i % 5 === 0 ? 6 : 3;
        c.beginPath();
        c.moveTo(cx + Math.sin(a) * r0, cx - Math.cos(a) * r0);
        c.lineTo(cx + Math.sin(a) * r1, cx - Math.cos(a) * r1);
        c.stroke();
      }
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillStyle = "#e8eef2";
      c.font = `700 70px ${FONTS.ui}`;
      c.fillText(T.brand, cx, s * 0.33);
      c.font = `600 34px ${FONTS.ui}`;
      c.fillStyle = T.accent;
      c.fillText(T.model, cx, s * 0.67);
      c.font = `600 26px ${FONTS.ui}`;
      c.fillStyle = "#8fa3b3";
      c.fillText("25 JEWELS", cx, s * 0.72);
    });
    map.anisotropy = 8;
    return new THREE.MeshPhysicalMaterial({ map, roughness: 0.3, metalness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  }, []);
  const crystal = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.02, transparent: true, opacity: 0.08, depthWrite: false, clearcoat: 1 }), []);
  const steel = metal("#c8ccd1", 0.22);
  const polished = chrome(0.06);
  const strapMat = plastic("#16181b", 0.62);
  const cushion = plastic("#3b4047", 0.9);
  const strap = useMemo(() => lathe([[0.0285, -0.01], [0.0315, -0.01], [0.0315, 0.01], [0.0285, 0.01], [0.0285, -0.01]], { segments: 96 }), []);
  const bezel = useMemo(() => lathe([[DIAL_R, 0], [CASE_R, 0], [CASE_R - 0.0002, 0.0016], [0.0192, 0.0028], [DIAL_R + 0.0002, 0.0026], [DIAL_R, 0]], { segments: 128 }), []);
  return (
    <group position={[0, 0, SHIFT_Z]}>
      {/* cushion + strap loop (axis along x) */}
      <mesh geometry={cylinder(0.0283, 0.0283, 0.062, 64)} material={cushion} position={[0, CY, 0]} rotation-z={Math.PI / 2} castShadow receiveShadow />
      <mesh geometry={strap} material={strapMat} position={[0, CY, 0]} rotation-z={Math.PI / 2} castShadow receiveShadow />
      {/* lugs */}
      {[-1, 1].flatMap((sx) => [-1, 1].map((sy) => (
        <mesh key={`${sx}${sy}`} geometry={roundedBox(0.004, 0.009, 0.011, 0.0012, 2)} material={steel} position={[sx * 0.012, CY + sy * 0.0205, 0.031]} castShadow />
      )))}
      {/* case: back + middle, axis along z */}
      <mesh geometry={cylinder(CASE_R, CASE_R, Z_DIAL - Z_BACK, 96)} material={steel} position={[0, CY, (Z_DIAL + Z_BACK) / 2]} rotation-x={Math.PI / 2} castShadow receiveShadow />
      <mesh geometry={bezel} material={polished} position={[0, CY, Z_DIAL - 0.0002]} rotation-x={Math.PI / 2} castShadow />
      {/* crown */}
      <mesh geometry={cylinder(0.0028, 0.0028, 0.0045, 32)} material={steel} position={[CASE_R + 0.002, CY, 0.0365]} rotation-z={Math.PI / 2} castShadow />
      {/* dial */}
      <mesh material={dial} position={[0, CY, Z_DIAL + 0.0002]} receiveShadow>
        <circleGeometry args={[DIAL_R, 96]} />
      </mesh>
      {/* applied indices */}
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const rr = DIAL_R * 0.74;
        return (
          <mesh key={`i${i}`} geometry={roundedBox(i === 0 ? 0.0024 : 0.0013, 0.0034, 0.0006, 0.0002, 1)} material={polished} position={[Math.sin(a) * rr, CY + Math.cos(a) * rr, Z_DIAL + 0.0003]} rotation-z={-a} castShadow />
        );
      })}
      {/* hands */}
      <group position={[0, CY, Z_DIAL]}>
        <Hand handRef={hourRef} len={0.0092} w={0.0021} tail={0.002} z={0.0008} lume mat={polished} />
        <Hand handRef={minRef} len={0.0142} w={0.0015} tail={0.0025} z={0.0014} lume mat={polished} />
        <Hand handRef={secRef} len={0.0158} w={0.0005} tail={0.004} z={0.002} mat={plastic(T.accent, 0.35)} />
        <mesh geometry={cylinder(0.0011, 0.0011, 0.0024, 24)} material={polished} position={[0, 0, 0.0014]} rotation-x={Math.PI / 2} />
      </group>
      {/* crystal */}
      <mesh material={crystal} position={[0, CY, Z_DIAL + 0.0026]}>
        <circleGeometry args={[0.0188, 96]} />
      </mesh>
    </group>
  );
};

/** Travertine-ish stone: warm base + noise pores. */
const stone = () => {
  const map = drawTexture("terrazzo-cool", 1024, (c, s) => {
    c.fillStyle = "#44474a";
    c.fillRect(0, 0, s, s);
    const r = rng(17);
    // soft cloudy veins, not stripes
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(${56 + r() * 36},${60 + r() * 36},${64 + r() * 36},0.18)`;
      c.beginPath();
      c.ellipse(r() * s, r() * s, 20 + r() * 120, 6 + r() * 30, (r() - 0.5) * 0.6, 0, Math.PI * 2);
      c.fill();
    }
    // terrazzo chips
    for (let i = 0; i < 1100; i++) {
      const pal = ["#d4d8dc", "#9aa3ab", "#7f858b", "#e6e9ec", "#4f6e86"];
      c.fillStyle = pal[Math.floor(r() * pal.length)];
      c.globalAlpha = 0.5 + r() * 0.5;
      c.beginPath();
      c.ellipse(r() * s, r() * s, 1 + r() * 3.5, 0.8 + r() * 2.5, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  });
  map.repeat.set(9, 1.35);
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
        <Watch />
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
    lens: 85,
    position: [0.0, 0.23, 0.47],
    target: [0, 0.152, 0.017],
    move: shot.push([0.0, 0.225, 0.43], { ease: ease.inOut }),
    drift: { px: 2, seed: 9 },
    focus: { point: [0, 0.1515, 0.0212], aperture: 5.6 },
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
