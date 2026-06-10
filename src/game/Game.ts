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
  drawArchway,
  drawBench,
  drawBirdbath,
  drawCairn,
  drawCampfire,
  drawCrop,
  drawFence,
  drawLamp,
  drawShelter,
  drawSoil,
  drawStick,
  drawWindchime,
} from '../art/props';
import { DatouRig } from '../datou/DatouRig';
import { HumanRig } from '../human/HumanRig';
import { readSavedAvatar, type AvatarStyle } from '../human/avatar';
import { Leash } from '../human/Leash';
import { Player } from '../human/Player';
import type { PhysicsAdapter } from '../physics/PhysicsAdapter';
import { Console } from '../ui/Console';
import { Minimap } from '../ui/Minimap';
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
import { Forage } from './Forage';
import { Keys } from './Keys';
import { Memories } from './Memories';
import { Pointer } from './Pointer';
import { t, tDyn } from '../i18n';
import { Workshop } from '../ui/Workshop';
import { WorkshopState } from './workshop/WorkshopState';
import type { Outcome } from './workshop/bench';
import { parseItemId, itemName } from './workshop/items';
import { itemSprite, itemHeight } from './workshop/sprites';
import type { MaterialId } from './workshop/materials';
import { MATERIALS } from './workshop/materials';
import { rollInspiration, type InspoContext, type Mood } from './workshop/inspiration';
import { weatherFor, seasonFor, tintFor } from './workshop/weather';
import { zoneAt } from '../world/zones';
import { NodeState } from './workshop/NodeState';
import { Tools } from './workshop/tools';
import { Harvest } from './workshop/Harvest';
import { NODE_DEFS, NODE_PLACEMENTS, type NodePlacement } from './workshop/nodes';
import { drawNode } from '../art/nodes';

const MAX_DT = 1 / 30;
const TRUST_FULL = 120;
const COMFORT_MEMORY_SECONDS = 2.5;
const GATHER_REACH = 1.9;
const REACT_COOLDOWN = 6;

type BuildableKind =
  | 'cairn'
  | 'lantern'
  | 'fence'
  | 'campfire'
  | 'shelter'
  | 'bench'
  | 'birdbath'
  | 'windchime'
  | 'archway';

interface BuiltItem {
  kind: BuildableKind;
  x: number;
  z: number;
}

