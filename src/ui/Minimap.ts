/**
 * Minimap — the painted world in the corner of your eye.
 *
 * Draws the actual world paint (scaled once into an offscreen layer), then
 * quiet markers on top: you (sage), Datou (charcoal with the amber dot),
 * home, and today's found discoveries. Click anywhere on it to walk there —
 * the map is also the fastest way to take Datou somewhere.
 */

import { INK, ROBOT, SAGE } from '../art/palette';
import { WORLD_PAINT_HALF } from '../art/worldPaint';

const REDRAW_INTERVAL = 0.25; // seconds between marker redraws

export class Minimap {
  private readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bg: HTMLCanvasElement;
  private cooldown = 0;

  constructor(worldPaint: HTMLCanvasElement, onTravel: (x: number, z: number) => void) {
    const el = document.getElementById('minimap');
    if (!(el instanceof HTMLCanvasElement)) throw new Error('#minimap missing');
    this.el = el;
    const ctx = el.getContext('2d');
    if (!ctx) throw new Error('minimap 2d context unavailable');
    this.ctx = ctx;

    // Pre-scale the world paint once.
    this.bg = document.createElement('canvas');
    this.bg.width = el.width;
    this.bg.height = el.height;
    const bgCtx = this.bg.getContext('2d')!;
    bgCtx.drawImage(worldPaint, 0, 0, this.bg.width, this.bg.height);

    el.addEventListener('click', (e) => {
      const rect = el.getBoundingClientRect();
      const u = (e.clientX - rect.left) / rect.width;
      const v = (e.clientY - rect.top) / rect.height;
      onTravel((u * 2 - 1) * WORLD_PAINT_HALF, (v * 2 - 1) * WORLD_PAINT_HALF);
    });
  }

  private px(x: number): number {
    return ((x + WORLD_PAINT_HALF) / (WORLD_PAINT_HALF * 2)) * this.el.width;
  }

  update(
    dt: number,
    player: { x: number; z: number },
    datou: { x: number; z: number },
    foundSpots: ReadonlyArray<{ x: number; z: number }>,
  ): void {
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    this.cooldown = REDRAW_INTERVAL;

    const g = this.ctx;
    g.clearRect(0, 0, this.el.width, this.el.height);
    g.drawImage(this.bg, 0, 0);

    // Home.
    g.fillStyle = INK.soft;
    g.beginPath();
    g.arc(this.px(0), this.px(0), 4, 0, Math.PI * 2);
    g.fill();

    // Found discoveries — tiny warm dots.
    g.fillStyle = ROBOT.accent;
    for (const s of foundSpots) {
      g.beginPath();
      g.arc(this.px(s.x), this.px(s.z), 3, 0, Math.PI * 2);
      g.fill();
    }

    // Datou — charcoal dot with the amber center.
    g.fillStyle = ROBOT.dark;
    g.beginPath();
    g.arc(this.px(datou.x), this.px(datou.z), 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ROBOT.accent;
    g.beginPath();
    g.arc(this.px(datou.x), this.px(datou.z), 2.5, 0, Math.PI * 2);
    g.fill();

    // You — sage ring.
    g.strokeStyle = SAGE.deep;
    g.lineWidth = 3.5;
    g.beginPath();
    g.arc(this.px(player.x), this.px(player.z), 6.5, 0, Math.PI * 2);
    g.stroke();
  }
}
