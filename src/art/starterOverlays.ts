/**
 * Starter-item state overlays — quiet, hand-cut shifts drawn OVER the authored
 * watercolor PNG so a placed keepsake can change as you and Datou use it (a
 * sprout grows a leaf, a lamp warms, a bed gets a curled blanket), in the same
 * spirit as the food bowl's four authored states — but composited in code so we
 * don't need a PNG per state.
 *
 * The law (binding, from DESIGN_BASELINE): every overlay is a still, warm,
 * low-saturation shift — NO glow, bloom, halo, rays, particles, sparkle, motion
 * trails, or floating dots. ≤3 dominant colors. The one warm focal accent is
 * `ACCENT_WARM` (a soft dust-tan), NEVER `ROBOT.accent` (#d9a441) — that amber
 * is Datou's signal color, reserved for the robot. The only exception is the two
 * lamps, which may carry a small warm candle-amber CAST LIGHT confined to their
 * aperture as a believable light source (a real lamp, not a bloom).
 *
 * Each draw fn returns a fresh PropSprite whose canvas is base-PNG + overlay,
 * its `ready` promise resolving once the base image has loaded and composited.
 * Cached per (form, state) like the bowl, so a redraw is identical and cheap.
 */

import { ACCENT_WARM, INK, SAGE } from './palette';
import type { PropSprite } from './props';
import { starterItemSpriteUrl, type StarterAssetForm } from './starterItems';
import { createCanvas, ctx2d } from './textures';

const FRAME_W = 480;
const FRAME_H = 600;

type Overlay = (g: CanvasRenderingContext2D) => void;

const cache = new Map<string, PropSprite>();

/**
 * Composite the authored base PNG for `form` with an overlay painter. The
 * painter runs in 480×600 frame space after the base image is drawn.
 */
function composite(form: StarterAssetForm, key: string, paint: Overlay): PropSprite {
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = createCanvas(FRAME_W, FRAME_H);
  const g = ctx2d(canvas);
  const image = new Image();
  image.decoding = 'async';
  const ready = new Promise<void>((resolve) => {
    image.onload = () => {
      g.drawImage(image, 0, 0, FRAME_W, FRAME_H);
      paint(g);
      resolve();
    };
    image.onerror = () => resolve();
  });
  image.src = starterItemSpriteUrl(form);

  const sprite: PropSprite = { canvas, aspect: FRAME_W / FRAME_H, ready };
  cache.set(key, sprite);
  return sprite;
}

/** A soft multiply wash confined to a region (damp soil, a seat dent). */
function wash(g: CanvasRenderingContext2D, color: string, alpha: number, fn: () => void): void {
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = alpha;
  g.fillStyle = color;
  fn();
  g.restore();
}

/* ── sprout-pot ──────────────────────────────────────────────────────────── */
// The authored art is a green bowl of dark soil with a two-leaf sprout. The
// bowl rim sits ~y360, soil fills ~y330–430, the sprout climbs to ~y150.
function sproutLeaf(g: CanvasRenderingContext2D, x: number, y: number, lean: number, s: number): void {
  g.save();
  g.fillStyle = SAGE.deep;
  g.strokeStyle = INK.line;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + lean * 0.5, y - s * 0.7, x + lean, y - s);
  g.quadraticCurveTo(x + lean * 0.4, y - s * 0.4, x, y);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}

