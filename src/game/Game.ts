/**
 * Game — the walk orchestrator.
 *
 * You are the human; Datou walks with you, on or off the leash. One loop
 * routes everything: WASD / tap-to-walk movement, petting and soothing,
 * gathering pickables into the backpack, crafting and placing keepsakes,
 * throwing the fetch stick, Datou's want loop, daily discoveries, and the
 * memory log. The physics adapter contract is untouched: this layer reads
 * getDatouState() and pulls the mode/target levers.
 */

import * as THREE from 'three';
import { canvasTexture, paintBackdrop, paintContactShadow } from '../art/textures';
import {
  drawCairn,
  drawCampfire,
  drawCrop,
  drawFence,
  drawLamp,
  drawShelter,
  drawSoil,
  drawStick,
} from '../art/props';
import { DatouRig } from '../datou/DatouRig';
import { HumanRig } from '../human/HumanRig';
import { readSavedAvatar, type AvatarStyle } from '../human/avatar';
import { Leash } from '../human/Leash';
import { Player } from '../human/Player';
import type { PhysicsAdapter } from '../physics/PhysicsAdapter';
import { Console } from '../ui/Console';
import { Cutout } from '../world/Cutout';
import { SPOT_ANCHORS } from '../world/layout';
import { kindDef, type ScatterKind } from '../world/scatter';
import { SPOTS_PER_DAY, SpotField, dailyKey, dailySeed, type Spot } from '../world/Spots';
import { World } from '../world/World';
import { WORLD_WALK_RADIUS } from '../world/zones';
import { Backpack, type CraftedId, type ResourceId } from './Backpack';
import { Bond } from './Bond';
import { CameraRig } from './CameraRig';
import { Companion, type CompanionEvents, type WantKind } from './Companion';
import { craft, recipe } from './Crafting';
import { CROP_KINDS, Farm, MATURE, TEND_RANGE, type CropKind, type PlotState } from './Farm';
import { Fetch } from './Fetch';
import { Keys } from './Keys';
import { Memories } from './Memories';
import { Pointer } from './Pointer';
import { t, tDyn } from '../i18n';

const MAX_DT = 1 / 30;
const TRUST_FULL = 120;
const COMFORT_MEMORY_SECONDS = 2.5;
const GATHER_REACH = 1.9;
const REACT_COOLDOWN = 6;

type BuildableKind = 'cairn' | 'lantern' | 'fence' | 'campfire' | 'shelter';

interface BuiltItem {
  kind: BuildableKind;
  x: number;
  z: number;
}

/** Plate heights/shadows for placed buildables. */
const BUILD_LOOK: Record<BuildableKind, { height: number; shadowRadius: number }> = {
  cairn: { height: 0.8, shadowRadius: 0.45 },
  lantern: { height: 1.5, shadowRadius: 0.4 },
  fence: { height: 0.95, shadowRadius: 0.55 },
  campfire: { height: 1.0, shadowRadius: 0.7 },
  shelter: { height: 1.5, shadowRadius: 1.0 },
};

interface PlotVisual {
  soil: Cutout;
  crop: Cutout | null;
  cropKind: CropKind | null;
  stage: number;
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly cameraRig: CameraRig;
  private readonly world: World;
  private readonly datouRig: DatouRig;
  private readonly humanRig: HumanRig;
  private readonly leash = new Leash();
  private readonly player = new Player();
  private readonly physics: PhysicsAdapter;
  private readonly companion: Companion;
  private readonly bond: Bond;
  private readonly memories = new Memories();
  private readonly backpack = new Backpack();
  private readonly spots: SpotField;
  private readonly fetch: Fetch;
  private readonly ui: Console;
  private readonly pointer: Pointer;
  private readonly keys = new Keys();
  private readonly raycaster = new THREE.Raycaster();
  private readonly stickCutout: Cutout;
  private readonly farm = new Farm();
  private readonly plotVisuals = new Map<number, PlotVisual>();

