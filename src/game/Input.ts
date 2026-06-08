export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  /** Fly up / down — only meaningful in creator (free-fly) mode. */
  up: boolean;
  down: boolean;
  /** Hold to fly faster in creator mode. */
  boost: boolean;
  /** True for exactly one poll after a click. */
  clicked: boolean;
  /** Click position in normalised device coordinates (-1..1). */
  clickNdcX: number;
  clickNdcY: number;
  /** True for exactly one poll after the creator-mode toggle key (C) is pressed. */
  toggleCreator: boolean;
  /**
   * True for exactly one poll after the contextual-action key (E) is pressed.
   * Note: `up` also reads 'e' for free-fly ascent — the Game honours `action`
   * only when NOT in free-fly, so the same physical key serves both modes.
   */
  action: boolean;
  /** Current pointer position in NDC (-1..1) — for hover raycasting. */
  pointerNdcX: number;
  pointerNdcY: number;
  /** Current pointer position in CSS pixels — for positioning DOM tooltips. */
  pointerPxX: number;
  pointerPxY: number;
  /** Whether the pointer is currently over the canvas (false → no hover). */
  pointerOver: boolean;
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
  private toggleCreatorQueued = false;
  private actionQueued = false;
  private pointerNdc = { x: 0, y: 0 };
  private pointerPx = { x: 0, y: 0 };
  private pointerOver = false;

  constructor(target: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      // 'c' is a one-shot toggle (creator mode), not a held movement key.
      if (k === 'c' && !e.repeat) this.toggleCreatorQueued = true;
      // 'e' is a one-shot contextual action (also held for free-fly ascent via
      // `up`); the Game gates `action` on non-free-fly so there's no conflict.
      if (k === 'e' && !e.repeat) this.actionQueued = true;
      this.keys.add(k);
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
      const rect = target.getBoundingClientRect();
      this.pointerPx.x = e.clientX;
      this.pointerPx.y = e.clientY;
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.pointerOver = true;
    });
    target.addEventListener('pointerleave', () => {
      this.pointerOver = false;
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
      up: this.keys.has('e') || this.keys.has(' '),
      down: this.keys.has('q'),
      boost: this.keys.has('shift'),
      clicked: this.clickQueued,
      clickNdcX: this.clickNdc.x,
      clickNdcY: this.clickNdc.y,
      toggleCreator: this.toggleCreatorQueued,
      action: this.actionQueued,
      pointerNdcX: this.pointerNdc.x,
      pointerNdcY: this.pointerNdc.y,
      pointerPxX: this.pointerPx.x,
      pointerPxY: this.pointerPx.y,
      pointerOver: this.pointerOver,
    };
    this.clickQueued = false;
    this.toggleCreatorQueued = false;
    this.actionQueued = false;
    return state;
  }
}
