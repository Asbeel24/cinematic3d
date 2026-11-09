#!/usr/bin/env node
// Package the skill into dist/cinematic-3d.zip (no node_modules, renders, review frames or dev docs).
// Unzip it into ~/.claude/skills/ and follow README.md → "从 zip 安装".
//   node scripts/pack.mjs [--out dist/cinematic-3d.zip]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { arg } from "./_lib.mjs";

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.resolve(skill, String(arg("out", "dist/cinematic-3d.zip")));
const PREFIX = "cinematic-3d/";
const LIMIT = 5 * 1024 * 1024;

// top-level entries that ship
const INCLUDE = ["SKILL.md", "README.md", "PROMPTS.md", "LICENSE", "references", "scripts", "starter", "examples"];
const SKIP_DIRS = new Set(["node_modules", "out", "review", "dist", ".git", ".remotion"]);
const SKIP_FILE = (f) => f.endsWith(".log") || f === ".DS_Store" || f.endsWith(".mp4") || f.endsWith(".mov");

const files = [];
const walk = (abs) => {
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    if (SKIP_DIRS.has(path.basename(abs))) return;
    for (const f of fs.readdirSync(abs).sort()) walk(path.join(abs, f));
  } else if (!SKIP_FILE(path.basename(abs))) files.push(abs);
};
for (const e of INCLUDE) if (fs.existsSync(path.join(skill, e))) walk(path.join(skill, e));

// --- minimal zip writer (deflate, no external tools) ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
// fixed timestamp so the zip is reproducible: 2026-01-01 00:00
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const chunks = [];
const central = [];
let offset = 0;
for (const abs of files) {
  const name = Buffer.from(PREFIX + path.relative(skill, abs).split(path.sep).join("/"), "utf8");
  const data = fs.readFileSync(abs);
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const store = deflated.length >= data.length;
  const body = store ? data : deflated;
  const crc = crc32(data);
  const exec = /\.(mjs|sh)$/.test(abs);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(store ? 0 : 8, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  chunks.push(local, name, body);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE((3 << 8) | 20, 4); // made by unix
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(store ? 0 : 8, 10);
  cen.writeUInt16LE(DOS_TIME, 12);
  cen.writeUInt16LE(DOS_DATE, 14);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(body.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(name.length, 28);
  cen.writeUInt32LE((((exec ? 0o100755 : 0o100644) << 16) >>> 0), 38);
  cen.writeUInt32LE(offset, 42);
  central.push(cen, name);
  offset += local.length + name.length + body.length;
}
const cenBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenBuf.length, 12);
end.writeUInt32LE(offset, 16);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([...chunks, cenBuf, end]));
const size = fs.statSync(out).size;
console.log(`${files.length} files → ${out}`);
console.log(`size ${(size / 1024 / 1024).toFixed(2)} MB (limit 5 MB) ${size <= LIMIT ? "PASS" : "FAIL"}`);
if (size > LIMIT) process.exit(1);
