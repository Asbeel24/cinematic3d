import * as THREE from "three";
import { BlendFunction, BloomEffect, Effect } from "postprocessing";

/**
 * Film grain, luminance-weighted, seeded by frame number (deterministic, never "stuck").
 * Applied after tone mapping, in display space.
 */
const grainFrag = /* glsl */ `
uniform float uSeed;
uniform float uAmount;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 px = floor(uv * resolution);
  // two octaves of hash → roughly gaussian
  float n = (h12(px + uSeed * 17.13) + h12(px * 1.37 + uSeed * 3.71) - 1.0);
  float l = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float w = uAmount * 0.16 * (1.0 - l * 0.7) * (0.35 + l * 2.0);
  outputColor = vec4(max(inputColor.rgb + n * w, 0.0), inputColor.a);
}`;

export class GrainEffect extends Effect {
  constructor(amount = 0.35) {
    super("GrainEffect", grainFrag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uSeed", new THREE.Uniform(0)],
        ["uAmount", new THREE.Uniform(amount)],
      ]),
    });
  }
  setFrame(frame: number) {
    (this.uniforms.get("uSeed") as THREE.Uniform).value = (frame % 997) + 1;
  }
}

/** Linear exposure multiplier (before halation/bloom/ACES). */
export class ExposureEffect extends Effect {
  constructor(exposure = 1) {
    super(
      "ExposureEffect",
      `uniform float uExposure;
       void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
         outputColor = vec4(inputColor.rgb * uExposure, inputColor.a);
       }`,
      { uniforms: new Map<string, THREE.Uniform>([["uExposure", new THREE.Uniform(exposure)]]) },
    );
  }
}

/**
 * Halation: film-base reflection around highlights.
 * highlight threshold → wide mip blur → red-orange tint → added back, before ACES.
 * Built on BloomEffect's threshold + mipmap blur, with a tinted composite shader.
 */
export class HalationEffect extends BloomEffect {
  constructor({ intensity = 0.3, threshold = 1.0, tint = [1.0, 0.32, 0.12] as [number, number, number] } = {}) {
    super({
      blendFunction: BlendFunction.ADD,
      luminanceThreshold: threshold,
      luminanceSmoothing: 0.3,
      mipmapBlur: true,
      intensity,
      radius: 0.55,
      levels: 6,
    });
    this.uniforms.set("uTint", new THREE.Uniform(new THREE.Vector3(...tint)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).setFragmentShader(`
#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D map;
#else
uniform lowp sampler2D map;
#endif
uniform float intensity;
uniform vec3 uTint;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 h = texture2D(map, uv).rgb;
  float l = dot(h, vec3(0.2126, 0.7152, 0.0722));
  outputColor = vec4(uTint * l * intensity, 1.0);
}`);
  }
}
