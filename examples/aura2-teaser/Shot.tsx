// AURA 2 teaser: one continuous 15 s shot on a single studio set.
// Started from the turntable Look / aura-speaker example. Beats:
//   0–1.5 s  darkness, only the speaker's light ring breathes on
//   1.5–5 s  studio light rises (whoosh), product turning, camera orbiting
//   5–11 s   one pulse per second: ring flares, body thumps, a sound-wave ring runs across the floor
//   12 s     brand comes round to the front, big flare (chime)
//   12.4–15 s title "AURA 2" + "COMING SOON · 12.12"
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Fog, Stage, useTimeline } from "../kit/stage";
import { shot, useShot } from "../kit/camera";
import { Bounce, KeyLight, SkyFill, StudioEnv } from "../kit/lights";
import { ease, progress, rng } from "../kit/motion";
import { drawTexture, metal, noiseTexture, plastic } from "../kit/materials";
import { FONTS } from "../kit/fonts";
import { cylinder, ring } from "../kit/geometry";
import { Caption } from "../kit/overlay";
import { Sfx, Bed } from "../kit/sound";
import { shotConfig } from "../shot.config";

export const TEASER = {
  /** editable */
  brand: "AURA",
  title: "AURA 2",
  kicker: "COMING SOON · 12.12",
  bodyColor: "#d9d4cc",
  capColor: "#b8b4ae",
  brandColor: "#22201e",
  /** light ring colour (linear RGB, >1 glows) */
  glow: [0.55, 0.85, 1.6] as [number, number, number],
  keyTemp: 4300,
  background: "#1d1b1a",
  /** frames */
  lightsUp: [45, 150] as [number, number],
  pulses: [150, 180, 210, 240, 270, 300, 330],
  drop: 360,
  titleIn: 372,
  /** do not edit */
  plinthR: 0.17,
  plinthH: 0.05,
};
const T = TEASER;

/* ----------------------------- product ----------------------------- */

/** Cylindrical speaker, r 0.065 m, 0.21 m tall, origin at bottom centre, brand facing +z. */
const SP = { R: 0.065, H: 0.2, base: 0.008, cap: 0.012 };

/** 0..1 envelope of the pulse that fired most recently before t. */
const pulseAt = (t: number) => {
  let v = 0;
  for (const p of T.pulses) {
    const a = t - p;
    if (a >= 0 && a < 24) v = Math.max(v, Math.exp(-a / 6));
  }
  const d = t - T.drop;
  if (d >= 0) v = Math.max(v, 1.6 * Math.exp(-d / 14));
  return v;
};

const Speaker: React.FC<{ glowMat: THREE.MeshBasicMaterial }> = ({ glowMat }) => {
  const { R, H, base, cap } = SP;
  const grille = useMemo(() => {
    const ratio = (2 * Math.PI * R) / H; // circumference / height, ~2
    const tex = drawTexture(`aura2-grille-${T.brand}-${T.bodyColor}-${shotConfig.seed}`, 1024, (c, s) => {
      c.fillStyle = T.bodyColor;
      c.fillRect(0, 0, s, s);
      c.save();
      c.scale(1 / ratio, 1);
      const vw = s * ratio;
      // coarse knit rows (big enough to survive filtering)
      c.fillStyle = "rgba(40,36,32,0.18)";
      for (let y = 0; y < s; y += s * 0.03) c.fillRect(0, y, vw, s * 0.012);
      // brand centred at u = 0.5 (front, see thetaStart below)
      c.fillStyle = T.brandColor;
      c.textBaseline = "middle";
      c.textAlign = "center";
      c.font = `700 ${Math.round(s * 0.13)}px ${FONTS.ui}`;
      const letters = T.brand.split("");
      const track = s * 0.05;
      const widths = letters.map((l) => c.measureText(l).width);
      const total = widths.reduce((a, b) => a + b, 0) + track * (letters.length - 1);
      c.fillStyle = T.bodyColor;
      c.fillRect(vw / 2 - total / 2 - s * 0.04, s * 0.42, total + s * 0.08, s * 0.16);
      c.fillStyle = T.brandColor;
      let x = vw / 2 - total / 2;
      letters.forEach((l, i) => {
        c.fillText(l, x + widths[i] / 2, s * 0.5);
        x += widths[i] + track;
      });
      c.restore();
    });
    tex.anisotropy = 8;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, bumpMap: noiseTexture(41 + shotConfig.seed, 160), bumpScale: 0.12 });
  }, [R, H]);
  const capMat = metal(T.capColor, 0.3);
  const rubber = plastic("#1b1a19", 0.7);
  const bodyH = H - base - cap;
  return (
    <group>
      <mesh geometry={cylinder(R - 0.004, R - 0.006, base, 48)} material={rubber} position={[0, base / 2, 0]} castShadow receiveShadow />
      {/* fabric body; thetaStart = π puts u = 0.5 at +z */}
      <mesh position={[0, base + bodyH / 2, 0]} material={grille} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, bodyH, 64, 1, true, Math.PI, Math.PI * 2]} />
      </mesh>
      <mesh geometry={cylinder(R, R, cap, 64)} material={capMat} position={[0, base + bodyH + cap / 2, 0]} castShadow receiveShadow />
      {/* light ring inset in the top cap */}
      <mesh geometry={ring(R * 0.8, R * 0.68, 0.002, 64)} material={glowMat} position={[0, H + 0.0004, 0]} />
      <mesh geometry={cylinder(R * 0.66, R * 0.66, 0.001, 48)} material={plastic("#2a2826", 0.5)} position={[0, H + 0.0006, 0]} />
    </group>
  );
};

