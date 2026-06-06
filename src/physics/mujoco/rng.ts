/**
 * Deterministic PRNG (mulberry32). Used by MujocoAdapter so that idle-mode
 * wandering is reproducible from a seed — a prerequisite for the diary replay
 * mode (see docs/MUJOCO_DESIGN.md §4.7). Same seed ⇒ same sequence.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force to uint32; 0 is a valid seed.
    this.state = seed >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Next float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Current internal state — for snapshotting the RNG alongside sim state. */
  getState(): number {
    return this.state;
  }

  /** Restore a previously captured state (see getState). */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}
