import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

/**
 * cinematic-3d promo, 9:16, 30 fps, 120 BPM (one beat = 15 frames).
 * Every frame is a pure function of useCurrentFrame(); all footage is the skill's own milestone renders.
 */
export const FPS = 30;
export const DURATION = 555;

const ZH = '"Noto Sans SC", sans-serif';
const EN = '"Inter", sans-serif';
const ACCENT = "#ffb43a";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** A clip that fills 9:16 (1:1 sources are cover-cropped), with an optional punch-in zoom. */
const Clip: React.FC<{
  src: string;
  from?: number; // source frame to start at
  len: number;
  zoom?: [number, number];
  origin?: string;
  rate?: number;
}> = ({ src, from = 0, len, zoom = [1, 1], origin = "50% 50%", rate = 1 }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, len], zoom, { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={from}
        playbackRate={rate}
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${s})`,
          transformOrigin: origin,
        }}
      />
    </AbsoluteFill>
  );
};

/** White flash that decays over n frames. */
const Flash: React.FC<{ n?: number; color?: string; peak?: number }> = ({ n = 5, color = "#fff", peak = 0.9 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, n], [peak, 0], clamp);
  return <AbsoluteFill style={{ backgroundColor: color, opacity: o, mixBlendMode: "screen" }} />;
};

/** Big slam text: appears at full size on frame 0 (no fade — hooks don't fade), settles from 1.18× to 1×. */
const Slam: React.FC<{ children: React.ReactNode; size?: number; y?: number; color?: string; sub?: string; strike?: boolean }> = ({
  children,
  size = 150,
  y = 50,
  color = "#fff",
  sub,
  strike,
}) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 6], [1.18, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const shake = f < 4 ? Math.sin(f * 9.1) * (4 - f) * 3 : 0;
  const strikeW = interpolate(f, [4, 10], [0, 100], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: `${y}%`,
          transform: `translate(${shake}px, -50%) scale(${s})`,
          textAlign: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "inline-block",
            position: "relative",
            fontFamily: ZH,
            fontWeight: 900,
            fontSize: size,
            lineHeight: 1.1,
            color,
            letterSpacing: "-0.02em",
            textShadow: "0 6px 40px rgba(0,0,0,.55)",
          }}
        >
          {children}
          {strike && (
            <div
              style={{
                position: "absolute",
                left: "-4%",
                top: "52%",
                height: size * 0.09,
                width: `${strikeW * 1.08}%`,
                background: ACCENT,
                boxShadow: "0 0 30px rgba(255,180,58,.8)",
              }}
            />
          )}
        </div>
        {sub && (
          <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 34, letterSpacing: "0.32em", color: "rgba(255,255,255,.8)", marginTop: 18 }}>
            {sub}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** Feature label: big Chinese word + small English tag, wipes in from the left. */
const Label: React.FC<{ zh: string; en: string; len: number; note?: string; dark?: boolean }> = ({ zh, en, len, note, dark }) => {
  const f = useCurrentFrame();
  const inP = interpolate(f, [0, 7], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const out = interpolate(f, [len - 4, len], [1, 0], clamp);
  const ink = dark ? "#1a1612" : "#fff";
  return (
    <AbsoluteFill style={{ padding: "0 90px", justifyContent: "flex-end", paddingBottom: 300, opacity: out }}>
      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            transform: `translateY(${(1 - inP) * 110}%)`,
            fontFamily: ZH,
            fontWeight: 900,
            fontSize: 190,
            lineHeight: 1,
            color: ink,
            textShadow: dark ? "none" : "0 4px 30px rgba(0,0,0,.45)",
          }}
        >
          {zh}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 22, opacity: inP }}>
        <div style={{ width: 70 * inP, height: 6, background: ACCENT }} />
        <div style={{ fontFamily: EN, fontWeight: 700, fontSize: 38, letterSpacing: "0.3em", color: ink }}>{en}</div>
      </div>
      {note && (
        <div style={{ fontFamily: ZH, fontWeight: 500, fontSize: 36, color: ink, opacity: 0.8 * inP, marginTop: 18 }}>{note}</div>
      )}
    </AbsoluteFill>
  );
};

/** Terminal card where the one-line prompt gets typed. */
const PROMPT = "毛绒耳机，逆光，85mm 微距推近";
const Terminal: React.FC = () => {
  const f = useCurrentFrame();
  const typed = Math.max(0, Math.min(PROMPT.length, Math.floor((f - 8) / 2)));
  const cursor = Math.floor(f / 8) % 2 === 0;
  const enter = f >= 46;
  const pop = interpolate(f, [0, 8], [0.9, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const press = enter ? interpolate(f, [46, 49, 54], [1, 0.96, 1], clamp) : 1;
  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 80% at 50% 40%, #2a2118 0%, #0b0907 70%)", justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: 900,
          borderRadius: 28,
          background: "rgba(18,16,14,.92)",
          border: "2px solid rgba(255,255,255,.12)",
          boxShadow: "0 40px 120px rgba(0,0,0,.6), 0 0 80px rgba(255,180,58,.12)",
          transform: `scale(${pop * press})`,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", gap: 14, padding: "26px 30px", borderBottom: "2px solid rgba(255,255,255,.08)" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 22, height: 22, borderRadius: 11, background: c }} />
          ))}
          <div style={{ fontFamily: EN, fontSize: 24, color: "rgba(255,255,255,.45)", marginLeft: 16 }}>claude</div>
        </div>
        <div style={{ padding: "44px 46px 56px", fontFamily: ZH, fontSize: 50, lineHeight: 1.45, color: "#f3ece2" }}>
          <div style={{ fontFamily: EN, fontWeight: 600, color: ACCENT, fontSize: 44 }}>› /cinematic-3d</div>
          <div style={{ minHeight: 145 }}>
            {PROMPT.slice(0, typed)}
            <span style={{ opacity: cursor || typed < PROMPT.length ? 1 : 0, color: ACCENT }}>▍</span>
          </div>
          <div style={{ fontFamily: EN, fontSize: 30, color: "rgba(255,255,255,.4)", opacity: enter ? 1 : 0 }}>⏎ rendering…</div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 330, width: "100%", textAlign: "center", fontFamily: ZH, fontWeight: 900, fontSize: 64, color: "#fff" }}>
        只要一句话
      </div>
    </AbsoluteFill>
  );
};

/** Persistent frame chrome: corner tag + progress hairline + vignette + grain. */
const Chrome: React.FC = () => {
  const f = useCurrentFrame();
  const seed = (f * 7919) % 1000;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(130% 90% at 50% 50%, transparent 55%, rgba(0,0,0,.45) 100%)" }} />
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.09, mixBlendMode: "overlay" }}>
        <filter id="g">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} />
        </filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
      <div style={{ position: "absolute", left: 0, top: 0, height: 6, width: `${(f / DURATION) * 100}%`, background: ACCENT }} />
    </AbsoluteFill>
  );
};

/** Hook rapid-fire: one clip per 8th note-ish. */
const RAPID: { src: string; from: number }[] = [
  { src: "golden-hour-9x16.mp4", from: 100 },
  { src: "turntable-9x16.mp4", from: 120 },
  { src: "b29-earmuffs-9x16.mp4", from: 80 },
  { src: "b14-radio-9x16.mp4", from: 90 },
  { src: "b27-furball-1x1.mp4", from: 60 },
  { src: "aura-speaker-9x16.mp4", from: 120 },
  { src: "render-pass-9x16.mp4", from: 120 },
];

const End: React.FC = () => {
  const f = useCurrentFrame();
  const t1 = interpolate(f, [40, 50], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const t2 = interpolate(f, [52, 62], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const t3 = interpolate(f, [62, 72], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Clip src="jelly-3d.mp4" from={10} len={105} />
      <AbsoluteFill style={{ alignItems: "center" }}>
        <div style={{ position: "absolute", top: 360, textAlign: "center", width: "100%" }}>
          <div style={{ fontFamily: EN, fontWeight: 800, fontSize: 104, letterSpacing: "-0.03em", color: "#2b1d16", opacity: t1, transform: `translateY(${(1 - t1) * 40}px)` }}>
            cinematic-3d
          </div>
          <div style={{ fontFamily: ZH, fontWeight: 700, fontSize: 52, color: "#2b1d16", marginTop: 18, opacity: t2, transform: `translateY(${(1 - t2) * 30}px)` }}>
            一句话 → 一条电影感 3D 镜头
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 260, textAlign: "center", width: "100%", opacity: t3 }}>
          <div style={{ display: "inline-block", padding: "18px 40px", borderRadius: 60, background: "#2b1d16", color: "#fff6ea", fontFamily: EN, fontWeight: 700, fontSize: 34, letterSpacing: "0.12em" }}>
            CLAUDE CODE SKILL
          </div>
          <div style={{ fontFamily: EN, fontWeight: 600, fontSize: 28, color: "rgba(43,29,22,.7)", marginTop: 22, letterSpacing: "0.2em" }}>
            REMOTION × THREE.JS
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Feature sequence table (absolute frames). */
const FEATURES: { at: number; len: number; src: string; from: number; zh: string; en: string; note?: string; zoom?: [number, number]; dark?: boolean }[] = [
  { at: 210, len: 45, src: "golden-hour-9x16.mp4", from: 20, zh: "光影", en: "LIGHT", note: "百叶影 · 体积光 · 浮尘", zoom: [1.12, 1] },
  { at: 255, len: 30, src: "b25-furphones-9x16.mp4", from: 60, zh: "毛发", en: "FUR", zoom: [1.15, 1.02] },
  { at: 285, len: 30, src: "turntable-9x16.mp4", from: 60, zh: "反射", en: "REFLECTION", zoom: [1.12, 1] },
  { at: 315, len: 30, src: "b09-perfume-1x1.mp4", from: 40, zh: "玻璃", en: "GLASS", zoom: [1.1, 1] },
  { at: 345, len: 30, src: "b29-earmuffs-9x16.mp4", from: 60, zh: "柔光", en: "SOFT LIGHT", zoom: [1.12, 1], dark: true },
  { at: 375, len: 30, src: "jelly-type-9x16.mp4", from: 30, zh: "弹性", en: "SQUASH", zoom: [1.45, 1.4], dark: true },
];

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* ---------- HOOK 0–90 ---------- */}
      <Sequence durationInFrames={15}>
        <Clip src="fur-9x16.mp4" from={90} len={15} zoom={[1.45, 1.25]} origin="55% 45%" />
        <Slam strike y={46} size={124}>这不是 Blender</Slam>
      </Sequence>
      <Sequence from={15} durationInFrames={15}>
        <Clip src="b09-perfume-1x1.mp4" from={70} len={15} zoom={[1.35, 1.2]} />
        <Flash n={4} />
        <Slam strike y={46} size={124}>也不是 AI 视频</Slam>
      </Sequence>
      {RAPID.map((r, i) => {
        const at = 30 + Math.round(i * 6.43);
        const len = 30 + Math.round((i + 1) * 6.43) - at;
        return (
          <Sequence key={r.src} from={at} durationInFrames={len}>
            <Clip src={r.src} from={r.from} len={len} zoom={[1.25, 1.08]} />
            <Flash n={3} peak={0.5} />
          </Sequence>
        );
      })}
      <Sequence from={75} durationInFrames={15}>
        <AbsoluteFill style={{ background: "#0b0907" }} />
        <Slam size={170} sub="IT'S CODE.">是代码</Slam>
        <Flash n={5} color={ACCENT} peak={0.6} />
      </Sequence>

      {/* ---------- PROMPT 90–150 ---------- */}
      <Sequence from={90} durationInFrames={60}>
        <Terminal />
      </Sequence>

      {/* ---------- RESULT 150–210 ---------- */}
      <Sequence from={150} durationInFrames={60}>
        <Clip src="fur-9x16.mp4" from={0} len={60} rate={1.5} zoom={[1.06, 1]} />
        <Flash n={8} />
        <Label zh="出片" en="6 SEC · 1080×1920" len={60} note="逆光毛边 · 85mm 浅景深" />
      </Sequence>

      {/* ---------- FEATURES 210–405 ---------- */}
      {FEATURES.map((s) => (
        <Sequence key={s.zh} from={s.at} durationInFrames={s.len}>
          <Clip src={s.src} from={s.from} len={s.len} zoom={s.zoom} />
          <Flash n={4} peak={0.45} />
          <Label zh={s.zh} en={s.en} len={s.len} note={s.note} dark={s.dark} />
        </Sequence>
      ))}

      {/* ---------- REAL 3D 405–450 ---------- */}
      <Sequence from={405} durationInFrames={45}>
        <Clip src="render-pass-9x16.mp4" from={60} len={45} zoom={[1.08, 1]} />
        <Flash n={4} peak={0.45} />
        <Label zh="真 3D" en="BEAUTY · CLAY · WIRE" len={45} note="每一帧都由代码算出" />
      </Sequence>

      {/* ---------- END 450–555 ---------- */}
      <Sequence from={450} durationInFrames={105}>
        <End />
        <Flash n={6} />
      </Sequence>

      <Chrome />
      <Audio src={staticFile("promo-audio.wav")} />
    </AbsoluteFill>
  );
};
