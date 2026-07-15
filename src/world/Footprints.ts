/**
 * Footprints — faint ink prints pressed into the ground behind the walkers, that
 * fade over ~18 s into a soft desire-path where you tread most. This is the
 * "permanence" lever from the playability research (juice: leaving persistent
 * traces makes actions feel consequential) and the cozy "visible progress in the
 * world" pillar — your history becomes legible in the place itself, with no HUD.
 *
 * A fixed pool of decal quads on one InstancedMesh (the codebase's own idiom).
 * Each footfall claims the next slot; a print eases in, holds, then shrinks away
 * over its lifetime so old prints recede rather than pop. Ink only, low alpha —
 * stays inside the DESIGN_BASELINE (warm, quiet, minimal).
 */

import * as THREE from 'three';
import { INK } from '../art/palette';

const POOL = 96; // enough for two walkers' recent trail; oldest recycles
const LIFE = 16; // seconds a print takes to fade fully
const PRINT = 0.2; // metre size of one print quad — a discrete dab, not a smear
const Y = 0.011; // just above the floor, under props/decals

/**
 * A small warm-ink footprint dab — a soft oval with a firmer core, so it reads
 * as a pressed print rather than a fuzzy blob. Warm ink (INK.line), never green.
 * One draw at boot; reused by every instance.
 */
function printTexture(): THREE.CanvasTexture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, INK.line); // warm charcoal core
  grad.addColorStop(0.45, INK.line);
  grad.addColorStop(0.75, 'rgba(58,55,47,0.35)');
  grad.addColorStop(1, 'rgba(58,55,47,0)'); // INK.line → transparent
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(s / 2, s / 2, s * 0.26, s * 0.36, 0, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Per-slot pose so each frame can recompose with an eased, shrinking scale. */
interface Print {
  x: number;
  z: number;
  yaw: number;
  base: number; // full-strength scale for this print (human vs Datou)
  age: number; // seconds since stamped; Infinity = free slot
}

export class Footprints {
  readonly mesh: THREE.InstancedMesh;
  private readonly prints: Print[] = [];
  private next = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly pos = new THREE.Vector3();
  private readonly scl = new THREE.Vector3();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  /** Alternate left/right lateral offset so prints stagger like real steps. */
  private side = false;
  /** Per-walker last-stamp position, so prints stay one stride apart. */
  private readonly last = new Map<string, { x: number; z: number }>();

  constructor() {
    for (let i = 0; i < POOL; i++) {
      this.prints.push({ x: 0, z: 0, yaw: 0, base: 0, age: Infinity });
    }
    const geo = new THREE.PlaneGeometry(PRINT, PRINT);
    const mat = new THREE.MeshBasicMaterial({
      map: printTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.5, // present but calm — legible without shouting
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, POOL);
    // Instances carry full world-space matrices (each print laid flat itself), so
    // the mesh stays at the identity frame — no nested-rotation bookkeeping.
    this.mesh.renderOrder = 0.7; // above floor/shadows, below billboards
    this.mesh.frustumCulled = false;
    for (let i = 0; i < POOL; i++) this.mesh.setMatrixAt(i, this.hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Minimum travel between prints for a given walker (metres) — one stride, so
   *  prints read as discrete dabs rather than a continuous smear. */
  private readonly STRIDE = 0.62;

  /**
   * Lay a print for walker `key` at (x,z) heading `yaw`, but only once the walker
   * has moved a stride since its last print — keeps the trail discrete. `scale`
   * lets Datou's prints be smaller than the human's.
   */
  trail(key: string, x: number, z: number, yaw: number, scale = 1): void {
    const prev = this.last.get(key);
    if (prev && Math.hypot(x - prev.x, z - prev.z) < this.STRIDE * scale) return;
    this.last.set(key, { x, z });
    this.stamp(x, z, yaw, scale);
  }

  /**
   * Drop a print at world (x,z) facing the heading `yaw` (radians; the direction
   * of travel). `scale` lets Datou's prints be smaller than the human's.
   */
  stamp(x: number, z: number, yaw: number, scale = 1): void {
    const i = this.next;
    this.next = (this.next + 1) % POOL;
    this.side = !this.side;
    // Offset laterally (perpendicular to heading) so left/right prints stagger.
    const off = (this.side ? 0.12 : -0.12) * scale;
    const p = this.prints[i];
    p.x = x + Math.cos(yaw) * off;
    p.z = z - Math.sin(yaw) * off;
    p.yaw = yaw;
    p.base = scale;
    p.age = 0;
    this.writeSlot(i, p, this.envelope(0) * scale);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Life envelope: quick ease-in, long hold, gentle shrink-out. 0..1. */
  private envelope(age: number): number {
    const t = age / LIFE;
    if (t >= 1) return 0;
    const inK = Math.min(1, age / 0.25); // ~quarter-second ease-in
    const outK = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4; // shrink over the last 40%
    return inK * outK;
  }

  private writeSlot(i: number, p: Print, size: number): void {
    if (size <= 0) {
      this.mesh.setMatrixAt(i, this.hidden);
      return;
    }
    this.e.set(-Math.PI / 2, p.yaw, 0, 'YXZ'); // flat, then face travel
    this.q.setFromEuler(this.e);
    this.pos.set(p.x, Y, p.z);
    this.scl.set(size, size, size);
    this.m.compose(this.pos, this.q, this.scl);
    this.mesh.setMatrixAt(i, this.m);
  }

  /** Age all live prints by dt; recycle any that have fully faded. */
  update(dt: number): void {
    let dirty = false;
    for (let i = 0; i < POOL; i++) {
      const p = this.prints[i];
      if (p.age === Infinity) continue;
      p.age += dt;
      if (p.age >= LIFE) {
        p.age = Infinity;
        this.mesh.setMatrixAt(i, this.hidden);
      } else {
        this.writeSlot(i, p, this.envelope(p.age) * p.base);
      }
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