/** A placed Workshop item (any of the generative ItemIds). */
interface WorkshopBuilt {
  id: string;
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
  bench: { height: 0.9, shadowRadius: 1.0 },
  birdbath: { height: 1.2, shadowRadius: 0.5 },
  windchime: { height: 1.5, shadowRadius: 0.3 },
  archway: { height: 2.5, shadowRadius: 0.9 },
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
  private readonly forage: Forage;
  private readonly ui: Console;
  private readonly pointer: Pointer;
  private readonly keys = new Keys();
  private readonly raycaster = new THREE.Raycaster();
  private readonly stickCutout: Cutout;
  private readonly farm = new Farm();
  private readonly plotVisuals = new Map<number, PlotVisual>();
  private minimap: Minimap | null = null;
  private readonly workshopState = new WorkshopState();
  private workshop!: Workshop;
  private placingItem: string | null = null;
  // Resource nodes & tools (W8).
  private readonly nodeState = new NodeState();
  private readonly tools = new Tools();
  private readonly harvest: Harvest;
  private readonly nodeVisuals = new Map<string, { cut: Cutout; state: string }>();
  // Inspiration cadence (§5.2): a slow tick, a cooldown, and a pity timer so at
  // least one fires every ~2 sessions and never more than one per 10 min.
  private inspoTickIn = 90;
  private inspoCooldown = 0;
  private inspoTickId = 0;

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
    this.forage = new Forage({
      setMode: (m) => this.physics.setMode(m),
      setTarget: (x, z) => this.physics.setTarget(x, z),
      findNearest: (kind, x, z, r) => {
        const hit = this.world.nearestPickableOfKind(kind, x, z, r);
        return hit ? { id: hit.id, kind: hit.kind, x: hit.x, z: hit.z } : null;
      },
      pick: (id) => this.world.removeInstance(id),
      onPick: () => {
        this.datouRig.reach();
        this.datouRig.setBucketFill(this.forage.fill, this.forage.bucketCapacity);
      },
      onDeliver: (items) => this.handleForageDeliver(items),
    });
    this.harvest = new Harvest({
      setMode: (m) => this.physics.setMode(m),
      setTarget: (x, z) => this.physics.setTarget(x, z),
      charges: (id) => this.nodeState.charges(id),
      spend: (id) => this.nodeState.spend(id),
      toolMultiplier: () => {
        const eq = this.tools.equippedTool();
        return eq ? this.tools.yieldMultiplier(eq.id) : 0;
      },
      swing: () => {
        const eq = this.tools.equippedTool();
        if (eq) this.tools.swing(eq.id);
      },
      bucketCapacity: () => this.forage.bucketCapacity,
      tooTired: () => this.physics.getDatouState().mood === 'tired',
      onBeat: (id, gained) => {
        this.datouRig.reach();
        this.datouRig.setBucketFill(this.harvest.fill, this.forage.bucketCapacity);
        this.replateNode(id);
        void gained;
      },
      onDeliver: (items) => this.handleForageDeliver(items),
      onNeedTool: () => this.ui.toast(t('node.needTool')),
      onRefuse: () => this.ui.toast(t('node.refused')),
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

    // The Workshop window — make things on the 3×3 bench (W2/W3).
    this.workshop = new Workshop(this.workshopState, this.backpack, {
      count: (mat) => this.materialCount(mat),
      takeOne: (mat) => this.backpack.take(mat as ResourceId),
      onRefund: (mats) => {
        for (const m of mats) this.backpack.add(m as ResourceId);
      },
      onMake: (outcome) => this.handleMake(outcome),
      onPinForage: (mat) => this.startForage(mat),
    });
    document
      .getElementById('btn-workshop')
      ?.addEventListener('click', () => this.workshop.toggle());
    for (const b of this.loadJson<WorkshopBuilt[]>('wwd.workshopBuilt', []))
      this.placeWorkshopItem(b.id, b.x, b.z, false);
    this.placeNodes();

    this.pointer = new Pointer(canvas, {
      onTap: (x, y) => this.handleTap(x, y),
      onHoldStart: (x, y) => this.handleHoldStart(x, y),
      onHoldEnd: (duration) => this.handleHoldEnd(duration),
      onDrag: (dx, dy) => this.cameraRig.addDrag(dx, dy),
      onZoom: (d) => this.cameraRig.addZoom(d),
    });

    // Minimap: click to walk there (Datou comes along).
    try {
      this.minimap = new Minimap(this.world.paintCanvas, (x, z) => {
        const p = this.clampToWorld(x, z);
        this.player.walkTo(p.x, p.z);
        this.ui.notifyInteracted();
      });
    } catch {
      this.minimap = null; // markup missing — game still runs
    }

    // Overview mode: the ⌖ button or M.
    const mapButton = document.getElementById('map-button');
    const toggleOverview = (): void => {
      const on = this.cameraRig.toggleOverview();
      mapButton?.classList.toggle('active', on);
    };
    mapButton?.addEventListener('click', toggleOverview);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && !e.repeat) toggleOverview();
    });

    this.player.setColliders(this.world.colliders);
    this.physics.setColliders?.(this.world.colliders);
    this.physics.setPlayerPosition(this.player.x, this.player.z);
    this.applyStance();
    this.applyWeather();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (this.placing || this.placingItem)) {
        this.placing = null;
        this.placingItem = null;
        this.ui.toast(t('place.cancelled'));
      }
    });
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

    // Placement mode: the next ground tap drops the made item into the world.
    if (this.placingItem) {
      this.placeWorkshopItem(this.placingItem, p.x, p.z, true);
      this.placingItem = null;
      return;
    }
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

    // A resource node → Datou trots over and works it (W8).
    const node = this.nodeNear(p.x, p.z);
    if (node) {
      this.tapNode(node);
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
      case 'bundle':
      case 'stonepile':
        // Components: explain rather than do.
        this.ui.toast(t('craft.componentHint'));
        break;
      default: {
        // Every other craftable goes into the world on the next ground tap.
        this.placing = id as BuildableKind | 'plot';
        this.ui.closePack();
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
      bench: drawBench,
      birdbath: drawBirdbath,
      windchime: drawWindchime,
      archway: drawArchway,
    }[item.kind];
    const cut = new Cutout(drawBuild(seed), BUILD_LOOK[item.kind]);
    this.world.placeCutout(cut, item.x, item.z);
    if (fresh) {
      const built = this.loadJson<BuiltItem[]>('wwd.built', []);
      built.push(item);
      this.saveJson('wwd.built', built);
    }
  }

  // --- Workshop ---

  /** Materials the player has for the bench. Backpack resources double as materials. */
  private materialCount(mat: MaterialId): number {
    if (mat in MATERIALS && this.isPackResource(mat)) return this.backpack.count(mat as ResourceId);
    return 0;
  }

  private isPackResource(mat: string): boolean {
    return (
      mat === 'twig' ||
      mat === 'pebble' ||
      mat === 'berry' ||
      mat === 'flower' ||
      mat === 'mushroom' ||
      mat === 'pinecone'
    );
  }

  /**
   * The bench confirmed a make. Materials were already pulled from the pack as
   * they were placed on cells, so here we just record knowledge, stamp the
   * first-make memory, and drop the player into placement mode for the item.
   * Curios bank quietly into the Notebook (a tiny success, never nothing).
   */
  private handleMake(outcome: Outcome): boolean {
    if (outcome.kind === 'empty') return false;
    if (outcome.kind === 'curio') {
      this.workshopState.addCurio(outcome.tone);
      this.bond.add('discovery', 1);
      this.datouRig.pulse();
      return true;
    }
    // exact / grammar → a real item id.
    const id = outcome.id;
    const spec = parseItemId(id);
    if (!spec) return false;
    const firstMake = this.workshopState.recordMake(id);
    if (outcome.kind === 'exact') this.workshopState.recordPattern(outcome.patternKey);
    this.bond.add('discovery', 2);
    this.datouRig.pulse();
    this.datouRig.reach();
    if (firstMake) {
      const entry = {
        ts: Date.now(),
        kind: 'want' as const,
        key: 'made:' + id,
        mood: this.physics.getDatouState().mood,
      };
      this.memories.add(entry);
      this.ui.toast(t('workshop.made', { thing: itemName(spec) }));
    }
    // Tools equip into the dorsal gripper rather than placing in the world.
    if (spec.form === 'axe' || spec.form === 'pickaxe' || spec.form === 'shears' || spec.form === 'scoop') {
      this.equipTool(id);
      return true;
    }
    // Everything else: close the window and place on the next ground tap.
    this.placingItem = id;
    this.workshop.hide();
    this.ui.toast(t('place.hint'));
    return true;
  }

  /**
   * Today's weather/season as a quiet scene treatment (§5): a soft warm fog on
   * rain/fog days (never a heavy effect — baseline forbids loud bloom), keyed
   * to the seeded daily weather so it's a calendar return reason, not noise.
   */
  private applyWeather(): void {
    const tint = tintFor();
    if (tint.haze > 0.03) {
      // Fog distance shortens with haze; color is the warm paper backdrop so it
      // reads as soft atmosphere, not a grey wall.
      const near = 18;
      const far = 60 - tint.haze * 160;
      this.scene.fog = new THREE.Fog(0xece5d6, near, Math.max(28, far));
    } else {
      this.scene.fog = null;
    }
  }

  /**
   * Slow inspiration tick (§5): roughly every 90 s, off-cooldown, Datou may
   * get an idea — a hint toward an unfound exact pattern banked into the
   * Notebook, announced by a quiet thought chip. All seeded → replay-safe.
   */
  private updateInspiration(dt: number, dx: number, dz: number, mood: Mood): void {
    if (this.inspoCooldown > 0) this.inspoCooldown -= dt;
    this.inspoTickIn -= dt;
    if (this.inspoTickIn > 0 || this.inspoCooldown > 0) return;
    this.inspoTickIn = 90;
    this.inspoTickId += 1;

    const now = new Date();
    const ctx: InspoContext = {
      zone: zoneAt(dx, dz).id,
      weather: weatherFor(now),
      season: seasonFor(now),
      mood,
      bond: this.bond.level,
      personality: 'balanced', // personality axes land in W7 gating
      tick: this.inspoTickId,
      date: now,
    };
    const found = this.workshopState.foundPatternSet();
    const hinted = new Set(this.workshopState.hintList().map((h) => h.pattern));
    const hint = rollInspiration(ctx, found, hinted);
    if (!hint) return;
    if (this.workshopState.bankHint(hint)) {
      this.inspoCooldown = 600; // ≥ 10 min between inspirations (§5.2)
      this.datouRig.pulse();
      this.datouRig.reach();
      this.ui.toast(t('workshop.inspired'));
    }
  }

  // --- Resource nodes (W8) ---

  /** World plate height (m) per node type — landmark-sized (§8.1). */
  private nodeHeight(type: NodePlacement['type']): number {
    return {
      'great-tree': 9,
      'old-boulder': 3.2,
      'clay-seam': 1.2,
      'flint-lode': 1.8,
      'bolt-cache': 2.4,
    }[type];
  }

  private placeNodes(): void {
    for (const p of NODE_PLACEMENTS) {
      const state = this.nodeState.state_(p.id);
      const seed = (Math.round(p.x * 31 + p.z * 7) ^ 0x4a0d) >>> 0;
      const cut = new Cutout(drawNode(p.type, state, seed), {
        height: this.nodeHeight(p.type),
        shadowRadius: this.nodeHeight(p.type) * 0.22,
      });
      this.world.placeCutout(cut, p.x, p.z);
      this.nodeVisuals.set(p.id, { cut, state });
    }
  }

  /** Re-draw a node's plate if its harvest state changed (depletion/regrow). */
  private replateNode(nodeId: string): void {
    const p = NODE_PLACEMENTS.find((n) => n.id === nodeId);
    const vis = this.nodeVisuals.get(nodeId);
    if (!p || !vis) return;
    const state = this.nodeState.state_(nodeId);
    if (state === vis.state) return;
    const seed = (Math.round(p.x * 31 + p.z * 7) ^ 0x4a0d) >>> 0;
    vis.cut.group.removeFromParent();
    vis.cut.dispose();
    const cut = new Cutout(drawNode(p.type, state, seed), {
      height: this.nodeHeight(p.type),
      shadowRadius: this.nodeHeight(p.type) * 0.22,
    });
    this.world.placeCutout(cut, p.x, p.z);
    this.nodeVisuals.set(nodeId, { cut, state });
  }

  /** Tapped near a node: send Datou to work it with the equipped tool (§8.3). */
  private tapNode(p: NodePlacement): void {
    if (this.harvest.active) {
      this.harvest.stop();
      return;
    }
    const def = NODE_DEFS[p.type];
    const eq = this.tools.equippedTool();
    if (!eq || eq.kind !== def.tool || eq.tier < def.minTier) {
      this.ui.toast(t('node.needTool'));
      return;
    }
    if (this.nodeState.charges(p.id) <= 0) {
      this.ui.toast(t('node.spent'));
      return;
    }
    if (this.leashOn) {
      this.leashOn = false;
      this.ui.setLeash(false);
      this.saveRaw('wwd.leash', '0');
      this.applyStance();
    }
    this.datouRig.setCarrying(true); // tool rides in the gripper
    this.harvest.start(p, dailySeed());
  }

  /** Nearest node within range of a world point (for tap routing). */
  private nodeNear(x: number, z: number, r = 3.5): NodePlacement | null {
    let best: NodePlacement | null = null;
    let bestD = r;
    for (const p of NODE_PLACEMENTS) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d <= bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Equip a made tool from the Workshop (clamps into the dorsal gripper). */
  private equipTool(id: string): void {
    this.tools.equip(id);
    this.datouRig.setCarrying(true);
    this.ui.toast(t('tool.equipped'));
  }

  private placeWorkshopItem(id: string, x: number, z: number, fresh: boolean): void {
    const spec = parseItemId(id);
    if (!spec) return;
    const cut = new Cutout(itemSprite(id), {
      height: itemHeight(spec),
      shadowRadius: itemHeight(spec) * 0.45,
    });
    this.world.placeCutout(cut, x, z);
    if (fresh) {
      const built = this.loadJson<WorkshopBuilt[]>('wwd.workshopBuilt', []);
      built.push({ id, x, z });
      this.saveJson('wwd.workshopBuilt', built);
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

  /** Datou dumped a forage OR harvest haul into the pack (§7/§8). */
  private handleForageDeliver(items: string[]): void {
    for (const kind of items) this.backpack.add(kind as ResourceId);
    this.bond.add('discovery', items.length);
    this.physics.applyPet();
    this.datouRig.pulse();
    // Reflect whichever loop is still running (0 when both stand down).
    const fill = this.harvest.active ? this.harvest.fill : this.forage.fill;
    this.datouRig.setBucketFill(fill, this.forage.bucketCapacity);
    if (!this.harvest.active && !this.forage.active) this.datouRig.setCarrying(false);
    this.ui.toast(t('forage.delivered', { n: String(items.length) }));
    if (items.length >= this.forage.bucketCapacity) {
      this.memories.add({
        ts: Date.now(),
        kind: 'want',
        key: 'forage',
        mood: this.physics.getDatouState().mood,
      });
    }
  }

  /** Pin a material → Datou forages for it (leash comes off). */
  private startForage(mat: MaterialId): void {
    if (!this.isPackResource(mat)) {
      this.ui.toast(t('forage.cantFind'));
      return;
    }
    if (this.leashOn) {
      this.leashOn = false;
      this.ui.setLeash(false);
      this.saveRaw('wwd.leash', '0');
      this.applyStance();
    }
    this.forage.pin(mat);
    this.ui.toast(t('forage.pinned', { thing: tDyn(`material.${mat}`) }));
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
    this.datouRig.reach();
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
    if (!this.fetch.active && this.harvest.active) {
      this.harvest.update(dt, state, this.player);
    } else if (!this.fetch.active && this.forage.active) {
      this.forage.update(dt, state, this.player);
    } else if (!this.fetch.active) {
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
          this.datouRig.reach();
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

    // Datou's muse: a slow seeded inspiration tick (§5).
    this.updateInspiration(dt, state.position.x, state.position.z, state.mood);

    // --- render layers ---
    const camYaw = this.cameraRig.azimuth;
    this.world.update(dt, camYaw);
    this.datouRig.update(dt, state, this.companion.expression, camYaw);
    this.humanRig.update(dt, this.player.x, this.player.z, this.player.vx, this.player.vz, camYaw);

    // Hide the rope when they're improbably far apart (spawn/teleport) —
    // a 2 m leash stretched across the meadow reads wrong.
    const pairDist = Math.hypot(state.position.x - this.player.x, state.position.z - this.player.z);
    this.leash.setVisible(this.leashOn && !this.fetch.active && pairDist < 6);
    this.leash.update(dt, this.humanRig.handPosition, this.datouRig.harnessPosition);

    const stickPos = this.fetch.stickPosition();
    if (stickPos) {
      this.stickCutout.group.visible = true;
      this.stickCutout.setPosition(stickPos.x, stickPos.z, stickPos.y);
      this.stickCutout.faceCamera(camYaw);
    } else if (this.fetch.carried) {
      // The dorsal arm holds the stick in its gripper.
      this.datouRig.setCarrying(true);
      const g = this.datouRig.gripperPosition;
      this.stickCutout.group.visible = true;
      this.stickCutout.group.position.set(g.x, Math.max(0.1, g.y - 0.1), g.z);
      this.stickCutout.faceCamera(camYaw);
    } else {
      this.datouRig.setCarrying(false);
      this.stickCutout.group.visible = false;
    }

    const focus = new THREE.Vector3(this.player.x, 0, this.player.z);
    this.cameraRig.update(dt, focus);

    this.minimap?.update(
      dt,
      this.player,
      { x: state.position.x, z: state.position.z },
      this.spots.spots.filter((sp) => sp.found),
    );

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
