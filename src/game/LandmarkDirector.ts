/**
 * LandmarkDirector — runs the authored community areas in the world
 * (landmark plan §10, Phase 2: the full Commons → Garden → Camp chain).
 *
 * Owns the LandmarkField state + its wwd.landmarks persistence, places each
 * area's plates (and re-plates them on state change), advances the three
 * cooperative activities, and hands the Companion its notice anchors.
 *
 * Every beat routes through Datou: he hears the chime and braces the post
 * (Commons), smells the wet earth and runs the pump (Garden), and IS the
 * tuning meter at the relay (Camp) — his ear-lift beat tells you a vane
 * landed true. The player is the hands; the robot is the partner.
 */

import { drawCoffer } from '../art/props';
import {
  drawBlueCoffer,
  drawBlueStake,
  drawCableSpool,
  drawChannel,
  drawChimeStand,
  drawFastener,
  drawFieldCase,
  drawFloatingPlanter,
  drawLeanTo,
  drawPatchedFence,
  drawPennantMast,
  drawPlanterSocket,
  drawPumpNotice,
  drawPumpWheel,
  drawRelayMast,
  drawRelayTag,
  drawRibbonScrap,
  drawSignalVane,
  drawToolShelter,
  drawTriangleMark,
} from '../art/landmarkProps';
import { Cutout } from '../world/Cutout';
import {
  LANDMARKS_VERSION,
  LandmarkField,
  type LandmarkArea,
  type LandmarkId,
} from '../world/landmarks';
import type { LandmarkAnchor } from './Companion';
import type { MaterialId } from './workshop/materials';
import type { FormId } from './workshop/forms';
import { t, tDyn } from '../i18n';

export interface LandmarkDirectorDeps {
  /** Put a plate into the world (World.placeCutout). */
  place(cut: Cutout, x: number, z: number): void;
  /** Twigs in the pack — the chime's missing part is one common twig. */
  countTwig(): number;
  takeTwig(): boolean;
  /** Bank a fully revealed blueprint hint (the coffer reward contract, §9). */
  grantBlueprint(form: FormId, context: string): void;
  grantMaterial(mat: MaterialId, n: number): void;
  /** Send Datou to a point (Companion.investigate). */
  sendDatou(x: number, z: number): void;
  datouPos(): { x: number; z: number };
  /** A warm cooperative beat — rig pulse + arm reach. */
  datouBeat(): void;
  toast(text: string): void;
  /** Write a shared memory (the game adds bond alongside). */
  memory(key: string): void;
  load(): unknown;
  save(data: unknown): void;
}

/** What a world tap near a landmark interactive resolves to. */
export interface LandmarkTarget {
  kind: 'chime' | 'coffer' | 'channel' | 'vane' | 'socket';
  area: LandmarkId;
  /** Which channel/vane (0 or 1) for the paired interactives. */
  index?: 0 | 1;
  x: number;
  z: number;
}

// --- A. Commons composition (authored placement, world metres) ---------------
// The heart tightens around the existing bench/signpost/bulletin cluster.
const MAST = { x: 132, z: -26, h: 8.6 };
const LEAN_TO = { x: 122, z: -26.5, h: 2.3 };
const CHIME = { x: 127.5, z: -30.5, h: 1.7 };
// Approach breadcrumbs along the east path (read at ground level, §5 + the
// Phase-0 finding: the camera never frames the horizon, crumbs carry it).
const FASTENERS = [
  { x: 107, z: -16 },
  { x: 113, z: -19.5 },
];
const PATCHED_FENCE = { x: 101, z: -13, h: 0.95 };
// The clue trail toward the lake garden, placed when the chime is repaired.
const RIBBONS = [
  { x: 112, z: -8 },
  { x: 96, z: 8 },
  { x: 78, z: 34 },
  { x: 58, z: 62 },
];
const NOTICE = { x: 121.6, z: -21.4, h: 0.62 };

// --- B. Garden composition ----------------------------------------------------
// On the shore by the jetty, behind the reed screen at the lake rim.
const PUMP = { x: 14, z: 108, h: 3.6 };
const CHANNELS = [
  { x: 10.5, z: 112, h: 0.9 },
  { x: 17.5, z: 112.5, h: 0.9 },
] as const;
const PLANTERS = [
  { x: 18.5, z: 116.5 },
  { x: 11, z: 117.5 },
];
const SOCKET = { x: 17.5, z: 106, h: 0.6 };
// Approach: the ribbon trail resolves into painted irrigation stakes.
const STAKES = [
  { x: 27, z: 92 },
  { x: 21, z: 100 },
];
// The clue onward: a stamped relay tag in a planter, placed on completion.
const TAG = { x: 15.5, z: 109.8, h: 0.35 };

