/**
 * Critters (E5) — the park's small animals: an ambient layer that is pooled
 * and culled around the player (birds, butterflies, a fish fin) and four
 * NAMED RESIDENTS with seeded daily routines (the trail cat, two lake ducks,
 * the oak squirrel, the neighbor dog who only visits some days).
 *
 * Design rules (DESIGN_BASELINE): witnessed more than used — slow paddling,
 * perch-hops, sine drift, an eased fly-off. Gameplay-relevant choices (dog
 * visit days, the squirrel's gift) are date-seeded and replayable; wing
 * flutter timing is cosmetic and may use Math.random.
 */

import * as THREE from 'three';
import { Cutout } from '../world/Cutout';
import { canvasTexture } from '../art/textures';
import { drawCritter, type CritterKind, type CritterPose } from '../art/critters';
import { dailyKey, dailySeed } from '../world/Spots';

export interface CritterHost {
  /** Put a plate into the world / take it back out. */
  add(cut: Cutout, x: number, z: number): void;
  remove(cut: Cutout): void;
  /** Snap a sample point to a nearby static prop (bird perches). */
  perchNear(x: number, z: number): { x: number; z: number } | null;
  /** A flower patch anchor for butterflies. */
  flowerNear(x: number, z: number): { x: number; z: number } | null;
  /** Show the name chip. Both arguments are i18n KEYS — the host translates. */
  chip(titleKey: string, lineKey: string): void;
  /** Quiet toast; the argument is an i18n KEY. */
  toast(textKey: string): void;
  /** A resident moment worth keeping — host dedups per day per key. */
  rememberOnce(key: string): void;
  /** Datou's small in-place reaction (pulse / reach). */
  datouReact(): void;
  /** Datou's bigger in-character beat (spin for the dog…). */
  datouClip(clip: 'spin' | 'stomp'): void;
  /** The squirrel left something at the oak roots. */
  dropGift(x: number, z: number): void;
}

const HEIGHTS: Record<CritterKind, number> = {
  bird: 0.26,
  butterfly: 0.16,
  fin: 0.34,
  cat: 0.5,
  duck: 0.38,
  squirrel: 0.26,
  dog: 0.6,
};

/** Where the residents live (trail commons, the lake, the hollow oak). */
const CAT_ANCHORS = [
  { x: 128, z: -32 }, // the bench
  { x: 121, z: -22 }, // the bulletin board
  { x: 138, z: -44 }, // the picnic table
] as const;
const DUCK_CENTER = { x: 24, z: 150 };
const OAK = { x: -65, z: -45 };
const DOG_LOOP = [
  { x: 150, z: 12 },
  { x: 128, z: -32 },
  { x: 104, z: -58 },
  { x: 140, z: -10 },
] as const;

interface Critter {
  kind: CritterKind;
  cut: Cutout;
  x: number;
  z: number;
  y: number;
  pose: CritterPose;
  seed: number;
  /** Behaviour scratch. */
  state: string;
  t: number;
  tx: number;
  tz: number;
  fromX: number;
  fromZ: number;
  phase: number;
  flutterIn: number;
  resident: boolean;
  active: boolean;
}

interface CritterSave {
  met: Record<string, string>;
  catDays: number;
  giftDay: string;
}

const AMBIENT_CAPS: Partial<Record<CritterKind, number>> = { bird: 3, butterfly: 3, fin: 1 };
const SIM_RADIUS = 80;

export class CritterSystem {
  private readonly host: CritterHost;
  private readonly critters: Critter[] = [];
  private readonly textures = new Map<string, THREE.Texture>();
  private spawnIn = 1;
  private save: CritterSave;
  private readonly storageKey: string;

