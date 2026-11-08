// Shared helpers for cinematic-3d scripts. Run every script from inside a shot project
// (the folder that contains package.json + src/shot.config.ts).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

export function projectRoot(start = process.cwd()) {
  let d = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(d, "src", "shot.config.ts")) && fs.existsSync(path.join(d, "package.json"))) return d;
    const up = path.dirname(d);
    if (up === d) throw new Error("Not inside a cinematic-3d shot project (no src/shot.config.ts found). cd into the project first.");
    d = up;
  }
}

/** Reads the plain literal fields of src/shot.config.ts without a TS compiler. */
export function shotConfig(root) {
  const src = fs.readFileSync(path.join(root, "src", "shot.config.ts"), "utf8");
  const str = (k, def) => (src.match(new RegExp(`${k}:\\s*"([^"]+)"`)) || [])[1] ?? def;
  const num = (k, def) => Number((src.match(new RegExp(`${k}:\\s*([0-9.]+)`)) || [])[1] ?? def);
  const format = str("format", "9:16");
  return { name: str("name", "shot"), look: str("look", ""), format, sec: num("sec", 6), fps: num("fps", 30), seed: num("seed", 1) };
}

export const formatId = (f) => ({ "9:16": "9x16", "16:9": "16x9", "1:1": "1x1" })[f] ?? "9x16";

export function req(root) {
  return createRequire(path.join(root, "package.json"));
}

/** GL backend: CINE_GL env, else angle on mac/win, swangle on linux. */
export function glBackend() {
  return process.env.CINE_GL || (process.platform === "linux" ? "swangle" : "angle");
}

/** Optional browser override (offline machines): CINE_BROWSER=/path/to/chrome-headless-shell */
export function browserExecutable() {
  return process.env.CINE_BROWSER || null;
}

export function ffmpeg(root) {
  const r = req(root);
  let dir;
  try {
    const pkg = Object.keys(JSON.parse(fs.readFileSync(path.join(root, "node_modules", "@remotion", "renderer", "package.json"), "utf8")).optionalDependencies || {})
      .filter((n) => n.startsWith("@remotion/compositor-"))
      .map((n) => { try { return path.dirname(r.resolve(`${n}/package.json`)); } catch { return null; } })
      .filter((d) => d && fs.existsSync(path.join(d, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg")));
    dir = pkg[0];
  } catch {}
  if (!dir) return { bin: "ffmpeg", env: process.env };
  const env = { ...process.env, LD_LIBRARY_PATH: `${dir}:${process.env.LD_LIBRARY_PATH ?? ""}`, DYLD_LIBRARY_PATH: `${dir}:${process.env.DYLD_LIBRARY_PATH ?? ""}` };
  return { bin: path.join(dir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"), env };
}

export function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { encoding: opts.encoding ?? "utf8", maxBuffer: 1 << 30, ...opts });
  if (r.status !== 0) throw new Error(`${path.basename(bin)} failed: ${r.stderr?.toString().slice(-2000)}`);
  return r;
}

export async function bundleProject(root) {
  const { bundle } = await import(req(root).resolve("@remotion/bundler"));
  return bundle({ entryPoint: path.join(root, "src", "index.ts"), onProgress: () => {} });
}

export function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
}

export const fmtMs = (ms) => (ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} min ${((ms % 60000) / 1000).toFixed(0)} s`);
