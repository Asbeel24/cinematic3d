#!/usr/bin/env node
// Create a new shot project from the starter.
//   node <skill>/scripts/new.mjs <name> --look golden-hour --format 9:16 --sec 6 [--fps 30] [--seed 1] [--install]
//   node <skill>/scripts/new.mjs <name> --example perfume     (start from a finished shot in <skill>/examples/)
// Creates ./<name>/ with src/shot.config.ts and src/shot/Shot.tsx (a copy of the chosen Look).
// Dependencies: if <skill>/starter/node_modules exists it is linked (fast, no download);
// pass --install to run a fresh `npm install` in the new project instead.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { LOOKS, arg, materializeLook, writeShotConfig } from "./_lib.mjs";

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const starter = path.join(skill, "starter");
const name = process.argv[2];
if (!name || name.startsWith("--") || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error(`Usage: node scripts/new.mjs <name> --look <${LOOKS.join("|")}> --format 9:16|16:9|1:1 --sec 6\n(name: lowercase letters, digits, dashes)`);
  process.exit(1);
}
const exampleName = arg("example", false);
let example = null;
if (exampleName) {
  const dir = path.join(skill, "examples", String(exampleName));
  if (!fs.existsSync(path.join(dir, "example.json"))) {
    const list = fs.readdirSync(path.join(skill, "examples")).filter((d) => fs.existsSync(path.join(skill, "examples", d, "example.json")));
    console.error(`no example "${exampleName}". Available: ${list.join(", ")}`);
    process.exit(1);
  }
  example = { dir, ...JSON.parse(fs.readFileSync(path.join(dir, "example.json"), "utf8")) };
}
const look = String(arg("look", example?.look ?? "golden-hour"));
const format = String(arg("format", example?.format ?? "9:16"));
const sec = Number(arg("sec", example?.sec ?? 6));
const fps = Number(arg("fps", example?.fps ?? 30));
const seed = Number(arg("seed", example?.seed ?? 1));
if (!LOOKS.includes(look)) fail(`--look must be one of ${LOOKS.join(", ")}`);
if (!["9:16", "16:9", "1:1"].includes(format)) fail("--format must be 9:16, 16:9 or 1:1");
if (!(sec > 0 && sec <= 30)) fail("--sec must be between 0 and 30");
if (![24, 30].includes(fps)) fail("--fps must be 24 or 30");

const dest = path.resolve(process.cwd(), name);
if (fs.existsSync(dest)) fail(`${dest} already exists`);

const SKIP = new Set(["node_modules", "out", "review"]);
fs.cpSync(starter, dest, {
  recursive: true,
  filter: (src) => {
    const rel = path.relative(starter, src);
    const top = rel.split(path.sep)[0];
    return !SKIP.has(top) && !rel.endsWith(".log");
  },
});
writeShotConfig(dest, { name, look, format, sec, fps, seed });
materializeLook(dest, look);
if (example) fs.copyFileSync(path.join(example.dir, "Shot.tsx"), path.join(dest, "src", "shot", "Shot.tsx"));

const shared = path.join(starter, "node_modules");
if (!arg("install", false) && fs.existsSync(shared)) {
  fs.symlinkSync(shared, path.join(dest, "node_modules"), "dir");
  console.log("deps: linked starter/node_modules");
} else {
  console.log("deps: npm install (1–3 min)…");
  const r = spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: dest, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) fail("npm install failed");
}

const id = `${name}-${{ "9:16": "9x16", "16:9": "16x9", "1:1": "1x1" }[format]}`;
console.log(`
created ${dest}
  look      ${look}
  format    ${format} · ${sec}s @ ${fps}fps · seed ${seed}
  edit      src/shot/Shot.tsx   (config object at the top = editable fields)
  next      cd ${dest} && node ${path.join(skill, "scripts", "stills.mjs")}
  comp id   ${id}`);

function fail(msg) {
  console.error(`new.mjs: ${msg}`);
  process.exit(1);
}
