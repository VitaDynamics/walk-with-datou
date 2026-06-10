/**
 * Canvas → Three.js texture plumbing, plus the big painted surfaces
 * (glade ground, contact shadow, backdrop) that aren't per-prop sprites.
 */

import * as THREE from 'three';
import { Rng } from '../physics/mujoco/rng';
import { GROUND, INK, PAPER, SHADOW } from './palette';
import { blob, speckle } from './strokes';

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return ctx;
}

/** Wrap a drawn canvas as a color texture (sRGB, smooth filtering). */
export function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/**
 * The glade floor: one big hand-painted disc with an irregular "hand-cut"
 * edge (transparent outside), painterly tone blotches, a worn path near the
 * resting pad, and paper grain. Drawn once at boot, deterministic.
 */
export function paintGlade(seed: number, size = 1024): HTMLCanvasElement {
  const rng = new Rng(seed);
  const c = createCanvas(size, size);
  const g = ctx2d(c);
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.46;

  // Irregular outer edge — two layered blobs: a darker rim, then the base.
  blob(g, rng, cx, cy, R, R * 0.985, { fill: GROUND.edge }, 18, 0.045);
  blob(g, rng, cx, cy, R * 0.985, R * 0.965, { fill: GROUND.base }, 18, 0.04);

  // Painterly tone blotches — large, soft, unevenly placed.
  const tones = [GROUND.blotchA, GROUND.blotchB, GROUND.blotchC];
  for (let i = 0; i < 26; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.next() * R * 0.78;
    const r = size * (0.04 + rng.next() * 0.09);
    g.save();
    g.globalAlpha = 0.25 + rng.next() * 0.3;
    blob(g, rng, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, r * (0.5 + rng.next() * 0.5), {
      fill: tones[i % tones.length],
    });
    g.restore();
  }

  // Worn path: a lighter soft swathe from center toward the south (the pad).
  g.save();
  g.globalAlpha = 0.5;
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    blob(
      g,
      rng,
      cx + (rng.next() * 2 - 1) * size * 0.015,
      cy + t * R * 0.55,
      size * (0.075 - t * 0.028),
      size * (0.05 - t * 0.012),
      { fill: GROUND.path },
    );
  }
  g.restore();

  // Sparse ground accents: tiny ink ticks and speckle grain.
  speckle(g, rng, size * 0.1, size * 0.1, size * 0.8, size * 0.8, 420, INK.grain, 0.05);
  g.strokeStyle = INK.soft;
  g.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * R * 0.85;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    g.save();
    g.globalAlpha = 0.1 + rng.next() * 0.12;
    g.lineWidth = 1.5 + rng.next();
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 2, y - 4 - rng.next() * 4, x + (rng.next() * 6 - 3), y - 7 - rng.next() * 5);
    g.stroke();
    g.restore();
  }

  return c;
}

/** Soft round contact shadow (radial falloff, warm ink). */
export function paintContactShadow(size = 128): HTMLCanvasElement {
  const c = createCanvas(size, size);
  const g = ctx2d(c);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, SHADOW);
  grad.addColorStop(0.65, 'rgba(58, 55, 47, 0.12)');
  grad.addColorStop(1, 'rgba(58, 55, 47, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Paper backdrop gradient used as the scene background texture. */
export function paintBackdrop(width = 4, height = 512): HTMLCanvasElement {
  const c = createCanvas(width, height);
  const g = ctx2d(c);
  const grad = g.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, PAPER.skyTop);
  grad.addColorStop(1, PAPER.skyBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, width, height);
  return c;
}