// --- C. Camp composition --------------------------------------------------------
// Sheltered under the Old Pine (−120,−110), beside the mushroom ring.
const RELAY_MAST = { x: -114, z: -104, h: 7.5 };
const SHELTER = { x: -117.5, z: -100.5, h: 2.0 };
const SPOOL = { x: -110.5, z: -101, h: 1.0 };
const VANES = [
  { x: -116.5, z: -106.5, h: 1.3 },
  { x: -111, z: -107, h: 1.3 },
] as const;
// Triangular waymarks winding the route in from the woods path.
const TRI_MARKS = [
  { x: -97, z: -86 },
  { x: -103, z: -92.5 },
  { x: -108.5, z: -98.5 },
];
/** The bearing each vane must point to (the player cycles 0→1→2). */
const VANE_TARGET: readonly [number, number] = [2, 1];

const REACH = 1.4; // Datou close enough to brace/work
const WORK_SECONDS = 2.6; // the calm cooperative beat
const TELL_COOLDOWN = 12; // s between coffer paw-tells
const TELL_RANGE = 5; // m (§9: 4–6 m)

/** Per-area coffer plate variant: patched chest / blue chest / metal case. */
const COFFER_LOOK: Record<LandmarkId, { h: number; draw: (open: boolean) => ReturnType<typeof drawCoffer> }> = {
  'repair-commons': { h: 0.7, draw: (open) => drawCoffer(74, open, true) },
  'pump-garden': { h: 0.7, draw: (open) => drawBlueCoffer(81, open) },
  'relay-camp': { h: 0.55, draw: (open) => drawFieldCase(82, open) },
};

type BeatPhase = 'idle' | 'datou-coming' | 'working';

interface Beat {
  phase: BeatPhase;
  left: number;
  beatIn: number;
}

export class LandmarkDirector {
  readonly field = new LandmarkField();
  private readonly deps: LandmarkDirectorDeps;

  // One cooperative beat per area (chime brace / pump run / relay wake).
  private readonly beats: Record<LandmarkId, Beat> = {
    'repair-commons': { phase: 'idle', left: 0, beatIn: 0 },
    'pump-garden': { phase: 'idle', left: 0, beatIn: 0 },
    'relay-camp': { phase: 'idle', left: 0, beatIn: 0 },
  };
  private tellCooldown = 0;

  // Session-local activity progress (completion persists via the field).
  private channelOn = [false, false];
  private vanePos: [number, number] = [0, 0];

  // Re-plateable cutouts.
  private mastCut: Cutout | null = null;
  private chimeCut: Cutout | null = null;
  private pumpCut: Cutout | null = null;
  private channelCuts: (Cutout | null)[] = [null, null];
  private planterCuts: (Cutout | null)[] = [null, null];
  private socketCut: Cutout | null = null;
  private relayCut: Cutout | null = null;
  private vaneCuts: (Cutout | null)[] = [null, null];
  private readonly cofferCuts = new Map<LandmarkId, Cutout>();
  private commonsCluesPlaced = false;
  private gardenCluesPlaced = false;

  constructor(deps: LandmarkDirectorDeps) {
    this.deps = deps;
    this.field.restore(deps.load());
    this.placeCommons();
    this.placeGarden();
    this.placeCamp();
  }

  // --- world dressing --------------------------------------------------------

  private placeCommons(): void {
    const done = this.completed('repair-commons');
    this.mastCut = this.plate(drawPennantMast(71, done), MAST.x, MAST.z, MAST.h, 1.0);
    this.plate(drawLeanTo(72), LEAN_TO.x, LEAN_TO.z, LEAN_TO.h, 1.4);
    this.chimeCut = this.plate(drawChimeStand(73, done), CHIME.x, CHIME.z, CHIME.h, 0.5);
    this.placeCoffer('repair-commons');
    for (const [i, f] of FASTENERS.entries())
      this.plate(drawFastener(75 + i), f.x, f.z, 0.24, 0.12);
    this.plate(drawPatchedFence(77), PATCHED_FENCE.x, PATCHED_FENCE.z, PATCHED_FENCE.h, 0.6);
    if (done) this.placeCommonsClues();
  }

