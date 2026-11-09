import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useTimeline } from "./stage";
import type { ThreeElements } from "@react-three/fiber";

/**
 * Shell-texturing fur. The base geometry is drawn `shells` times, each shell pushed out
 * along the normal; a per-strand hash in UV space discards fragments that are outside
 * a strand or above its length. Gravity and wind bend the tips (∝ h²), driven by t.
 */
export type FurProps = {
  geometry: THREE.BufferGeometry;
  /** 32–64 */
  shells?: number;
  /** strand length in metres */
  length?: number;
  /** strands per UV unit (u, v) */
  density?: [number, number];
  color?: string;
  /** colour at the root (self-shadowing) */
  rootColor?: string;
  /** strand thickness 0..1 of a cell */
  thickness?: number;
  /** world-space gravity strength (fraction of length at the tip) */
  gravity?: number;
  /** wind strength and direction (world) */
  wind?: {
    strength: number;
    dir: [number, number, number];
    /** speed of the built-in slow "breathing" (factor 0.65 ± 0.35) */
    speed?: number;
    /** optional gust envelope (seconds → multiplier); replaces the breathing, e.g. gusts({ at: [1, 2, 4] }) */
    gust?: (sec: number) => number;
  };
  seed?: number;
  castShadow?: boolean;
} & Omit<ThreeElements["group"], "children">;

export const Fur: React.FC<FurProps> = ({
  geometry,
  shells = 48,
  length = 0.012,
  density = [220, 220],
  color = "#e9dccb",
  rootColor,
  thickness = 0.85,
  gravity = 0.35,
  wind = { strength: 0.25, dir: [1, 0, 0.3], speed: 1 },
  seed = 1,
  castShadow = true,
  ...group
}) => {
  const groupRef = useRef<THREE.Group>(null!);
  const shared = useMemo(
    () => ({
      uTime: { value: 0 },
      uLength: { value: length },
      uDensity: { value: new THREE.Vector2(...density) },
      uGravity: { value: new THREE.Vector3(0, -gravity, 0) },
      uWind: { value: new THREE.Vector3() },
      uThick: { value: thickness },
      uSeed: { value: seed },
      uRoot: { value: new THREE.Color(rootColor ?? new THREE.Color(color).multiplyScalar(0.35).getStyle()) },
    }),
    [length, density[0], density[1], gravity, thickness, seed, color, rootColor],
  );

  const materials = useMemo(
    () =>
      Array.from({ length: shells }, (_, i) => {
        const h = i / (shells - 1);
        const m = new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.85,
          sheen: 1,
          sheenRoughness: 0.45,
          sheenColor: new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.4),
        });
        m.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, shared, { uShell: { value: h } });
          sh.vertexShader = sh.vertexShader
            .replace(
              "#include <common>",
              `#include <common>
               uniform float uShell; uniform float uLength; uniform vec3 uGravity; uniform vec3 uWind; uniform float uTime;
               varying vec2 vFurUv;`,
            )
            .replace(
              "#include <begin_vertex>",
              `#include <begin_vertex>
               vFurUv = uv;
               float hh = uShell * uShell;
               // gravity / wind are given in world space; bring them into object space
               vec3 gObj = (vec4(uGravity, 0.0) * modelMatrix).xyz;
               float gust = 0.6 + 0.4 * sin(dot(position, vec3(41.0, 23.0, 37.0)) + uTime * 0.21);
               vec3 wObj = (vec4(uWind, 0.0) * modelMatrix).xyz * gust;
               transformed += normal * uLength * uShell + (gObj + wObj) * uLength * hh;`,
            );
          sh.fragmentShader = sh.fragmentShader
            .replace(
              "#include <common>",
              `#include <common>
               uniform float uShell; uniform vec2 uDensity; uniform float uThick; uniform float uSeed; uniform vec3 uRoot;
               varying vec2 vFurUv;
               float fh(vec2 p){ return fract(sin(dot(p + uSeed, vec2(127.1, 311.7))) * 43758.5453); }`,
            )
            .replace(
              "#include <color_fragment>",
              `#include <color_fragment>
               vec2 g = vFurUv * uDensity;
               vec2 cell = floor(g);
               float strandLen = 0.55 + 0.45 * fh(cell);
               vec2 f = fract(g) - 0.5 + (vec2(fh(cell + 3.1), fh(cell + 7.7)) - 0.5) * 0.3;
               float r = uThick * 0.5 * (1.0 - uShell / strandLen);
               if (uShell > 0.0 && (uShell > strandLen || length(f) > r)) discard;
               diffuseColor.rgb = mix(uRoot, diffuseColor.rgb, smoothstep(0.0, 0.9, uShell));`,
            );
        };
        m.customProgramCacheKey = () => `fur-${i}`;
        return m;
      }),
    [shells, color, shared],
  );

  useTimeline((t) => {
    shared.uTime.value = t;
    const w = wind.strength;
    const d = new THREE.Vector3(...wind.dir).normalize();
    // slow breathing wind, never linear
    const s = t / 30;
    const k = wind.gust
      ? w * wind.gust(s)
      : w * (0.65 + 0.35 * Math.sin(s * 1.3 * (wind.speed ?? 1)) * Math.sin(s * 0.47 + 1.1));
    shared.uWind.value.copy(d).multiplyScalar(k);
  });

  return (
    <group ref={groupRef} {...group}>
      {materials.map((m, i) => (
        <mesh key={i} geometry={geometry} material={m} castShadow={castShadow && i === 0} receiveShadow={i === 0} renderOrder={i} />
      ))}
    </group>
  );
};

/**
 * Gusty wind envelope for <Fur wind={{ ..., gust: gusts({ at: [1, 2, 4] }) }}>.
 * Returns a multiplier of wind.strength: `base` between gusts, `peak` at each time in `at` (seconds),
 * fast rise (`rise` s) and slow fall (`fall` s). Pure function of time.
 */
export const gusts = ({
  at,
  base = 0.25,
  peak = 1.2,
  rise = 0.35,
  fall = 0.7,
}: { at: number[]; base?: number; peak?: number; rise?: number; fall?: number }) =>
  (sec: number) => {
    let g = 0;
    for (const c of at) {
      const d = sec - c;
      const e = d < 0 ? (d > -rise ? Math.sin((Math.PI / 2) * (1 + d / rise)) ** 2 : 0) : Math.exp(-d / fall) * (d < 4 * fall ? 1 : 0);
      g = Math.max(g, e);
    }
    return base + (peak - base) * g;
  };
