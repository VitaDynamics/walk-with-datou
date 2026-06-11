/**
 * LandmarkDirector — runs the authored community areas in the world
 * (landmark plan §10, Phase 1: the Trail Repair Commons).
 *
 * Owns the LandmarkField state + its wwd.landmarks persistence, places the
 * area's plates (and re-plates them on state change), advances the one
 * cooperative activity, and hands the Companion its notice anchors. Written
 * as plain area code on purpose — a shared activity state machine gets
 * extracted only when area 2 shows what is actually common (§10).
 *
 * Every beat routes through Datou: he hears the chime first (notice want),
 * braces the post while the player supplies the missing part, and paws the
 * coffer latch. The player is the hands; the robot is the partner.
 */

import { drawCoffer } from '../art/props';
import {
  drawChimeStand,
  drawFastener,
  drawLeanTo,
  drawPatchedFence,
  drawPennantMast,
  drawPumpNotice,
  drawRibbonScrap,
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
  kind: 'chime' | 'coffer';
  area: LandmarkId;
  x: number;
  z: number;
}

// --- Commons composition (authored placement, world metres) -----------------
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

const CHIME_REACH = 1.4; // Datou close enough to brace
const WORK_SECONDS = 2.6; // the calm repair beat
const TELL_COOLDOWN = 12; // s between coffer paw-tells
const TELL_RANGE = 5; // m (§9: 4–6 m)

type ChimePhase = 'idle' | 'datou-coming' | 'working';

export class LandmarkDirector {
  readonly field = new LandmarkField();
  private readonly deps: LandmarkDirectorDeps;

  private chimePhase: ChimePhase = 'idle';
  private workLeft = 0;
  private beatIn = 0;
  private tellCooldown = 0;

  // Re-plateable cutouts.
  private mastCut: Cutout | null = null;
  private chimeCut: Cutout | null = null;
  private cofferCut: Cutout | null = null;
  private cluesPlaced = false;

  constructor(deps: LandmarkDirectorDeps) {
    this.deps = deps;
    this.field.restore(deps.load());
    this.placeCommons();
  }

  // --- world dressing --------------------------------------------------------

  private placeCommons(): void {
    const area = this.field.get('repair-commons')!;
    const repaired = area.progress === 'completed';
    this.mastCut = this.plate(drawPennantMast(71, repaired), MAST.x, MAST.z, MAST.h, 1.0);
    this.plate(drawLeanTo(72), LEAN_TO.x, LEAN_TO.z, LEAN_TO.h, 1.4);
    this.chimeCut = this.plate(drawChimeStand(73, repaired), CHIME.x, CHIME.z, CHIME.h, 0.5);
    const c = area.def.coffer;
    this.cofferCut = this.plate(
      drawCoffer(74, area.cofferOpened, true),
      c.x,
      c.z,
      0.7,
      0.5,
    );
    for (const [i, f] of FASTENERS.entries())
      this.plate(drawFastener(75 + i), f.x, f.z, 0.24, 0.12);
    this.plate(drawPatchedFence(77), PATCHED_FENCE.x, PATCHED_FENCE.z, PATCHED_FENCE.h, 0.6);
    if (repaired) this.placeClues();
  }

