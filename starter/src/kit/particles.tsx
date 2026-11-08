import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { rng } from "./motion";
import { BEAM_GLSL, useKeyUniforms } from "./lights";
import { useTimeline } from "./stage";
import type { Vec3 } from "./camera";

type Volumetric = {
  /** same aperture/floor as the <Beam>, so particles light up only inside the shaft */
  aperture: [Vec3, Vec3, Vec3, Vec3];
  floorY: number;
};

/* ------------------------------------------------------------------ */
/* Dust: points that are almost invisible outside the beam             */
/* ------------------------------------------------------------------ */

export const Dust: React.FC<
  Volumetric & {
    count?: number;
    min: Vec3;
    max: Vec3;
    /** mote diameter in millimetres (rendered size; DOF makes them read bigger) */
    size?: number;
    /** brightness inside the beam */
    gain?: number;
    seed?: number;
  }
> = ({ aperture, floorY, count = 1500, min, max, size = 1.6, gain = 1, seed = 11 }) => {
  const u = useKeyUniforms(aperture, floorY);
  const { size: viewport } = useThree();
  const geo = useMemo(() => {
    const r = rng(seed);
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = r();
      pos[i * 3 + 1] = r();
      pos[i * 3 + 2] = r();
      rnd[i * 4] = r();
      rnd[i * 4 + 1] = r();
      rnd[i * 4 + 2] = r();
      rnd[i * 4 + 3] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return g;
  }, [count, seed]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...u,
          uMin: { value: new THREE.Vector3(...min) },
          uMax: { value: new THREE.Vector3(...max) },
          uSize: { value: size },
          uGain: { value: gain },
          uViewH: { value: viewport.height },
        },
        vertexShader: `
          ${BEAM_GLSL}
          uniform vec3 uMin; uniform vec3 uMax; uniform float uSize; uniform float uViewH;
          attribute vec4 aRnd;
          varying float vLit; varying float vTw;
          void main(){
            vec3 span = uMax - uMin;
            float t = uTime / 30.0; // seconds
            // slow convection + brownian wander, wrapped inside the box
            vec3 drift = vec3(0.012, 0.018 + aRnd.w * 0.02, -0.006) * t;
            vec3 wander = 0.025 * vec3(
              sin(t * (0.6 + aRnd.x) + aRnd.y * 40.0),
              sin(t * (0.5 + aRnd.y) + aRnd.z * 40.0),
              sin(t * (0.7 + aRnd.z) + aRnd.x * 40.0));
            vec3 p = uMin + mod(position * span + drift + wander, span);
            vLit = keyMask(p);
            vTw = 0.55 + 0.45 * sin(t * (2.0 + aRnd.x * 3.0) + aRnd.w * 30.0); // glint as motes turn
            vec4 mv = viewMatrix * vec4(p, 1.0);
            vLit *= smoothstep(0.25, 0.6, -mv.z); // motes right at the lens would be huge blurry blobs
            gl_Position = projectionMatrix * mv;
            float s = uSize * (0.4 + aRnd.z * 0.9);
            gl_PointSize = max(1.5, s * 0.001 * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z);
          }`,
        fragmentShader: `
          uniform vec3 uLightColor; uniform float uGain;
          varying float vLit; varying float vTw;
          void main(){
            vec2 d = gl_PointCoord - 0.5;
            float a = smoothstep(0.5, 0.0, length(d));
            float lit = vLit * vTw;
            vec3 col = uLightColor * (lit * 0.06 + 0.0008) * uGain;
            gl_FragColor = vec4(col * a, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
      }),
    [u, JSON.stringify(min), JSON.stringify(max), size, gain, viewport.height],
  );
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={11} />;
};

/* ------------------------------------------------------------------ */
/* Steam: billboarded noise wisps rising from a point                   */
/* ------------------------------------------------------------------ */

export const Steam: React.FC<
  Volumetric & {
    origin: Vec3;
    /** rise height in metres */
    height?: number;
    /** base width in metres */
    width?: number;
    /** number of overlapping wisps */
    count?: number;
    /** seconds for one wisp to rise */
    period?: number;
    opacity?: number;
    seed?: number;
  }
> = ({ aperture, floorY, origin, height = 0.26, width = 0.07, count = 12, period = 3.4, opacity = 0.42, seed = 5 }) => {
  const u = useKeyUniforms(aperture, floorY);
  const camera = useThree((s) => s.camera);
  const group = useRef<THREE.Group>(null!);
  const items = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, (_, i) => ({
      offset: i / count,
      seed: r() * 100,
      sway: 0.6 + r() * 0.8,
      mat: new THREE.ShaderMaterial({
        uniforms: {
          ...u,
          uPhase: { value: 0 },
          uSeed: { value: r() * 100 },
          uOpacity: { value: opacity },
          uCenter: { value: new THREE.Vector3() },
        },
        vertexShader: `
          varying vec2 vUv; varying vec3 vWorld;
          void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `
          ${BEAM_GLSL}
          uniform float uPhase; uniform float uSeed; uniform float uOpacity;
          varying vec2 vUv; varying vec3 vWorld;
          float vn2(vec2 p){ return vnoise(vec3(p, uSeed)); }
          void main(){
            // wisp: a thin ribbon that curls more as it rises, broken up by noise
            vec2 p = vUv;
            float rise = p.y;
            float curl = (fbm3(vec3(p.y * 3.0 - uPhase * 2.0, uSeed, uPhase * 0.5)) - 0.5) * (0.25 + rise * 0.9);
            float x = (p.x - 0.5) - curl;
            float w = 0.03 + rise * 0.06;
            float ribbon = exp(-x * x / (w * w));
            float breakup = smoothstep(0.38, 0.72, fbm3(vec3(p.x * 6.0, p.y * 7.0 - uPhase * 4.0, uSeed + uPhase)));
            float edge = smoothstep(0.0, 0.12, p.y) * smoothstep(1.0, 0.45, p.y);
            float life = sin(3.14159 * uPhase);
            float a = ribbon * breakup * edge * life * uOpacity;
            float lit = keyMask(vWorld);
            vec3 col = uLightColor * (0.02 + lit * 0.09) + vec3(0.015);
            gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    }));
  }, [u, count, opacity, seed]);

  useTimeline((t) => {
    const s = t / 30;
    group.current.children.forEach((m, i) => {
      const it = items[i];
      const phase = (((s / period + it.offset) % 1) + 1) % 1;
      it.mat.uniforms.uPhase.value = phase;
      const h = height * (0.55 + 0.45 * phase);
      const w = width * (0.7 + phase * 1.6);
      const swayX = Math.sin(s * 0.9 * it.sway + it.seed) * 0.012 * phase;
      m.position.set(origin[0] + swayX, origin[1] + phase * height * 0.45 + h * 0.5 - 0.01, origin[2]);
      m.scale.set(w, h, 1);
      m.quaternion.copy(camera.quaternion);
      m.updateMatrixWorld();
    });
  }, 20);

  return (
    <group ref={group}>
      {items.map((it, i) => (
        <mesh key={i} material={it.mat} renderOrder={12}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  );
};
