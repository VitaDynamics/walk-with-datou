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
  drawButterflies,
  drawCableSpool,
  drawChannel,
  drawChimeStand,
  drawCloverPatch,
  drawCrate,
  drawDonatedChime,
  drawDragonfly,
  drawEchoBell,
  drawFallenLintel,
  drawFastener,
  drawFeatherWand,
  drawFieldCase,
  drawFloatingPlanter,
  drawHoseCoil,
  drawInkcap,
  drawLeanTo,
  drawLogSeat,
  drawMarkedStone,
  drawMoonFern,
  drawMoth,
  drawPatchBall,
  drawPatchedFence,
  drawPennantMast,
  drawPerchedBird,
  drawPlankStack,
  drawPlanterSocket,
  drawPumpNotice,
  drawPumpWheel,
  drawReedRing,
  drawRelayMast,
  drawRelayTag,
  drawRibbonScrap,
  drawRowMarker,
  drawSapling,
  drawSeedRattle,
  drawSignalVane,
  drawSpotterTube,
  drawSquirrel,
  drawStoneOrb,
  drawToolShelter,
  drawTrailBloom,
  drawTriangleMark,
  drawWatchPost,
  drawWaterBarrel,
  drawWaterIris,
  drawWheelingBirds,
  drawWindGrass,
} from '../art/landmarkProps';
import { Rng } from '../physics/mujoco/rng';
import { Cutout } from '../world/Cutout';
import {
  LANDMARK_DEFS,
  LANDMARKS_VERSION,
  LandmarkField,
  type LandmarkArea,
  type LandmarkId,
} from '../world/landmarks';
import { dailySeed } from '../world/Spots';
import type { LandmarkAnchor } from './Companion';
import type { MaterialId } from './workshop/materials';
import type { FormId } from './workshop/forms';
import type { Personality } from './workshop/inspiration';
import { finishesFor, isValid, itemId, sizesFor } from './workshop/items';
import { itemHeight, itemSprite } from './workshop/sprites';
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
  /** Datou's emergent personality — shades presentation only (§6). */
  personality(): Personality;
  /** A quiet synthesized sound cue (Phase 3 — never load-bearing). */
  cue(kind: 'chime' | 'response'): void;
  /** Bank a curio into the Notebook (the time-capsule keepsake). */
  bankCurio(tone: number): void;
  /** A round of toy play happened — feeds the playful personality axis. */
  notePlay(): void;
  load(): unknown;
  save(data: unknown): void;
}

/** What a world tap near a landmark interactive resolves to. */
export interface LandmarkTarget {
  kind:
    | 'chime'
    | 'coffer'
    | 'channel'
    | 'vane'
    | 'socket'
    | 'hollow'
    | 'toy'
    | 'stone'
    | 'tube'
    | 'sapling';
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
// Dressing — supporting cast spread through the ring so the Commons reads as
// a worked-in AREA, not an island of hero props (Phase 3).
const PLANKS = { x: 124.5, z: -33.5, h: 0.6 };
const CRATE_A = { x: 119.8, z: -25, h: 0.55 };
const FENCE_B = { x: 133, z: -31.5, h: 0.95 };
const FASTENER_C = { x: 129.5, z: -23.5 };
// The donated chime hangs on its own hook by the lean-to (§9 first use).
const DONATED_CHIME = { x: 123.6, z: -28.6, h: 1.3 };

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
  { x: 15, z: 119 },
];
const SOCKET = { x: 17.5, z: 106, h: 0.6 };
// Approach: the ribbon trail resolves into painted irrigation stakes.
const STAKES = [
  { x: 27, z: 92 },
  { x: 21, z: 100 },
];
// The clue onward: a stamped relay tag in a planter, placed on completion.
const TAG = { x: 15.5, z: 109.8, h: 0.35 };
// Dressing — the gardener's working clutter around the ring.
const HOSE = { x: 11.5, z: 107.5, h: 0.4 };
const STAKE_C = { x: 10, z: 113, h: 0.5 };

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
// Dressing — log seats and a parts crate make it a camp someone lived at.
const LOG_SEATS = [
  { x: -112, z: -102, h: 0.5 },
  { x: -116, z: -103, h: 0.5 },
];
const CRATE_B = { x: -110.5, z: -105.5, h: 0.55 };
const TRI_MARK_IN = { x: -114.5, z: -101.8, h: 0.3 };
// The volunteers' time capsule hides in the hollow beneath the Old Pine —
// findable only after the relay wakes (Phase 3 secret).
const HOLLOW = { x: -120, z: -110 };

