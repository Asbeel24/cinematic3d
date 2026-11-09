import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Procedural shapes. All sizes in metres. */

export const roundedBox = (w: number, h: number, d: number, r = 0.01, seg = 4) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-4));

/**
 * Solid of revolution from a 2D profile [radius, height][] (bottom → top).
 * Pass `thickness` to get a closed shell (cup, bowl): the profile is offset inward
 * and walked back down so the object has real walls.
 */
export function lathe(profile: [number, number][], opts: { segments?: number; thickness?: number } = {}) {
  const seg = opts.segments ?? 96;
  let pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  if (opts.thickness) {
    const th = opts.thickness;
    const inner = [...profile]
      .reverse()
      .map(([r, y]) => new THREE.Vector2(Math.max(0, r - th), y))
      .filter((_, i, a) => i < a.length - 1);
    // lip
    const top = profile[profile.length - 1];
    pts = [...pts, new THREE.Vector2(top[0] - th * 0.5, top[1] + th * 0.35), ...inner];
    // floor inside
    pts.push(new THREE.Vector2(0, profile[0][1] + th));
  }
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}

/** Smooth profile from a few control points (Catmull-Rom), for lathe(). */
export function smoothProfile(ctrl: [number, number][], samples = 48): [number, number][] {
  const curve = new THREE.SplineCurve(ctrl.map(([x, y]) => new THREE.Vector2(x, y)));
  return curve.getPoints(samples).map((p) => [Math.max(0, p.x), p.y] as [number, number]);
}

export const cylinder = (rTop: number, rBottom: number, h: number, seg = 64) =>
  new THREE.CylinderGeometry(rTop, rBottom, h, seg);

/** A flat panel with a rectangular hole (a wall with a window). Returns ExtrudeGeometry in XY, depth along +Z. */
export function wallWithHole(
  w: number,
  h: number,
  hole: { x: number; y: number; w: number; h: number },
  depth = 0.12,
) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.lineTo(-w / 2, 0);
  const p = new THREE.Path();
  p.moveTo(hole.x, hole.y);
  p.lineTo(hole.x, hole.y + hole.h);
  p.lineTo(hole.x + hole.w, hole.y + hole.h);
  p.lineTo(hole.x + hole.w, hole.y);
  p.lineTo(hole.x, hole.y);
  s.holes.push(p);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}

/** Venetian blind slats: `count` thin boxes stacked vertically, tilted by `tiltDeg`. */
export function slatPositions(count: number, top: number, bottom: number) {
  return Array.from({ length: count }, (_, i) => top - ((top - bottom) * (i + 0.5)) / count);
}

/* ---- helpers added after the M4 blind test ---- */

/**
 * A round rod from point a to point b (glasses temples, cables between two points, legs, handles).
 * The returned geometry is already placed in world space: use it with position 0.
 */
export function rod(a: [number, number, number], b: [number, number, number], r = 0.002, seg = 16) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}

/** A flat ring / band with a rectangular cross-section (bezel, strap loop, lens rim). Axis = +y. */
export function ring(rOuter: number, rInner: number, depth: number, seg = 96) {
  const pts = [
    new THREE.Vector2(rInner, -depth / 2),
    new THREE.Vector2(rOuter, -depth / 2),
    new THREE.Vector2(rOuter, depth / 2),
    new THREE.Vector2(rInner, depth / 2),
    new THREE.Vector2(rInner, -depth / 2),
  ];
  const g = new THREE.LatheGeometry(pts, seg);
  g.computeVertexNormals();
  return g;
}

/** Torus (mug handle, round frame). R = ring radius, r = tube radius, arc in radians (2π = closed). Axis = +z. */
export const torus = (R: number, r: number, arc = Math.PI * 2, seg = 64) => new THREE.TorusGeometry(R, r, 16, seg, arc);

/**
 * A sheet bent along x (book page, paper, cloth): width w (x), depth d (z), lifted by `lift` metres
 * in the middle of each half like an open page. Returns a plane lying on y = 0 with UVs.
 */
export function bentSheet(w: number, d: number, lift = 0.01, segX = 48, segZ = 4) {
  const g = new THREE.PlaneGeometry(w, d, segX, segZ);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = Math.min(1, Math.max(0, p.getX(i) / w + 0.5)); // clamp: never NaN
    p.setY(i, lift * Math.sin(u * Math.PI));
  }
  g.computeVertexNormals();
  return g;
}

/** Rotate a y-axis shape (lathe, cylinder, ring) so its axis points along +z (towards the camera). */
export function faceZ<T extends THREE.BufferGeometry>(g: T): T {
  g.rotateX(Math.PI / 2);
  return g;
}