  private readonly events: CompanionEvents = { petted: false, comforted: false, guidedTo: null };
  private leashOn = true;
  private garlandWorn = false;
  private placing: BuildableKind | 'plot' | null = null;
  private pendingGather: string | null = null;
  private pendingReaction: { verb: string; x: number; z: number } | null = null;
  private reactCooldown = 0;
  private comforting = false;
  private comfortPulseIn = 0;
  private lastTime = performance.now();
  private saveIn = 3;
  private running = false;

  constructor(canvas: HTMLCanvasElement, physics: PhysicsAdapter) {
    this.physics = physics;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene.background = canvasTexture(paintBackdrop());

    this.cameraRig = new CameraRig(window.innerWidth / window.innerHeight);

    this.world = new World(dailySeed(), this.loadJson<string[]>(this.pickedKey(), []));
    this.scene.add(this.world.group);

    const shadowTex = canvasTexture(paintContactShadow());
    this.datouRig = new DatouRig(shadowTex);
    this.humanRig = new HumanRig(shadowTex, readSavedAvatar());
    this.scene.add(this.datouRig.group, this.humanRig.group, this.leash.mesh);

    this.stickCutout = new Cutout(drawStick(5), { height: 0.28 });
    this.stickCutout.group.visible = false;
    this.scene.add(this.stickCutout.group);

    // --- Relationship + world state (persists) ---
    this.bond = new Bond(Number(this.loadRaw('wwd.bond')) || 0);
    this.spots = new SpotField(dailySeed(), SPOT_ANCHORS, SPOTS_PER_DAY);
    this.spots.restoreFound(this.loadJson<number[]>('wwd.spots.' + dailyKey(), []));
    for (const s of this.spots.spots) if (s.found) this.world.revealSpot(s);
    for (const b of this.loadJson<BuiltItem[]>('wwd.built', [])) this.placeBuilt(b, false);
    this.syncFarm();
    this.garlandWorn = this.loadRaw('wwd.garland') === '1';
    this.datouRig.setGarland(this.garlandWorn);
    this.leashOn = this.loadRaw('wwd.leash') !== '0';

    this.companion = new Companion(
      this.bond,
      {
        setMode: (m) => this.physics.setMode(m),
        setTarget: (x, z) => this.physics.setTarget(x, z),
        onDiscover: (spot) => this.handleDiscover(spot),
        onWantSatisfied: (kind) => this.handleWantSatisfied(kind),
      },
      Math.random,
      this.spots,
    );
    this.fetch = new Fetch({
      setMode: (m) => this.physics.setMode(m),
      setTarget: (x, z) => this.physics.setTarget(x, z),
      onComplete: () => this.handleFetchComplete(),
    });

    this.ui = new Console(this.memories, this.backpack, {
      onLeashToggle: () => this.toggleLeash(),
      onUseItem: (id) => this.useItem(id),
      onCraft: (id) => this.craftItem(id),
    });
    this.ui.setFoundToday(this.spots.foundCount, this.spots.spots.length);
    this.ui.setTrust(this.bond.level / TRUST_FULL);
    this.ui.setLeash(this.leashOn);
    this.ui.setGarlandWorn(this.garlandWorn);

    this.pointer = new Pointer(canvas, {
      onTap: (x, y) => this.handleTap(x, y),
      onHoldStart: (x, y) => this.handleHoldStart(x, y),
      onHoldEnd: (duration) => this.handleHoldEnd(duration),
      onDrag: (dx) => this.cameraRig.addDrag(dx),
      onZoom: (d) => this.cameraRig.addZoom(d),
    });

    this.player.setColliders(this.world.colliders);
    this.physics.setColliders?.(this.world.colliders);
    this.physics.setPlayerPosition(this.player.x, this.player.z);
    this.applyStance();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('beforeunload', () =>
      this.saveRaw('wwd.bond', String(this.bond.level)),
    );
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  /** Live avatar swap from ⚙ settings. */
  setAvatar(style: AvatarStyle): void {
    this.humanRig.setAvatar(style);
  }

  // --- pointer verbs ---

  private handleTap(clientX: number, clientY: number): void {
    this.ui.notifyInteracted();
    const hit = this.pick(clientX, clientY);
    if (hit === 'datou') {
      this.events.petted = true;
      this.physics.applyPet();
      this.datouRig.pulse();
      return;
    }
    if (!hit) return;
    const p = this.clampToWorld(hit.x, hit.z);

    // Placement mode: the next ground tap drops the crafted keepsake.
    if (this.placing) {
      if (this.placing === 'plot') {
        if (this.backpack.take('plot')) this.farm.addPlot(p.x, p.z);
      } else {
        this.placeBuilt({ kind: this.placing, x: p.x, z: p.z }, true);
      }
      this.placing = null;
      return;
    }

    // Answering an active curious want by pointing at what Datou sees.
    if (this.companion.activeWant === 'curious') {
      this.events.guidedTo = p;
      return;
    }

    // A garden plot under the tap → plant / harvest (walk over first).
    const plot = this.farm.plotAt(p.x, p.z);
    if (plot) {
      if (Math.hypot(plot.x - this.player.x, plot.z - this.player.z) <= 2.2) {
        this.tendPlot(plot);
      } else {
        this.player.walkTo(plot.x, plot.z);
      }
      return;
    }

    // A pickable under the tap → gather (walk over first if needed).
    const pickable = this.world.nearestInstance(p.x, p.z, 1.0, true);
    if (pickable) {
      if (Math.hypot(pickable.x - this.player.x, pickable.z - this.player.z) <= GATHER_REACH) {
        this.gather(pickable.id, pickable.kind, pickable.x, pickable.z);
      } else {
        this.player.walkTo(pickable.x, pickable.z);
        this.pendingGather = pickable.id;
      }
      return;
    }

    // An interactable prop → Datou trots over and reacts.
    const prop = this.world.nearestInstance(p.x, p.z, 1.2, false);
    if (prop && kindDef(prop.kind).verb !== 'none' && !kindDef(prop.kind).pickable) {
      this.companion.investigate(prop.x, prop.z);
      this.pendingReaction = { verb: kindDef(prop.kind).verb, x: prop.x, z: prop.z };
      return;
    }

    // Otherwise: walk there together.
    this.player.walkTo(p.x, p.z);
    this.pendingGather = null;
  }

  private handleHoldStart(clientX: number, clientY: number): void {
    if (this.pick(clientX, clientY) === 'datou') {
      this.ui.notifyInteracted();
      this.comforting = true;
      this.comfortPulseIn = 0;
    }
  }

  private handleHoldEnd(duration: number): void {
    if (!this.comforting) return;
    this.comforting = false;
    if (duration >= 0.8) this.events.comforted = true;
    if (duration >= COMFORT_MEMORY_SECONDS) {
      this.memories.add({
        ts: Date.now(),
        kind: 'comfort',
        key: 'comfort',
        mood: this.physics.getDatouState().mood,
      });
    }
  }

  private pick(clientX: number, clientY: number): 'datou' | { x: number; z: number } | null {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.cameraRig.camera);
    if (this.raycaster.intersectObject(this.datouRig.hitMesh, false).length > 0) return 'datou';
    const ground = this.raycaster.intersectObject(this.world.groundMesh, false)[0];
    if (ground) return { x: ground.point.x, z: ground.point.z };
    return null;
  }

