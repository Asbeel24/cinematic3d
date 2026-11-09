import React, { useLayoutEffect } from "react";
import * as THREE from "three";
import { Pass } from "postprocessing";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useStage, type StageState } from "./stage";
import { FONTS } from "./fonts";

/**
 * Render-pass split screen: the same shot rendered as beauty / clay / wireframe,
 * composited with animated diagonal bands and a 1 px highlight on each seam.
 */

export type PassName = "beauty" | "clay" | "wire";
export type SplitSpec = {
  passes: PassName[];
  split: "diagonal" | "vertical";
  /** band seams in 0..1 across the frame, as a pure function of t (frames) */
  seams: (t: number) => number[];
  clayColor?: string;
  wireColor?: string;
  wireBackground?: string;
};

/** Normalised split coordinate (0 at top-left corner → 1 at bottom-right for diagonal). */
export function splitCoord(u: number, v: number, aspect: number, split: SplitSpec["split"]) {
  if (split === "vertical") return u;
  // 45° on screen: weight x by aspect so the seam is a true diagonal in pixels
  return (u * aspect + v) / (aspect + 1);
}

export class SplitPass extends Pass {
  spec: SplitSpec | null = null;
  frame = 0;
  private clayRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  private wireRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  private clayMat = new THREE.MeshStandardMaterial({ color: "#d8d4cc", roughness: 0.85 });
  private wireMat = new THREE.MeshBasicMaterial({ color: "#cfe3ff", wireframe: true, toneMapped: false });
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  constructor(private sceneRef: THREE.Scene, private camRef: THREE.Camera) {
    super("SplitPass");
    this.needsSwap = true;
    this.enabled = false;
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tBeauty: { value: null },
        tClay: { value: null },
        tWire: { value: null },
        uSeams: { value: new THREE.Vector4(2, 2, 2, 2) },
        uCount: { value: 3 },
        uAspect: { value: 1 },
        uDiagonal: { value: 1 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uOrder: { value: new THREE.Vector3(0, 1, 2) },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `
        uniform sampler2D tBeauty, tClay, tWire;
        uniform vec4 uSeams; uniform float uCount; uniform float uAspect; uniform float uDiagonal;
        uniform vec2 uRes; uniform vec3 uOrder;
        varying vec2 vUv;
        vec4 pick(float id){
          if (id < 0.5) return texture2D(tBeauty, vUv);
          if (id < 1.5) return texture2D(tClay, vUv);
          return texture2D(tWire, vUv);
        }
        void main(){
          float u = vUv.x, v = 1.0 - vUv.y;
          float d = uDiagonal > 0.5 ? (u * uAspect + v) / (uAspect + 1.0) : u;
          float band = 0.0;
          if (d > uSeams.x) band = 1.0;
          if (uCount > 2.5 && d > uSeams.y) band = 2.0;
          float id = band < 0.5 ? uOrder.x : (band < 1.5 ? uOrder.y : uOrder.z);
          vec4 c = pick(id);
          // 1 px seam highlight (distance in pixels along the split gradient)
          float pxPerUnit = uDiagonal > 0.5 ? length(vec2(uRes.x * (uAspect + 1.0) / uAspect, uRes.y * (uAspect + 1.0))) / sqrt(2.0) : uRes.x;
          float line = 0.0;
          line = max(line, 1.0 - smoothstep(0.0, 1.2, abs(d - uSeams.x) * pxPerUnit));
          if (uCount > 2.5) line = max(line, 1.0 - smoothstep(0.0, 1.2, abs(d - uSeams.y) * pxPerUnit));
          c.rgb = mix(c.rgb, vec3(3.0), line * 0.9);
          gl_FragColor = c;
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quadScene.add(this.quad);
  }
  setSize(w: number, h: number) {
    this.clayRT.setSize(w, h);
    this.wireRT.setSize(w, h);
    this.mat.uniforms.uRes.value.set(w, h);
    this.mat.uniforms.uAspect.value = w / h;
  }
  private renderOverride(renderer: THREE.WebGLRenderer, rt: THREE.WebGLRenderTarget, mat: THREE.Material, bg: THREE.Color | null) {
    const scene = this.sceneRef;
    const oldBg = scene.background;
    const oldFog = scene.fog;
    if (bg) scene.background = bg;
    const hidden: THREE.Object3D[] = [];
    if (mat === this.wireMat) {
      scene.fog = null;
      // environment (walls, floors) marked userData.noWire stays out of the wireframe band
      scene.traverse((o) => {
        if (o.userData.noWire && o.visible) {
          o.visible = false;
          hidden.push(o);
        }
      });
    }
    scene.overrideMaterial = mat;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, this.camRef);
    scene.overrideMaterial = null;
    for (const o of hidden) o.visible = true;
    scene.background = oldBg;
    scene.fog = oldFog;
  }
  render(renderer: THREE.WebGLRenderer, input: THREE.WebGLRenderTarget, output: THREE.WebGLRenderTarget) {
    const spec = this.spec;
    if (!spec) return;
    this.clayMat.color.set(spec.clayColor ?? "#d8d4cc");
    this.wireMat.color.set(spec.wireColor ?? "#cfe3ff");
    // the scene is still posed at the exact frame (SubframePass leaves it there)
    if (spec.passes.includes("clay")) this.renderOverride(renderer, this.clayRT, this.clayMat, null);
    if (spec.passes.includes("wire")) this.renderOverride(renderer, this.wireRT, this.wireMat, new THREE.Color(spec.wireBackground ?? "#0d1420"));
    const seams = spec.seams(this.frame);
    const ids = spec.passes.map((p) => ({ beauty: 0, clay: 1, wire: 2 })[p]);
    const u = this.mat.uniforms;
    u.tBeauty.value = input.texture;
    u.tClay.value = this.clayRT.texture;
    u.tWire.value = this.wireRT.texture;
    u.uSeams.value.set(seams[0] ?? 2, seams[1] ?? 2, 2, 2);
    u.uCount.value = spec.passes.length;
    u.uDiagonal.value = spec.split === "diagonal" ? 1 : 0;
    u.uOrder.value.set(ids[0] ?? 0, ids[1] ?? 1, ids[2] ?? 2);
    renderer.setRenderTarget(this.renderToScreen ? null : output);
    renderer.render(this.quadScene, this.quadCam);
  }
}

/** Declare the split inside <Stage>. */
export const RenderPass: React.FC<SplitSpec> = (spec) => {
  const stage = useStage() as StageState;
  useLayoutEffect(() => {
    stage.split = spec;
    return () => {
      stage.split = null;
    };
  });
  return null;
};

/** DOM labels that ride along each band (render outside <Stage>, in the same AbsoluteFill). */
export const PassLabels: React.FC<{
  spec: SplitSpec;
  labels?: Partial<Record<PassName, string>>;
  /** vertical position (0..1) of each band's label; staggered so they never collide */
  rows?: number[];
}> = ({ spec, labels = {}, rows = [0.2, 0.42, 0.64] }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const aspect = width / height;
  const seams = spec.seams(frame);
  const edges = [0, ...seams.slice(0, spec.passes.length - 1), 1];
  const names: Record<PassName, string> = { beauty: "BEAUTY", clay: "CLAY", wire: "WIREFRAME", ...labels };
  const fs = Math.round(Math.min(width, height) * 0.024);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {spec.passes.map((p, i) => {
        const y = rows[i] ?? 0.5;
        const dc = (edges[i] + edges[i + 1]) / 2;
        // solve the split coordinate for x on this row
        const u = spec.split === "diagonal" ? (dc * (aspect + 1) - y) / aspect : dc;
        const x = Math.min(0.85, Math.max(0.15, u)) * width;
        return (
          <div
            key={p}
            style={{
              position: "absolute",
              left: x,
              top: y * height,
              transform: "translate(-50%, -50%)",
              fontFamily: FONTS.ui,
              fontWeight: 600,
              fontSize: fs,
              letterSpacing: fs * 0.18,
              color: p === "wire" ? "#cfe3ff" : p === "clay" ? "#2a2724" : "#f4f1ea",
              background: p === "clay" ? "rgba(255,255,255,0.55)" : "rgba(10,10,12,0.45)",
              border: `1px solid ${p === "clay" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.35)"}`,
              padding: `${fs * 0.35}px ${fs * 0.8}px`,
              borderRadius: fs,
              whiteSpace: "nowrap",
            }}
          >
            {String(i + 1).padStart(2, "0")} · {names[p]}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
