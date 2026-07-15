/**
 * Setpieces (E2) — the park's "great things": one quiet wonder per region.
 *
 * Pure data. Each sits on a ground apron worldPaint already paints, so the
 * map's painted hints finally have their objects. Two entries (old-pine,
 * jetty-end) anchor to existing hero cutouts and add no new plate.
 *
 * A setpiece tap (or Datou's own visit) plays a short staged beat — drift
 * plates + a signature clip — and, once per day, banks a "world echo": one
 * partially revealed crafting pattern related to the thing itself
 * (BUILDING_SYSTEM §5, the world-echoes discovery source).
 */

import type { SignatureClip } from '../datou/character';
import type { FormId } from '../game/workshop/forms';
import type { BeatArt } from '../art/setpieces';

export interface Setpiece {
  id: string;
  x: number;
  z: number;
  /** Plate height in metres (ignored when `anchored`). */
  height: number;
  /** Lay flat (the star circle). */
  decal?: boolean;
  /** Reuses an existing hero cutout — place no new plate. */
  anchored?: boolean;
  /** Where the drift plates spawn (metres above ground). */
  fxHeight: number;
  /** What drifts when the beat plays. */
  beat: BeatArt;
  /** Datou's side of the event (falls back to pulse+reach if stage-gated). */
  clip: SignatureClip;
  /** The daily world echo: a related form, hinted 2 cells at a time. */
  echoForm: FormId;
}

export const SETPIECES: readonly Setpiece[] = [
  // Meadow west — the painted "hollow oak" apron.
  { id: 'hollow-oak', x: -65, z: -45, height: 6.5, fxHeight: 4.2, beat: 'leaf', clip: 'shiver', echoForm: 'vessel' },
  // Woods heart — the existing Old Pine hero prop.
  { id: 'old-pine', x: -120, z: -110, height: 7.2, anchored: true, fxHeight: 5.0, beat: 'leaf', clip: 'stretch', echoForm: 'post' },
  // Meadow — the painted "swing tree clover" apron.
  { id: 'swing-tree', x: -34, z: -70, height: 6.0, fxHeight: 3.6, beat: 'leaf', clip: 'spin', echoForm: 'chime' },
  // Lake west — the painted "willow bend" apron.
  { id: 'willow-bend', x: -38, z: 92, height: 6.8, fxHeight: 4.0, beat: 'petal', clip: 'stretch', echoForm: 'garland' },
  // High meadow east — a glacial stranger.
  { id: 'erratic', x: 118, z: 122, height: 2.6, fxHeight: 2.2, beat: 'mote', clip: 'stomp', echoForm: 'cairn' },
  // The existing jetty hero prop — the beat ripples the water.
  { id: 'jetty-end', x: 21, z: 122, height: 0, anchored: true, fxHeight: 0.02, beat: 'ripple', clip: 'stretch', echoForm: 'beam' },
  // Meadow south — the painted "star circle" apron.
  { id: 'star-circle', x: -10, z: -170, height: 6.0, decal: true, fxHeight: 1.6, beat: 'mote', clip: 'spin', echoForm: 'campfire' },
  // Trail east — the painted "kite field" apron.
  { id: 'kite-tree', x: 150, z: 90, height: 6.2, fxHeight: 4.4, beat: 'petal', clip: 'spin', echoForm: 'wind-vane' },
];

export function setpieceNear(x: number, z: number, r = 2.6): Setpiece | null {
  let best: Setpiece | null = null;
  let bestD = r;
  for (const s of SETPIECES) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
