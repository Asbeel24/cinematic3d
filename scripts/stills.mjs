#!/usr/bin/env node
// Render key frames → review/f<N>.png, a contact sheet review/contact.png (with 9:16 platform
// safe-zone guides) and exposure stats review/stats.json.
// Usage (inside a shot project): node <skill>/scripts/stills.mjs [--frames 0,25%,50%,75%,last] [--format 9:16] [--comp id]
import fs from "node:fs";
import path from "node:path";
import { arg, browserExecutable, bundleProject, fmtMs, formatId, glBackend, projectRoot, req, shotConfig } from "./_lib.mjs";
import { decodePNG, encodePNG, resize } from "./_png.mjs";

const root = projectRoot();
const cfg = shotConfig(root);
const format = arg("format", cfg.format);
const compId = arg("comp", `${cfg.name}-${formatId(format)}`);
const outDir = path.join(root, "review");
fs.mkdirSync(outDir, { recursive: true });

const t0 = Date.now();
const { renderStill, selectComposition, openBrowser } = await import(req(root).resolve("@remotion/renderer"));
const serveUrl = await bundleProject(root);
const chromiumOptions = { gl: glBackend() };
const browser = await openBrowser("chrome", { browserExecutable: browserExecutable(), chromiumOptions });
const comp = await selectComposition({ serveUrl, id: compId, puppeteerInstance: browser, chromiumOptions, browserExecutable: browserExecutable() });
const last = comp.durationInFrames - 1;
const frames = String(arg("frames", "0,25%,50%,75%,last"))
  .split(",")
  .map((s) => s.trim())
  .map((s) => (s === "last" ? last : s.endsWith("%") ? Math.round((parseFloat(s) / 100) * last) : parseInt(s, 10)))
  .filter((n) => Number.isFinite(n) && n >= 0 && n <= last);

const stats = { composition: compId, width: comp.width, height: comp.height, fps: comp.fps, durationInFrames: comp.durationInFrames, frames: [] };
const files = [];
const tiles = [];
for (const f of frames) {
  const file = path.join(outDir, `f${String(f).padStart(4, "0")}.png`);
  const ts = Date.now();
  await renderStill({ serveUrl, composition: comp, frame: f, output: file, puppeteerInstance: browser, chromiumOptions, overwrite: true });
  const ms = Date.now() - ts;
  // exposure stats from raw RGB
  const img = decodePNG(fs.readFileSync(file));
  const raw = img.data;
  tiles.push(resize(img, 720));
  let sum = 0, hi = 0, lo = 0;
  const n = raw.length / 3;
  for (let i = 0; i < raw.length; i += 3) {
    const y = 0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2];
    sum += y;
    if (y >= 250) hi++;
    if (y <= 4) lo++;
  }
  const s = { frame: f, file: path.relative(root, file), renderMs: ms, meanLuma: +(sum / n / 255).toFixed(4), clippedHighlights: +((hi / n) * 100).toFixed(3), crushedBlacks: +((lo / n) * 100).toFixed(3) };
  s.pass = s.clippedHighlights < 1 && s.crushedBlacks < 3;
  stats.frames.push(s);
  files.push(file);
  console.log(`frame ${f}: ${fmtMs(ms)}  mean ${s.meanLuma}  highlights ${s.clippedHighlights}%  blacks ${s.crushedBlacks}%  ${s.pass ? "PASS" : "CHECK"}`);
}
await browser.close({ silent: true });

// contact sheet: tiles 720 px tall side by side; 9:16 gets platform safe-zone guides
// (Xiaohongshu / Douyin UI: top bar ~8%, bottom caption + buttons ~22%, right action column ~14%)
const H = 720, GAP = 8;
const Wt = tiles.reduce((a, t) => a + t.width + GAP, -GAP);
const sheet = { width: Wt, height: H, data: new Uint8Array(Wt * H * 3) };
let ox = 0;
for (const t of tiles) {
  for (let y = 0; y < H; y++) sheet.data.set(t.data.subarray(y * t.width * 3, (y + 1) * t.width * 3), (y * Wt + ox) * 3);
  if (comp.height > comp.width) {
    const px = (x, y) => { const i = (y * Wt + ox + x) * 3; sheet.data[i] = 0; sheet.data[i + 1] = 230; sheet.data[i + 2] = 255; };
    const yTop = Math.round(H * 0.08), yBot = Math.round(H * 0.78), xR = Math.round(t.width * 0.86);
    for (let x = 0; x < t.width; x += 2) { px(x, yTop); px(x, yBot); }
    for (let y = yTop; y < yBot; y += 2) px(xR, y);
  }
  ox += t.width + GAP;
}
const contact = path.join(outDir, "contact.png");
fs.writeFileSync(contact, encodePNG(sheet));
stats.contact = path.relative(root, contact);
stats.pass = stats.frames.every((f) => f.pass);
stats.totalMs = Date.now() - t0;
fs.writeFileSync(path.join(outDir, "stats.json"), JSON.stringify(stats, null, 2));
console.log(`contact sheet: ${contact}\nstats: ${path.join(outDir, "stats.json")}\nexposure ${stats.pass ? "PASS" : "CHECK"} · total ${fmtMs(stats.totalMs)}`);