  private clampToWorld(x: number, z: number): { x: number; z: number } {
    const r = Math.hypot(x, z);
    const s = r > WORLD_WALK_RADIUS ? WORLD_WALK_RADIUS / r : 1;
    return { x: x * s, z: z * s };
  }

  // --- backpack / craft / build / fetch ---

  private gather(id: string, kind: ScatterKind, x: number, z: number): void {
    if (!this.world.removeInstance(id)) return;
    this.backpack.add(kind as ResourceId);
    this.bond.add('discovery', 1);
    const picked = this.loadJson<string[]>(this.pickedKey(), []);
    picked.push(id);
    this.saveJson(this.pickedKey(), picked);
    this.ui.toast(t('gather.toast', { thing: tDyn(`thing.${kind}`) }));
    void x;
    void z;
  }

  private craftItem(id: CraftedId): void {
    if (craft(recipe(id), this.backpack)) {
      this.ui.toast(tDyn(`thing.${id}`));
    }
  }

  private useItem(id: CraftedId): void {
    switch (id) {
      case 'stick': {
        if (this.fetch.active) return;
        // Throw ahead of the player (their last heading, else camera-forward).
        const speed = Math.hypot(this.player.vx, this.player.vz);
        const yaw = this.cameraRig.azimuth;
        const dirX = speed > 0.2 ? this.player.vx : -Math.sin(yaw);
        const dirZ = speed > 0.2 ? this.player.vz : -Math.cos(yaw);
        this.fetch.throw(this.player.x, this.player.z, dirX, dirZ, WORLD_WALK_RADIUS);
        break;
      }
      case 'garland': {
        this.garlandWorn = !this.garlandWorn;
        this.datouRig.setGarland(this.garlandWorn);
        this.ui.setGarlandWorn(this.garlandWorn);
        this.saveRaw('wwd.garland', this.garlandWorn ? '1' : '0');
        break;
      }
      case 'cairn':
      case 'lantern':
      case 'fence':
      case 'campfire':
      case 'shelter':
      case 'plot': {
        this.placing = id;
        this.ui.toast(t('place.hint'));
        break;
      }
    }
  }

