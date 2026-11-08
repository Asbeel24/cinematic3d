import * as THREE from "three";
import { rng } from "./motion";

/**
 * Material library. Every texture is generated procedurally on a Canvas
 * (no downloads). Results are cached by their arguments.
 */
const cache = new Map<string, THREE.Material | THREE.Texture>();
function memo<T extends THREE.Material | THREE.Texture>(key: string, make: () => T): T {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key) as T;
}

function canvas(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void, srgb = true) {
  const el = document.createElement("canvas");
  el.width = el.height = size;
  draw(el.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(el);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/* ---------------------------- textures ---------------------------- */

/** Fine value-noise grey texture (roughness / bump variation). */
export function noiseTexture(seed = 1, scale = 4, size = 512) {
  return memo(`noise:${seed}:${scale}:${size}`, () =>
    canvas(size, (c, s) => {
      const r = rng(seed);
      const img = c.createImageData(s, s);
      const g = scale;
      const grid = Array.from({ length: (g + 1) * (g + 1) }, () => r());
      const at = (x: number, y: number) => grid[(y % g) * (g + 1) + (x % g)];
      for (let y = 0; y < s; y++)
        for (let x = 0; x < s; x++) {
          const fx = (x / s) * g, fy = (y / s) * g;
          const ix = Math.floor(fx), iy = Math.floor(fy);
          const tx = fx - ix, ty = fy - iy;
          const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
          const v0 = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
          const v1 = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
          const v = (v0 + (v1 - v0) * sy) * 0.7 + r() * 0.3;
          const i = (y * s + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
          img.data[i + 3] = 255;
        }
      c.putImageData(img, 0, 0);
    }, false),
  );
}

/** Wood grain: long wavy stripes along U, colour from light to dark tone. */
export function woodTexture(seed = 2, light = "#a8774b", dark = "#5b371f") {
  return memo(`wood:${seed}:${light}:${dark}`, () =>
    canvas(1024, (c, s) => {
      const r = rng(seed);
      c.fillStyle = light;
      c.fillRect(0, 0, s, s);
      for (let i = 0; i < 220; i++) {
        const y0 = r() * s;
        const amp = 3 + r() * 14;
        const freq = 0.002 + r() * 0.006;
        const ph = r() * 10;
        c.strokeStyle = dark;
        c.globalAlpha = 0.04 + r() * 0.16;
        c.lineWidth = 0.6 + r() * 3.5;
        c.beginPath();
        for (let x = 0; x <= s; x += 8) {
          const y = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph * 2) * amp * 0.25;
          if (x === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
      }
      // a couple of knots / pores
      c.globalAlpha = 0.12;
      for (let i = 0; i < 1400; i++) {
        c.fillStyle = dark;
        c.fillRect(r() * s, r() * s, 1 + r() * 5, 1);
      }
      c.globalAlpha = 1;
    }),
  );
}

/** Concentric grooves for a vinyl record (used as roughness + colour modulation). */
export function grooveTexture() {
  return memo("grooves", () =>
    canvas(1024, (c, s) => {
      const r = rng(9);
      c.fillStyle = "#808080";
      c.fillRect(0, 0, s, s);
      const cx = s / 2;
      for (let rad = s * 0.17; rad < s * 0.495; rad += 1.6) {
        const v = 100 + r() * 70;
        c.strokeStyle = `rgb(${v},${v},${v})`;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(cx, cx, rad, 0, Math.PI * 2);
        c.stroke();
      }
      // track gaps
      c.strokeStyle = "#e0e0e0";
      c.lineWidth = 3;
      for (const k of [0.25, 0.31, 0.37, 0.43]) {
        c.beginPath();
        c.arc(cx, cx, s * k, 0, Math.PI * 2);
        c.stroke();
      }
    }, false),
  );
}

/* ---------------------------- materials --------------------------- */

/** Matte white model (render-pass "clay"). */
export const clay = (color = "#d9d6d0") =>
  memo(`clay:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 }));

export const chrome = (roughness = 0.08) =>
  memo(`chrome:${roughness}`, () => new THREE.MeshStandardMaterial({ color: "#e8e8ea", roughness, metalness: 1 }));

/** Brushed / satin metal. */
export const metal = (color = "#b9b6b0", roughness = 0.32) =>
  memo(`metal:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness: 1 }));

export const plastic = (color: string, roughness = 0.42) =>
  memo(`plastic:${color}:${roughness}`, () =>
    new THREE.MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
  );

export const glass = (tint = "#ffffff", roughness = 0.04) =>
  memo(`glass:${tint}:${roughness}`, () =>
    new THREE.MeshPhysicalMaterial({
      color: tint,
      roughness,
      metalness: 0,
      transmission: 1,
      thickness: 0.004,
      ior: 1.5,
      transparent: true,
      opacity: 1,
    }),
  );

/** Matte paper / card. */
export const paper = (color = "#e9e2d2") =>
  memo(`paper:${color}`, () =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, roughnessMap: noiseTexture(4, 64) }),
  );

/** Oiled wood with procedural grain. repeat = how many grain tiles across the surface. */
export const wood = (opts: { seed?: number; light?: string; dark?: string; repeat?: [number, number]; roughness?: number } = {}) =>
  memo(`wood:${JSON.stringify(opts)}`, () => {
    const map = woodTexture(opts.seed ?? 2, opts.light, opts.dark).clone();
    map.repeat.set(...(opts.repeat ?? [1, 1]));
    map.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({
      map,
      roughness: opts.roughness ?? 0.48,
      roughnessMap: noiseTexture(3, 16),
      clearcoat: 0.18,
      clearcoatRoughness: 0.35,
    });
  });

/** Painted plaster wall. */
export const plaster = (color = "#d8cbb8") =>
  memo(`plaster:${color}`, () => {
    const bump = noiseTexture(7, 48, 512);
    return new THREE.MeshStandardMaterial({ color, roughness: 0.95, bumpMap: bump, bumpScale: 0.6 });
  });

/** Glazed porcelain. */
export const porcelain = (color = "#f3f0ea") =>
  memo(`porcelain:${color}`, () =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0 }),
  );

/** Black vinyl with groove sheen. */
export const vinyl = () =>
  memo("vinyl", () =>
    new THREE.MeshPhysicalMaterial({
      color: "#0b0b0c",
      roughness: 0.32,
      roughnessMap: grooveTexture(),
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
    }),
  );

/** Liquid surface (tea, coffee): dark, glossy, slightly tinted. */
export const liquid = (color = "#6b3a12") =>
  memo(`liquid:${color}`, () =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0 }),
  );

/** Self-lit surface (sky outside a window, screens). intensity in linear units. */
export const emissive = (color: string, intensity = 1, map?: THREE.Texture) =>
  memo(`emissive:${color}:${intensity}:${map?.uuid ?? ""}`, () =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), map: map ?? null, toneMapped: false }),
  );

/** Vertical gradient texture (sky). stops: [pos 0..1 from top, css colour] */
export function gradientTexture(stops: [number, string][]) {
  return memo(`grad:${JSON.stringify(stops)}`, () =>
    canvas(256, (c, s) => {
      const g = c.createLinearGradient(0, 0, 0, s);
      for (const [p, col] of stops) g.addColorStop(p, col);
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    }),
  );
}

/** Plain canvas texture helper for labels / decals. */
export function drawTexture(key: string, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void) {
  return memo(`draw:${key}:${size}`, () => canvas(size, draw));
}