// --- D. Ruin Stones composition --------------------------------------------------
// The existing ruin rocks (168,−162 · 171,−158.5 · 165.5,−159) are the bones;
// we add the marked slab, the fallen lintel sheltering the satchel, and life.
const MARKED_STONE = { x: 169.5, z: -163.5, h: 1.9 };
const LINTEL = { x: 164.5, z: -157.8, h: 0.7 };
const MOTH = { x: 166.8, z: -161.5, h: 0.3 };

// --- E. Watchers' Knoll composition ------------------------------------------------
const WATCH_POST = { x: -99.5, z: 86, h: 2.2 };
const SPOTTER = { x: -96.5, z: 88.5, h: 1.4 };
const BIRDS = { x: -98, z: 85, h: 2.6 };

// --- F. Meadow Orchard composition ---------------------------------------------------
// Three saplings in a row; the middle one slipped its stake (the activity).
const SAPLINGS = [
  { x: 57, z: -112.5, leaning: false },
  { x: 61, z: -109, leaning: true },
  { x: 64.5, z: -113, leaning: false },
] as const;
const BARREL = { x: 56.5, z: -107.5, h: 0.95 };
const ROW_MARKERS = [
  { x: 54, z: -111.5 },
  { x: 66.5, z: -110.5 },
];
const BUTTERFLIES = { x: 62, z: -107.8, h: 0.5 };

/** Datou's toy per area — left by the volunteers, his to play with. */
const TOYS: Record<LandmarkId, { x: number; z: number; h: number }> = {
  'repair-commons': { x: 128.8, z: -26.2, h: 0.42 },
  'pump-garden': { x: 12.5, z: 114.2, h: 0.42 },
  'relay-camp': { x: -112.2, z: -108.2, h: 0.72 },
  'ruin-stones': { x: 171.5, z: -156.5, h: 0.4 },
  'watch-knoll': { x: -95, z: 90.5, h: 0.5 },
  'meadow-orchard': { x: 63.5, z: -106.8, h: 0.35 },
};

const REACH = 1.4; // Datou close enough to brace/work
const WORK_SECONDS = 2.6; // the calm cooperative beat
const TELL_COOLDOWN = 12; // s between coffer paw-tells
const TELL_RANGE = 5; // m (§9: 4–6 m)

/** Per-area coffer plate variant: patched chest / blue chest / metal case. */
const COFFER_LOOK: Record<LandmarkId, { h: number; draw: (open: boolean) => ReturnType<typeof drawCoffer> }> = {
  'repair-commons': { h: 0.7, draw: (open) => drawCoffer(74, open, true) },
  'pump-garden': { h: 0.7, draw: (open) => drawBlueCoffer(81, open) },
  'relay-camp': { h: 0.55, draw: (open) => drawFieldCase(82, open) },
  'ruin-stones': { h: 0.6, draw: (open) => drawCoffer(118, open) },
  'watch-knoll': { h: 0.6, draw: (open) => drawCoffer(119, open, true) },
  'meadow-orchard': { h: 0.6, draw: (open) => drawCoffer(127, open) },
};

type BeatPhase = 'idle' | 'datou-coming' | 'working';

interface Beat {
  phase: BeatPhase;
  left: number;
  beatIn: number;
  /** Where Datou works this beat (set on engage — activity or toy). */
  station: { x: number; z: number } | null;
  /** What happens when the beat lands. */
  onDone: (() => void) | null;
}

