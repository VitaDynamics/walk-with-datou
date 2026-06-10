/**
 * Farm — small gardens you and Datou keep together.
 *
 * Craft a garden plot, place it anywhere, tap it to plant a gathered berry /
 * flower / mushroom. Crops grow through three drawn stages: while you play,
 * while you're away (come back tomorrow → harvest), and FASTER when Datou is
 * close by — tending the garden is a companionship act, not a chore. Harvest
 * returns a small multiple of what you planted.
 *
 * Pure logic + storage; the game layer renders plots and routes taps.
 */

export type CropKind = 'berry' | 'flower' | 'mushroom';

export const CROP_KINDS: readonly CropKind[] = ['berry', 'flower', 'mushroom'];

/** Growth: 0 → 3 (mature). */
export const MATURE = 3;
/** Active seconds per stage (Datou nearby scales this down). */
const SECONDS_PER_STAGE = 110;
/** Offline growth: a full crop matures overnight (~9 h wall clock). */
const OFFLINE_HOURS_PER_STAGE = 3;
/** Datou within this range tends the garden (1.6× growth). */
export const TEND_RANGE = 3.5;
const TEND_BOOST = 1.6;
/** Harvest yield per crop. */
export const YIELD: Record<CropKind, number> = { berry: 3, flower: 3, mushroom: 2 };

export interface PlotState {
  id: number;
  x: number;
  z: number;
  crop: CropKind | null;
  /** Growth progress 0..MATURE. */
  progress: number;
  /** Wall-clock ms of the last persisted tick (for offline growth). */
  savedAt: number;
}

export class Farm {
  private plots: PlotState[] = [];
  private nextId = 1;
  private readonly listeners = new Set<() => void>();
  private readonly storageKey: string;
  private saveIn = 5;

  constructor(storageKey = 'wwd.farm', now = Date.now()) {
    this.storageKey = storageKey;
    this.load(now);
  }

  list(): readonly PlotState[] {
    return this.plots;
  }

  addPlot(x: number, z: number, now = Date.now()): PlotState {
    const plot: PlotState = { id: this.nextId++, x, z, crop: null, progress: 0, savedAt: now };
    this.plots.push(plot);
    this.save(now);
    this.changed();
    return plot;
  }

  /** Nearest plot within `maxDist`, or null. */
  plotAt(x: number, z: number, maxDist = 1.1): PlotState | null {
    let best: PlotState | null = null;
    let bestD = maxDist;
    for (const p of this.plots) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  plant(plot: PlotState, crop: CropKind, now = Date.now()): boolean {
    if (plot.crop) return false;
    plot.crop = crop;
    plot.progress = 0;
    plot.savedAt = now;
    this.save(now);
    this.changed();
    return true;
  }

  /** Harvest a mature crop; returns the yield count (0 if not ready). */
  harvest(plot: PlotState, now = Date.now()): { crop: CropKind; count: number } | null {
    if (!plot.crop || plot.progress < MATURE) return null;
    const crop = plot.crop;
    plot.crop = null;
    plot.progress = 0;
    plot.savedAt = now;
    this.save(now);
    this.changed();
    return { crop, count: YIELD[crop] };
  }

  /** Stage 0..3 for rendering. */
  stage(plot: PlotState): number {
    return Math.min(MATURE, Math.floor(plot.progress));
  }

  /**
   * Advance active growth. `datouNear` says whether Datou is tending each
   * plot (within TEND_RANGE) — those grow faster.
   */
  update(dt: number, datouNear: (x: number, z: number) => boolean, now = Date.now()): void {
    let any = false;
    for (const p of this.plots) {
      if (!p.crop || p.progress >= MATURE) continue;
      const rate = datouNear(p.x, p.z) ? TEND_BOOST : 1;
      const before = this.stage(p);
      p.progress = Math.min(MATURE, p.progress + (dt / SECONDS_PER_STAGE) * rate);
      if (this.stage(p) !== before) any = true;
    }
    this.saveIn -= dt;
    if (this.saveIn <= 0) {
      this.saveIn = 5;
      this.save(now);
    }
    if (any) this.changed();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }

  private load(now: number): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const p of parsed as PlotState[]) {
        if (typeof p.x !== 'number' || typeof p.z !== 'number') continue;
        // Offline growth since the last save.
        if (p.crop && p.progress < MATURE) {
          const hours = Math.max(0, now - (p.savedAt || now)) / 3_600_000;
          p.progress = Math.min(MATURE, p.progress + hours / OFFLINE_HOURS_PER_STAGE);
        }
        p.savedAt = now;
        this.plots.push(p);
        this.nextId = Math.max(this.nextId, p.id + 1);
      }
    } catch {
      // Corrupt save — start fresh.
    }
  }

  private save(now: number): void {
    try {
      for (const p of this.plots) p.savedAt = now;
      localStorage.setItem(this.storageKey, JSON.stringify(this.plots));
    } catch {
      // Session-only in private mode.
    }
  }
}