  private placeBuilt(item: BuiltItem, fresh: boolean): void {
    if (fresh && !this.backpack.take(item.kind)) return;
    const seed = Math.round(item.x * 31 + item.z * 7);
    const drawBuild = {
      cairn: drawCairn,
      lantern: drawLamp,
      fence: drawFence,
      campfire: drawCampfire,
      shelter: drawShelter,
    }[item.kind];
    const cut = new Cutout(drawBuild(seed), BUILD_LOOK[item.kind]);
    this.world.placeCutout(cut, item.x, item.z);
    if (fresh) {
      const built = this.loadJson<BuiltItem[]>('wwd.built', []);
      built.push(item);
      this.saveJson('wwd.built', built);
    }
  }

  /** Tap on a garden plot: plant the first plantable resource, or harvest. */
  private tendPlot(plot: PlotState): void {
    if (plot.crop && plot.progress >= MATURE) {
      const result = this.farm.harvest(plot);
      if (result) {
        this.backpack.add(result.crop, result.count);
        this.bond.add('discovery', 2);
        this.physics.applyPet();
        this.datouRig.pulse();
        this.memories.add({
          ts: Date.now(),
          kind: 'want',
          key: 'harvest',
          mood: this.physics.getDatouState().mood,
        });
        this.ui.toast(
          t('farm.harvest', { thing: tDyn(`thing.${result.crop}`), n: String(result.count) }),
        );
      }
      return;
    }
    if (plot.crop) {
      this.ui.toast(t('farm.growing'));
      return;
    }
    const crop = CROP_KINDS.find((kind) => this.backpack.count(kind) > 0);
    if (!crop) {
      this.ui.toast(t('farm.empty'));
      return;
    }
    this.backpack.take(crop);
    this.farm.plant(plot, crop);
    this.ui.toast(t('farm.planted', { thing: tDyn(`thing.${crop}`) }));
  }

