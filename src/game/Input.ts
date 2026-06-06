export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  /** True for exactly one poll after a click. */
  clicked: boolean;
  /** Click position in normalised device coordinates (-1..1). */
  clickNdcX: number;
  clickNdcY: number;
}

/**
 * Keyboard and tap input. Exposes a snapshot via poll(); the snapshot's
 * `clicked` flag is one-shot (cleared after read) so the game can act on a
 * tap exactly once.
 *
 * Taps are distinguished from camera drags: a pointer that moves beyond
 * TAP_SLOP pixels between down and up is treated as a drag (handled by the
 * camera) and does NOT fire `clicked`, so dragging the view never pets Datou.
 */
export class Input {
  private static readonly TAP_SLOP = 6; // px of movement still counted as a tap

  private readonly keys = new Set<string>();
  private clickQueued = false;
  private clickNdc = { x: 0, y: 0 };
  private downX = 0;
  private downY = 0;
  private moved = 0;

  constructor(target: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });

    target.addEventListener('pointerdown', (e) => {
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.moved = 0;
    });
    target.addEventListener('pointermove', (e) => {
      this.moved = Math.max(this.moved, Math.hypot(e.clientX - this.downX, e.clientY - this.downY));
    });
    target.addEventListener('pointerup', (e) => {
      if (this.moved > Input.TAP_SLOP) return; // a drag, not a tap
      const rect = target.getBoundingClientRect();
      this.clickNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.clickNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.clickQueued = true;
    });
  }

  poll(): InputState {
    const state: InputState = {
      forward: this.keys.has('w') || this.keys.has('arrowup'),
      back: this.keys.has('s') || this.keys.has('arrowdown'),
      left: this.keys.has('a') || this.keys.has('arrowleft'),
      right: this.keys.has('d') || this.keys.has('arrowright'),
      clicked: this.clickQueued,
      clickNdcX: this.clickNdc.x,
      clickNdcY: this.clickNdc.y,
    };
    this.clickQueued = false;
    return state;
  }
}
