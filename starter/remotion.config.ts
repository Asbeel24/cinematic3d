import { Config } from "@remotion/cli/config";

// GL backend: macOS/Windows default "angle"; Linux headless uses software "swangle"
// unless a GPU is available (set CINE_GL=angle-egl). doctor.mjs reports which works.
const gl = (process.env.CINE_GL ||
  (process.platform === "linux" ? "swangle" : "angle")) as
  | "angle"
  | "angle-egl"
  | "swangle"
  | "egl"
  | "swiftshader";
Config.setChromiumOpenGlRenderer(gl);
Config.setVideoImageFormat("png");
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(18);
Config.setConcurrency(1);
if (process.env.CINE_BROWSER) Config.setBrowserExecutable(process.env.CINE_BROWSER);