export class LandmarkDirector {
  readonly field = new LandmarkField();
  private readonly deps: LandmarkDirectorDeps;

  // One cooperative beat per area (chime brace / pump run / relay wake).
  private readonly beats = Object.fromEntries(
    LANDMARK_DEFS.map((d) => [d.id, { phase: 'idle', left: 0, beatIn: 0, station: null, onDone: null }]),
  ) as Record<LandmarkId, Beat>;
  private tellCooldown = 0;
  /** Passing the repaired chime re-lures with its quiet ring (§7A). */
  private relureCooldown = 0;

  // Session-local activity progress (completion persists via the field).
  private channelOn = [false, false];
  private vanePos: [number, number] = [0, 0];

  // Re-plateable cutouts.
  private mastCut: Cutout | null = null;
  private chimeCut: Cutout | null = null;
  private pumpCut: Cutout | null = null;
  private channelCuts: (Cutout | null)[] = [null, null];
  private planterCuts: (Cutout | null)[] = PLANTERS.map(() => null);
  private socketCut: Cutout | null = null;
  private relayCut: Cutout | null = null;
  private vaneCuts: (Cutout | null)[] = [null, null];
  private stoneCut: Cutout | null = null;
  private tubeCut: Cutout | null = null;
  private saplingCuts: (Cutout | null)[] = SAPLINGS.map(() => null);
  private readonly cofferCuts = new Map<LandmarkId, Cutout>();
  private commonsCluesPlaced = false;
  private gardenCluesPlaced = false;

  constructor(deps: LandmarkDirectorDeps) {
    this.deps = deps;
    this.field.restore(deps.load());
    this.placeCommons();
    this.placeGarden();
    this.placeCamp();
    this.placeRuins();
    this.placeKnoll();
    this.placeOrchard();
  }

  // --- world dressing --------------------------------------------------------

  private placeCommons(): void {
    const done = this.completed('repair-commons');
    this.mastCut = this.plate(drawPennantMast(this.vary(71, done), done), MAST.x, MAST.z, MAST.h, 1.0);
    this.plate(drawLeanTo(72), LEAN_TO.x, LEAN_TO.z, LEAN_TO.h, 1.4);
    this.chimeCut = this.plate(drawChimeStand(this.vary(73, done), done), CHIME.x, CHIME.z, CHIME.h, 0.5);
    this.placeCoffer('repair-commons');
    for (const [i, f] of FASTENERS.entries())
      this.plate(drawFastener(75 + i), f.x, f.z, 0.24, 0.12);
    this.plate(drawPatchedFence(77), PATCHED_FENCE.x, PATCHED_FENCE.z, PATCHED_FENCE.h, 0.6);
    // Dressing: the volunteers' working clutter through the ring (Phase 3).
    this.plate(drawPlankStack(101), PLANKS.x, PLANKS.z, PLANKS.h, 0.45);
    this.plate(drawCrate(102, 'patch'), CRATE_A.x, CRATE_A.z, CRATE_A.h, 0.35);
    this.plate(drawPatchedFence(103), FENCE_B.x, FENCE_B.z, FENCE_B.h, 0.6);
    this.plate(drawFastener(104), FASTENER_C.x, FASTENER_C.z, 0.24, 0.12);
    // The life layer: the volunteers' planting, a regular visitor, made
    // furnishings from the same item space the player crafts from, and a toy.
    this.clusterPlates(drawTrailBloom, 7, 126, -28, 5, 13, 0.5, 0x7a11);
    this.plate(drawPerchedBird(120), 133.8, -28.2, 0.42, 0.1);
    this.placeMadeItem('table', 'plank', 124, -31.2);
    this.placeMadeItem('bench', 'plank', 129.6, -24.6);
    this.placeMadeItem('cache-box', 'plank', 121.2, -24.2);
    const toyA = TOYS['repair-commons'];
    this.plate(drawPatchBall(121), toyA.x, toyA.z, toyA.h, 0.25);
    if (this.field.chimeDonated) this.placeDonatedChime();
    if (done) this.placeCommonsClues();
  }

