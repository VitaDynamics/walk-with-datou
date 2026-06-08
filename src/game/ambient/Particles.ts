import * as THREE from 'three';

/**
 * Ambient drifting motes (docs/ENVIRONMENT_DESIGN.md §4.3) — a small, capped
 * THREE.Points cloud that floats around the player so the air always feels
 * alive without filling 250,000 m² with particles. Points gently rise and
 * recycle; the whole cloud re-centres on the player each frame so you're never
 * walking out of it.
 *
 * Cheap: one Points object, COUNT vertices, no physics. Daytime pollen tone;
 * the colour/size can later be swapped for dusk fireflies (§4.3).
 */
export class Particles {
  readonly points: THREE.Points;
  private readonly velocities: Float32Array;
  private readonly positions: Float32Array;
  private static readonly COUNT = 160;
  private static readonly RADIUS = 26; // cloud spread around the player
  private static readonly HEIGHT = 9;

  constructor() {
    const n = Particles.COUNT;
    this.positions = new Float32Array(n * 3);
    this.velocities = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.reseed(i, 0, 0, /*initial*/ true);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xfff2c4,
      size: 0.18,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /** Place mote i at a random spot in the cloud volume around (cx, cz). */
  private reseed(i: number, cx: number, cz: number, initial = false): void {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * Particles.RADIUS;
    this.positions[i * 3] = cx + Math.cos(a) * r;
    this.positions[i * 3 + 1] = (initial ? Math.random() : 0) * Particles.HEIGHT + 0.5;
    this.positions[i * 3 + 2] = cz + Math.sin(a) * r;
    // Slow upward drift + a little lateral wander.
    this.velocities[i * 3] = (Math.random() - 0.5) * 0.3;
    this.velocities[i * 3 + 1] = 0.2 + Math.random() * 0.4;
    this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }

  /** Advance motes and keep the cloud centred on the player. */
  update(dt: number, player: { x: number; z: number }): void {
    const n = Particles.COUNT;
    for (let i = 0; i < n; i++) {
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;

      // Recycle once a mote drifts too high or too far from the player.
      const dx = this.positions[i * 3] - player.x;
      const dz = this.positions[i * 3 + 2] - player.z;
      if (
        this.positions[i * 3 + 1] > Particles.HEIGHT ||
        dx * dx + dz * dz > Particles.RADIUS * Particles.RADIUS
      ) {
        this.reseed(i, player.x, player.z);
      }
    }
    this.points.geometry.getAttribute('position').needsUpdate = true;
  }
}