const stone = () => {
  const map = drawTexture("aura2-plinth", 512, (c, s) => {
    c.fillStyle = "#3b3936";
    c.fillRect(0, 0, s, s);
    const r = rng(17);
    for (let i = 0; i < 500; i++) {
      c.fillStyle = ["#8c8780", "#5a5650", "#b9a68a"][Math.floor(r() * 3)];
      c.globalAlpha = 0.4 + r() * 0.5;
      c.fillRect(r() * s, r() * s, 2 + r() * 4, 2 + r() * 3);
    }
    c.globalAlpha = 1;
  });
  map.repeat.set(3, 0.4);
  return new THREE.MeshStandardMaterial({ map, roughness: 0.7 });
};

const Product: React.FC<{ glowMat: THREE.MeshBasicMaterial }> = ({ glowMat }) => {
  const turn = useRef<THREE.Group>(null!);
  const stoneMat = useMemo(stone, []);
  useTimeline((t) => {
    // brand travels from the back (-180°) to the front, arriving just before the drop, then a soft settle
    const k = progress(t, 0, T.drop, ease.inOut);
    turn.current.rotation.y = THREE.MathUtils.degToRad(-180 + 200 * k);
    // thump: a tiny squash on every pulse
    const p = pulseAt(t);
    turn.current.scale.set(1 + 0.012 * p, 1 - 0.02 * p, 1 + 0.012 * p);
  });
  return (
    <group>
      <mesh geometry={cylinder(T.plinthR, T.plinthR, T.plinthH, 96)} material={stoneMat} position={[0, T.plinthH / 2, 0]} castShadow receiveShadow />
      <group ref={turn} position={[0, T.plinthH, 0]}>
        <Speaker glowMat={glowMat} />
      </group>
    </group>
  );
};

/** Sound-wave rings that run across the floor on every pulse. */
const Waves: React.FC = () => {
  const beats = [...T.pulses, T.drop];
  const refs = useRef<THREE.Mesh[]>([]);
  const geo = useMemo(() => new THREE.RingGeometry(0.985, 1, 128).rotateX(-Math.PI / 2), []);
  const mats = useMemo(
    () =>
      beats.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(...T.glow),
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useTimeline((t) => {
    beats.forEach((b, i) => {
      const m = refs.current[i];
      if (!m) return;
      const life = i === beats.length - 1 ? 60 : 45;
      const a = (t - b) / life;
      const on = a >= 0 && a < 1;
      m.visible = on;
      if (!on) return;
      const r = T.plinthR + 0.01 + 1.4 * ease.out(a);
      m.scale.setScalar(r);
      mats[i].opacity = (1 - a) * (i === beats.length - 1 ? 1 : 0.7);
    });
  });
  return (
    <group position={[0, 0.0015, 0]}>
      {beats.map((b, i) => (
        <mesh key={b} ref={(el) => { if (el) refs.current[i] = el; }} geometry={geo} material={mats[i]} visible={false} />
      ))}
    </group>
  );
};

const Floor: React.FC<{ glowMat: THREE.MeshBasicMaterial }> = ({ glowMat }) => {
  const fade = useMemo(
    () =>
      drawTexture(`aura2-floor-fade`, 512, (c, s) => {
        const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.55, "rgba(255,255,255,0.75)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, s, s);
      }),
    [],
  );
  const floorMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#151413", roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, transparent: true, opacity: 0.94, alphaMap: fade }),
    [fade],
  );
  return (
    <group>
      <group scale={[1, -1, 1]}>
        <Product glowMat={glowMat} />
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.0005, 0]} material={floorMat} receiveShadow>
        <circleGeometry args={[3, 96]} />
      </mesh>
    </group>
  );
};

