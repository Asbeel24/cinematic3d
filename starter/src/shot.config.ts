// The current shot. scripts/new.mjs writes this file; Root.tsx registers src/shot/Shot.tsx
// as `<name>-9x16`, `<name>-16x9` and `<name>-1x1`. stills.mjs / render.mjs default to `<name>-<format>`.
export const shotConfig = {
  name: "my-shot",
  /** the Look this shot was started from (golden-hour | render-pass | jelly-type | fur | turntable) */
  look: "golden-hour",
  /** default format for stills/render: "9:16" | "16:9" | "1:1" */
  format: "9:16" as "9:16" | "16:9" | "1:1",
  sec: 6,
  fps: 30 as 24 | 30,
  /** master seed: add it to every rng()/noise seed in the shot so a re-roll is one edit */
  seed: 1,
};
