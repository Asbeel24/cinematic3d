#!/usr/bin/env node
// Synthesises the bundled sound effects into starter/public/sfx/*.wav.
// Everything is generated from code (seeded noise + oscillators), so the sounds are original
// and released under CC0 1.0 together with this script. Re-running gives byte-identical files.
//
// usage: node scripts/sfx.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? path.join(here, "..", "starter", "public", "sfx");
const SR = 44100;

const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** one-pole low-pass over a buffer, cutoff in Hz (may be a function of time) */
const lowpass = (buf, cutoff) => {
  let y = 0;
  return buf.map((x, i) => {
    const fc = typeof cutoff === "function" ? cutoff(i / SR) : cutoff;
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    y += a * (x - y);
    return y;
  });
};

const noise = (sec, seed) => {
  const r = mulberry32(seed);
  return Float64Array.from({ length: Math.round(sec * SR) }, () => r() * 2 - 1);
};

/** sine with a pitch curve f(t), amplitude env(t) */
const tone = (sec, f, env) => {
  const out = new Float64Array(Math.round(sec * SR));
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f(t)) / SR;
    out[i] = Math.sin(ph) * env(t);
  }
  return out;
};

const mix = (...bufs) => {
  const n = bufs.reduce((a, b) => Math.max(a, b.length), 0);
  const out = new Float64Array(n);
  for (const b of bufs) for (let i = 0; i < b.length; i++) out[i] += b[i];
  return out;
};
const gain = (buf, g) => buf.map((x, i) => x * (typeof g === "function" ? g(i / SR) : g));
const fadeEdges = (buf, ms = 4) => {
  const n = Math.round((ms / 1000) * SR);
  return buf.map((x, i) => x * Math.min(1, i / n, (buf.length - 1 - i) / n));
};
const normalize = (buf, peak = 0.89) => {
  const m = buf.reduce((a, x) => Math.max(a, Math.abs(x)), 0) || 1;
  return buf.map((x) => (x / m) * peak);
};

const SOUNDS = {
  // soft low impact: a heavy object set down
  thud: () =>
    mix(
      tone(0.45, (t) => 46 + 60 * Math.exp(-t * 30), (t) => Math.exp(-t * 11)),
      gain(lowpass(noise(0.08, 11), 900), (t) => Math.exp(-t * 60) * 0.5),
    ),
  // jelly landing: short wet pop with a pitch drop
  pop: () =>
    mix(
      tone(0.18, (t) => 260 + 520 * Math.exp(-t * 45), (t) => Math.exp(-t * 26)),
      gain(lowpass(noise(0.03, 7), 3000), (t) => Math.exp(-t * 200) * 0.35),
    ),
  // springy wobble
  boing: () => tone(0.6, (t) => 180 * (1 + 0.18 * Math.exp(-t * 5) * Math.sin(2 * Math.PI * 14 * t)) * (1 + 0.6 * Math.exp(-t * 18)), (t) => Math.exp(-t * 6) * Math.min(1, t * 400)),
  // clock / UI tick
  tick: () => mix(gain(noise(0.03, 3), (t) => Math.exp(-t * 400)), tone(0.03, () => 3200, (t) => Math.exp(-t * 300) * 0.4)),
  // air whoosh for a camera move or a reveal (1 s, peak at 0.55 s)
  whoosh: () => gain(lowpass(noise(1.0, 5), (t) => 300 + 2600 * Math.sin(Math.PI * t) ** 2), (t) => Math.sin(Math.PI * Math.min(1, t / 1.0)) ** 3),
  // soft bell for a title or brand reveal
  chime: () =>
    mix(
      tone(1.6, () => 880, (t) => Math.exp(-t * 2.6) * Math.min(1, t * 300)),
      tone(1.6, () => 1320, (t) => Math.exp(-t * 3.4) * 0.5 * Math.min(1, t * 300)),
      tone(1.6, () => 2217, (t) => Math.exp(-t * 6) * 0.25 * Math.min(1, t * 300)),
    ),
  // 4 s ambient wind bed, seamless enough to loop (fur, winter, outdoors)
  wind: () => {
    const sec = 4;
    const base = lowpass(noise(sec, 21), (t) => 380 + 260 * Math.sin(2 * Math.PI * t / sec) ** 2);
    return gain(base, (t) => 0.55 + 0.45 * Math.sin(2 * Math.PI * t / sec + 1.2) ** 2);
  },
  // quiet room tone (window / desk scenes)
  room: () => lowpass(lowpass(noise(4, 31), 220), 400),
};

const writeWav = (file, buf) => {
  const data = Buffer.alloc(buf.length * 2);
  buf.forEach((x, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
};

fs.mkdirSync(outDir, { recursive: true });
const peaks = { room: 0.35, wind: 0.6 };
for (const [name, make] of Object.entries(SOUNDS)) {
  const buf = fadeEdges(normalize(make(), peaks[name] ?? 0.89));
  const file = path.join(outDir, `${name}.wav`);
  writeWav(file, buf);
  console.log(`${name.padEnd(7)} ${(buf.length / SR).toFixed(2)} s  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}
fs.writeFileSync(
  path.join(outDir, "LICENSE.txt"),
  "These sound effects were synthesised from code by scripts/sfx.mjs (no samples or recordings).\n" +
    "They are dedicated to the public domain under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/\n",
);
