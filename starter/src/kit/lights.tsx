import React, { createContext, useContext, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { rng } from "./motion";
import { useTimeline } from "./stage";
import type { Vec3 } from "./camera";

/* ------------------------------------------------------------------ */
/* Colour temperature                                                   */
/* ------------------------------------------------------------------ */

/** Kelvin → linear RGB colour (Tanner Helland fit, normalised so 6500K ≈ white). */
export function kelvin(K: number): THREE.Color {
  const t = K / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

/* ------------------------------------------------------------------ */
/* Gobo textures (procedural, Canvas)                                   */
/* ------------------------------------------------------------------ */

export type GoboSpec = {
  pattern: "blinds" | "window" | "leaves";
  /** blinds: number of slats across the window */
  slats?: number;
  /** blinds: fraction of each slat pitch that lets light through (0..1) */
  open?: number;
  /** pattern rotation in degrees */
  angle?: number;
  /** edge softness in texture pixels (of 1024) */
  softness?: number;
  /** vertical security bars (防盗网) count, 0 = none */
  bars?: number;
  /** window aperture inside the texture [x0,y0,x1,y1] in 0..1 */
  aperture?: [number, number, number, number];
  seed?: number;
};

export function makeGoboTexture(g: GoboSpec): THREE.CanvasTexture {
  const S = 1024;
  const src = document.createElement("canvas");
  src.width = src.height = S;
  const c = src.getContext("2d", { willReadFrequently: true })!;
  c.fillStyle = "#000";
  c.fillRect(0, 0, S, S);
  const [ax0, ay0, ax1, ay1] = g.aperture ?? [0.18, 0.12, 0.82, 0.88];
  c.save();
  c.beginPath();
  c.rect(ax0 * S, ay0 * S, (ax1 - ax0) * S, (ay1 - ay0) * S);
  c.clip();
  c.fillStyle = "#fff";
  c.fillRect(0, 0, S, S);
  c.translate(S / 2, S / 2);
  c.rotate(((g.angle ?? 0) * Math.PI) / 180);
  c.translate(-S / 2, -S / 2);
  c.fillStyle = "#000";
  if (g.pattern === "blinds") {
    const n = g.slats ?? 22;
    const pitch = ((ay1 - ay0) * S) / n;
    const open = g.open ?? 0.45;
    for (let i = -n; i < 2 * n; i++) {
      const y = ay0 * S + i * pitch;
      c.fillRect(-S, y, 3 * S, pitch * (1 - open));
    }
  } else if (g.pattern === "window") {
    const mx = (ax0 + ax1) / 2, my = (ay0 + ay1) / 2;
    c.fillRect(mx * S - 10, -S, 20, 3 * S);
    c.fillRect(-S, my * S - 10, 3 * S, 20);
  } else if (g.pattern === "leaves") {
    const r = rng(g.seed ?? 3);
    for (let i = 0; i < 70; i++) {
      c.save();
      c.translate(r() * S, r() * S);
      c.rotate(r() * Math.PI);
      c.beginPath();
      c.ellipse(0, 0, 18 + r() * 40, 8 + r() * 16, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }
  c.restore();
  // security bars are straight up regardless of blind angle
  const bars = g.bars ?? 0;
  if (bars > 0) {
    c.fillStyle = "#000";
    for (let i = 1; i <= bars; i++) {
      const x = (ax0 + ((ax1 - ax0) * i) / (bars + 1)) * S;
      c.fillRect(x - 7, 0, 14, S);
    }
    c.fillRect(0, (ay0 + (ay1 - ay0) * 0.62) * S - 4, S, 8);
  }
  // soft edges: blur the whole pattern (penumbra of a large source)
  const out = document.createElement("canvas");
  out.width = out.height = S;
  const o = out.getContext("2d", { willReadFrequently: true })!;
  o.filter = `blur(${g.softness ?? 6}px)`;
  o.drawImage(src, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Key light (the one motivated light)                                  */
/* ------------------------------------------------------------------ */

export type KeyLightHandle = {
  light: THREE.SpotLight | null;
  gobo: THREE.Texture | null;
  /** light-space view-projection (for beams / dust) */
  viewProj: THREE.Matrix4;
  color: THREE.Color;
  /** shared uniforms for volumetric consumers */
  uniforms: {
    uSpotMat: { value: THREE.Matrix4 };
    uGobo: { value: THREE.Texture | null };
    uLightPos: { value: THREE.Vector3 };
    uLightColor: { value: THREE.Color };
    uTime: { value: number };
  };
};

const KeyCtx = createContext<KeyLightHandle | null>(null);
export const useKeyLight = () => {
  const k = useContext(KeyCtx);
  if (!k) throw new Error("<Beam>/<Dust>/<Steam> must be inside <KeyLight>");
  return k;
};

export type KeyLightProps = {
  kind: "sun" | "softbox" | "spot";
  /** colour temperature in Kelvin */
  temp?: number;
  intensity?: number;
  position: Vec3;
  target: Vec3;
  /** optional pose animation, pure function of t (frames) */
  animate?: (t: number) => { position?: Vec3; target?: Vec3; intensity?: number };
  gobo?: GoboSpec;
  /** cone half-angle in degrees (sun default 9°, spot 25°, softbox 50°) */
  angle?: number;
  /** soft shadow radius in shadow-map texels */
  shadowRadius?: number;
  shadowMapSize?: number;
  children?: React.ReactNode;
};

/**
 * The ONE motivated key light. Children (Beam, Dust, Steam) can read it.
 * sun: distant narrow spot (near-parallel rays, gobo capable)
 * softbox: wide soft spot; spot: theatrical spot.
 */
export const KeyLight: React.FC<KeyLightProps> = ({
  kind,
  temp = 5600,
  intensity,
  position,
  target,
  animate,
  gobo,
  angle,
  shadowRadius,
  shadowMapSize = 2048,
  children,
}) => {
  const scene = useThree((s) => s.scene);
  const color = useMemo(() => kelvin(temp), [temp]);
  const goboTex = useMemo(() => (gobo ? makeGoboTexture(gobo) : null), [JSON.stringify(gobo)]);
  const light = useMemo(() => {
    const l = new THREE.SpotLight(color, 1);
    l.decay = 0;
    l.distance = 0;
    l.castShadow = true;
    l.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    l.shadow.bias = -0.0002;
    l.shadow.normalBias = 0.01;
    l.map = goboTex;
    return l;
  }, [color, goboTex, shadowMapSize]);
  const defaults = {
    sun: { angle: 9, penumbra: 0.05, radius: 3, intensity: 6 },
    softbox: { angle: 50, penumbra: 1, radius: 12, intensity: 3 },
    spot: { angle: 25, penumbra: 0.35, radius: 4, intensity: 8 },
  }[kind];
  light.angle = THREE.MathUtils.degToRad(angle ?? defaults.angle);
  light.penumbra = gobo ? 0 : defaults.penumbra;
  light.shadow.radius = shadowRadius ?? defaults.radius;
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 40;

  const handle = useMemo<KeyLightHandle>(
    () => ({
      light,
      gobo: goboTex,
      viewProj: new THREE.Matrix4(),
      color,
      uniforms: {
        uSpotMat: { value: new THREE.Matrix4() },
        uGobo: { value: goboTex },
        uLightPos: { value: new THREE.Vector3() },
        uLightColor: { value: color.clone() },
        uTime: { value: 0 },
      },
    }),
    [light, goboTex, color],
  );

  useLayoutEffect(() => {
    scene.add(light);
    scene.add(light.target);
    return () => {
      scene.remove(light);
      scene.remove(light.target);
    };
  }, [scene, light]);

  const projCam = useMemo(() => new THREE.PerspectiveCamera(), []);
  useTimeline((t) => {
    const a = animate?.(t) ?? {};
    const p = a.position ?? position;
    const tg = a.target ?? target;
    light.position.set(p[0], p[1], p[2]);
    light.target.position.set(tg[0], tg[1], tg[2]);
    light.intensity = a.intensity ?? intensity ?? defaults.intensity;
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();
    // same projection three uses for SpotLight.map
    projCam.fov = THREE.MathUtils.radToDeg(light.angle) * 2;
    projCam.aspect = 1;
    projCam.near = 0.1;
    projCam.far = 100;
    projCam.position.copy(light.position);
    projCam.lookAt(light.target.position);
    projCam.updateProjectionMatrix();
    projCam.updateMatrixWorld();
    handle.viewProj.multiplyMatrices(projCam.projectionMatrix, projCam.matrixWorldInverse);
    handle.uniforms.uSpotMat.value.copy(handle.viewProj);
    handle.uniforms.uLightPos.value.copy(light.position);
    handle.uniforms.uLightColor.value.copy(color).multiplyScalar(light.intensity);
    handle.uniforms.uTime.value = t;
  }, -10);

  return <KeyCtx.Provider value={handle}>{children}</KeyCtx.Provider>;
};

/* ------------------------------------------------------------------ */
/* Bounce / fill / environment                                          */
/* ------------------------------------------------------------------ */

/** Reflected fill from a surface lit by the key. No shadows, low intensity. */
export const Bounce: React.FC<{
  from: "floor" | "wall";
  temp?: number;
  intensity?: number;
  /** direction the bounce light comes FROM (default: below-front for floor, side for wall) */
  position?: Vec3;
}> = ({ from, temp = 3800, intensity = 0.35, position }) => {
  const color = useMemo(() => kelvin(temp), [temp]);
  const pos = position ?? (from === "floor" ? [0.3, -1, 1.5] : [2, 0.6, 0.4]);
  return <directionalLight color={color} intensity={intensity} position={pos} />;
};

/** Cool sky fill (hemisphere) for warm/cool contrast against a warm key. */
export const SkyFill: React.FC<{ temp?: number; groundTemp?: number; intensity?: number }> = ({
  temp = 9500,
  groundTemp = 3500,
  intensity = 0.25,
}) => {
  const sky = useMemo(() => kelvin(temp), [temp]);
  const ground = useMemo(() => kelvin(groundTemp).multiplyScalar(0.4), [groundTemp]);
  return <hemisphereLight args={[sky, ground, intensity]} />;
};

/** Procedural studio environment (RoomEnvironment → PMREM). No HDRI downloads. */
export const StudioEnv: React.FC<{ intensity?: number; rotationY?: number }> = ({ intensity = 0.4, rotationY = 0 }) => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    scene.environmentRotation.set(0, rotationY, 0);
    return () => {
      scene.environment = null;
      env.dispose();
      pm.dispose();
    };
  }, [gl, scene, intensity, rotationY]);
  return null;
};

/* ------------------------------------------------------------------ */
/* Volumetric beam                                                      */
/* ------------------------------------------------------------------ */

/** GLSL shared by Beam/Dust/Steam: how much key light reaches world point p. */
export const BEAM_GLSL = /* glsl */ `
uniform mat4 uSpotMat;
uniform sampler2D uGobo;
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform float uTime;
uniform vec4 uClip;    // plane (n.xyz, d): light only where dot(n,p)+d > 0 (room side of window)
uniform float uFloorY;
float keyMask(vec3 p) {
  vec4 c = uSpotMat * vec4(p, 1.0);
  if (c.w <= 0.0) return 0.0;
  vec3 n = c.xyz / c.w * 0.5 + 0.5;
  if (any(lessThan(n.xy, vec2(0.0))) || any(greaterThan(n.xy, vec2(1.0)))) return 0.0;
  if (dot(uClip.xyz, p) + uClip.w < 0.0) return 0.0;
  if (p.y < uFloorY) return 0.0;
  return texture2D(uGobo, n.xy).r;
}
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p){ return vnoise(p)*0.55 + vnoise(p*2.03)*0.3 + vnoise(p*4.1)*0.15; }
`;

export type BeamProps = {
  /** the four corners of the opening the light enters through (e.g. a window), world space */
  aperture: [Vec3, Vec3, Vec3, Vec3];
  /** the beam stops at this height (desk / floor) */
  floorY: number;
  /** 0..1 amount of haze in the air */
  haze?: number;
  steps?: number;
  /** metres in front of the camera kept free of haze (default 0.6) */
  near?: number;
};

/** Volumetric light shaft (additive, ray-marched, gobo-aware). */
export const Beam: React.FC<BeamProps> = ({ aperture, floorY, haze = 0.5, steps = 40, near = 0.6 }) => {
  const key = useKeyLight();
  const mesh = useRef<THREE.Mesh>(null!);
  const clip = useMemo(() => {
    const a = new THREE.Vector3(...aperture[0]);
    const b = new THREE.Vector3(...aperture[1]);
    const c = new THREE.Vector3(...aperture[2]);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    return { n, d: -n.dot(a) };
  }, [JSON.stringify(aperture)]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...key.uniforms,
          uClip: { value: new THREE.Vector4() },
          uFloorY: { value: floorY },
          uHaze: { value: haze },
          uSteps: { value: steps },
          uNear: { value: near },
        },
        vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `
          ${BEAM_GLSL}
          uniform float uHaze; uniform float uSteps; uniform float uNear;
          varying vec3 vWorld;
          void main(){
            vec3 ro = cameraPosition;
            vec3 seg = vWorld - ro;
            float L = length(seg);
            vec3 rd = seg / L;
            float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            float dt = L / uSteps;
            float acc = 0.0;
            for (int i = 0; i < 96; i++) {
              if (float(i) >= uSteps) break;
              vec3 p = ro + rd * (float(i) + jitter) * dt;
              float m = keyMask(p);
              if (m > 0.0) {
                float n = fbm3(p * 3.5 + vec3(0.0, uTime * 0.004, uTime * 0.006));
                // no haze right in front of the lens (camera standing in the shaft)
                float near = smoothstep(uNear * 0.4, uNear, (float(i) + jitter) * dt);
                acc += m * (0.35 + 0.9 * n) * near;
              }
            }
            vec3 col = uLightColor * acc * dt * uHaze * 0.09;
            gl_FragColor = vec4(col, 1.0);
          }`,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -8,
      }),
    [key, floorY, haze, steps, near],
  );

  // rebuild the light prism (aperture swept away from the light down to floorY)
  useTimeline(() => {
    const lp = key.uniforms.uLightPos.value;
    const pts: THREE.Vector3[] = [];
    for (const c of aperture) {
      const a = new THREE.Vector3(...c);
      pts.push(a.clone());
      const dir = a.clone().sub(lp).normalize();
      const k = dir.y < -1e-4 ? (floorY - a.y) / dir.y : 6;
      pts.push(a.clone().addScaledVector(dir, Math.min(k, 8)));
    }
    const geo = new ConvexGeometry(pts);
    mesh.current.geometry.dispose();
    mesh.current.geometry = geo;
    // clip plane must keep the room side (away from the light)
    const sgn = clip.n.dot(lp) + clip.d > 0 ? -1 : 1;
    (material.uniforms.uClip.value as THREE.Vector4).set(clip.n.x * sgn, clip.n.y * sgn, clip.n.z * sgn, clip.d * sgn);
  }, -5);

  return <mesh ref={mesh} material={material} frustumCulled={false} renderOrder={10} />;
};

/** Hook for other volumetrics: shared key-light uniforms + clip plane. */
export function useKeyUniforms(aperture: [Vec3, Vec3, Vec3, Vec3], floorY: number) {
  const key = useKeyLight();
  const u = useMemo(() => {
    const a = new THREE.Vector3(...aperture[0]);
    const b = new THREE.Vector3(...aperture[1]);
    const c = new THREE.Vector3(...aperture[2]);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    return {
      ...key.uniforms,
      uClip: { value: new THREE.Vector4(n.x, n.y, n.z, -n.dot(a)) },
      uFloorY: { value: floorY },
    };
  }, [key, JSON.stringify(aperture), floorY]);
  useTimeline(() => {
    const c = u.uClip.value;
    if (c.x * u.uLightPos.value.x + c.y * u.uLightPos.value.y + c.z * u.uLightPos.value.z + c.w > 0) c.multiplyScalar(-1);
  }, -5);
  return u;
}