  /** The player's donated chime on its hook by the lean-to. */
  private placeDonatedChime(): void {
    this.plate(drawDonatedChime(105), DONATED_CHIME.x, DONATED_CHIME.z, DONATED_CHIME.h, 0.3);
  }

  /** Daily revisit variation: completed-state plates re-seed each day, so a
   *  restored place is subtly redrawn every morning (Phase 3). */
  private vary(seed: number, done: boolean): number {
    return done ? (seed ^ dailySeed()) >>> 0 : seed;
  }

  private placeGarden(): void {
    const done = this.completed('pump-garden');
    if (done) this.channelOn = [true, true];
    this.pumpCut = this.plate(drawPumpWheel(this.vary(80, done), done), PUMP.x, PUMP.z, PUMP.h, 0.9);
    this.plate(drawHoseCoil(106), HOSE.x, HOSE.z, HOSE.h, 0.3);
    this.plate(drawBlueStake(107), STAKE_C.x, STAKE_C.z, STAKE_C.h, 0.1);
    for (const [i, ch] of CHANNELS.entries()) {
      this.channelCuts[i] = this.plate(drawChannel(83 + i, done, done), ch.x, ch.z, ch.h, 0.5);
    }
    for (const [i, p] of PLANTERS.entries()) {
      this.planterCuts[i] = this.plate(drawFloatingPlanter(85 + i, done), p.x, p.z, 0.7, 0);
    }
    this.plate(drawRibbonScrap(87), 38, 78, 0.35, 0.1); // last ribbon meets the stakes
    for (const [i, s] of STAKES.entries()) this.plate(drawBlueStake(88 + i), s.x, s.z, 0.5, 0.1);
    this.placeCoffer('pump-garden');
    // The life layer: water iris in the shallows, dragonflies, woven and
    // stone furnishings, and the splash ring at the water's edge.
    this.clusterPlates(drawWaterIris, 6, 15, 113, 3, 9, 0.65, 0x7a12);
    this.plate(drawDragonfly(122), 16.5, 114.8, 0.5, 0);
    this.plate(drawDragonfly(123), 10.5, 115.8, 0.45, 0);
    this.placeMadeItem('basket', 'reed', 12.4, 105.6);
    this.placeMadeItem('trellis', 'reed', 18.4, 108.6);
    this.placeMadeItem('drinking-bowl', 'flat-stone', 15.6, 104.6);
    const toyB = TOYS['pump-garden'];
    this.plate(drawReedRing(124), toyB.x, toyB.z, toyB.h, 0.2);
    if (done) this.placeGardenClues();
  }

  private placeCamp(): void {
    const done = this.completed('relay-camp');
    if (done) this.vanePos = [VANE_TARGET[0], VANE_TARGET[1]];
    this.relayCut = this.plate(drawRelayMast(this.vary(90, done), done), RELAY_MAST.x, RELAY_MAST.z, RELAY_MAST.h, 0.9);
    this.plate(drawToolShelter(91), SHELTER.x, SHELTER.z, SHELTER.h, 1.2);
    this.plate(drawCableSpool(92), SPOOL.x, SPOOL.z, SPOOL.h, 0.5);
    for (const [i, seat] of LOG_SEATS.entries())
      this.plate(drawLogSeat(108 + i), seat.x, seat.z, seat.h, 0.4);
    this.plate(drawCrate(110, 'triangle'), CRATE_B.x, CRATE_B.z, CRATE_B.h, 0.35);
    this.plate(drawTriangleMark(111), TRI_MARK_IN.x, TRI_MARK_IN.z, TRI_MARK_IN.h, 0.1);
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
    // The life layer: ink-caps spreading from the pines, the camp's tenant,
    // made furnishings, and the echo bell Datou can boop.
    this.clusterPlates(drawInkcap, 7, -114, -104, 5, 11, 0.4, 0x7a13);
    this.plate(drawSquirrel(125), -117.8, -107.8, 0.45, 0.12);
    this.placeMadeItem('stool', 'log', -112.8, -103);
    this.placeMadeItem('lamp', 'driftwood', -116.8, -105);
    this.placeMadeItem('mat', 'grass-wisp', -115.5, -99.5);
    const toyC = TOYS['relay-camp'];
    this.plate(drawEchoBell(126), toyC.x, toyC.z, toyC.h, 0.3);
  }

