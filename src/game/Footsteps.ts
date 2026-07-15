/**
 * Footsteps — turns a walker's motion into per-footfall foley. This is the
 * single biggest "the walk has no feedback" fix from the playability research
 * (game-feel/juice: emphasized audio is a primary feedback channel that needs no
 * HUD): the most-repeated action in the game finally answers back.
 *
 * Pure cadence logic. It accumulates a stride phase from speed (faster gait when
 * running), and on each footfall asks the surface classifier what the ground is
 * and fires one quiet, surface-voiced tap. The human and Datou each own one
 * tracker (Datou's quieter and pitched down a touch).
 */

import { surfaceAt } from '../world/surface';
import { cueFootstep } from './cues';

/** Steps per metre travelled — a stride roughly every ~0.7 m at a walk. */
const STEPS_PER_M = 1.45;
/** Below this speed (m/s) we treat the walker as standing still. */
const MOVE_EPS = 0.15;

export interface FootstepVoice {
  /** Overall loudness (Datou < human). */
  gain: number;
  /** Base pitch multiplier (Datou's lighter feet sit a touch higher). */
  pitch: number;
}

export class Footsteps {
  /** Stride phase in [0,1); a footfall fires when it wraps past 1. */
  private phase = 0;
  /** Alternate feet so successive steps aren't identical. */
  private left = false;

  constructor(private readonly voice: FootstepVoice) {}

  /**
   * Advance by `dt` for a walker at (x,z) moving at `speed` m/s. Fires zero or
   * more footfalls (usually zero or one) via cueFootstep. Returns the number of
   * footfalls this tick (handy for driving a camera/rig bob later, and tests).
   */
  update(dt: number, x: number, z: number, speed: number): number {
    if (speed < MOVE_EPS || dt <= 0) {
      // Reset toward mid-stride so the next departure lands a step promptly,
      // not instantly (no click the frame you start moving).
      this.phase = Math.min(this.phase, 0.5);
      return 0;
    }
    this.phase += speed * STEPS_PER_M * dt;
    let fired = 0;
    // Cap the loop so a long-dt hitch can't spew a burst of steps.
    while (this.phase >= 1 && fired < 3) {
      this.phase -= 1;
      this.left = !this.left;
      const surface = surfaceAt(x, z);
      // Each footfall varies pitch a little; left/right feet differ slightly.
      const jitter = (this.left ? 0.04 : -0.04) + (this.phase - 0.5) * 0.12;
      cueFootstep(surface, this.voice.gain, this.voice.pitch * (1 + jitter));
      fired++;
    }
    return fired;
  }
}