  private placeGarden(): void {
    const done = this.completed('pump-garden');
    if (done) this.channelOn = [true, true];
    this.pumpCut = this.plate(drawPumpWheel(80, done), PUMP.x, PUMP.z, PUMP.h, 0.9);
    for (const [i, ch] of CHANNELS.entries()) {
      this.channelCuts[i] = this.plate(drawChannel(83 + i, done, done), ch.x, ch.z, ch.h, 0.5);
    }
    for (const [i, p] of PLANTERS.entries()) {
      this.planterCuts[i] = this.plate(drawFloatingPlanter(85 + i, done), p.x, p.z, 0.7, 0);
    }
    this.plate(drawRibbonScrap(87), 38, 78, 0.35, 0.1); // last ribbon meets the stakes
    for (const [i, s] of STAKES.entries()) this.plate(drawBlueStake(88 + i), s.x, s.z, 0.5, 0.1);
    this.placeCoffer('pump-garden');
    if (done) this.placeGardenClues();
  }

  private placeCamp(): void {
    const done = this.completed('relay-camp');
    if (done) this.vanePos = [VANE_TARGET[0], VANE_TARGET[1]];
    this.relayCut = this.plate(drawRelayMast(90, done), RELAY_MAST.x, RELAY_MAST.z, RELAY_MAST.h, 0.9);
    this.plate(drawToolShelter(91), SHELTER.x, SHELTER.z, SHELTER.h, 1.2);
    this.plate(drawCableSpool(92), SPOOL.x, SPOOL.z, SPOOL.h, 0.5);
    for (const [i, v] of VANES.entries()) {
      this.vaneCuts[i] = this.plate(
        drawSignalVane(93 + i, this.vanePos[i] as 0 | 1 | 2),
        v.x,
        v.z,
        v.h,
        0.4,
      );
    }
    for (const [i, m] of TRI_MARKS.entries())
      this.plate(drawTriangleMark(95 + i), m.x, m.z, 0.3, 0.1);
    this.placeCoffer('relay-camp');
  }

  private placeCoffer(id: LandmarkId): void {
    const area = this.field.get(id)!;
    const look = COFFER_LOOK[id];
    const cut = this.plate(
      look.draw(area.cofferOpened),
      area.def.coffer.x,
      area.def.coffer.z,
      look.h,
      0.5,
    );
    this.cofferCuts.set(id, cut);
  }

  /** The Commons aftermath: the pinned garden notice + the ribbon trail. */
  private placeCommonsClues(): void {
    if (this.commonsCluesPlaced) return;
    this.commonsCluesPlaced = true;
    this.plate(drawPumpNotice(78), NOTICE.x, NOTICE.z, NOTICE.h, 0.2, 2);
    for (const [i, r] of RIBBONS.entries())
      this.plate(drawRibbonScrap(79 + i), r.x, r.z, 0.35, 0.1);
  }

  /** The Garden aftermath: the relay tag clue + the waiting donation socket. */
  private placeGardenClues(): void {
    if (this.gardenCluesPlaced) return;
    this.gardenCluesPlaced = true;
    this.plate(drawRelayTag(96), TAG.x, TAG.z, TAG.h, 0.12, 2);
    this.socketCut = this.plate(
      drawPlanterSocket(97, this.field.socketFilled),
      SOCKET.x,
      SOCKET.z,
      SOCKET.h,
      0.35,
    );
  }

  private completed(id: LandmarkId): boolean {
    return this.field.get(id)!.progress === 'completed';
  }

  private plate(
    sprite: { canvas: HTMLCanvasElement; aspect: number },
    x: number,
    z: number,
    height: number,
    shadowRadius: number,
    renderOrder?: number,
  ): Cutout {
    const cut = new Cutout(sprite, { height, shadowRadius, renderOrder });
    this.deps.place(cut, x, z);
    return cut;
  }

  private replate(
    old: Cutout | null,
    sprite: { canvas: HTMLCanvasElement; aspect: number },
    x: number,
    z: number,
    height: number,
    shadowRadius: number,
  ): Cutout {
    if (old) {
      old.group.removeFromParent();
      old.dispose();
    }
    return this.plate(sprite, x, z, height, shadowRadius);
  }

  // --- companion thread (§6) --------------------------------------------------

  /** The Companion's landmark anchor provider: nearest unseen area whose
   *  notice radius contains the player. */
  noticeAnchor(px: number, pz: number): LandmarkAnchor | null {
    const a = this.field.nearestNoticeable(px, pz);
    return a ? { id: a.def.id, x: a.def.center.x, z: a.def.center.z } : null;
  }

