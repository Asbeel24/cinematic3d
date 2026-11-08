import * as THREE from "three";
import { BlendFunction, Effect } from "postprocessing";

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
