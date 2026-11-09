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

export const fmtMs = (ms) => {
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)} min ${s % 60} s`;
};

export const LOOKS = ["golden-hour", "render-pass", "jelly-type", "fur", "turntable"];

/** Copy the reference Look scene into src/shot/Shot.tsx (the file Claude edits). */
export function materializeLook(root, look) {
  if (!LOOKS.includes(look)) throw new Error(`Unknown look "${look}". Choose one of: ${LOOKS.join(", ")}`);
  const dir = path.join(root, "src", "scenes", look);
  const file = fs.readdirSync(dir).find((f) => f.endsWith(".tsx"));
  let src = fs.readFileSync(path.join(dir, file), "utf8");
  src = src.replaceAll('"../../kit/', '"../kit/');
  const header = `// Shot file, started from the "${look}" Look (src/scenes/${look}/${file}).\n// Edit freely: this is the only scene file of this shot. Keep the default export.\n`;
  fs.mkdirSync(path.join(root, "src", "shot"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "shot", "Shot.tsx"), header + src);
}

/** Write src/shot.config.ts. */
export function writeShotConfig(root, { name, look, format, sec, fps, seed }) {
  fs.writeFileSync(
    path.join(root, "src", "shot.config.ts"),
    `// The current shot. scripts/new.mjs writes this file; Root.tsx registers src/shot/Shot.tsx
// as \`<name>-9x16\`, \`<name>-16x9\` and \`<name>-1x1\`. stills.mjs / render.mjs default to \`<name>-<format>\`.
export const shotConfig = {
  name: "${name}",
  /** the Look this shot was started from (${LOOKS.join(" | ")}) */
  look: "${look}",
  /** default format for stills/render: "9:16" | "16:9" | "1:1" */
  format: "${format}" as "9:16" | "16:9" | "1:1",
  sec: ${sec},
  fps: ${fps} as 24 | 30,
  /** master seed: add it to every rng()/noise seed in the shot so a re-roll is one edit */
  seed: ${seed},
};
`,
  );
}