  /** Datou's notice beat began — the area is now 'noticed'. */
  onNoticed(id: string): void {
    if (this.field.notice(id as LandmarkId)) this.persist();
  }

  /** The scripted first hook fires once (§6): Game checks the preconditions
   *  (home coffer opened + one make); we keep the once-ever flag. */
  takeFirstHook(): LandmarkAnchor | null {
    if (this.field.firstHookDone) return null;
    const commons = this.field.get('repair-commons')!;
    if (commons.progress !== 'unseen') {
      // Already found another way — never script over real discovery.
      this.field.firstHookDone = true;
      this.persist();
      return null;
    }
    this.field.firstHookDone = true;
    this.persist();
    return { id: 'repair-commons', x: commons.def.center.x, z: commons.def.center.z };
  }

  // --- interaction routing -----------------------------------------------------

  /** The landmark interactive under a world tap, if any. */
  target(x: number, z: number): LandmarkTarget | null {
    const near = (px: number, pz: number, r: number): boolean => Math.hypot(x - px, z - pz) <= r;
    if (near(CHIME.x, CHIME.z, 1.8)) {
      return { kind: 'chime', area: 'repair-commons', x: CHIME.x, z: CHIME.z };
    }
    for (const [i, ch] of CHANNELS.entries()) {
      if (near(ch.x, ch.z, 1.7)) {
        return { kind: 'channel', area: 'pump-garden', index: i as 0 | 1, x: ch.x, z: ch.z };
      }
    }
    for (const [i, v] of VANES.entries()) {
      if (near(v.x, v.z, 1.6)) {
        return { kind: 'vane', area: 'relay-camp', index: i as 0 | 1, x: v.x, z: v.z };
      }
    }
    if (this.completed('pump-garden') && near(SOCKET.x, SOCKET.z, 1.5)) {
      return { kind: 'socket', area: 'pump-garden', x: SOCKET.x, z: SOCKET.z };
    }
    for (const a of this.field.areas) {
      const c = a.def.coffer;
      if (!a.cofferOpened && near(c.x, c.z, 1.6)) {
        return { kind: 'coffer', area: a.def.id, x: c.x, z: c.z };
      }
    }
    return null;
  }

  /** Engage a landmark interactive (the player is standing at it). */
  engage(target: LandmarkTarget): void {
    switch (target.kind) {
      case 'coffer':
        this.openCoffer(target.area);
        break;
      case 'chime':
        this.engageChime();
        break;
      case 'channel':
        this.engageChannel(target.index ?? 0);
        break;
      case 'vane':
        this.engageVane(target.index ?? 0);
        break;
      case 'socket':
        // A tap without a planter in hand: the socket says what it waits for.
        if (!this.field.socketFilled) this.deps.toast(t('landmark.garden.socketWaits'));
        break;
    }
  }

  /**
   * Donation socket (§7B): called by the game while the player is placing a
   * made item — a planter tapped onto the socket installs there instead.
   */
  tryDonate(x: number, z: number, form: FormId): boolean {
    if (form !== 'planter' || this.field.socketFilled) return false;
    if (!this.completed('pump-garden')) return false;
    if (Math.hypot(x - SOCKET.x, z - SOCKET.z) > 1.6) return false;
    this.field.socketFilled = true;
    this.persist();
    this.socketCut = this.replate(
      this.socketCut,
      drawPlanterSocket(97, true),
      SOCKET.x,
      SOCKET.z,
      SOCKET.h,
      0.35,
    );
    this.deps.datouBeat();
    this.deps.memory('landmark.socket');
    this.deps.toast(t('landmark.garden.socketFilled'));
    return true;
  }

  // --- A. the chime repair ------------------------------------------------------

  private engageChime(): void {
    if (this.completed('repair-commons')) {
      this.deps.toast(t('landmark.commons.chimeAgain'));
      return;
    }
    const beat = this.beats['repair-commons'];
    if (beat.phase !== 'idle') return;
    if (this.deps.countTwig() < 1) {
      // The information gap stays open and names its key: one common twig.
      this.deps.toast(t('landmark.commons.chimeNeedsPart'));
      return;
    }
    // Datou comes to brace the post; the repair runs when he's in position.
    this.deps.sendDatou(CHIME.x, CHIME.z);
    beat.phase = 'datou-coming';
    beat.left = 14; // generous travel allowance before giving up quietly
    this.deps.toast(t('landmark.commons.chimeStart'));
  }