const Glow: React.FC<{ mat: THREE.MeshBasicMaterial }> = ({ mat }) => {
  useTimeline((t) => {
    // breathe on in the dark, then flare with each pulse
    const on = progress(t, 10, 60, ease.inOut);
    const breath = 0.85 + 0.15 * Math.sin((t / 30) * Math.PI);
    const k = on * breath * (0.7 + 1.6 * pulseAt(t));
    mat.color.setRGB(T.glow[0] * k, T.glow[1] * k, T.glow[2] * k);
  }, -5);
  return null;
};

const Camera: React.FC = () => {
  useShot({
    lens: 50,
    frame: { center: [0, 0.14, 0], size: [0.34, 0.28, 0.34], fill: 0.46, elevation: 12, azimuth: -20 },
    move: shot.orbit(40, { ease: ease.inOut }),
    drift: { px: 3, seed: 9 + shotConfig.seed },
    focus: { point: [0, 0.16, SP.R], aperture: 4 },
  });
  return null;
};

/** Fade from black: the room starts nearly dark so the light ring reads first. */
const Blackout: React.FC = () => {
  const f = useCurrentFrame();
  const o = 0.9 * (1 - progress(f, 20, 120, ease.inOut));
  return o > 0 ? <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 38%, rgba(0,0,0,${o * 0.55}) 0%, rgba(0,0,0,${o}) 22%)` }} /> : null;
};

export const Teaser: React.FC<{ durationInFrames: number }> = () => {
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0), toneMapped: false }), []);
  const keyUp = (t: number) => progress(t, T.lightsUp[0], T.lightsUp[1], ease.inOut);
  return (
    <AbsoluteFill>
      <Stage background={T.background} film={{ dof: true, bloom: 0.3, halation: 0.15, grain: 0.25, vignette: 0.32, exposure: 1.0 }}>
        <Camera />
        <Glow mat={glowMat} />
        <Fog color={T.background} near={1.6} far={4.0} />
        <KeyLight
          kind="softbox"
          temp={T.keyTemp}
          intensity={6.5}
          position={[-1.2, 1.8, 1.0]}
          target={[0, 0.12, 0]}
          angle={28}
          shadowRadius={10}
          animate={(t) => ({ intensity: 0.05 + 6.45 * keyUp(t) })}
        />
        <Bounce from="wall" temp={7500} intensity={0.5} position={[1.5, 0.4, 0.8]} />
        <SkyFill temp={8500} groundTemp={4000} intensity={0.22} />
        <StudioEnv intensity={0.4} rotationY={0.6} />
        <Product glowMat={glowMat} />
        <Waves />
        <Floor glowMat={glowMat} />
      </Stage>
      <Blackout />
      <Caption text={T.title} place="top" size={110} weight={700} tracking={0.02} from={T.titleIn} to={460} fade={14} />
      <Caption text={T.kicker} place="bottom" size={34} weight={600} tracking={0.2} from={T.titleIn + 12} to={460} fade={14} />
      <Bed name="room" volume={0.25} />
      <Sfx name="whoosh" at={T.lightsUp[0] + 30 - 17} volume={0.6} />
      {T.pulses.map((p, i) => (
        <Sfx key={p} name="thud" at={p} volume={0.55 + i * 0.05} pitch={0.8 + i * 0.03} />
      ))}
      <Sfx name="whoosh" at={T.drop - 17} volume={0.7} pitch={0.8} />
      <Sfx name="thud" at={T.drop} volume={0.95} pitch={0.7} />
      <Sfx name="chime" at={T.titleIn} volume={0.6} />
    </AbsoluteFill>
  );
};

export default Teaser;