  constructor(host: CritterHost, storageKey = 'wwd.critters') {
    this.host = host;
    this.storageKey = storageKey;
    this.save = this.load();
    // Residents exist from the start; the dog only on his seeded visit days.
    this.spawnResident('cat', CAT_ANCHORS[0].x, CAT_ANCHORS[0].z);
    this.spawnResident('duck', DUCK_CENTER.x + 4, DUCK_CENTER.z);
    this.spawnResident('duck', DUCK_CENTER.x - 3, DUCK_CENTER.z + 4);
    this.spawnResident('squirrel', OAK.x + 1.5, OAK.z + 1);
    if (this.dogVisitsToday()) this.spawnResident('dog', DOG_LOOP[0].x, DOG_LOOP[0].z);
  }

  dogVisitsToday(): boolean {
    return dailySeed() % 3 === 0;
  }

  /** A critter under the tap → name chip + a quiet line. Returns handled. */
  tapAt(x: number, z: number): boolean {
    for (const c of this.critters) {
      if (!c.active || c.kind === 'fin') continue;
      if (Math.hypot(c.x - x, c.z - z) > 1.2) continue;
      const line = this.tapLineFor(c);
      this.host.chip(line.title, line.line);
      if (c.resident) this.meet(c.kind);
      if (c.kind === 'bird' || c.kind === 'squirrel') this.startFlee(c);
      return true;
    }
    return false;
  }