  /** Keep plot visuals in sync with farm state (soil decal + staged crop). */
  private syncFarm(): void {
    for (const plot of this.farm.list()) {
      let vis = this.plotVisuals.get(plot.id);
      if (!vis) {
        const soil = new Cutout(drawSoil(plot.id * 13 + 5), { height: 1.7, decal: true });
        this.world.placeCutout(soil, plot.x, plot.z);
        vis = { soil, crop: null, cropKind: null, stage: -1 };
        this.plotVisuals.set(plot.id, vis);
      }
      const stage = plot.crop ? this.farm.stage(plot) : -1;
      if (vis.stage !== stage || vis.cropKind !== plot.crop) {
        if (vis.crop) {
          vis.crop.group.removeFromParent();
          vis.crop.dispose();
          vis.crop = null;
        }
        if (plot.crop) {
          const h = 0.35 + stage * 0.12;
          vis.crop = new Cutout(drawCrop(plot.crop, stage, plot.id * 7), {
            height: h,
            renderOrder: 2,
          });
          this.world.placeCutout(vis.crop, plot.x, plot.z);
        }
        vis.cropKind = plot.crop;
        vis.stage = stage;
      }
    }
  }

  private handleFetchComplete(): void {
    this.bond.add('play');
    this.physics.applyPet();
    this.datouRig.pulse();
    this.memories.add({
      ts: Date.now(),
      kind: 'want',
      key: 'fetch',
      mood: this.physics.getDatouState().mood,
    });
    this.ui.toast(t('fetch.return'));
    this.applyStance();
  }

  // --- companionship events ---

  private toggleLeash(): void {
    this.ui.notifyInteracted();
    this.leashOn = !this.leashOn;
    this.ui.setLeash(this.leashOn);
    this.saveRaw('wwd.leash', this.leashOn ? '1' : '0');
    this.applyStance();
  }

  private applyStance(): void {
    const mode = this.leashOn ? 'follow' : 'idle';
    this.companion.homeMode = mode;
    if (!this.fetch.active) this.physics.setMode(mode);
  }

  private handleDiscover(spot: Spot): void {
    if (!this.spots.markFound(spot.id) && spot.found !== true) return;
    this.world.revealSpot(spot);
    this.physics.applyPet();
    this.datouRig.pulse();
    const entry = {
      ts: Date.now(),
      kind: 'discovery' as const,
      key: `${spot.art}@${spot.place}`,
      mood: this.physics.getDatouState().mood,
    };
    this.memories.add(entry);
    this.ui.toast(this.ui.memoryText(entry));
    this.ui.setFoundToday(this.spots.foundCount, this.spots.spots.length);
    this.saveJson('wwd.spots.' + dailyKey(), this.spots.foundIds());
  }

  private handleWantSatisfied(kind: WantKind): void {
    this.physics.applyPet();
    this.datouRig.pulse();
    this.memories.add({
      ts: Date.now(),
      kind: 'want',
      key: kind,
      mood: this.physics.getDatouState().mood,
    });
  }

  // --- main loop ---

  private readonly tick = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    // Human movement (keyboard wins over tap-target).
    this.player.update(dt, this.keys.axis(), this.cameraRig.azimuth);
    this.physics.setPlayerPosition(this.player.x, this.player.z);

    // Soothing hold keeps the warmth flowing.
    if (this.comforting) {
      this.comfortPulseIn -= dt;
      if (this.comfortPulseIn <= 0) {
        this.comfortPulseIn = 0.9;
        this.physics.applyPet();
        this.datouRig.pulse();
      }
    }

    this.physics.step(dt);
    const state = this.physics.getDatouState();

    this.fetch.update(dt, state, this.player);
    if (!this.fetch.active) {
      this.companion.update(state, this.player, this.events, dt);
    }
    this.events.petted = false;
    this.events.comforted = false;
    this.events.guidedTo = null;

    // Deferred gather: arrived next to the tapped pickable?
    if (this.pendingGather) {
      const item = this.world.nearestInstance(this.player.x, this.player.z, GATHER_REACH, true);
      if (item && item.id === this.pendingGather) {
        this.gather(item.id, item.kind, item.x, item.z);
        this.pendingGather = null;
      } else if (!this.player.hasTarget) {
        this.pendingGather = null;
      }
    }