  private placeRuins(): void {
    const done = this.completed('ruin-stones');
    this.stoneCut = this.plate(
      drawMarkedStone(this.vary(112, done), done),
      MARKED_STONE.x,
      MARKED_STONE.z,
      MARKED_STONE.h,
      0.7,
    );
    this.plate(drawFallenLintel(113), LINTEL.x, LINTEL.z, LINTEL.h, 0.8);
    this.placeCoffer('ruin-stones');
    // Life: moon-fern among the stones, a patient moth, things visitors left.
    this.clusterPlates(drawMoonFern, 6, 168, -160, 4, 10, 0.45, 0x7a14);
    this.plate(drawMoth(114), MOTH.x, MOTH.z, MOTH.h, 0.08);
    this.placeMadeItem('cairn', 'pebble', 166, -163.8);
    this.placeMadeItem('memory-frame', 'driftwood', 171.8, -161.8);
    const toy = TOYS['ruin-stones'];
    this.plate(drawStoneOrb(115), toy.x, toy.z, toy.h, 0.22);
  }

  private placeKnoll(): void {
    const done = this.completed('watch-knoll');
    this.plate(drawWatchPost(116), WATCH_POST.x, WATCH_POST.z, WATCH_POST.h, 0.6);
    this.tubeCut = this.plate(
      drawSpotterTube(this.vary(117, done), done),
      SPOTTER.x,
      SPOTTER.z,
      SPOTTER.h,
      0.5,
    );
    this.placeCoffer('watch-knoll');
    // Life: wind-grass silvering the rise, the watchers' bench, a regular.
    this.clusterPlates(drawWindGrass, 8, -98, 88, 3, 9, 0.7, 0x7a15);
    this.plate(drawPerchedBird(128), -101.5, 85, 0.42, 0.1);
    this.placeMadeItem('bench', 'plank', -101, 89.5);
    const toy = TOYS['watch-knoll'];
    this.plate(drawFeatherWand(129), toy.x, toy.z, toy.h, 0.12);
    if (done) this.placeKnollBirds();
  }

  /** The knoll's completion made visible: swifts wheeling over the rise. */
  private placeKnollBirds(): void {
    this.plate(drawWheelingBirds(130), BIRDS.x, BIRDS.z, BIRDS.h, 0);
  }