export function drawSproutPot(stage: 'dry' | 'watered' | 'leafing' | 'bloom'): PropSprite {
  return composite('sprout-pot', `sprout:${stage}`, (g) => {
    if (stage === 'dry') {
      // Read a touch drier: one low-opacity warm-grey wash over the soil only.
      wash(g, '#c9c2b4', 0.28, () => {
        g.beginPath();
        g.ellipse(240, 450, 120, 46, 0, 0, Math.PI * 2);
        g.fill();
      });
      return;
    }
    // watered / leafing / bloom all carry the damp soil band.
    wash(g, '#4f463a', 0.36, () => {
      g.beginPath();
      g.ellipse(240, 452, 118, 44, 0, 0, Math.PI * 2);
      g.fill();
    });
    if (stage === 'leafing' || stage === 'bloom') {
      // One added two-stroke leaf low on the stem (the "new leaf" the hook
      // promises — clearly distinct from the authored top pair).
      sproutLeaf(g, 240, 330, 40, 46);
    }
    if (stage === 'bloom') {
      // One tiny believable bud at the stem tip — the lone warm accent earned.
      g.save();
      g.fillStyle = ACCENT_WARM;
      g.strokeStyle = INK.line;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(238, 132, 11, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();
    }
  });
}

/* ── mailbox ─────────────────────────────────────────────────────────────── */
// Authored: a post-mounted wooden mailbox, arched door on the front-left. We
// add a small raised signal flag on the right flank, and a brief "open" read.
export function drawMailbox(stage: 'flag-down' | 'flag-up' | 'open'): PropSprite {
  return composite('mailbox', `mailbox:${stage}`, (g) => {
    const flagX = 360;
    const flagBaseY = 250;
    // The flag post is always there (down = horizontal-ish, up = raised).
    g.save();
    g.strokeStyle = INK.line;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(flagX, flagBaseY + 30);
    g.lineTo(flagX, flagBaseY - (stage === 'flag-down' ? -2 : 18));
    g.stroke();
    // The flag itself: tucked down, or raised upright (geometry signals "raised").
    g.fillStyle = ACCENT_WARM;
    g.beginPath();
    if (stage === 'flag-down') {
      g.moveTo(flagX, flagBaseY + 6);
      g.lineTo(flagX + 34, flagBaseY + 14);
      g.lineTo(flagX, flagBaseY + 22);
    } else {
      g.moveTo(flagX, flagBaseY - 18);
      g.lineTo(flagX + 30, flagBaseY - 10);
      g.lineTo(flagX, flagBaseY - 2);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = INK.line;
    g.lineWidth = 2;
    g.stroke();
    g.restore();
    if (stage === 'open') {
      // A thin warm-ink arched door arc + a slightly deepened interior shadow,
      // signalling the little door is open. No folded-paper second focal.
      wash(g, '#3a3730', 0.22, () => {
        g.beginPath();
        g.ellipse(195, 300, 58, 70, 0, 0, Math.PI * 2);
        g.fill();
      });
      g.save();
      g.strokeStyle = INK.soft;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(195, 300, 64, Math.PI * 0.9, Math.PI * 1.9);
      g.stroke();
      g.restore();
    }
  });
}

/* ── mushroom-lamp ───────────────────────────────────────────────────────── */
// Authored: a mushroom lamp, cream stem with a small window. lit = one tiny
// warm candle-amber core confined to the stem window + one faint contact wash.
export function drawMushroomLamp(lit: boolean): PropSprite {
  return composite('mushroom-lamp', `lamp:${lit ? 'lit' : 'unlit'}`, (g) => {
    if (!lit) return; // unlit = plain authored PNG (dim by nature).
    // Cast-light core confined to the stem window (a believable light source).
    g.save();
    const grad = g.createRadialGradient(243, 410, 4, 243, 410, 34);
    grad.addColorStop(0, 'rgba(233, 196, 124, 0.85)');
    grad.addColorStop(1, 'rgba(233, 196, 124, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(243, 410, 30, 36, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // One faint cream contact wash on the ground only (no cap-underside pool).
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = '#f3e6c8';
    g.beginPath();
    g.ellipse(243, 552, 120, 24, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

/* ── pet-bed ─────────────────────────────────────────────────────────────── */
// Authored: a woven basket bed with a cream cushion + a folded sage blanket on
// the rim. circled = faint tamped ring; nested = curled blanket crescent + one
// tiny ACCENT_WARM stitch.
export function drawPetBed(stage: 'made' | 'circled' | 'nested'): PropSprite {
  return composite('pet-bed', `bed:${stage}`, (g) => {
    if (stage === 'made') return;
    // A faint tamped ring in the cushion (its own shadow tone, no new hue).
    wash(g, '#cdbfa6', 0.3, () => {
      g.beginPath();
      g.ellipse(245, 360, 120, 50, 0, 0, Math.PI * 2);
      g.fill();
    });
    if (stage === 'nested') {
      // A curled sage-blanket crescent in the far half; near half left open.
      g.save();
      g.fillStyle = SAGE.mid;
      g.strokeStyle = INK.line;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(245, 330, 118, 56, 0, Math.PI * 1.05, Math.PI * 1.95);
      g.quadraticCurveTo(245, 360, 130, 318);
      g.fill();
      g.stroke();
      g.restore();
      // One tiny warm stitch-dot on the blanket (ACCENT_WARM, never #d9a441).
      g.save();
      g.fillStyle = ACCENT_WARM;
      g.beginPath();
      g.arc(300, 312, 5, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });
}

/* ── stool ───────────────────────────────────────────────────────────────── */
// Authored: a round dished wooden seat on three legs. seated/rested add a soft
// seat-dent; rested adds a low warm chin-crescent at the near front leg.
export function drawStool(stage: 'empty' | 'seated' | 'rested'): PropSprite {
  return composite('stool', `stool:${stage}`, (g) => {
    if (stage === 'empty') return;
    // A soft seat-dent (low-alpha radial in the seat tone).
    g.save();
    const grad = g.createRadialGradient(243, 210, 8, 243, 210, 90);
    grad.addColorStop(0, 'rgba(201, 188, 168, 0.5)');
    grad.addColorStop(1, 'rgba(201, 188, 168, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(243, 212, 90, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    if (stage === 'rested') {
      // A low warm chin-crescent resting against the near front leg.
      g.save();
      g.fillStyle = ACCENT_WARM;
      g.globalAlpha = 0.7;
      g.beginPath();
      g.ellipse(243, 470, 40, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });
}

/* ── garden-lantern ──────────────────────────────────────────────────────── */
// Authored: a stone pagoda lantern with an open glazed light box. lit = one
// soft amber radial confined to the box aperture + one grounded contact tint.
export function drawGardenLantern(lit: boolean): PropSprite {
  return composite('garden-lantern', `lantern:${lit ? 'lit' : 'unlit'}`, (g) => {
    if (!lit) return;
    // Single soft amber radial confined to the aperture (the candle box).
    g.save();
    const grad = g.createRadialGradient(243, 320, 4, 243, 320, 46);
    grad.addColorStop(0, 'rgba(233, 196, 124, 0.8)');
    grad.addColorStop(1, 'rgba(233, 196, 124, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(243, 320, 40, 44, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // One low-alpha grounded contact ellipse on the path (flat floor tint).
    g.save();
    g.globalAlpha = 0.16;
    g.fillStyle = '#efe0bf';
    g.beginPath();
    g.ellipse(243, 556, 130, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

/* ── seed-chest ──────────────────────────────────────────────────────────── */
// Authored: an open domed-lid chest with two compartments of seeds. sorted =
// seeds nudged toward one side; chosen = one clearly-raised marked seed.
export function drawSeedChest(stage: 'full' | 'sorted' | 'chosen'): PropSprite {
  return composite('seed-chest', `seed:${stage}`, (g) => {
    if (stage === 'full') return;
    if (stage === 'sorted') {
      // A soft shadow nudged across the left compartment (seeds gathered right).
      wash(g, '#5b5346', 0.22, () => g.fillRect(150, 300, 95, 48));
      return;
    }
    // chosen: one clearly-readable raised, marked seed lifted from the right
    // compartment — the single warm focal.
    g.save();
    g.fillStyle = ACCENT_WARM;
    g.strokeStyle = INK.line;
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(290, 296, 15, 20, 0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  });
}
