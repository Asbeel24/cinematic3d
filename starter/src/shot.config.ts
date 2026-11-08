// The current shot. new.mjs writes this file; Root.tsx registers it in all three formats.
export const shotConfig = {
  name: "golden-hour",
  look: "golden-hour" as const,
  /** default format for stills/render: "9:16" | "16:9" | "1:1" */
  format: "9:16" as "9:16" | "16:9" | "1:1",
  sec: 6,
  fps: 30 as 24 | 30,
  seed: 1,
};
