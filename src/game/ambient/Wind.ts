import * as THREE from 'three';

/**
 * Foliage wind (docs/ENVIRONMENT_DESIGN.md §4.3). A single shared time uniform
 * drives a small vertex sway injected into any material via `apply()`. Higher
 * geometry (taller verts) sways more, so trunks stay planted while tips move.
 *
 * Cheap: one uniform, a few extra vertex-shader lines, no per-frame CPU work
 * beyond advancing the clock. Works on InstancedMesh — the sway is applied in
 * local space before the instance matrix, and phase varies by world XZ so a
 * whole field doesn't sway in lockstep.
 */
export class Wind {
  /** Shared uniform object referenced by every patched material. */
  private readonly uniform = { value: 0 };

  /**
   * Patch a material so its meshes sway. Call once per material at build time.
   * `strength` scales the sway (metres at the top of a 1 m-tall prop).
   */
  apply(material: THREE.Material, strength = 0.12): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = this.uniform;
      shader.uniforms.uWindStrength = { value: strength };

      shader.vertexShader =
        'uniform float uWindTime;\nuniform float uWindStrength;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           {
             // World XZ of this instance/vertex origin → per-prop phase.
             #ifdef USE_INSTANCING
               vec3 wpos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
             #else
               vec3 wpos = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
             #endif
             float phase = wpos.x * 0.3 + wpos.z * 0.3;
             // Sway grows with local height so the base stays planted.
             float h = max(transformed.y, 0.0);
             float swayX = sin(uWindTime * 1.6 + phase) * uWindStrength * h;
             float swayZ = cos(uWindTime * 1.3 + phase * 1.7) * uWindStrength * 0.6 * h;
             transformed.x += swayX;
             transformed.z += swayZ;
           }`,
        );
    };
    material.needsUpdate = true;
  }

  /** Advance the wind clock. Call once per frame with dt seconds. */
  update(dt: number): void {
    this.uniform.value += dt;
  }
}