  /** The completion aftermath: the pinned garden notice + the ribbon trail. */
  private placeClues(): void {
    if (this.cluesPlaced) return;
    this.cluesPlaced = true;
    this.plate(drawPumpNotice(78), NOTICE.x, NOTICE.z, NOTICE.h, 0.2, 2);
    for (const [i, r] of RIBBONS.entries())
      this.plate(drawRibbonScrap(79 + i), r.x, r.z, 0.35, 0.1);
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

  private replate(old: Cutout | null, cut: Cutout, x: number, z: number): Cutout {
    if (old) {
      old.group.removeFromParent();
      old.dispose();
    }
    this.deps.place(cut, x, z);
    return cut;
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
    const commons = this.field.get('repair-commons')!;
    if (Math.hypot(x - CHIME.x, z - CHIME.z) <= 1.8) {
      return { kind: 'chime', area: 'repair-commons', x: CHIME.x, z: CHIME.z };
    }
    const c = commons.def.coffer;
    if (!commons.cofferOpened && Math.hypot(x - c.x, z - c.z) <= 1.6) {
      return { kind: 'coffer', area: 'repair-commons', x: c.x, z: c.z };
    }
    return null;
  }

  /** Engage a landmark interactive (the player is standing at it). */
  engage(target: LandmarkTarget): void {
    if (target.kind === 'coffer') {
      this.openCoffer(target.area);
      return;
    }
    this.engageChime();
  }

  private engageChime(): void {
    const area = this.field.get('repair-commons')!;
    if (area.progress === 'completed') {
      this.deps.toast(t('landmark.commons.chimeAgain'));
      return;
    }
    if (this.chimePhase !== 'idle') return;
    if (this.deps.countTwig() < 1) {
      // The information gap stays open and names its key: one common twig.
      this.deps.toast(t('landmark.commons.chimeNeedsPart'));
      return;
    }
    // Datou comes to brace the post; the repair runs when he's in position.
    this.deps.sendDatou(CHIME.x, CHIME.z);
    this.chimePhase = 'datou-coming';
    this.workLeft = 14; // generous travel allowance before giving up quietly
    this.deps.toast(t('landmark.commons.chimeStart'));
  }

  private completeChime(): void {
    this.chimePhase = 'idle';
    if (!this.deps.takeTwig()) return; // pack changed mid-beat — stay tangled
    const area = this.field.get('repair-commons')!;
    this.field.complete('repair-commons');
    this.persist();
    // The place changes and stays changed: chime hangs true, mast lamp lit.
    this.chimeCut = this.replate(
      this.chimeCut,
      new Cutout(drawChimeStand(73, true), { height: CHIME.h, shadowRadius: 0.5 }),
      CHIME.x,
      CHIME.z,
    );
    this.mastCut = this.replate(
      this.mastCut,
      new Cutout(drawPennantMast(71, true), { height: MAST.h, shadowRadius: 1.0 }),
      MAST.x,
      MAST.z,
    );
    this.placeClues();
    this.deps.datouBeat();
    this.deps.memory('landmark.repair-commons');
    this.deps.toast(t('landmark.commons.chimeDone'));
    void area;
  }

  private openCoffer(id: LandmarkId): void {
    const area = this.field.get(id);
    if (!area || !this.field.openCoffer(id)) return;
    this.persist();
    // The reward contract (§9): full blueprint + exactly one build's stock.
    this.deps.grantBlueprint(area.def.coffer.blueprintForm, t('coffer.commonsContext'));
    for (const [mat, n] of Object.entries(area.def.coffer.materials)) {
      this.deps.grantMaterial(mat as MaterialId, n);
    }
    this.cofferCut = this.replate(
      this.cofferCut,
      new Cutout(drawCoffer(74, true, true), { height: 0.7, shadowRadius: 0.5 }),
      area.def.coffer.x,
      area.def.coffer.z,
    );
    this.deps.datouBeat();
    this.deps.memory(`landmark.coffer.${id}`);
    this.deps.toast(t('coffer.commonsOpened'));
  }

  // --- per-frame ---------------------------------------------------------------

  update(dt: number, playerX: number, playerZ: number): void {
    // Arrival: stepping into an activity ring names the place (once).
    const here = this.field.areaAt(playerX, playerZ);
    if (here && here.progress !== 'completed' && this.field.arrive(here.def.id)) {
      this.persist();
      this.deps.toast(tDyn(`landmark.${here.def.id}.arrive`));
    }

    // The chime repair beat.
    if (this.chimePhase === 'datou-coming') {
      this.workLeft -= dt;
      const d = this.deps.datouPos();
      if (Math.hypot(d.x - CHIME.x, d.z - CHIME.z) <= CHIME_REACH) {
        this.chimePhase = 'working';
        this.workLeft = WORK_SECONDS;
        this.beatIn = 0;
      } else if (this.workLeft <= 0) {
        this.chimePhase = 'idle'; // path blocked — no punishment, try again
      }
    } else if (this.chimePhase === 'working') {
      this.workLeft -= dt;
      this.beatIn -= dt;
      if (this.beatIn <= 0) {
        this.beatIn = 0.9;
        this.deps.datouBeat(); // bracing the post, steady pulses
        // Keep him braced — follow mode would otherwise pull him back to
        // the player mid-beat once the approach resolves.
        const d = this.deps.datouPos();
        if (Math.hypot(d.x - CHIME.x, d.z - CHIME.z) > CHIME_REACH + 0.3) {
          this.deps.sendDatou(CHIME.x, CHIME.z);
        }
      }
      if (this.workLeft <= 0) this.completeChime();
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
