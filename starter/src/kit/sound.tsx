import React from "react";
import { Audio, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";

/**
 * Sound effects synthesised by scripts/sfx.mjs (original, CC0), in public/sfx/.
 * Everything is placed by frame number, so audio is as deterministic as the picture.
 * Put these NEXT TO <Stage> (outside the 3D canvas), e.g. <><Stage>…</Stage><Sfx name="pop" at={24} /></>.
 */
export type SfxName = "thud" | "pop" | "boing" | "tick" | "whoosh" | "chime" | "wind" | "room";

/** One-shot effect starting at frame `at`. `pitch` 0.5–2 changes speed and pitch together. */
export const Sfx: React.FC<{ name: SfxName; at: number; volume?: number; pitch?: number }> = ({
  name,
  at,
  volume = 0.8,
  pitch = 1,
}) => (
  <Sequence from={Math.round(at)} layout="none" name={`sfx ${name}`}>
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} playbackRate={pitch} />
  </Sequence>
);

/** Looping ambience for the whole shot (wind, room tone) with fade in / out in frames. */
export const Bed: React.FC<{ name: SfxName; volume?: number; fadeIn?: number; fadeOut?: number }> = ({
  name,
  volume = 0.35,
  fadeIn = 12,
  fadeOut = 18,
}) => {
  const { durationInFrames: n } = useVideoConfig();
  return (
    <Audio
      src={staticFile(`sfx/${name}.wav`)}
      loop
      volume={(f) =>
        volume *
        interpolate(f, [0, Math.max(1, fadeIn), Math.max(fadeIn + 1, n - 1 - fadeOut), n - 1], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
};

/** Frames of `count` beats at `bpm`, starting at frame `offset` (for cutting motion to music). */
export const beats = (bpm: number, fps: number, count: number, offset = 0): number[] =>
  Array.from({ length: count }, (_, i) => Math.round(offset + (i * fps * 60) / bpm));