  private completeChime(): void {
    if (!this.deps.takeTwig()) return; // pack changed mid-beat — stay tangled
    this.field.complete('repair-commons');
    this.persist();
    // The place changes and stays changed: chime hangs true, mast lamp lit.
    this.chimeCut = this.replate(this.chimeCut, drawChimeStand(73, true), CHIME.x, CHIME.z, CHIME.h, 0.5);
    this.mastCut = this.replate(this.mastCut, drawPennantMast(71, true), MAST.x, MAST.z, MAST.h, 1.0);
    this.placeCommonsClues();
    this.deps.datouBeat();
    this.deps.memory('landmark.repair-commons');
    this.deps.toast(t('landmark.commons.chimeDone'));
  }

  // --- B. the water loop ----------------------------------------------------------

  private engageChannel(i: 0 | 1): void {
    if (this.completed('pump-garden')) {
      this.deps.toast(t('landmark.garden.again'));
      return;
    }
    if (this.beats['pump-garden'].phase !== 'idle') return;
    if (this.channelOn[i]) {
      this.deps.toast(t('landmark.garden.channelSet'));
      return;
    }
    this.channelOn[i] = true;
    this.channelCuts[i] = this.replate(
      this.channelCuts[i],
      drawChannel(83 + i, true, false),
      CHANNELS[i].x,
      CHANNELS[i].z,
      CHANNELS[i].h,
      0.5,
    );
    if (this.channelOn[0] && this.channelOn[1]) {
      // The loop is whole — Datou takes his station at the pump.
      const beat = this.beats['pump-garden'];
      this.deps.sendDatou(PUMP.x, PUMP.z);
      beat.phase = 'datou-coming';
      beat.left = 16;
      this.deps.toast(t('landmark.garden.pumping'));
    } else {
      this.deps.toast(t('landmark.garden.channelTurned'));
    }
  }

  private completeGarden(): void {
    this.field.complete('pump-garden');
    this.persist();
    // Water travels: wheel runs, channels carry, paper plants lift and color.
    this.pumpCut = this.replate(this.pumpCut, drawPumpWheel(80, true), PUMP.x, PUMP.z, PUMP.h, 0.9);
    for (const [i, ch] of CHANNELS.entries()) {
      this.channelCuts[i] = this.replate(this.channelCuts[i], drawChannel(83 + i, true, true), ch.x, ch.z, ch.h, 0.5);
    }
    for (const [i, p] of PLANTERS.entries()) {
      this.planterCuts[i] = this.replate(this.planterCuts[i], drawFloatingPlanter(85 + i, true), p.x, p.z, 0.7, 0);
    }
    this.placeGardenClues();
    this.deps.datouBeat();
    this.deps.memory('landmark.pump-garden');
    this.deps.toast(t('landmark.garden.done'));
  }

  // --- C. the relay tuning ----------------------------------------------------------

  private engageVane(i: 0 | 1): void {
    if (this.completed('relay-camp')) {
      this.deps.toast(t('landmark.camp.again'));
      return;
    }
    if (this.beats['relay-camp'].phase !== 'idle') return;
    this.vanePos[i] = (this.vanePos[i] + 1) % 3;
    this.vaneCuts[i] = this.replate(
      this.vaneCuts[i],
      drawSignalVane(93 + i, this.vanePos[i] as 0 | 1 | 2),
      VANES[i].x,
      VANES[i].z,
      VANES[i].h,
      0.4,
    );
    if (this.vanePos[0] === VANE_TARGET[0] && this.vanePos[1] === VANE_TARGET[1]) {
      // Both true — Datou goes very still, then gives the mast his attention.
      const beat = this.beats['relay-camp'];
      this.deps.sendDatou(RELAY_MAST.x, RELAY_MAST.z);
      beat.phase = 'datou-coming';
      beat.left = 16;
      this.deps.toast(t('landmark.camp.aligned'));
    } else if (this.vanePos[i] === VANE_TARGET[i]) {
      // Datou is the meter: the ear-lift beat says this one landed true (§7C).
      this.deps.datouBeat();
      this.deps.toast(t('landmark.camp.vaneGood'));
    } else {
      this.deps.toast(t('landmark.camp.vaneTurn'));
    }
  }

