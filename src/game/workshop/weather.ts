/**
 * Weather & season service (BUILDING_SYSTEM §5, prerequisite of inspiration).
 *
 * A light, seeded daily weather (clear/breeze/rain/fog) and a season derived
 * from the real date (4 palettes/tints). Both are pure functions of the date,
 * so "today's weather" is the same for everyone and replay-safe (§9) — no
 * `Math.random`, no live RNG state. Weather also lightly retints the world and
 * shifts ambient scatter (calendar return reasons for free, §5).
 */

import { Rng } from '../../physics/mujoco/rng';
import { dailySeed } from '../../world/Spots';

export type Weather = 'clear' | 'breeze' | 'rain' | 'fog';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const WEATHERS: readonly Weather[] = ['clear', 'breeze', 'rain', 'fog'];

// Weighted draw — clear/breeze are common, rain/fog rarer (calm-day bias).
const WEATHER_WEIGHTS: Record<Weather, number> = { clear: 5, breeze: 4, rain: 2, fog: 2 };

/** Today's weather, seeded by the date (deterministic). */
export function weatherFor(date: Date = new Date()): Weather {
  const rng = new Rng((dailySeed(date) ^ 0x57ea_ce5) >>> 0);
  const total = WEATHERS.reduce((n, w) => n + WEATHER_WEIGHTS[w], 0);
  let r = rng.next() * total;
  for (const w of WEATHERS) {
    r -= WEATHER_WEIGHTS[w];
    if (r < 0) return w;
  }
  return 'clear';
}

/** Season from the calendar month (northern-hemisphere mapping). */
export function seasonFor(date: Date = new Date()): Season {
  const m = date.getMonth(); // 0..11
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

/** A subtle multiplicative tint applied to the world paint (never garish). */
export interface Tint {
  /** RGB multipliers, each ~0.9..1.06 — quiet, baseline-safe. */
  r: number;
  g: number;
  b: number;
  /** Extra haze alpha for fog (0..0.18). */
  haze: number;
}

const SEASON_TINT: Record<Season, Omit<Tint, 'haze'>> = {
  spring: { r: 1.0, g: 1.03, b: 0.99 },
  summer: { r: 1.02, g: 1.02, b: 0.97 },
  autumn: { r: 1.05, g: 0.98, b: 0.93 },
  winter: { r: 0.98, g: 1.0, b: 1.04 },
};

const WEATHER_HAZE: Record<Weather, number> = { clear: 0, breeze: 0.02, rain: 0.06, fog: 0.16 };

export function tintFor(date: Date = new Date()): Tint {
  const s = SEASON_TINT[seasonFor(date)];
  return { ...s, haze: WEATHER_HAZE[weatherFor(date)] };
}