  update(dt: number, player: { x: number; z: number }, datou: { x: number; z: number }): void {
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnIn = 2;
      this.refillAmbient(player);
    }
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const c = this.critters[i];
      const dPlayer = Math.hypot(c.x - player.x, c.z - player.z);
      // Residents sleep beyond the simulation radius; ambient despawns.
      if (dPlayer > SIM_RADIUS) {
        if (c.resident) {
          this.setActive(c, false);
          continue;
        }
        this.despawn(i);
        continue;
      }
      this.setActive(c, true);
      c.t += dt;
      switch (c.kind) {
        case 'bird':
          this.updateBird(c, dt, player, datou);
          break;
        case 'butterfly':
          this.updateButterfly(c, dt);
          break;
        case 'fin':
          this.updateFin(c, dt, i);
          break;
        case 'cat':
          this.updateCat(c, dt, datou);
          break;
        case 'duck':
          this.updateDuck(c, dt, datou);
          break;
        case 'squirrel':
          this.updateSquirrel(c, dt, player, datou);
          break;
        case 'dog':
          this.updateDog(c, dt, datou);
          break;
      }
      c.cut.setPosition(c.x, c.z, c.y);
    }
  }

  // --- ambient layer -------------------------------------------------------

  private refillAmbient(player: { x: number; z: number }): void {
    for (const kind of ['bird', 'butterfly', 'fin'] as const) {
      const cap = AMBIENT_CAPS[kind] ?? 0;
      const alive = this.critters.filter((c) => c.kind === kind).length;
      if (alive >= cap) continue;
      // Spawn out of the player's immediate attention (12–40 m out).
      const a = Math.random() * Math.PI * 2;
      const d = 12 + Math.random() * 28;
      const sx = player.x + Math.cos(a) * d;
      const sz = player.z + Math.sin(a) * d;
      if (kind === 'bird') {
        const perch = this.host.perchNear(sx, sz);
        if (perch) this.spawnAmbient('bird', perch.x + 0.5, perch.z + 0.4);
      } else if (kind === 'butterfly') {
        const flowers = this.host.flowerNear(sx, sz);
        if (flowers) {
          const b = this.spawnAmbient('butterfly', flowers.x, flowers.z);
          b.tx = flowers.x;
          b.tz = flowers.z;
          b.t = 0;
          b.state = 'drift';
        }
      } else {
        // The fin surfaces near the jetty, rarely.
        if (Math.random() < 0.25) {
          const f = this.spawnAmbient('fin', 24 + Math.random() * 6, 128 + Math.random() * 6);
          f.state = 'glide';
          f.t = 0;
          f.phase = Math.random() * Math.PI * 2;
        }
      }
    }
  }

  private updateBird(
    c: Critter,
    dt: number,
    player: { x: number; z: number },
    datou: { x: number; z: number },
  ): void {
    if (c.state === 'perch') {
      c.pose = 'idle';
      // The occasional little hop.
      if (c.t > 3 && Math.random() < dt * 0.3) {
        c.t = 0;
        c.y = 0.06;
      }
      c.y = Math.max(0, c.y - dt * 0.4);
      const near = Math.min(
        Math.hypot(c.x - player.x, c.z - player.z),
        Math.hypot(c.x - datou.x, c.z - datou.z),
      );
      if (near < 2.6) this.startFlee(c);
    } else {
      // An eased arc to the landing spot.
      const k = Math.min(1, c.t / 2.2);
      const e = k < 0.5 ? 2 * k * k : 1 - (1 - k) * (1 - k) * 2;
      c.x = c.fromX + (c.tx - c.fromX) * e;
      c.z = c.fromZ + (c.tz - c.fromZ) * e;
      c.y = Math.sin(Math.PI * k) * 2.2;
      c.flutterIn -= dt;
      if (c.flutterIn <= 0) {
        c.flutterIn = 0.13;
        this.setPose(c, c.pose === 'alt' ? 'move' : 'alt');
      }
      if (k >= 1) {
        c.state = 'perch';
        c.t = 0;
        c.y = 0;
        this.setPose(c, 'idle');
      }
    }
  }

  private startFlee(c: Critter): void {
    if (c.kind === 'bird') {
      if (c.state === 'fly') return;
      const a = Math.random() * Math.PI * 2;
      c.state = 'fly';
      c.t = 0;
      c.fromX = c.x;
      c.fromZ = c.z;
      c.tx = c.x + Math.cos(a) * (8 + Math.random() * 6);
      c.tz = c.z + Math.sin(a) * (8 + Math.random() * 6);
    } else if (c.kind === 'squirrel') {
      c.state = 'hide';
      c.t = 0;
      c.tx = OAK.x;
      c.tz = OAK.z;
      this.setPose(c, 'move');
    }
  }

  private updateButterfly(c: Critter, dt: number): void {
    // A slow lissajous drift around its flower patch.
    c.x = c.tx + Math.sin(c.t * 0.5 + c.phase) * 1.6;
    c.z = c.tz + Math.sin(c.t * 0.37 + c.phase * 2) * 1.3;
    c.y = 0.5 + Math.sin(c.t * 0.9) * 0.18;
    c.flutterIn -= dt;
    if (c.flutterIn <= 0) {
      c.flutterIn = 0.18;
      this.setPose(c, c.pose === 'alt' ? 'idle' : 'alt');
    }
  }

  private updateFin(c: Critter, dt: number, index: number): void {
    void dt;
    // One slow glide, then back under.
    const k = Math.min(1, c.t / 3.2);
    c.x += Math.cos(c.phase) * 0.5 * dt;
    c.z += Math.sin(c.phase) * 0.5 * dt;
    c.y = 0;
    const mat = c.cut.plane.material as THREE.MeshBasicMaterial;
    mat.opacity = k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1;
    mat.transparent = true;
    if (k >= 1) this.despawn(index);
  }

  // --- residents -----------------------------------------------------------

  private updateCat(c: Critter, dt: number, datou: { x: number; z: number }): void {
    // Routine: the seeded anchor of the hour (bench → board → picnic table).
    const slot = (new Date().getHours() + dailySeed()) % CAT_ANCHORS.length;
    const anchor = CAT_ANCHORS[slot];
    const dAnchor = Math.hypot(c.x - anchor.x, c.z - anchor.z);
    const dDatou = Math.hypot(c.x - datou.x, c.z - datou.z);
    if (dDatou < 2.2) {
      // Sits tall and watches the robot dog. Both pretend this is normal.
      this.setPose(c, 'alt');
      this.rememberAndReact('critter.cat');
    } else if (dAnchor > 1.2) {
      this.setPose(c, 'move');
      const k = (0.6 * dt) / Math.max(0.001, dAnchor);
      c.x += (anchor.x - c.x) * k;
      c.z += (anchor.z - c.z) * k;
    } else {
      this.setPose(c, 'idle');
    }
  }

  private updateDuck(c: Critter, dt: number, datou: { x: number; z: number }): void {
    // A slow seeded circuit on the shallows.
    c.phase += dt * 0.12;
    c.x = DUCK_CENTER.x + Math.cos(c.phase) * (5 + c.seed % 3);
    c.z = DUCK_CENTER.z + Math.sin(c.phase) * (4 + c.seed % 2);
    c.flutterIn -= dt;
    if (c.flutterIn <= 0) {
      c.flutterIn = 0.55;
      this.setPose(c, c.pose === 'alt' ? 'idle' : 'alt');
    }
    if (Math.hypot(c.x - datou.x, c.z - datou.z) < 4.5) {
      // Datou has OPINIONS about ducks.
      if (this.rememberAndReact('critter.duck')) this.host.datouClip('stomp');
    }
  }

  private updateSquirrel(
    c: Critter,
    dt: number,
    player: { x: number; z: number },
    datou: { x: number; z: number },
  ): void {
    if (c.state === 'hide') {
      const k = Math.min(1, c.t / 0.5);
      c.x = c.x + (c.tx - c.x) * k;
      c.z = c.z + (c.tz - c.z) * k;
      if (k >= 1) {
        // Up the oak — gone for a while.
        c.state = 'hidden';
        c.t = 0;
        this.setActive(c, false);
      }
      return;
    }
    if (c.state === 'hidden') {
      this.setActive(c, false);
      if (c.t > 25) {
        c.state = 'about';
        c.t = 0;
        c.x = OAK.x + 1.5;
        c.z = OAK.z + 1;
        this.setActive(c, true);
      }
      return;
    }
    // About: dash–pause between spots near the oak roots.
    const near = Math.min(
      Math.hypot(c.x - player.x, c.z - player.z),
      Math.hypot(c.x - datou.x, c.z - datou.z),
    );
    if (near < 2.4) {
      this.startFlee(c);
      return;
    }
    if (c.state === 'dash') {
      const k = Math.min(1, c.t / 0.5);
      c.x = c.fromX + (c.tx - c.fromX) * k;
      c.z = c.fromZ + (c.tz - c.fromZ) * k;
      if (k >= 1) {
        c.state = 'about';
        c.t = 0;
        this.setPose(c, 'idle');
      }
    } else if (c.t > 2 + (c.seed % 3) && Math.random() < dt) {
      c.state = 'dash';
      c.t = 0;
      c.fromX = c.x;
      c.fromZ = c.z;
      const a = Math.random() * Math.PI * 2;
      c.tx = OAK.x + Math.cos(a) * (1 + Math.random() * 2.5);
      c.tz = OAK.z + Math.sin(a) * (1 + Math.random() * 2.5);
      this.setPose(c, 'move');
    }
    // The rare gift: one seeded morning find at the roots.
    if (this.save.giftDay !== dailyKey() && dailySeed() % 10 < 3 && near < 12) {
      this.save.giftDay = dailyKey();
      this.persist();
      this.host.dropGift(OAK.x + 0.9, OAK.z + 0.7);
    }
  }

  private updateDog(c: Critter, dt: number, datou: { x: number; z: number }): void {
    if (c.state === 'play') {
      this.setPose(c, 'alt'); // the bow
      if (c.t > 6) {
        c.state = 'patrol';
        c.t = 0;
      }
      return;
    }
    const dDatou = Math.hypot(c.x - datou.x, c.z - datou.z);
    if (dDatou < 5 && this.rememberAndReact('critter.dog')) {
      c.state = 'play';
      c.t = 0;
      this.host.datouClip('spin');
      return;
    }
    // Patrol the trail loop at a trot.
    const wp = DOG_LOOP[Math.floor(c.phase) % DOG_LOOP.length];
    const d = Math.hypot(c.x - wp.x, c.z - wp.z);
    if (d < 1.5) {
      c.phase += 1;
    } else {
      const k = (1.2 * dt) / d;
      c.x += (wp.x - c.x) * k;
      c.z += (wp.z - c.z) * k;
      c.flutterIn -= dt;
      if (c.flutterIn <= 0) {
        c.flutterIn = 0.3;
        this.setPose(c, c.pose === 'move' ? 'idle' : 'move');
      }
    }
  }

  // --- shared plumbing -----------------------------------------------------

  private tapLineFor(c: Critter): { title: string; line: string } {
    // The cat warms up over met-days; everyone else has one line.
    if (c.kind === 'cat') {
      const warmed = this.save.catDays >= 3;
      return { title: `critter.cat`, line: warmed ? 'critter.cat.line.2' : 'critter.cat.line.1' };
    }
    return { title: `critter.${c.kind}`, line: `critter.${c.kind}.line` };
  }

  /** First meeting of the day with a resident → familiarity + memory. */
  private meet(kind: CritterKind): void {
    if (this.save.met[kind] === dailyKey()) return;
    this.save.met[kind] = dailyKey();
    if (kind === 'cat') this.save.catDays += 1;
    this.persist();
    this.host.rememberOnce(`critter.${kind}`);
  }

  private rememberAndReact(key: string): boolean {
    const k = `react.${key}`;
    if (this.save.met[k] === dailyKey()) return false;
    this.save.met[k] = dailyKey();
    this.persist();
    this.host.rememberOnce(key);
    return true;
  }

  private spawnAmbient(kind: CritterKind, x: number, z: number): Critter {
    return this.spawn(kind, x, z, false);
  }

  private spawnResident(kind: CritterKind, x: number, z: number): Critter {
    const c = this.spawn(kind, x, z, true);
    c.state = kind === 'dog' ? 'patrol' : 'about';
    if (kind === 'duck') c.phase = (c.seed % 7) * 0.9;
    return c;
  }

  private spawn(kind: CritterKind, x: number, z: number, resident: boolean): Critter {
    const seed = (Math.round(x * 11 + z * 7) ^ 0xbeef) >>> 0;
    const cut = new Cutout(drawCritter(kind, 'idle', seed), {
      height: HEIGHTS[kind],
      shadowRadius: kind === 'fin' || kind === 'duck' ? 0 : HEIGHTS[kind] * 0.4,
    });
    this.host.add(cut, x, z);
    const c: Critter = {
      kind,
      cut,
      x,
      z,
      y: 0,
      pose: 'idle',
      seed,
      state: 'perch',
      t: 0,
      tx: x,
      tz: z,
      fromX: x,
      fromZ: z,
      phase: 0,
      flutterIn: 0.2,
      resident,
      active: true,
    };
    this.critters.push(c);
    return c;
  }

  private despawn(index: number): void {
    const c = this.critters[index];
    this.host.remove(c.cut);
    this.critters.splice(index, 1);
  }

  private setActive(c: Critter, on: boolean): void {
    if (c.active === on) return;
    c.active = on;
    c.cut.group.visible = on;
  }

  private setPose(c: Critter, pose: CritterPose): void {
    if (c.pose === pose) return;
    c.pose = pose;
    const key = `${c.kind}:${pose}:${c.seed % 3}`;
    let tex = this.textures.get(key);
    if (!tex) {
      tex = canvasTexture(drawCritter(c.kind, pose, c.seed).canvas);
      this.textures.set(key, tex);
    }
    const mat = c.cut.plane.material as THREE.MeshBasicMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
  }

  private load(): CritterSave {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) return { met: {}, catDays: 0, giftDay: '', ...JSON.parse(raw) };
    } catch {
      // fresh save
    }
    return { met: {}, catDays: 0, giftDay: '' };
  }

  private persist(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.save));
    } catch {
      // storage unavailable — stay session-local
    }
  }
}
