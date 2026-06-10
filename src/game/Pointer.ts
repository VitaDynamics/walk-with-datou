/**
 * Pointer — the whole input surface, redesigned for touch-first companionship.
 *
 * Three gestures, all gentle:
 *   tap   — pet Datou / guide attention to a point in the glade
 *   hold  — a comforting touch (fires after a beat, ends on release)
 *   drag  — turn the diorama (the camera orbits; the world is the dial)
 * Plus wheel/pinch for a restrained zoom. No keyboard required.
 */

export interface PointerHandlers {
  /** A quick tap at client coordinates. */
  onTap(clientX: number, clientY: number): void;
  /** A hold began (after the press settled) at client coordinates. */
  onHoldStart(clientX: number, clientY: number): void;
  /** The hold was released; `duration` in seconds. */
  onHoldEnd(duration: number): void;
  /** Drag, in pixels (turn the world — or pan it in overview). */
  onDrag(dx: number, dy: number): void;
  /** Zoom delta (wheel ticks / pinch), positive = zoom out. */
  onZoom(delta: number): void;
}

const TAP_MAX_MS = 350;
const TAP_MAX_DRIFT = 9; // px
const HOLD_DELAY_MS = 420;

export class Pointer {
  private readonly canvas: HTMLCanvasElement;
  private readonly handlers: PointerHandlers;

  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;
  private dragging = false;
  private holding = false;
  private holdStarted = 0;
  private holdTimer: number | null = null;
  private activeId: number | null = null;

  private readonly onDown = (e: PointerEvent): void => {
    if (this.activeId !== null) return;
    this.activeId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.downAt = performance.now();
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.dragging = false;
    this.holding = false;
    this.holdTimer = window.setTimeout(() => {
      if (this.dragging) return;
      this.holding = true;
      this.holdStarted = performance.now();
      this.handlers.onHoldStart(this.downX, this.downY);
    }, HOLD_DELAY_MS);
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    const drift = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
    if (!this.dragging && !this.holding && drift > TAP_MAX_DRIFT) {
      this.dragging = true;
      this.clearHoldTimer();
    }
    if (this.dragging) {
      this.handlers.onDrag(e.clientX - this.lastX, e.clientY - this.lastY);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    this.clearHoldTimer();
    if (this.holding) {
      this.holding = false;
      this.handlers.onHoldEnd((performance.now() - this.holdStarted) / 1000);
      return;
    }
    const elapsed = performance.now() - this.downAt;
    if (!this.dragging && elapsed <= TAP_MAX_MS) {
      this.handlers.onTap(e.clientX, e.clientY);
    }
    this.dragging = false;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.handlers.onZoom(Math.sign(e.deltaY));
  };

  constructor(canvas: HTMLCanvasElement, handlers: PointerHandlers) {
    this.canvas = canvas;
    this.handlers = handlers;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** True while a comforting hold is in progress. */
  get isHolding(): boolean {
    return this.holding;
  }

  private clearHoldTimer(): void {
    if (this.holdTimer !== null) {
      window.clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  dispose(): void {
    this.clearHoldTimer();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }
}
