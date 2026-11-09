#!/usr/bin/env node
// Convert an OFL/Apache .woff/.ttf/.otf font into three.js typeface JSON (for TextGeometry / Text3D).
// Usage: node scripts/font2typeface.mjs <font.woff> <out.typeface.json> [--chars "ABC…"]
// Default char set: printable ASCII. Requires opentype.js (dev dependency of the starter).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [, , input, output] = process.argv;
if (!input || !output) {
  console.error("usage: font2typeface.mjs <font.woff|ttf|otf> <out.json> [--chars ...]");
  process.exit(1);
}
const ci = process.argv.indexOf("--chars");
const chars = ci > 0 ? process.argv[ci + 1] : Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
const require = createRequire(path.join(process.cwd(), "package.json"));
const opentype = require("opentype.js");
const buf = fs.readFileSync(input);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const scale = 1000 / font.unitsPerEm;
const r = (v) => Math.round(v * scale);
const glyphs = {};
for (const ch of chars) {
  const g = font.charToGlyph(ch);
  if (!g) continue;
  const p = g.getPath(0, 0, font.unitsPerEm);
  const o = [];
  // opentype paths are y-down; typeface JSON is y-up
  for (const c of p.commands) {
    if (c.type === "M") o.push("m", r(c.x), r(-c.y));
    else if (c.type === "L") o.push("l", r(c.x), r(-c.y));
    else if (c.type === "Q") o.push("q", r(c.x), r(-c.y), r(c.x1), r(-c.y1));
    else if (c.type === "C") o.push("b", r(c.x), r(-c.y), r(c.x1), r(-c.y1), r(c.x2), r(-c.y2));
  }
  const bb = g.getBoundingBox();
  glyphs[ch] = { ha: r(g.advanceWidth), x_min: r(bb.x1), x_max: r(bb.x2), o: o.join(" ") };
}
const json = {
  glyphs,
  familyName: font.names.fontFamily?.en ?? "font",
  ascender: r(font.ascender),
  descender: r(font.descender),
  underlinePosition: r(font.tables.post?.underlinePosition ?? -100),
  underlineThickness: r(font.tables.post?.underlineThickness ?? 50),
  boundingBox: { xMin: r(font.tables.head.xMin), yMin: r(font.tables.head.yMin), xMax: r(font.tables.head.xMax), yMax: r(font.tables.head.yMax) },
  resolution: 1000,
  original_font_information: { license: font.names.license?.en ?? "", copyright: font.names.copyright?.en ?? "" },
};
fs.writeFileSync(output, JSON.stringify(json));
console.log(`${Object.keys(glyphs).length} glyphs → ${output} (${(fs.statSync(output).size / 1024).toFixed(0)} KB)`);
