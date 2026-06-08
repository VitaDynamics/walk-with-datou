import * as THREE from 'three';

/**
 * Hover highlight for a named feature's mesh: a gentle emissive glow + a slight
 * scale-up, both eased so it feels soft rather than snappy. Only one feature is
 * highlighted at a time (the one under the cursor).
 *
 * Important: props share materials (e.g. one `MAT.wood` is used by the bench,
 * bridge, signposts…). Tinting a shared material would light up every prop that
 * uses it. So on hover-enter we **clone** the target sub-tree's materials (cheap
 * — one feature, only when the hover changes) and tint the clones; on clear we
 * swap the originals back, leaving the shared materials untouched.
 */
export class Highlighter {
  private current: THREE.Object3D | null = null;
  /** Eases 0→1 while a target is set, driving glow + scale strength. */
  private strength = 0;
  /** Per-touched-mesh: its original (shared) material and our tintable clone. */
  private readonly swapped: Array<{
    mesh: THREE.Mesh;
    original: THREE.Material | THREE.Material[];
    clones: THREE.MeshStandardMaterial[];
  }> = [];
  /** The current object's authored base (uniform) scale, to scale relative to. */
  private baseScale = 1;

  private static readonly GLOW = 0.4; // peak lerp toward warm white
  private static readonly SCALE = 0.06; // peak scale-up (+6%)
  private static readonly EASE = 10; // per-second approach rate

  /** Set the feature mesh to highlight (null = none). */
  setTarget(obj: THREE.Object3D | null): void {
    if (obj === this.current) return;
    this.clear();
    this.current = obj;
    if (!obj) return;

    this.strength = 0;
    this.baseScale = obj.scale.x || 1;
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const original = mesh.material;
      const arr = Array.isArray(original) ? original : [original];
      const clones: THREE.MeshStandardMaterial[] = [];
      const cloned = arr.map((m) => {
        const c = m.clone() as THREE.Material;
        if (c instanceof THREE.MeshStandardMaterial) clones.push(c);
        return c;
      });
      mesh.material = Array.isArray(original) ? cloned : cloned[0];
      this.swapped.push({ mesh, original, clones });
    });
  }

  /** Advance the ease and apply the glow + scale to the current target. */
  update(dt: number): void {
    if (!this.current) return;
    this.strength += (1 - this.strength) * Math.min(1, dt * Highlighter.EASE);

    this.current.scale.setScalar(this.baseScale * (1 + Highlighter.SCALE * this.strength));

    const lift = Highlighter.GLOW * this.strength;
    for (const s of this.swapped) {
      for (const c of s.clones) c.emissive.copy(c.color).lerp(WARM, 0.5).multiplyScalar(lift);
    }
  }

  /** Drop the highlight: restore original shared materials + base scale, and
   *  dispose the clones. */
  clear(): void {
    for (const s of this.swapped) {
      s.mesh.material = s.original;
      for (const c of s.clones) c.dispose();
    }
    this.swapped.length = 0;
    if (this.current) this.current.scale.setScalar(this.baseScale);
    this.current = null;
    this.strength = 0;
  }
}

const WARM = new THREE.Color(0xffe9b0);
