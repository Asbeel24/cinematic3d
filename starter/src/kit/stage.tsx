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
import { getInputProps, useCurrentFrame, useVideoConfig } from "remotion";
import {
  BloomEffect,
  DepthOfFieldEffect,
  Effect,
  EffectComposer,
  EffectPass,
  Pass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import { ExposureEffect, GrainEffect, HalationEffect } from "./post";
import { SplitPass, type SplitSpec } from "./renderPass";

/* ------------------------------------------------------------------ */
/* Timeline: every animated value is a pure function of t (in frames). */
/* t = current frame, or a sub-frame sample when motion blur is on.    */
/* ------------------------------------------------------------------ */

export type TimelineFn = (t: number) => void;
type Entry = { current: TimelineFn; order: number };

/** Mutable per-render state shared by kit modules (camera focus, blur windows…). */
export type StageState = {
  timeline: Set<Entry>;
  focus: { enabled: boolean; distance: number; range: number; bokeh: number };
  /** frame ranges that need more motion-blur sub-samples (e.g. whip pans) */
  blurWindows: { from: number; to: number; samples: number }[];
  /** render-pass split screen (see renderPass.tsx) */
  split: SplitSpec | null;
  /** set by the driver: false in proxy mode (no motion blur) */
  proxy: boolean;
};

const StageCtx = createContext<StageState | null>(null);

export function useStage(): StageState {
  const s = useContext(StageCtx);
  if (!s) throw new Error("kit hooks must be used inside <Stage>");
  return s;
}

/**
 * Register an animator. `fn(t)` must only depend on t (frames, may be fractional).
 * Lower `order` runs first (lights -10, default 0, camera 10, readers of the camera 20).
 */
export function useTimeline(fn: TimelineFn, order = 0) {
  const { timeline } = useStage();
  const ref = useRef<Entry>({ current: fn, order });
  ref.current.current = fn;
  ref.current.order = order;
  useLayoutEffect(() => {
    const e = ref.current;
    timeline.add(e);
    return () => {
      timeline.delete(e);
    };
  }, [timeline]);
}

/** Raise motion-blur sub-samples for a frame range (fast action). Proxy renders ignore it. */
export function useMotionBlur(from: number, to: number, samples = 8) {
  const { blurWindows } = useStage();
  useLayoutEffect(() => {
    const w = { from, to, samples };
    blurWindows.push(w);
    return () => {
      blurWindows.splice(blurWindows.indexOf(w), 1);
    };
  }, [blurWindows, from, to, samples]);
}

function runTimeline(state: StageState, t: number) {
  const list = [...state.timeline].sort((a, b) => a.order - b.order);
  for (const e of list) e.current(t);
}

/* ------------------------------------------------------------------ */
/* Sub-frame accumulation pass (motion blur).                           */
/* Renders straight into the composer's input buffer so depth is kept  */
/* for depth of field.                                                  */
/* ------------------------------------------------------------------ */

class SubframePass extends Pass {
  frame = 0;
  samples = 1;
  shutter = 0.5; // fraction of a frame (180° = 0.5)
  /** called after the scene has been set to the exact frame (DOF focus etc.) */
  onApplied: (() => void) | null = null;
  private temp: THREE.WebGLRenderTarget;
  private accum: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quadMat: THREE.ShaderMaterial;
  private depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  constructor(
    private sceneRef: THREE.Scene,
    private camRef: THREE.Camera,
    private state: StageState,
  ) {
    super("SubframePass");
    this.needsSwap = false;
    this.needsDepthBlit = true;
    const opts = { type: THREE.HalfFloatType, depthBuffer: true };
    this.temp = new THREE.WebGLRenderTarget(1, 1, { ...opts, samples: 4 });
    this.accum = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    this.quadMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, w: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `uniform sampler2D tex; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tex, vUv) * w; }`,
      // pure additive (ONE, ONE): the weight is baked into the colour
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
    this.accum.setSize(w, h);
  }
  private apply(t: number) {
    runTimeline(this.state, t);
    this.sceneRef.updateMatrixWorld();
    this.camRef.updateMatrixWorld();
  }
  private blit(renderer: THREE.WebGLRenderer, tex: THREE.Texture, w: number, target: THREE.WebGLRenderTarget) {
    this.quadMat.uniforms.tex.value = tex;
    this.quadMat.uniforms.w.value = w;
    renderer.setRenderTarget(target);
    renderer.render(this.quadScene, this.quadCam);
  }
  render(renderer: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget) {
    const n = Math.max(1, Math.round(this.samples));
    if (n === 1) {
      this.apply(this.frame);
      this.onApplied?.();
      renderer.setRenderTarget(input);
      renderer.clear();
      renderer.render(this.sceneRef, this.camRef);
      return;
    }
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.accum);
    renderer.clear();
    for (let i = 0; i < n; i++) {
      const t = this.frame + ((i + 0.5) / n - 0.5) * this.shutter;
      this.apply(t);
      renderer.setRenderTarget(this.temp);
      renderer.clear();
      renderer.render(this.sceneRef, this.camRef);
      this.blit(renderer, this.temp.texture, 1 / n, this.accum);
    }
    // depth at the exact frame (for DOF), then the averaged colour on top
    this.apply(this.frame);
    this.onApplied?.();
    renderer.setRenderTarget(input);
    renderer.clear();
    const bg = this.sceneRef.background;
    this.sceneRef.background = null;
    this.sceneRef.overrideMaterial = this.depthOnly;
    renderer.render(this.sceneRef, this.camRef);
    this.sceneRef.overrideMaterial = null;
    this.sceneRef.background = bg;
    this.blit(renderer, this.accum.texture, 1, input);
    renderer.autoClear = autoClear;
  }
}