  private completeCamp(): void {
    this.field.complete('relay-camp');
    this.persist();
    this.relayCut = this.replate(
      this.relayCut,
      drawRelayMast(90, true),
      RELAY_MAST.x,
      RELAY_MAST.z,
      RELAY_MAST.h,
      0.9,
    );
    this.deps.datouBeat();
    this.deps.memory('landmark.relay-camp');
    // The response tone carries the ruin-stones mark — the next mystery is
    // already standing in the far meadow corner (§7C); no new content needed.
    this.deps.toast(t('landmark.camp.done'));
  }

  // --- per-frame ---------------------------------------------------------------

  update(dt: number, playerX: number, playerZ: number): void {
    // Arrival: stepping into an activity ring names the place (once).
    const here = this.field.areaAt(playerX, playerZ);
    if (here && here.progress !== 'completed' && this.field.arrive(here.def.id)) {
      this.persist();
      this.deps.toast(tDyn(`landmark.${here.def.id}.arrive`));
    }

    // The cooperative beats (chime brace / pump run / relay wake).
    this.advanceBeat('repair-commons', CHIME, () => this.completeChime(), dt);
    this.advanceBeat('pump-garden', PUMP, () => this.completeGarden(), dt);
    this.advanceBeat('relay-camp', RELAY_MAST, () => this.completeCamp(), dt);

    // The coffer tell: within 4–6 m of an unopened coffer Datou paws at it.
    if (this.tellCooldown > 0) this.tellCooldown -= dt;
    if (this.tellCooldown <= 0) {
      const d = this.deps.datouPos();
      const near = this.field.nearestUnopenedCoffer(d.x, d.z, TELL_RANGE);
      // Only at an arrived area — the tell is a nudge, not a tractor beam.
      if (near && near.progress !== 'unseen') {
        this.tellCooldown = TELL_COOLDOWN;
        this.deps.datouBeat();
      }
    }
  }

  private advanceBeat(
    id: LandmarkId,
    station: { x: number; z: number },
    complete: () => void,
    dt: number,
  ): void {
    const beat = this.beats[id];
    if (beat.phase === 'datou-coming') {
      beat.left -= dt;
      const d = this.deps.datouPos();
      if (Math.hypot(d.x - station.x, d.z - station.z) <= REACH) {
        beat.phase = 'working';
        beat.left = WORK_SECONDS;
        beat.beatIn = 0;
      } else if (beat.left <= 0) {
        beat.phase = 'idle'; // path blocked — no punishment, try again
      }
    } else if (beat.phase === 'working') {
      beat.left -= dt;
      beat.beatIn -= dt;
      if (beat.beatIn <= 0) {
        beat.beatIn = 0.9;
        this.deps.datouBeat(); // steady working pulses
        // Keep him at his station — follow mode would otherwise pull him
        // back to the player mid-beat once the approach resolves.
        const d = this.deps.datouPos();
        if (Math.hypot(d.x - station.x, d.z - station.z) > REACH + 0.3) {
          this.deps.sendDatou(station.x, station.z);
        }
      }
      if (beat.left <= 0) {
        beat.phase = 'idle';
        complete();
      }
    }
  }

  private openCoffer(id: LandmarkId): void {
    const area = this.field.get(id);
    if (!area || !this.field.openCoffer(id)) return;
    this.persist();
    // The reward contract (§9): full blueprint + exactly one build's stock.
    this.deps.grantBlueprint(area.def.coffer.blueprintForm, tDyn(`coffer.${id}.context`));
    for (const [mat, n] of Object.entries(area.def.coffer.materials)) {
      this.deps.grantMaterial(mat as MaterialId, n);
    }
    const look = COFFER_LOOK[id];
    this.cofferCuts.set(
      id,
      this.replate(
        this.cofferCuts.get(id) ?? null,
        look.draw(true),
        area.def.coffer.x,
        area.def.coffer.z,
        look.h,
        0.5,
      ),
    );
    this.deps.datouBeat();
    this.deps.memory(`landmark.coffer.${id}`);
    this.deps.toast(tDyn(`coffer.${id}.opened`));
  }

  /** Areas the minimap may mark (arrived or completed — the reveal layer). */
  mapMarks(): Array<{ id: LandmarkId; x: number; z: number; completed: boolean }> {
    return this.field.areas
      .filter((a) => a.progress === 'arrived' || a.progress === 'completed')
      .map((a) => ({
        id: a.def.id,
        x: a.def.center.x,
        z: a.def.center.z,
        completed: a.progress === 'completed',
      }));
  }

  private persist(): void {
    const data = this.field.serialize();
    data.v = LANDMARKS_VERSION;
    this.deps.save(data);
  }
}

export type { LandmarkArea };
