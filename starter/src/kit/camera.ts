import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useVideoConfig } from "remotion";
import { useLayoutEffect } from "react";
import { Ease, ease, lerp, noise1D, progress } from "./motion";
import { useStage, useTimeline } from "./stage";

export type Vec3 = [number, number, number];
export type Lens = 35 | 50 | 85;

/**
 * Focal length → vertical FOV (degrees), full-frame sensor.
 * The sensor's long side (36 mm) follows the frame's long side, so 9:16 and 16:9
 * at the same lens show the same "width" of the world along the long edge.
 */
export function lensToFov(mm: number, aspect: number): number {
  const sensorV = aspect < 1 ? 36 : 24; // portrait frames put the 36 mm side vertical
  return (2 * Math.atan(sensorV / 2 / mm) * 180) / Math.PI;
}

type Window = { start?: number; end?: number; ease?: Ease };

/** One shot has exactly ONE main move. */
export type Move =
  | { kind: "static" }
  | ({ kind: "push"; to: Vec3 } & Window) // camera position → `to`, target fixed
  | ({ kind: "dolly"; distance: number } & Window) // along view axis (+ = toward target)
  | ({ kind: "orbit"; deg: number } & Window) // around target, yaw
  | ({ kind: "pan"; deg: number } & Window) // rotate in place (yaw)
  | ({ kind: "tilt"; deg: number } & Window) // rotate in place (pitch)
  | ({ kind: "crane"; dy: number } & Window) // rise/fall, keeps target
  | { kind: "whip"; dir: "left" | "right" | "up" | "down"; at: number; deg?: number; frames?: number; samples?: number };

/** Builders: `shot.push({to:[0,1,2]})`, `shot.orbit(20)` … */
export const shot = {
  static: (): Move => ({ kind: "static" }),
  push: (to: Vec3, w: Window = {}): Move => ({ kind: "push", to, ...w }),
  dolly: (distance: number, w: Window = {}): Move => ({ kind: "dolly", distance, ...w }),
  orbit: (deg: number, w: Window = {}): Move => ({ kind: "orbit", deg, ...w }),
  pan: (deg: number, w: Window = {}): Move => ({ kind: "pan", deg, ...w }),
  tilt: (deg: number, w: Window = {}): Move => ({ kind: "tilt", deg, ...w }),
  crane: (dy: number, w: Window = {}): Move => ({ kind: "crane", dy, ...w }),
  /** whip pan: forces 16–32 motion-blur sub-samples around `at` */
  whip: (dir: "left" | "right" | "up" | "down", at: number, o: { deg?: number; frames?: number; samples?: number } = {}): Move => ({
    kind: "whip",
    dir,
    at,
    ...o,
  }),
};

export type ShotSpec = {
  lens: Lens;
  position: Vec3;
  target: Vec3;
  move?: Move;
  /** handheld micro-drift amplitude in output pixels (2–6). Default on (3 px). false = locked off. */
  drift?: { px?: number; seed?: number } | false;
  /** physical-ish depth of field */
  focus?: {
    /** world point to keep sharp (default: target) */
    point?: Vec3;
    /** override with a fixed distance in metres */
    distance?: number;
    /** f-stop: 1.4 very shallow … 8 deep. Default 2.8 */
    aperture?: number;
  } | false;
};

const v3 = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2]);

/**
 * Drive the scene camera from a ShotSpec. Pure function of t.
 * Usage: useShot({ lens: 50, position: [0,1.2,3], target: [0,0.9,0], move: shot.orbit(20) })
 */
export function useShot(spec: ShotSpec) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const { width, height, durationInFrames } = useVideoConfig();
  const stage = useStage();
  const aspect = width / height;

  // whip needs extra motion-blur samples in its window
  useLayoutEffect(() => {
    const m = spec.move;
    if (m && m.kind === "whip") {
      const frames = m.frames ?? 8;
      const w = { from: m.at - frames, to: m.at + frames, samples: Math.min(32, Math.max(16, m.samples ?? 24)) };
      stage.blurWindows.push(w);
      return () => {
        stage.blurWindows.splice(stage.blurWindows.indexOf(w), 1);
      };
    }
  }, [spec.move, stage]);

  const pos = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  useTimeline((t) => {
    const m = spec.move ?? { kind: "static" };
    const end = durationInFrames - 1;
    const k = (w: Window) => progress(t, w.start ?? 0, w.end ?? end, w.ease ?? ease.cine);
    pos.copy(v3(spec.position));
    tgt.copy(v3(spec.target));
    let yaw = 0;
    let pitch = 0;

    switch (m.kind) {
      case "push":
        pos.lerpVectors(v3(spec.position), v3(m.to), k(m));
        break;
      case "dolly": {
        tmp.subVectors(tgt, pos).normalize();
        pos.addScaledVector(tmp, m.distance * k(m));
        break;
      }
      case "orbit": {
        const a = THREE.MathUtils.degToRad(m.deg) * k(m);
        tmp.subVectors(pos, tgt).applyAxisAngle(up, a);
        pos.addVectors(tgt, tmp);
        break;
      }
      case "pan":
        yaw = THREE.MathUtils.degToRad(m.deg) * k(m);
        break;
      case "tilt":
        pitch = THREE.MathUtils.degToRad(m.deg) * k(m);
        break;
      case "crane":
        pos.y += m.dy * k(m);
        break;
      case "whip": {
        const frames = m.frames ?? 8;
        const deg = m.deg ?? 70;
        const kk = progress(t, m.at - frames, m.at + frames, ease.inOut);
        const a = THREE.MathUtils.degToRad(deg) * kk;
        if (m.dir === "left") yaw = a;
        if (m.dir === "right") yaw = -a;
        if (m.dir === "up") pitch = a;
        if (m.dir === "down") pitch = -a;
        break;
      }
    }

    camera.fov = lensToFov(spec.lens, aspect);
    camera.aspect = aspect;
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(tgt);

    // handheld drift: low-frequency noise, amplitude expressed in output pixels
    let dyaw = 0;
    let dpitch = 0;
    let droll = 0;
    if (spec.drift !== false) {
      const px = spec.drift?.px ?? 3;
      const seed = spec.drift?.seed ?? 7;
      const radPerPx = THREE.MathUtils.degToRad(camera.fov) / height;
      const s = t / 45; // ~1.5 s period at 30 fps
      dyaw = (noise1D(s, seed) * 0.7 + noise1D(s * 2.3, seed + 1) * 0.3) * px * radPerPx;
      dpitch = (noise1D(s, seed + 2) * 0.7 + noise1D(s * 2.1, seed + 3) * 0.3) * px * radPerPx;
      droll = noise1D(s * 0.7, seed + 4) * 0.0015 * (px / 3);
    }
    camera.rotateY(yaw + dyaw);
    camera.rotateX(pitch + dpitch);
    camera.rotateZ(droll);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // focus
    const f = spec.focus;
    if (f === false || f === undefined) {
      stage.focus.enabled = false;
    } else {
      const fp = f.point ? v3(f.point) : tgt;
      const dist = f.distance ?? camera.position.distanceTo(fp);
      const N = f.aperture ?? 2.8;
      stage.focus.enabled = true;
      stage.focus.distance = dist;
      // depth range that stays sharp grows with distance and f-number
      stage.focus.range = Math.max(0.02, (dist * dist * N) / (spec.lens * 6));
      // bokeh size: bigger for long lenses and wide apertures
      stage.focus.bokeh = Math.min(8, (spec.lens / 50) * (4 / N) * 2.2);
    }
  }, 10);
}

export { lerp };
