#!/usr/bin/env node
// Environment self-check. Run inside a shot project (or the skill's starter/).
//   node <skill>/scripts/doctor.mjs
// Works anywhere: outside a shot project it checks <skill>/starter.
// Prints one line per check: PASS / WARN / FAIL + how to fix. Exit code 1 if anything FAILs.
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browserExecutable, bundleProject, fmtMs, glBackend, projectRoot, req } from "./_lib.mjs";
import { decodePNG } from "./_png.mjs";

const rows = [];
const add = (status, name, detail, fix = "") => {
  rows.push({ status, name, detail, fix });
  console.log(`${status.padEnd(4)}  ${name.padEnd(14)} ${detail}${fix && status !== "PASS" ? `\n      → ${fix}` : ""}`);
};

// 1. Node
const major = Number(process.versions.node.split(".")[0]);
if (major >= 20) add("PASS", "node", process.versions.node);
else if (major >= 18) add("WARN", "node", `${process.versions.node} (works, 20 LTS recommended)`, "install Node 20 LTS from nodejs.org or `brew install node@20`");
else add("FAIL", "node", process.versions.node, "Node ≥ 18 required; install Node 20 LTS");

// 2. project + deps
let root;
try {
  root = projectRoot();
  add("PASS", "project", root);
} catch {
  // not inside a shot project: check the skill's own starter instead
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "starter");
  add("PASS", "project", `${root} (not inside a shot project, checking the skill's starter)`);
}
let remotionVersion = null;
try {
  const ver = (p) => JSON.parse(fs.readFileSync(path.join(root, "node_modules", p, "package.json"), "utf8")).version;
  remotionVersion = ver("remotion");
  const three = ver("three");
  for (const p of ["@remotion/renderer", "@remotion/bundler", "@remotion/three", "@react-three/fiber", "postprocessing"]) ver(p);
  add("PASS", "deps", `remotion ${remotionVersion}, three ${three}`);
} catch {
  add("FAIL", "deps", `node_modules missing or incomplete in ${root}`, "run `npm install` in <skill>/starter (shot projects link to it)");
  finish();
}

// 3. disk
try {
  const st = fs.statfsSync(root);
  const gb = (st.bavail * st.bsize) / 1e9;
  if (gb >= 2) add("PASS", "disk", `${gb.toFixed(1)} GB free`);
  else if (gb >= 1) add("WARN", "disk", `${gb.toFixed(1)} GB free`, "a 6 s final render needs ~0.5 GB of temp frames; free some space");
  else add("FAIL", "disk", `${gb.toFixed(2)} GB free`, "free at least 1 GB");
} catch {
  add("WARN", "disk", "could not read free space");
}

// 4. fonts (bundled OFL fonts, needed for canvas text and overlays)
const fontDir = path.join(root, "public", "fonts");
const fonts = fs.existsSync(fontDir) ? fs.readdirSync(fontDir).filter((f) => f.endsWith(".woff2")) : [];
if (fonts.length >= 4) add("PASS", "fonts", fonts.join(", "));
else add("FAIL", "fonts", `found ${fonts.length} woff2 in public/fonts`, "re-copy starter/public/fonts from the skill");

// 4b. a system CJK font (Chinese captions / labels fall back to it; macOS and Windows always have one)
if (process.platform === "linux") {
  let cjk = "";
  try { cjk = execSync("fc-list :lang=zh family", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n")[0] || ""; } catch {}
  if (cjk) add("PASS", "cjk font", cjk);
  else add("WARN", "cjk font", "no Chinese font found (only matters for Chinese text)", "install one: `sudo apt install fonts-noto-cjk` (or fonts-wqy-zenhei)");
}

// 5. browser + GL + one-frame test render + determinism
const gl = glBackend();
const { renderStill, selectComposition, openBrowser, ensureBrowser } = await import(req(root).resolve("@remotion/renderer"));
let browser;
try {
  if (!browserExecutable()) await ensureBrowser();
  browser = await openBrowser("chrome", { browserExecutable: browserExecutable(), chromiumOptions: { gl } });
  add("PASS", "chrome", browserExecutable() ?? "Remotion chrome-headless-shell");
} catch (e) {
  add(
    "FAIL",
    "chrome",
    String(e.message).split("\n")[0],
    "Remotion downloads Chrome Headless Shell on first run and needs internet once. Offline: set CINE_BROWSER=/path/to/chrome-headless-shell",
  );
  finish();
}
try {
  const t0 = Date.now();
  const serveUrl = await bundleProject(root);
  const tb = Date.now() - t0;
  const chromiumOptions = { gl };
  const comp = await selectComposition({ serveUrl, id: "test-cube", puppeteerInstance: browser, chromiumOptions });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cine-doctor-"));
  const shots = [];
  let ms = 0;
  for (const i of [0, 1]) {
    const out = path.join(tmp, `t${i}.png`);
    const t = Date.now();
    await renderStill({ serveUrl, composition: comp, frame: 12, output: out, puppeteerInstance: browser, chromiumOptions, overwrite: true });
    ms = Date.now() - t;
    shots.push(decodePNG(fs.readFileSync(out)));
  }
  const [a, b] = shots;
  let diff = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) diff++;
  let mean = 0;
  for (let i = 0; i < a.data.length; i++) mean += a.data[i];
  mean /= a.data.length * 255;
  add("PASS", "gl", `${gl} (set CINE_GL to override)`);
  add(mean > 0.02 ? "PASS" : "FAIL", "test render", `540² cube, 4 sub-frames: ${fmtMs(ms)} (bundle ${fmtMs(tb)}), mean ${mean.toFixed(3)}`, "a black frame means WebGL failed: try CINE_GL=angle (mac), swangle (linux, no GPU) or angle-egl (linux GPU)");
  add(diff === 0 ? "PASS" : "FAIL", "determinism", diff === 0 ? "same frame twice → 0 bytes differ" : `${diff} bytes differ`, "something animates outside useTimeline or uses Math.random / Date.now; see references/troubleshooting.md");
  // rough estimate for a 1080×1920 shot: ~7× the pixels of the test frame
  const est = (ms / 4) * 7;
  add(est < 20000 ? "PASS" : "WARN", "speed", `≈ ${fmtMs(est)} per 1080×1920 frame without motion blur (estimate)`, "slow GL backend: on a Mac use the default (angle); on Linux without GPU expect 3–6 s/frame");
  fs.rmSync(tmp, { recursive: true, force: true });
} catch (e) {
  add("FAIL", "test render", String(e.message).split("\n")[0], "see references/troubleshooting.md → render errors");
}
await browser?.close({ silent: true });
finish();

function finish() {
  const fails = rows.filter((r) => r.status === "FAIL").length;
  const warns = rows.filter((r) => r.status === "WARN").length;
  console.log(`\n${fails ? "FAIL" : "PASS"} · ${rows.length} checks, ${fails} failed, ${warns} warnings`);
  process.exit(fails ? 1 : 0);
}
