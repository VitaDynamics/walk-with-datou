/**
 * World dressing (E6) — the community's furniture, drawn from the same
 * 501-form item space the player crafts from (BUILDING_SYSTEM). Pure layout
 * data: each entry is a real ItemId placed a few metres off a landmark heart,
 * so authored areas read inhabited without competing with their interactives.
 *
 * Inspecting a dressed item teaches its shape: the first time, its exact
 * pattern (when one exists) is banked as a one-cell hint — the world is the
 * workshop's quiet tutorial (§5 neighbor teaching).
 */

import { itemId, type ItemSpec } from '../game/workshop/items';

export interface Dressed {
  id: string;
  spec: ItemSpec;
  x: number;
  z: number;
}

function d(
  form: ItemSpec['form'],
  material: ItemSpec['material'],
  size: ItemSpec['size'],
  x: number,
  z: number,
): Dressed {
  const spec: ItemSpec = { form, material, size, finish: 'plain' };
  return { id: itemId(spec), spec, x, z };
}

/** ~26 pieces across the authored areas (offsets keep interactives clear). */
export const DRESSING: readonly Dressed[] = [
  // Trail Repair Commons (126,-28) — the most lived-in corner of the park.
  d('table', 'plank', 'M', 131, -24),
  d('stool', 'log', 'S', 133, -26),
  d('stool', 'log', 'S', 130, -21.5),
  d('lantern', 'plank', 'M', 124, -35),
  d('basket', 'reed', 'M', 132.5, -22.5),
  // Reedwater Pump Garden (14,110) — clay and water work.
  d('planter', 'clay-lump', 'M', 9, 106),
  d('planter', 'clay-lump', 'M', 11, 104),
  d('drinking-bowl', 'clay-lump', 'M', 18, 113),
  d('path-tile', 'flat-stone', 'M', 16, 106),
  d('path-tile', 'flat-stone', 'M', 17.5, 108),
  // Old Pine Relay Camp (-114,-104) — a kept clearing.
  d('bench', 'log', 'M', -110, -100),
  d('cache-box', 'plank', 'M', -117, -101),
  d('lantern', 'plank', 'M', -111, -107),
  // Ruin Stones (168,-160) — someone tends even this far corner.
  d('cairn', 'stone-block', 'M', 164, -164),
  d('sign', 'plank', 'M', 172, -156),
  // Watchers' Knoll (-98,88) — sit still, look long.
  d('stool', 'driftwood', 'S', -95, 85),
  d('mat', 'grass-wisp', 'M', -101, 90),
  d('chime', 'shell', 'M', -96, 91),
  // Meadow Orchard (60,-110) — harvest furniture.
  d('basket', 'twig', 'M', 64, -113),
  d('table', 'plank', 'M', 66, -116),
  d('sign', 'plank', 'M', 52, -118),
  // Lakeshore landward of the jetty (the planks themselves are on water).
  d('mat', 'reed', 'M', 4, 118),
  d('drinking-bowl', 'clay-lump', 'M', 2, 116),
  // Star Circle (-10,-170) — a lantern for the dark walk back.
  d('lantern', 'plank', 'M', -6, -166),
  d('mat', 'grass-wisp', 'M', -13, -167),
  // Kite Field (150,90) — watch the tail dance from a bench.
  d('bench', 'plank', 'M', 146, 86),
  d('sign', 'driftwood', 'M', 153, 94),
];

export function dressedNear(x: number, z: number, r = 1.4): Dressed | null {
  let best: Dressed | null = null;
  let bestD = r;
  for (const item of DRESSING) {
    const dist = Math.hypot(item.x - x, item.z - z);
    if (dist <= bestD) {
      bestD = dist;
      best = item;
    }
  }
  return best;
}