/* ------------------------------------------------------------------ */
/* Film settings — the fixed post chain                                 */
/* DOF → exposure → halation → bloom → ACES → vignette → grain          */
/* ------------------------------------------------------------------ */

export type FilmSettings = {
  /** depth of field on/off; focus comes from useShot({focus}) */
  dof?: boolean;
  bloom?: number;
  halation?: number;
  grain?: number;
  vignette?: number;
  /** linear exposure multiplier before tone mapping */
  exposure?: number;
  aces?: boolean;
};

export const defaultFilm: Required<FilmSettings> = {
  dof: true,
  bloom: 0.2,
  halation: 0.3,
  grain: 0.35,
  vignette: 0.25,
  exposure: 1,
  aces: true,
};

const Driver: React.FC<{
  samples: number;
  shutterAngle: number;
  film: Required<FilmSettings>;
  state: StageState;
  background: string;
  proxy: boolean;
}> = ({ samples, shutterAngle, film, state, background, proxy }) => {
  const { gl, scene, camera, size } = useThree();
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const pipeline = useMemo(() => {
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    scene.background = new THREE.Color(background);
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType });
    const sub = new SubframePass(scene, camera, state);
    composer.addPass(sub);
    const split = new SplitPass(scene, camera);
    composer.addPass(split);

    const exposure = new ExposureEffect(film.exposure);
    let dof: DepthOfFieldEffect | null = null;
    if (film.dof) {
      dof = new DepthOfFieldEffect(camera, { focusDistance: 3, focusRange: 1, bokehScale: 3, resolutionScale: proxy ? 0.5 : 0.75 });
      composer.addPass(new EffectPass(camera, dof, exposure));
    } else {
      composer.addPass(new EffectPass(camera, exposure));
    }
    const effects: Effect[] = [];
    if (film.halation > 0) effects.push(new HalationEffect({ intensity: film.halation }));
    if (film.bloom > 0)
      effects.push(new BloomEffect({ intensity: film.bloom, luminanceThreshold: 0.85, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.8 }));
    if (film.aces) effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    if (film.vignette > 0) effects.push(new VignetteEffect({ offset: 0.3, darkness: film.vignette }));
    const grain = new GrainEffect(film.grain);
    if (film.grain > 0) effects.push(grain);
    composer.addPass(new EffectPass(camera, ...effects));
    if (dof) {
      const d = dof;
      sub.onApplied = () => {
        d.cocMaterial.focusDistance = state.focus.distance;
        d.cocMaterial.focusRange = state.focus.range;
        d.bokehScale = state.focus.enabled ? state.focus.bokeh : 0;
      };
    }
    return { composer, sub, grain, dof, split };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useLayoutEffect(() => {
    pipeline.composer.setSize(size.width, size.height);
  }, [pipeline, size.width, size.height]);

  // Render driver (not an animator): runs on every advance() that @remotion/three
  // issues after the frame changes. All state comes from frameRef → deterministic.
  useFrame(() => {
    const f = frameRef.current;
    let n = samples;
    for (const w of state.blurWindows) if (f >= w.from && f <= w.to) n = Math.max(n, w.samples);
    if (proxy) n = 1;
    pipeline.sub.frame = f;
    pipeline.sub.samples = n;
    pipeline.sub.shutter = shutterAngle / 360;
    pipeline.grain.setFrame(f);
    pipeline.split.enabled = !!state.split;
    pipeline.split.spec = state.split;
    pipeline.split.frame = f;
    pipeline.composer.render(0);
  }, 1);
  return null;
};

/** Distance fog in the background colour: dissolves floors into the horizon. */
export const Fog: React.FC<{ color: string; near: number; far: number }> = ({ color, near, far }) => {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    scene.fog = new THREE.Fog(color, near, far);
    return () => {
      scene.fog = null;
    };
  }, [scene, color, near, far]);
  return null;
};

export type StageProps = {
  children: React.ReactNode;
  /** sub-frames per frame for motion blur (1 = off). Whip pans raise it locally. */
  samples?: number;
  shutterAngle?: number;
  film?: FilmSettings;
  background?: string;
  /** proxy: no motion blur, cheaper DOF (render.mjs --proxy sets this) */
  proxy?: boolean;
};

export const Stage: React.FC<StageProps> = ({
  children,
  samples = 1,
  shutterAngle = 180,
  film = {},
  background = "#000000",
  proxy = Boolean((getInputProps() as { proxy?: boolean }).proxy),
}) => {
  const { width, height } = useVideoConfig();
  const state = useMemo<StageState>(
    () => ({
      timeline: new Set(),
      focus: { enabled: false, distance: 3, range: 1, bokeh: 0 },
      blurWindows: [],
      split: null,
      proxy,
    }),
    [proxy],
  );
  const f = { ...defaultFilm, ...film };
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={1}
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ fov: 40, near: 0.02, far: 200, position: [0, 1, 5] }}
      gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
    >
      <StageCtx.Provider value={state}>
        {children}
        <Driver samples={samples} shutterAngle={shutterAngle} film={f} state={state} background={background} proxy={proxy} />
      </StageCtx.Provider>
    </ThreeCanvas>
  );
};
