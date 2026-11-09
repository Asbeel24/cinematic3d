import React, { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Open-licensed fonts shipped in public/fonts (OFL 1.1, see the *-OFL.txt files).
 * Canvas textures and DOM overlays use these families by name.
 */
export const FONTS = {
  ui: "Inter",
  round: "Fredoka",
} as const;

const faces: { family: string; file: string; weight: string }[] = [
  { family: "Inter", file: "inter-latin-400-normal.woff2", weight: "400" },
  { family: "Inter", file: "inter-latin-600-normal.woff2", weight: "600" },
  { family: "Inter", file: "inter-latin-700-normal.woff2", weight: "700" },
  { family: "Fredoka", file: "fredoka-latin-600-normal.woff2", weight: "600" },
];

let loading: Promise<void> | null = null;
function loadAll() {
  if (!loading) {
    loading = Promise.all(
      faces.map(async (f) => {
        const ff = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format("woff2")`, { weight: f.weight });
        await ff.load();
        document.fonts.add(ff);
      }),
    ).then(() => undefined);
  }
  return loading;
}

/** Renders children only after the fonts are ready (canvas textures need them at draw time). */
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    loadAll()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        setReady(true);
        continueRender(handle);
      });
  }, [handle]);
  return ready ? <>{children}</> : null;
};
