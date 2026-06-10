/**
 * Keys — WASD / arrow movement for the human (camera-relative), with a soft
 * run on Shift. Tap-to-walk lives in Pointer; whichever input moved last wins.
 */

export class Keys {
  private readonly down = new Set<string>();

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    this.down.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };
  private readonly onBlur = (): void => {
    this.down.clear();
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  /** Movement intent in camera space: x = right, z = forward; [-1, 1]. */
  axis(): { x: number; z: number; run: boolean } {
    let x = 0;
    let z = 0;
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) z += 1;
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) z -= 1;
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) x += 1;
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) x -= 1;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z, run: this.down.has('ShiftLeft') || this.down.has('ShiftRight') };
  }

  get active(): boolean {
    const a = this.axis();
    return a.x !== 0 || a.z !== 0;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
