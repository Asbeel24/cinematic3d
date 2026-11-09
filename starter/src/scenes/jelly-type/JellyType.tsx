import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useVideoConfig } from "remotion";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { Fog, Stage, useMotionBlur, useTimeline } from "../../kit/stage";
import { frameSubject, shot, useShot, type Vec3 } from "../../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../../kit/lights";
import { ease } from "../../kit/motion";
import { jelly } from "../../kit/materials";
import fredoka from "../../kit/fonts/fredoka-600.typeface.json";

/**
 * Look: Jelly Type
 * Letters drop one by one onto a pastel sweep, squash on impact and wobble to rest.
 * This Look is allowed more than 2% overshoot.
 */
export const JELLY = {
  /** editable */
  word: "BEAT",
  colors: ["#ff5a36", "#ffb800", "#28c88c", "#7a5cff", "#ff4f9a", "#22b3ff"],
  floor: "#e7b9a8",
  /** frames between letters */
  stagger: 8,
  /** first impact frame */
  firstHit: 24,
  /** squash depth on impact (0.2–0.4) */
  squash: 0.32,
  /** do not edit */
  size: 0.115,
  drop: 0.9,
};
const J = JELLY;

const font = new FontLoader().parse(fredoka as never);

function letterGeometry(ch: string) {
  const g = new TextGeometry(ch, {
    font,
    size: J.size,
    depth: J.size * 0.42,
    curveSegments: 10,
    bevelEnabled: true,
    bevelThickness: J.size * 0.16,
    bevelSize: J.size * 0.075,
    bevelSegments: 6,
  });
  g.computeBoundingBox();
  const b = g.boundingBox!;
  // pivot at the bottom centre so squash keeps the letter on the floor
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.computeVertexNormals();
  return g;
}

/** Fall, squash–stretch and wobble for one letter. Pure function of t. */
function letterPose(t: number, hit: number) {
  const fall = 11; // frames of free fall before impact
  const tau = t - (hit - fall);
  if (tau < 0) return { y: J.drop, sy: 1, sx: 1, rz: 0, visible: false };
  if (t < hit) {
    const k = tau / fall; // accelerating fall: y ∝ 1 − k²
    const y = J.drop * (1 - k * k);
    const stretch = 1 + 0.14 * k * k;
    return { y, sy: stretch, sx: 1 / Math.sqrt(stretch), rz: 0, visible: true };
  }
  const d = t - hit; // frames since impact
  const decay = Math.exp(-d / 6.5);
  const w = (2 * Math.PI) / 9; // wobble period 9 frames
  const sy = 1 - J.squash * decay * Math.cos(w * d);
  const hop = 0.035 * Math.exp(-d / 5) * Math.max(0, Math.sin(w * d));
  return { y: hop, sy, sx: 1 / Math.sqrt(sy), rz: 0.06 * decay * Math.sin(w * d * 0.5), visible: true };
}

/** Width of the laid-out word in metres (same advance rule as <Letters>). */
function wordWidth() {
  return Array.from(J.word).reduce((w, ch) => {
    const glyph = (fredoka as { glyphs: Record<string, { ha: number }> }).glyphs[ch];
    return w + ((glyph?.ha ?? 600) / 1000) * J.size * 1.18;
  }, 0);
}

const Letters: React.FC = () => {
  const chars = Array.from(J.word);
  const items = useMemo(() => {
    let x = 0;
    const out = chars.map((ch, i) => {
      const glyph = (fredoka as { glyphs: Record<string, { ha: number }> }).glyphs[ch];
      const adv = ((glyph?.ha ?? 600) / 1000) * J.size * 1.18;
      const g = letterGeometry(ch);
      const item = { ch, g, m: jelly(J.colors[i % J.colors.length], J.size), x: x + adv / 2 };
      x += adv;
      return item;
    });
    const total = x;
    for (const it of out) it.x -= total / 2;
    return out;
  }, [J.word]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  // falling letters move fast: shutter blur from the first drop to the last impact
  useMotionBlur(J.firstHit - 12, J.firstHit + (chars.length - 1) * J.stagger + 2, 6);
  useTimeline((t) => {
    items.forEach((it, i) => {
      const m = refs.current[i];
      if (!m) return;
      const p = letterPose(t, J.firstHit + i * J.stagger);
      m.visible = p.visible;
      m.position.set(it.x, p.y, 0);
      m.scale.set(p.sx, p.sy, p.sx);
      m.rotation.set(0, (i - (items.length - 1) / 2) * -0.06, p.rz);
    });
  });
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} ref={(r) => (refs.current[i] = r)} geometry={it.g} material={it.m} castShadow receiveShadow />
      ))}
    </group>
  );
};

/** Seamless studio sweep: floor curving up into a backdrop. */
const Sweep: React.FC = () => {
  const geo = useMemo(() => {
    const shape: THREE.Vector2[] = [];
    const R = 0.8;
    shape.push(new THREE.Vector2(2.5, 0));
    shape.push(new THREE.Vector2(-0.6, 0));
    for (let i = 1; i <= 16; i++) {
      const a = (i / 16) * (Math.PI / 2);
      shape.push(new THREE.Vector2(-0.6 - Math.sin(a) * R, R - Math.cos(a) * R));
    }
    shape.push(new THREE.Vector2(-0.6 - R, 3));
    // extrude the profile sideways: x of the profile becomes world z
    const pts: number[] = [];
    const idx: number[] = [];
    const W = 6;
    shape.forEach((p) => {
      pts.push(-W / 2, p.y, p.x, W / 2, p.y, p.x);
    });
    for (let i = 0; i < shape.length - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={J.floor} roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
};

const Shot: React.FC = () => {
  const { width, height } = useVideoConfig();
  // frame the settled word: any length fits the safe area; the push ends on this framing
  const end = frameSubject(
    { center: [0, J.size * 0.55, 0], size: [wordWidth(), J.size * 1.1, J.size * 0.6], fill: 0.11, elevation: 1.5 },
    50,
    width / height,
  );
  const PUSH = 0.14; // start 14 % further away, push in to `end`
  return (
    <ShotCamera
      position={end.position.map((v, i) => v + (end.position[i] - end.target[i]) * PUSH) as Vec3}
      target={end.target}
      push={end.position}
    />
  );
};

const ShotCamera: React.FC<{ position: Vec3; target: Vec3; push: Vec3 }> = ({ position, target, push }) => {
  useShot({
    lens: 50,
    position,
    target,
    move: shot.push(push, { ease: ease.inOut }),
    drift: { px: 2, seed: 2 },
    focus: { point: [target[0], J.size * 0.6, 0.03], aperture: 2.8 },
  });
  return null;
};

export const JellyType: React.FC<{ durationInFrames: number }> = () => (
  <Stage background={J.floor} film={{ dof: true, bloom: 0.18, halation: 0.12, grain: 0.18, vignette: 0.18, exposure: 0.8 }}>
    <Shot />
    <Fog color={J.floor} near={2.4} far={6} />
    <KeyLight kind="softbox" temp={5600} intensity={4.6} position={[-0.9, 1.6, 1.2]} target={[0, 0.05, 0]} angle={30} shadowRadius={12} />
    <Bounce from="floor" temp={5200} intensity={0.5} position={[0.4, -0.5, 1.5]} />
    <SkyFill temp={7800} groundTemp={4800} intensity={0.35} />
    <StudioEnv intensity={0.6} rotationY={1.2} />
    <Sweep />
    <Letters />
  </Stage>
);

export default JellyType;
