import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONTS } from "./fonts";
import { ease, progress } from "./motion";

/**
 * DOM overlay: captions and titles drawn over the 3D frame (crisp text, no 3D font needed).
 * Place it NEXT TO <Stage>, inside an <AbsoluteFill>:
 *
 *   <AbsoluteFill>
 *     <Stage>…</Stage>
 *     <Caption text="Golden hour, Shenzhen" from={30} to={150} />
 *   </AbsoluteFill>
 *
 * Positions respect the 9:16 platform safe zone (top 8 %, bottom 22 %, right 14 %).
 */
export const SAFE = { top: 0.08, bottom: 0.22, right: 0.14, left: 0.06 };

type Fade = { from: number; to: number; fade?: number };

/** 0..1 opacity: eased fade in after `from`, fade out before `to`. */
export function fadeAt(t: number, { from, to, fade = 12 }: Fade) {
  return Math.min(progress(t, from, from + fade, ease.out), 1 - progress(t, to - fade, to, ease.in));
}

export type CaptionProps = Fade & {
  text: string;
  /** "bottom" sits just above the platform caption zone; "top" just below the status bar */
  place?: "bottom" | "top" | "center";
  size?: number; // px at 1080 wide
  color?: string;
  /** dark pill behind the text for legibility on bright frames */
  pill?: boolean;
  font?: keyof typeof FONTS;
  weight?: number;
  /** extra letter spacing in em */
  tracking?: number;
};

export const Caption: React.FC<CaptionProps> = ({
  text,
  from,
  to,
  fade = 12,
  place = "bottom",
  size = 44,
  color = "#f4efe6",
  pill = false,
  font = "ui",
  weight = 600,
  tracking = 0.02,
}) => {
  const t = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const k = fadeAt(t, { from, to, fade });
  if (k <= 0) return null;
  const s = width / 1080;
  const portrait = height > width;
  const pos: React.CSSProperties =
    place === "top"
      ? { top: height * (portrait ? SAFE.top + 0.03 : 0.08) }
      : place === "center"
        ? { top: height / 2, transform: "translateY(-50%)" }
        : { bottom: height * (portrait ? SAFE.bottom + 0.02 : 0.1) };
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: width * SAFE.left,
          right: width * (portrait ? SAFE.right : SAFE.left),
          display: "flex",
          justifyContent: "center",
          ...pos,
        }}
      >
        <div
          style={{
            fontFamily: FONTS[font],
            fontWeight: weight,
            fontSize: size * s,
            letterSpacing: `${tracking}em`,
            lineHeight: 1.25,
            color,
            textAlign: "center",
            opacity: k,
            transform: `translateY(${(1 - k) * 14 * s}px)`,
            padding: pill ? `${10 * s}px ${22 * s}px` : 0,
            borderRadius: 999,
            background: pill ? "rgba(16,14,12,0.55)" : "transparent",
            textShadow: pill ? "none" : `0 ${2 * s}px ${12 * s}px rgba(0,0,0,0.35)`,
            whiteSpace: "pre-wrap",
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Large title card (two lines: title + small kicker), centred, fades in and out. */
export const Title: React.FC<Fade & { title: string; kicker?: string; color?: string; font?: keyof typeof FONTS }> = ({
  title,
  kicker,
  color = "#f4efe6",
  font = "ui",
  ...f
}) => (
  <>
    <Caption text={title} place="center" size={96} weight={700} tracking={-0.01} color={color} font={font} {...f} />
    {kicker ? (
      <AbsoluteFill style={{ transform: "translateY(7%)" }}>
        <Caption text={kicker.toUpperCase()} place="center" size={30} weight={600} tracking={0.18} color={color} {...f} />
      </AbsoluteFill>
    ) : null}
  </>
);