    // Datou reached a tapped prop → a small in-character reaction.
    if (this.reactCooldown > 0) this.reactCooldown -= dt;
    if (this.pendingReaction) {
      const d = Math.hypot(
        state.position.x - this.pendingReaction.x,
        state.position.z - this.pendingReaction.z,
      );
      if (d <= 1.1) {
        if (this.reactCooldown <= 0) {
          this.reactCooldown = REACT_COOLDOWN;
          this.ui.toast(tDyn(`react.${this.pendingReaction.verb}`));
          this.bond.add('discovery', 2);
          this.datouRig.pulse();
        }
        this.pendingReaction = null;
      }
    }

    // The garden grows — faster when Datou is tending it nearby.
    this.farm.update(
      dt,
      (x, z) => Math.hypot(state.position.x - x, state.position.z - z) <= TEND_RANGE,
    );
    this.syncFarm();

    // Walking past a hidden spot reveals it — co-walking discovers things.
    const nearSpot = this.spots.nearestUndiscovered(state.position.x, state.position.z, 0.9);
    if (nearSpot) this.handleDiscover(nearSpot);

    for (const unlock of this.bond.takeUnlocks()) {
      const entry = { ts: Date.now(), kind: 'milestone' as const, key: unlock, mood: state.mood };
      this.memories.add(entry);
      this.ui.toast(this.ui.memoryText(entry));
    }

    // --- render layers ---
    const camYaw = this.cameraRig.azimuth;
    this.world.update(dt, camYaw);
    this.datouRig.update(dt, state, this.companion.expression, camYaw);
    this.humanRig.update(dt, this.player.x, this.player.z, this.player.vx, this.player.vz, camYaw);

    this.leash.setVisible(this.leashOn && !this.fetch.active);
    this.leash.update(dt, this.humanRig.handPosition, this.datouRig.harnessPosition);

    const stickPos = this.fetch.stickPosition();
    if (stickPos) {
      this.stickCutout.group.visible = true;
      this.stickCutout.setPosition(stickPos.x, stickPos.z, stickPos.y);
      this.stickCutout.faceCamera(camYaw);
    } else if (this.fetch.carried) {
      const m = this.datouRig.mouthPosition;
      this.stickCutout.group.visible = true;
      this.stickCutout.group.position.set(m.x, m.y - 0.14, m.z);
      this.stickCutout.faceCamera(camYaw);
    } else {
      this.stickCutout.group.visible = false;
    }

    const focus = new THREE.Vector3(this.player.x, 0, this.player.z);
    this.cameraRig.update(dt, focus);

    // --- console sync ---
    this.ui.setMood(state.mood);
    this.ui.setTrust(this.bond.level / TRUST_FULL);
    const want = this.companion.activeWant;
    if (want && !this.fetch.active) {
      const head = new THREE.Vector3(state.position.x, 1.0, state.position.z).project(
        this.cameraRig.camera,
      );
      this.ui.showWant(
        want,
        ((head.x + 1) / 2) * window.innerWidth,
        ((1 - head.y) / 2) * window.innerHeight,
      );
    } else {
      this.ui.showWant(null);
    }

    this.saveIn -= dt;
    if (this.saveIn <= 0) {
      this.saveIn = 3;
      this.saveRaw('wwd.bond', String(this.bond.level));
    }

    this.renderer.render(this.scene, this.cameraRig.camera);
    requestAnimationFrame(this.tick);
  };

  private readonly onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraRig.resize(window.innerWidth / window.innerHeight);
  };

  // --- persistence helpers ---

  private pickedKey(): string {
    return 'wwd.picked.' + dailyKey();
  }

  private loadRaw(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private saveRaw(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Session-only in private mode.
    }
  }

  private loadJson<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private saveJson(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Session-only in private mode.
    }
  }

  dispose(): void {
    this.running = false;
    this.pointer.dispose();
    this.keys.dispose();
    window.removeEventListener('resize', this.onResize);
    this.physics.dispose();
    this.renderer.dispose();
  }
}
