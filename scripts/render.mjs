#!/usr/bin/env node
// Proxy or final render of the current shot.
//   node <skill>/scripts/render.mjs --proxy            0.5× resolution, no motion blur → out/<name>-proxy.mp4
//   node <skill>/scripts/render.mjs --final [--prores] full resolution H.264 CRF 18 (or ProRes 4444) → out/<name>.mp4/.mov
// Optional: --format 9:16|16:9|1:1  --comp <id>
import fs from "node:fs";
import path from "node:path";
import { arg, browserExecutable, bundleProject, fmtMs, formatId, glBackend, projectRoot, req, shotConfig } from "./_lib.mjs";

const root = projectRoot();
const cfg = shotConfig(root);
const proxy = Boolean(arg("proxy", false));
const prores = Boolean(arg("prores", false));
if (!proxy && !arg("final", false)) {
  console.error("Choose --proxy or --final");
  process.exit(1);
}
const format = arg("format", cfg.format);
const compId = arg("comp", `${cfg.name}-${formatId(format)}`);
const outDir = path.join(root, "out");
fs.mkdirSync(outDir, { recursive: true });
const ext = prores ? "mov" : "mp4";
const out = path.join(outDir, `${compId}${proxy ? "-proxy" : ""}.${ext}`);

const t0 = Date.now();
const { renderMedia, selectComposition, openBrowser } = await import(req(root).resolve("@remotion/renderer"));
const serveUrl = await bundleProject(root);
const chromiumOptions = { gl: glBackend() };
const inputProps = { proxy };
const browser = await openBrowser("chrome", { browserExecutable: browserExecutable(), chromiumOptions });
const composition = await selectComposition({ serveUrl, id: compId, inputProps, puppeteerInstance: browser, chromiumOptions });
const tRender = Date.now();
let last = -1;
await renderMedia({
  serveUrl,
  composition,
  inputProps,
  outputLocation: out,
  puppeteerInstance: browser,
  chromiumOptions,
  concurrency: 1,
  scale: proxy ? 0.5 : 1,
  imageFormat: "png",
  ...(prores
    ? { codec: "prores", proResProfile: "4444", pixelFormat: "yuva444p10le" }
    : { codec: "h264", crf: proxy ? 23 : 18, pixelFormat: "yuv420p" }),
  onProgress: ({ renderedFrames }) => {
    const pct = Math.floor((renderedFrames / composition.durationInFrames) * 10);
    if (pct !== last) {
      last = pct;
      process.stdout.write(`rendered ${renderedFrames}/${composition.durationInFrames}\n`);
    }
  },
});
await browser.close({ silent: true });
const ms = Date.now() - t0;
const renderMs = Date.now() - tRender;
const size = fs.statSync(out).size;
const report = {
  output: path.relative(root, out),
  mode: proxy ? "proxy" : "final",
  composition: compId,
  size: `${composition.width * (proxy ? 0.5 : 1)}x${composition.height * (proxy ? 0.5 : 1)}`,
  fps: composition.fps,
  frames: composition.durationInFrames,
  seconds: composition.durationInFrames / composition.fps,
  totalTime: fmtMs(ms),
  renderTime: fmtMs(renderMs),
  perFrame: `${(renderMs / composition.durationInFrames / 1000).toFixed(2)} s`,
  fileSize: `${(size / 1e6).toFixed(1)} MB`,
  gl: glBackend(),
};
fs.writeFileSync(path.join(outDir, `${compId}${proxy ? "-proxy" : ""}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
