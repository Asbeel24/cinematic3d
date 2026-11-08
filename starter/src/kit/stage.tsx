import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  Pass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import { GrainEffect } from "./post";

/* ------------------------------------------------------------------ */
/* Timeline: every animated value is a pure function of t (in frames). */
/* t = current frame, or a sub-frame sample when motion blur is on.    */
/* ------------------------------------------------------------------ */

type TimelineFn = (t: number) => void;
const TimelineCtx = createContext<Set<{ current: TimelineFn }> | null>(null);

/** Register an animator. `fn(t)` must only depend on t (frames, may be fractional). */
export function useTimeline(fn: TimelineFn) {
  const set = useContext(TimelineCtx);
  if (!set) throw new Error("useTimeline must be used inside <Stage>");
  const ref = useRef(fn);
  ref.current = fn;
  useLayoutEffect(() => {
    set.add(ref);
    return () => {
      set.delete(ref);
    };
  }, [set]);
}

/* ------------------------------------------------------------------ */
/* Sub-frame accumulation pass (motion blur).                           */
/* ------------------------------------------------------------------ */

class SubframePass extends Pass {
  frame = 0;
  samples = 1;
  shutter = 0.5; // fraction of a frame (180° = 0.5)
  private temp: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quadMat: THREE.ShaderMaterial;
  constructor(
    private sceneRef: THREE.Scene,
    private camRef: THREE.Camera,
    private timeline: Set<{ current: TimelineFn }>,
  ) {
    super("SubframePass");
    this.needsSwap = true;
    this.temp = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthBuffer: true,
    });
    this.quadMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, w: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `uniform sampler2D tex; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tex, vUv) * w; }`,
      // pure additive (ONE, ONE): weight is already baked into the colour
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.quadMat));
  }
  setSize(w: number, h: number) {
    this.temp.setSize(w, h);
  }
  private apply(t: number) {
    for (const fn of this.timeline) fn.current(t);
    this.sceneRef.updateMatrixWorld();
    (this.camRef as THREE.PerspectiveCamera).updateProjectionMatrix?.();
  }
  render(renderer: THREE.WebGLRenderer, _in: THREE.WebGLRenderTarget, out: THREE.WebGLRenderTarget) {
    const n = Math.max(1, Math.round(this.samples));
    if (n === 1) {
      this.apply(this.frame);
      renderer.setRenderTarget(out);
      renderer.clear();
      renderer.render(this.sceneRef, this.camRef);
      return;
    }
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(out);
    renderer.clear();
    for (let i = 0; i < n; i++) {
      const t = this.frame + ((i + 0.5) / n - 0.5) * this.shutter;
      this.apply(t);
      renderer.setRenderTarget(this.temp);
      renderer.clear();
      renderer.render(this.sceneRef, this.camRef);
      this.quadMat.uniforms.tex.value = this.temp.texture;
      this.quadMat.uniforms.w.value = 1 / n;
      renderer.setRenderTarget(out);
      renderer.render(this.quadScene, this.quadCam);
    }
    renderer.autoClear = autoClear;
    // leave scene at the exact frame for anything reading it afterwards
    this.apply(this.frame);
  }
}

/* ------------------------------------------------------------------ */
/* Post settings                                                        */
/* ------------------------------------------------------------------ */

export type FilmSettings = {
  bloom?: number;
  grain?: number;
  vignette?: number;
  exposure?: number;
  aces?: boolean;
};

const Driver: React.FC<{
  samples: number;
  shutterAngle: number;
  film: FilmSettings;
  timeline: Set<{ current: TimelineFn }>;
  background: string;
}> = ({ samples, shutterAngle, film, timeline, background }) => {
  const { gl, scene, camera, size } = useThree();
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const pipeline = useMemo(() => {
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMappingExposure = film.exposure ?? 1;
    scene.background = new THREE.Color(background);
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType });
    const sub = new SubframePass(scene, camera, timeline);
    composer.addPass(sub);
    const effects = [];
    if ((film.bloom ?? 0.2) > 0)
      effects.push(new BloomEffect({ intensity: film.bloom ?? 0.2, luminanceThreshold: 0.9, luminanceSmoothing: 0.2, mipmapBlur: true }));
    if (film.aces !== false) effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    if ((film.vignette ?? 0.25) > 0)
      effects.push(new VignetteEffect({ offset: 0.3, darkness: film.vignette ?? 0.25 }));
    const grain = new GrainEffect(film.grain ?? 0.35);
    if ((film.grain ?? 0.35) > 0) effects.push(grain);
    composer.addPass(new EffectPass(camera, ...effects));
    return { composer, sub, grain };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useLayoutEffect(() => {
    pipeline.composer.setSize(size.width, size.height);
  }, [pipeline, size.width, size.height]);

  // Render driver (not an animator): runs on every advance() that @remotion/three
  // issues after the frame changes. All state comes from frameRef → deterministic.
  useFrame(() => {
    pipeline.sub.frame = frameRef.current;
    pipeline.sub.samples = samples;
    pipeline.sub.shutter = shutterAngle / 360;
    pipeline.grain.setFrame(frameRef.current);
    pipeline.composer.render(0);
  }, 1);
  return null;
};

export const Stage: React.FC<{
  children: React.ReactNode;
  /** sub-frames per frame for motion blur (1 = off) */
  samples?: number;
  shutterAngle?: number;
  film?: FilmSettings;
  background?: string;
  fov?: number;
}> = ({ children, samples = 1, shutterAngle = 180, film = {}, background = "#000000", fov = 40 }) => {
  const { width, height } = useVideoConfig();
  const timeline = useMemo(() => new Set<{ current: TimelineFn }>(), []);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={1}
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ fov, near: 0.05, far: 200, position: [0, 1, 5] }}
      gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
    >
      <TimelineCtx.Provider value={timeline}>
        {children}
        <Driver samples={samples} shutterAngle={shutterAngle} film={film} timeline={timeline} background={background} />
      </TimelineCtx.Provider>
    </ThreeCanvas>
  );
};
