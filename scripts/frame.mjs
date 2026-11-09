#!/usr/bin/env node
// Grab one frame from a rendered video so you can Read it.
// usage: node <skill>/scripts/frame.mjs out/<comp>.mp4 [seconds=middle]  → out/<comp>-<sec>s.png
import { spawnSync } from "node:child_process";
import path from "node:path";
import { ffmpeg, projectRoot, run } from "./_lib.mjs";

const file = process.argv[2];
if (!file) {
  console.error("usage: frame.mjs <video> [seconds]");
  process.exit(1);
}
const root = projectRoot();
const { bin, env } = ffmpeg(root);
let sec = process.argv[3];
if (sec === undefined) {
  const probe = spawnSync(bin, ["-i", file], { env, encoding: "utf8" }).stderr ?? ""; // ffmpeg -i alone exits 1
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe);
  sec = m ? String(((+m[1] * 60 + +m[2]) * 60 + +m[3]) / 2) : "0";
}
const out = file.replace(/\.(mp4|mov)$/i, "") + `-${Number(sec)}s.png`;
run(bin, ["-y", "-ss", String(sec), "-i", file, "-frames:v", "1", out], { env });
console.log(`frame: ${path.resolve(out)}`);
