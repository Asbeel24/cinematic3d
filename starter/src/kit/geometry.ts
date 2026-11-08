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