  private placeOrchard(): void {
    const done = this.completed('meadow-orchard');
    for (const [i, sap] of SAPLINGS.entries()) {
      this.saplingCuts[i] = this.plate(
        drawSapling(this.vary(131 + i, done), sap.leaning && !done, done),
        sap.x,
        sap.z,
        1.9,
        0.6,
      );
    }
    this.plate(drawWaterBarrel(134), BARREL.x, BARREL.z, BARREL.h, 0.5);
    for (const [i, m] of ROW_MARKERS.entries())
      this.plate(drawRowMarker(135 + i), m.x, m.z, 0.5, 0.1);
    this.placeCoffer('meadow-orchard');
    // Life: clover sown for the bees, pollinators, the planters' furnishings.
    this.clusterPlates(drawCloverPatch, 6, 60, -110, 3, 9, 0.35, 0x7a16);
    this.plate(drawButterflies(137), BUTTERFLIES.x, BUTTERFLIES.z, BUTTERFLIES.h, 0);
    this.placeMadeItem('birdbath', 'flat-stone', 58.5, -114.5);
    this.placeMadeItem('stool', 'log', 65.5, -107.5);
    const toy = TOYS['meadow-orchard'];
    this.plate(drawSeedRattle(138), toy.x, toy.z, toy.h, 0.12);
    if (done) this.plate(drawButterflies(139), 59, -113.2, 0.5, 0);
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

  /** A seeded ring of small plates around a center — the special plants
   *  spreading each area's character into its surroundings. */
  private clusterPlates(
    draw: (seed: number) => { canvas: HTMLCanvasElement; aspect: number },
    n: number,
    cx: number,
    cz: number,
    rMin: number,
    rMax: number,
    h: number,
    seed: number,
  ): void {
    const rng = new Rng(seed);
    for (let i = 0; i < n; i++) {
      const a = rng.next() * Math.PI * 2;
      const d = rMin + rng.next() * (rMax - rMin);
      this.plate(
        draw((seed ^ (i * 2654435761)) >>> 0),
        cx + Math.cos(a) * d,
        cz + Math.sin(a) * d,
        h * (0.85 + rng.next() * 0.3),
        0.12,
      );
    }
  }

  /** Place a community-made Workshop item as world dressing — the same
   *  generative item space the player crafts from (volunteers made things
   *  here too). Skips quietly if the combination isn't in the item space. */
  private placeMadeItem(form: FormId, material: MaterialId, x: number, z: number): void {
    const sizes = sizesFor(form);
    const spec = {
      form,
      material,
      size: sizes[Math.min(1, sizes.length - 1)],
      finish: finishesFor(form)[0],
    };
    if (!isValid(spec)) return;
    const h = itemHeight(spec);
    this.plate(itemSprite(itemId(spec)), x, z, h, h * 0.4);
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
    // Personality shades presentation only (§6): an Explorer senses places
    // from farther out; a Guardian holds the gaze longer and softer. Every
    // personality can complete everything.
    const p = this.deps.personality();
    const scale = p === 'explorer' ? 1.2 : 1;
    const hold = p === 'guardian' ? 1.3 : 1;
    const a = this.field.nearestNoticeable(px, pz, scale);
    return a ? { id: a.def.id, x: a.def.center.x, z: a.def.center.z, hold } : null;
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
    // The Old Pine hollow opens up only once the relay is awake (Phase 3).
    if (this.completed('relay-camp') && !this.field.capsuleFound && near(HOLLOW.x, HOLLOW.z, 1.7)) {
      return { kind: 'hollow', area: 'relay-camp', x: HOLLOW.x, z: HOLLOW.z };
    }
    if (near(MARKED_STONE.x, MARKED_STONE.z, 1.8)) {
      return { kind: 'stone', area: 'ruin-stones', x: MARKED_STONE.x, z: MARKED_STONE.z };
    }
    if (near(SPOTTER.x, SPOTTER.z, 1.6)) {
      return { kind: 'tube', area: 'watch-knoll', x: SPOTTER.x, z: SPOTTER.z };
    }
    const lean = SAPLINGS.find((sp) => sp.leaning)!;
    if (near(lean.x, lean.z, 1.7)) {
      return { kind: 'sapling', area: 'meadow-orchard', x: lean.x, z: lean.z };
    }
    for (const a of this.field.areas) {
      const toy = TOYS[a.def.id];
      if (near(toy.x, toy.z, 1.5)) {
        return { kind: 'toy', area: a.def.id, x: toy.x, z: toy.z };
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
      case 'hollow':
        this.findCapsule();
        break;
      case 'toy':
        this.engageToy(target.area);
        break;
      case 'stone':
        this.engageStone();
        break;
      case 'tube':
        this.engageTube();
        break;
      case 'sapling':
        this.engageSapling();
        break;
    }
  }

  // --- D. tracing the mark -------------------------------------------------------

  private engageStone(): void {
    if (this.completed('ruin-stones')) {
      this.deps.toast(this.dailyLine('landmark.ruins.again', 2));
      return;
    }
    if (this.startBeat('ruin-stones', MARKED_STONE, () => this.completeRuins())) {
      this.deps.toast(t('landmark.ruins.trace'));
    }
  }

  private completeRuins(): void {
    this.field.complete('ruin-stones');
    this.persist();
    this.stoneCut = this.replate(
      this.stoneCut,
      drawMarkedStone(112, true),
      MARKED_STONE.x,
      MARKED_STONE.z,
      MARKED_STONE.h,
      0.7,
    );
    this.deps.datouBeat();
    this.deps.cue('response'); // the mark and the relay share a voice
    this.deps.memory('landmark.ruin-stones');
    // The recovered network sketch is the clue onward: a watchers' rise west
    // of home, planted rows in the high meadow — qualities, never arrows.
    this.deps.toast(t('landmark.ruins.done'));
  }

  // --- E. steadying the tube --------------------------------------------------------

  private engageTube(): void {
    if (this.completed('watch-knoll')) {
      this.deps.toast(this.dailyLine('landmark.knoll.again', 2));
      return;
    }
    if (this.startBeat('watch-knoll', SPOTTER, () => this.completeKnoll())) {
      this.deps.toast(t('landmark.knoll.steady'));
    }
  }

  private completeKnoll(): void {
    this.field.complete('watch-knoll');
    this.persist();
    this.tubeCut = this.replate(
      this.tubeCut,
      drawSpotterTube(117, true),
      SPOTTER.x,
      SPOTTER.z,
      SPOTTER.h,
      0.5,
    );
    this.placeKnollBirds();
    this.deps.datouBeat();
    this.deps.memory('landmark.watch-knoll');
    this.deps.toast(t('landmark.knoll.done'));
  }

  // --- F. re-staking the sapling -------------------------------------------------------

  private engageSapling(): void {
    if (this.completed('meadow-orchard')) {
      this.deps.toast(this.dailyLine('landmark.orchard.again', 2));
      return;
    }
    const lean = SAPLINGS.find((sp) => sp.leaning)!;
    if (this.startBeat('meadow-orchard', lean, () => this.completeOrchard())) {
      this.deps.toast(t('landmark.orchard.stake'));
    }
  }

  private completeOrchard(): void {
    this.field.complete('meadow-orchard');
    this.persist();
    for (const [i, sap] of SAPLINGS.entries()) {
      this.saplingCuts[i] = this.replate(
        this.saplingCuts[i],
        drawSapling(131 + i, false, true),
        sap.x,
        sap.z,
        1.9,
        0.6,
      );
    }
    this.plate(drawButterflies(139), 59, -113.2, 0.5, 0);
    this.deps.datouBeat();
    this.deps.memory('landmark.meadow-orchard');
    this.deps.toast(t('landmark.orchard.done'));
  }

  /** Datou's toy: he trots over, plays a round, and is pleased with himself.
   *  Repeatable, feeds the playful axis, never a chore. */
  private engageToy(id: LandmarkId): void {
    const toy = TOYS[id];
    this.startBeat(id, toy, () => {
      this.deps.notePlay();
      if (id === 'relay-camp') this.deps.cue('chime'); // the bell answers
      this.deps.toast(this.dailyLine(`landmark.toy.${id}`, 2));
    });
  }

  /** The volunteers' time capsule under the Old Pine — found once, with
   *  Datou's paw, after the relay wakes (Phase 3 secret). */
  private findCapsule(): void {
    if (this.field.capsuleFound || !this.completed('relay-camp')) return;
    this.field.capsuleFound = true;
    this.persist();
    this.deps.datouBeat();
    this.deps.bankCurio(dailySeed() % 5);
    this.deps.memory('landmark.capsule');
    this.deps.toast(t('landmark.capsule.found'));
  }

  /**
   * Donation socket (§7B): called by the game while the player is placing a
   * made item — a planter tapped onto the socket installs there instead.
   */
  tryDonate(x: number, z: number, form: FormId): boolean {
    // The garden's planter socket (§7B).
    if (
      form === 'planter' &&
      !this.field.socketFilled &&
      this.completed('pump-garden') &&
      Math.hypot(x - SOCKET.x, z - SOCKET.z) <= 1.6
    ) {
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
    // A crafted chime offered at the Commons hangs by the lean-to (§9's
    // intended first use — the remaining donation hook, Phase 3).
    if (
      form === 'chime' &&
      !this.field.chimeDonated &&
      this.completed('repair-commons') &&
      Math.hypot(x - DONATED_CHIME.x, z - DONATED_CHIME.z) <= 2.2
    ) {
      this.field.chimeDonated = true;
      this.persist();
      this.placeDonatedChime();
      this.deps.datouBeat();
      this.deps.memory('landmark.chime-donated');
      this.deps.toast(t('landmark.commons.chimeDonated'));
      return true;
    }
    return false;
  }

  // --- A. the chime repair ------------------------------------------------------

  /** Daily-rotating revisit line: same day, same line — new day, new one. */
  private dailyLine(prefix: string, n: number): string {
    return tDyn(`${prefix}.${dailySeed() % n}`);
  }

  /** Start a cooperative beat: Datou travels to the station, works it in
   *  steady pulses, then `onDone` lands. Shared by activities and toys. */
  private startBeat(
    id: LandmarkId,
    station: { x: number; z: number },
    onDone: () => void,
  ): boolean {
    const beat = this.beats[id];
    if (beat.phase !== 'idle') return false;
    this.deps.sendDatou(station.x, station.z);
    beat.phase = 'datou-coming';
    beat.left = 16; // generous travel allowance before giving up quietly
    beat.station = station;
    beat.onDone = onDone;
    return true;
  }

  private engageChime(): void {
    if (this.completed('repair-commons')) {
      this.deps.cue('chime');
      this.deps.toast(this.dailyLine('landmark.commons.again', 3));
      return;
    }
    if (this.beats['repair-commons'].phase !== 'idle') return;
    if (this.deps.countTwig() < 1) {
      // The information gap stays open and names its key: one common twig.
      this.deps.toast(t('landmark.commons.chimeNeedsPart'));
      return;
    }
    // Datou comes to brace the post; the repair runs when he's in position.
    if (this.startBeat('repair-commons', CHIME, () => this.completeChime())) {
      this.deps.toast(t('landmark.commons.chimeStart'));
    }
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
    this.deps.cue('chime');
    this.deps.memory('landmark.repair-commons');
    this.deps.toast(t('landmark.commons.chimeDone'));
  }

  // --- B. the water loop ----------------------------------------------------------

  private engageChannel(i: 0 | 1): void {
    if (this.completed('pump-garden')) {
      this.deps.toast(this.dailyLine('landmark.garden.again', 3));
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
      if (this.startBeat('pump-garden', PUMP, () => this.completeGarden())) {
        this.deps.toast(t('landmark.garden.pumping'));
      }
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
      // The waking relay murmurs a different log snippet each day.
      this.deps.toast(this.dailyLine('landmark.camp.snippet', 3));
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
      if (this.startBeat('relay-camp', RELAY_MAST, () => this.completeCamp())) {
        this.deps.toast(t('landmark.camp.aligned'));
      }
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
    // The one distant response tone (§7C) — it carries the ruin-stones mark;
    // the next mystery is already standing in the far meadow corner.
    this.deps.cue('response');
    this.deps.memory('landmark.relay-camp');
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

    // The cooperative beats (chime brace / pump run / relay wake / toy play).
    for (const a of this.field.areas) this.advanceBeat(a.def.id, dt);

    // The repaired chime is the Commons' audible re-lure: passing it rings
    // softly, on a long cooldown (§7A "chime sounds when the player passes").
    if (this.relureCooldown > 0) this.relureCooldown -= dt;
    if (
      this.relureCooldown <= 0 &&
      this.completed('repair-commons') &&
      Math.hypot(playerX - CHIME.x, playerZ - CHIME.z) <= 12
    ) {
      this.relureCooldown = 75;
      this.deps.cue('chime');
    }

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

  private advanceBeat(id: LandmarkId, dt: number): void {
    const beat = this.beats[id];
    const station = beat.station;
    const complete = beat.onDone;
    if (!station || !complete) {
      beat.phase = 'idle';
      return;
    }
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
        beat.station = null;
        beat.onDone = null;
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
