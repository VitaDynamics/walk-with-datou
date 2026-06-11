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
  drawCoffer,
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
import { Backpack, type CraftedId, type ItemId, type ResourceId } from './Backpack';
import { Bond } from './Bond';
import { CameraRig } from './CameraRig';
import { Companion, type CompanionEvents, type WantKind } from './Companion';
import { CROP_KINDS, Farm, MATURE, TEND_RANGE, type CropKind, type PlotState } from './Farm';
import { Fetch } from './Fetch';
import { Forage } from './Forage';
import { Keys } from './Keys';
import { cueChime, cueResponse } from './cues';
import { LandmarkDirector, type LandmarkTarget } from './LandmarkDirector';
import { Memories } from './Memories';
import { Pointer } from './Pointer';
import { t, tDyn } from '../i18n';
import { Workshop } from '../ui/Workshop';
import { ForageMenu, type ForageOption } from '../ui/ForageMenu';
import { WorkshopState } from './workshop/WorkshopState';
import type { Outcome } from './workshop/bench';
import { parseItemId, itemName, itemId, sizesFor, finishesFor, materialsAcceptedBy } from './workshop/items';
import { canonical } from './workshop/pattern';
import { patternForForm, patternRecipe } from './workshop/patterns';
import type { FormId } from './workshop/forms';
import { itemSprite, itemHeight } from './workshop/sprites';
import type { MaterialId, MaterialGroup } from './workshop/materials';
import { MATERIALS, MATERIAL_IDS, groupOf } from './workshop/materials';
import { rollInspiration, type InspoContext, type Mood } from './workshop/inspiration';
import { weatherFor, seasonFor, tintFor } from './workshop/weather';
import { zoneAt } from '../world/zones';
import { NodeState } from './workshop/NodeState';
import { PersonalityModel } from './workshop/personality';
import { Tools } from './workshop/tools';
import { Harvest } from './workshop/Harvest';
import { NODE_DEFS, NODE_PLACEMENTS, type NodePlacement } from './workshop/nodes';
import { drawNode } from '../art/nodes';

const MAX_DT = 1 / 30;
const TRUST_FULL = 120;
const COMFORT_MEMORY_SECONDS = 2.5;
const GATHER_REACH = 1.9;
const REACT_COOLDOWN = 6;
/** The starter coffer sits just off the home pad, in easy first-walk reach. */
const COFFER_POS = { x: -1.8, z: 4.0 } as const;

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
  private forageMenu!: ForageMenu;
  private placingItem: string | null = null;
  // Resource nodes & tools (W8).
  private readonly nodeState = new NodeState();
  private readonly personality = new PersonalityModel();
  private readonly tools = new Tools();
  private readonly harvest: Harvest;
  private readonly nodeVisuals = new Map<string, { cut: Cutout; state: string }>();
  // Starter treasure coffer — teaches the blueprint concept (a banked hint +
  // the stock to try it), opened once near home.
  private cofferCutout: Cutout | null = null;
  private cofferOpen = false;
  private pendingCoffer = false;
  // Authored community areas (landmark plan) — the places the park leads to.
  private landmarks!: LandmarkDirector;
  private pendingLandmark: LandmarkTarget | null = null;
  /** The scripted first-hook want toward the Commons fires once, a little
   *  into the session, if the home coffer is open and one item is made (§6). */
  private firstHookIn = 25;
  // Inspiration cadence (§5.2): a slow tick, a cooldown, and a pity timer so at
  // least one fires every ~2 sessions and never more than one per 10 min.
  private inspoTickIn = 90;
  private inspoCooldown = 0;
  private inspoTickId = 0;
  private forageMenuRefreshIn = 0;

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

    // Dev/QA: ?lm=arrived|completed presets the Commons state so headless
    // screenshots can QA the changed world. Inert in normal play.
    const lmQa = new URLSearchParams(location.search).get('lm');
    if (lmQa === 'arrived' || lmQa === 'completed') {
      this.saveJson('wwd.landmarks', {
        v: 1,
        areas: (['repair-commons', 'pump-garden', 'relay-camp'] as const).map((id) => ({
          id,
          progress: lmQa,
          cofferOpened: lmQa === 'completed',
        })),
        firstHookDone: true,
      });
    }

    // The authored community areas (landmark plan) — places the props, runs
    // the cooperative activities, owns wwd.landmarks. All hooks are lazy
    // arrows so construction order stays flexible.
    this.landmarks = new LandmarkDirector({
      place: (cut, x, z) => this.world.placeCutout(cut, x, z),
      countTwig: () => this.backpack.count('twig'),
      takeTwig: () => this.backpack.take('twig'),
      grantBlueprint: (form, context) => this.bankFullBlueprint(form, context),
      grantMaterial: (mat, n) => this.backpack.add(mat as ItemId, n),
      sendDatou: (x, z) => this.companion.investigate(x, z),
      datouPos: () => {
        const s = this.physics.getDatouState();
        return { x: s.position.x, z: s.position.z };
      },
      datouBeat: () => {
        this.datouRig.pulse();
        this.datouRig.reach();
      },
      toast: (text) => this.ui.toast(text),
      memory: (key) => this.handleLandmarkMemory(key),
      personality: () => this.personality.axis(),
      cue: (kind) => (kind === 'chime' ? cueChime() : cueResponse()),
      bankCurio: (tone) => this.workshopState.addCurio(tone),
      notePlay: () => this.personality.note('play'),
      load: () => this.loadJson<unknown>('wwd.landmarks', null),
      save: (d) => this.saveJson('wwd.landmarks', d),
    });

    this.companion = new Companion(
      this.bond,
      {
        setMode: (m) => this.physics.setMode(m),
        setTarget: (x, z) => this.physics.setTarget(x, z),
        onDiscover: (spot) => this.handleDiscover(spot),
        onWantSatisfied: (kind) => this.handleWantSatisfied(kind),
        onLandmarkNoticed: (id) => this.landmarks.onNoticed(id),
      },
      Math.random,
      this.spots,
      () => this.landmarks.noticeAnchor(this.player.x, this.player.z),
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
      hasGroup: (group, n) => this.heldInGroup(group) >= n,
      onBuildForm: (form) => this.buildFormFromTree(form),
      onFetchFor: (form) => this.gatherForForm(form),
      onGodCreate: (form) => this.godCreateForm(form),
    });
    document
      .getElementById('btn-workshop')
      ?.addEventListener('click', () => this.workshop.toggle());

    // The Fetch menu — the discoverable "ask Datou to find & pick things" (§7).
    this.forageMenu = new ForageMenu({
      options: () => this.forageOptions(),
      send: (id) => this.gatherMaterial(id as MaterialId),
      callBack: () => this.callDatouBack(),
      status: () => this.forageStatus(),
    });
    document.getElementById('btn-fetch')?.addEventListener('click', () => {
      this.ui.notifyInteracted();
      this.forageMenu.toggle();
    });
    for (const b of this.loadJson<WorkshopBuilt[]>('wwd.workshopBuilt', []))
      this.placeWorkshopItem(b.id, b.x, b.z, false);
    this.placeNodes();
    this.placeCoffer();

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
    // Dev/QA: ?overview=1 starts in the whole-map view (headless map checks).
    if (new URLSearchParams(location.search).has('overview')) toggleOverview();
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM' && !e.repeat) toggleOverview();
    });

    // Dev/QA teleport: ?at=x,z[,camYaw] starts the walk anywhere, facing
    // anywhere — used by the headless sightline checks; inert in normal play.
    const at = new URLSearchParams(location.search).get('at');
    if (at) {
      const [ax, az, yaw] = at.split(',').map(Number);
      if (Number.isFinite(ax) && Number.isFinite(az)) {
        const p = this.clampToWorld(ax, az);
        this.player.x = p.x;
        this.player.z = p.z;
        if (Number.isFinite(yaw)) this.cameraRig.setYaw(yaw);
      }
    }

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
      // A planter tapped onto the garden's donation socket installs there (§7B).
      const form = parseItemId(this.placingItem)?.form;
      if (form && this.landmarks.tryDonate(p.x, p.z, form)) {
        this.placingItem = null;
        return;
      }
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

    // The starter coffer → walk over and open it (once).
    if (!this.cofferOpen && Math.hypot(p.x - COFFER_POS.x, p.z - COFFER_POS.z) <= 1.6) {
      if (Math.hypot(COFFER_POS.x - this.player.x, COFFER_POS.z - this.player.z) <= GATHER_REACH) {
        this.openCoffer();
      } else {
        this.player.walkTo(COFFER_POS.x, COFFER_POS.z);
        this.pendingCoffer = true;
      }
      return;
    }

    // A landmark interactive (chime, community coffer) → walk over, engage.
    const lm = this.landmarks.target(p.x, p.z);
    if (lm) {
      if (Math.hypot(lm.x - this.player.x, lm.z - this.player.z) <= GATHER_REACH + 0.4) {
        this.landmarks.engage(lm);
      } else {
        this.player.walkTo(lm.x, lm.z);
        this.pendingLandmark = lm;
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
    if (duration >= 0.8) {
      this.events.comforted = true;
      this.personality.note('care');
    }
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
    if (mat in MATERIALS && this.isPackResource(mat)) return this.backpack.count(mat as ItemId);
    return 0;
  }

  /** Lives in the pack and feeds the bench (gatherables + coffer finds, §9). */
  private isPackResource(mat: string): boolean {
    return this.isGatherable(mat) || mat === 'feather' || mat === 'reed' || mat === 'old-bolt';
  }

  /** Exists as a ground pickable Datou can forage. */
  private isGatherable(mat: string): boolean {
    return (
      mat === 'twig' ||
      mat === 'pebble' ||
      mat === 'berry' ||
      mat === 'flower' ||
      mat === 'mushroom' ||
      mat === 'pinecone'
    );
  }

  /** Total held units across all pack materials of a given group. */
  private heldInGroup(group: MaterialGroup): number {
    let n = 0;
    for (const mat of MATERIAL_IDS) {
      if (groupOf(mat) === group) n += this.materialCount(mat);
    }
    return n;
  }

  /** Pick the first held material in a group (cheapest available stock). */
  private firstHeldInGroup(group: MaterialGroup): MaterialId | null {
    for (const mat of MATERIAL_IDS) {
      if (groupOf(mat) === group && this.materialCount(mat) > 0) return mat;
    }
    return null;
  }

  /**
   * Build a form directly from the Tree recipe: consume the needed materials
   * (by group), then route through the same make path (record + memory +
   * place/equip). Assumes hasGroup already gated the Build button.
   */
  private buildFormFromTree(form: FormId): void {
    const pat = patternForForm(form);
    if (!pat) return;
    const need = patternRecipe(pat);
    // Resolve each group to a concrete held material and check stock.
    const plan: { mat: MaterialId; n: number }[] = [];
    for (const [group, n] of Object.entries(need) as [MaterialGroup, number][]) {
      const mat = this.firstHeldInGroup(group);
      if (!mat || this.materialCount(mat) < n) {
        this.ui.toast(t('workshop.needMore'));
        return;
      }
      plan.push({ mat, n });
    }
    // The dominant material decides the item's material (heaviest group).
    let domMat = plan[0].mat;
    let domN = plan[0].n;
    for (const p of plan) {
      if (p.n > domN) {
        domN = p.n;
        domMat = p.mat;
      }
    }
    // Consume.
    for (const p of plan) this.backpack.take(p.mat as ResourceId, p.n);
    // Size from total mass, plain finish (a clean Tree build).
    const mass = plan.reduce((s, p) => s + p.n, 0);
    const size = sizesFor(form).length === 1 ? sizesFor(form)[0] : mass <= 3 ? sizesFor(form)[0] : mass <= 6 ? sizesFor(form)[Math.min(1, sizesFor(form).length - 1)] : sizesFor(form)[sizesFor(form).length - 1];
    const id = itemId({ form, material: domMat, size, finish: finishesFor(form)[0] });
    this.handleMake({ kind: 'exact', form, id, patternKey: canonical(pat) });
  }

  /**
   * God mode: conjure one of `form` for free — no materials consumed, no
   * pattern required. Builds a representative variant (first accepted material,
   * base size/finish) and routes through the normal make path so it records,
   * stamps the first-make memory, and drops into placement / equips like any
   * other item. A maker's sandbox over the whole 1000-item space.
   */
  private godCreateForm(form: FormId): void {
    const material = materialsAcceptedBy(form)[0];
    if (!material) return; // no eligible material — nothing to draw
    const id = itemId({ form, material, size: sizesFor(form)[0], finish: finishesFor(form)[0] });
    // Record the pattern too when the form has one, so the Tree node inks in.
    const pat = patternForForm(form);
    this.handleMake(
      pat
        ? { kind: 'exact', form, id, patternKey: canonical(pat) }
        : { kind: 'grammar', id },
    );
  }

  /**
   * Goal-level command: "Datou, get what I need for this." Reads the blueprint's
   * groups, finds the first one we're short on, and sends Datou to gather it —
   * foraging a ground pickable of that group, OR working a node that yields it
   * (if the matching tool is equipped). A readable nudge when neither is
   * possible (no tool, nothing nearby).
   */
  private gatherForForm(form: FormId): void {
    const pat = patternForForm(form);
    if (!pat) return;
    const need = patternRecipe(pat);
    for (const [group, n] of Object.entries(need) as [MaterialGroup, number][]) {
      if (this.heldInGroup(group) >= n) continue;
      this.gatherGroup(group);
      return;
    }
  }

  /** Send Datou to gather one material of `group` (forage pickable, else work a node). */
  private gatherGroup(group: MaterialGroup): void {
    // Prefer a ground pickable of this group that exists somewhere nearby.
    const pickable = this.pickableMaterialForGroup(group);
    if (pickable && this.world.nearestPickableOfKind(pickable, this.player.x, this.player.z, 90)) {
      this.startForage(pickable);
      return;
    }
    // Else look for a node that yields this group and that we can work.
    const work = this.workableNodeForGroup(group);
    if (work) {
      this.tapNode(work);
      return;
    }
    // Nothing reachable — explain why (likely a tool gap for bulk materials).
    const node = this.anyNodeForGroup(group);
    if (node) this.ui.toast(t('node.needTool'));
    else this.ui.toast(t('forage.cantFind'));
  }

  /** A foraged (ground-pickable) material in a group, if any. */
  private pickableMaterialForGroup(group: MaterialGroup): MaterialId | null {
    for (const mat of MATERIAL_IDS) {
      if (groupOf(mat) === group && this.isGatherable(mat)) return mat;
    }
    return null;
  }

  /** Nearest node yielding `group` that the equipped tool can work. */
  private workableNodeForGroup(group: MaterialGroup): NodePlacement | null {
    const eq = this.tools.equippedTool();
    let best: NodePlacement | null = null;
    let bestD = Infinity;
    for (const p of NODE_PLACEMENTS) {
      const def = NODE_DEFS[p.type];
      if (!def.yields.some((y) => groupOf(y.material) === group)) continue;
      if (!eq || eq.kind !== def.tool || eq.tier < def.minTier) continue;
      if (this.nodeState.charges(p.id) <= 0) continue;
      const d = Math.hypot(p.x - this.player.x, p.z - this.player.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Any node (tool or not) that yields `group` — for the "need a tool" nudge. */
  private anyNodeForGroup(group: MaterialGroup): NodePlacement | null {
    return (
      NODE_PLACEMENTS.find((p) =>
        NODE_DEFS[p.type].yields.some((y) => groupOf(y.material) === group),
      ) ?? null
    );
  }

  /** Send Datou after a SPECIFIC material (forage a pickable, else work its node). */
  private gatherMaterial(mat: MaterialId): void {
    if (this.isGatherable(mat)) {
      this.startForage(mat);
      return;
    }
    const node = this.workableNodeForMaterial(mat);
    if (node) {
      this.tapNode(node);
      return;
    }
    if (this.anyNodeForMaterial(mat)) this.ui.toast(t('node.needTool'));
    else this.ui.toast(t('forage.cantFind'));
  }

  private workableNodeForMaterial(mat: MaterialId): NodePlacement | null {
    const eq = this.tools.equippedTool();
    let best: NodePlacement | null = null;
    let bestD = Infinity;
    for (const p of NODE_PLACEMENTS) {
      const def = NODE_DEFS[p.type];
      if (!def.yields.some((y) => y.material === mat)) continue;
      if (!eq || eq.kind !== def.tool || eq.tier < def.minTier) continue;
      if (this.nodeState.charges(p.id) <= 0) continue;
      const d = Math.hypot(p.x - this.player.x, p.z - this.player.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private anyNodeForMaterial(mat: MaterialId): NodePlacement | null {
    return NODE_PLACEMENTS.find((p) => NODE_DEFS[p.type].yields.some((y) => y.material === mat)) ?? null;
  }

  /** Materials Datou could fetch right now, for the Fetch menu. */
  private forageOptions(): ForageOption[] {
    const out: ForageOption[] = [];
    const seen = new Set<MaterialId>();
    // Ground pickables that actually exist in the world right now.
    for (const mat of MATERIAL_IDS) {
      if (!this.isGatherable(mat)) continue;
      if (this.world.nearestPickableOfKind(mat, this.player.x, this.player.z, 240)) {
        out.push({ id: mat, via: 'forage' });
        seen.add(mat);
      }
    }
    // Bulk node materials: workable (tool ok) → enabled; else blocked w/ reason.
    for (const p of NODE_PLACEMENTS) {
      const def = NODE_DEFS[p.type];
      for (const y of def.yields) {
        if (seen.has(y.material)) continue;
        seen.add(y.material);
        const eq = this.tools.equippedTool();
        const canWork = !!eq && eq.kind === def.tool && eq.tier >= def.minTier;
        out.push(
          canWork
            ? { id: y.material, via: 'node' }
            : { id: y.material, via: 'blocked', note: t('forage.needTool') },
        );
      }
    }
    return out;
  }

  /** Current forage/harvest status for the Fetch menu banner. */
  private forageStatus(): { active: boolean; label: string; fill: number; capacity: number } {
    if (this.harvest.active) {
      const id = this.harvest.workingNodeId;
      const p = NODE_PLACEMENTS.find((n) => n.id === id);
      return {
        active: true,
        label: p ? t(`node.name.${p.type}`) : t('forage.somewhere'),
        fill: this.harvest.fill,
        capacity: this.forage.bucketCapacity,
      };
    }
    if (this.forage.active) {
      const mat = this.forage.pinnedMaterial;
      return {
        active: true,
        label: mat ? tDyn(`material.${mat}`) : t('forage.somewhere'),
        fill: this.forage.fill,
        capacity: this.forage.bucketCapacity,
      };
    }
    return { active: false, label: '', fill: 0, capacity: this.forage.bucketCapacity };
  }

  private callDatouBack(): void {
    if (this.harvest.active) this.harvest.stop();
    else if (this.forage.active) this.forage.stop();
    this.datouRig.setBucketFill(0);
    this.datouRig.setCarrying(false);
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
      personality: this.personality.axis(),
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

  // --- Starter treasure coffer (blueprint onboarding) ---

  private placeCoffer(): void {
    this.cofferOpen = this.loadRaw('wwd.coffer') === '1';
    this.cofferCutout = new Cutout(drawCoffer(7, this.cofferOpen), {
      height: 0.7,
      shadowRadius: 0.5,
    });
    this.world.placeCutout(this.cofferCutout, COFFER_POS.x, COFFER_POS.z);
  }

  /**
   * Open the coffer once: bank a basic blueprint hint (the fetch stick — the
   * simplest exact, and it feeds the play loop the player already knows) with
   * ONE of its two cells revealed, and drop the twigs to fulfil it. This is the
   * concrete teach of the no-blueprint loop: an idea + the stock to try it.
   */
  private openCoffer(): void {
    if (this.cofferOpen) return;
    this.cofferOpen = true;
    this.saveRaw('wwd.coffer', '1');

    // Bank the three bootstrap blueprints — the fetch stick (feeds the play
    // loop) and the two t1 tools (the §8.2 node bootstrap), each fully revealed
    // so the chest READS as a how-to, not a riddle.
    for (const form of ['stick', 'axe', 'pickaxe'] as const) {
      this.bankFullBlueprint(form, t('coffer.context'));
    }
    // A generous starter haul: at least 5 of each material category (wood /
    // stone / plant / found) so the player can immediately try the bench across
    // every recipe group, not just the three banked blueprints. Each material
    // here is one the pack can actually hold (see isPackResource).
    const STARTER: Array<[ItemId, number]> = [
      ['twig', 6], // wood
      ['pebble', 6], // stone
      ['flower', 5], // plant
      ['feather', 5], // found
    ];
    for (const [mat, n] of STARTER) this.backpack.add(mat, n);

    // Re-plate to the opened state + a calm warm beat.
    if (this.cofferCutout) {
      this.cofferCutout.group.removeFromParent();
      this.cofferCutout.dispose();
      this.cofferCutout = new Cutout(drawCoffer(7, true), { height: 0.7, shadowRadius: 0.5 });
      this.world.placeCutout(this.cofferCutout, COFFER_POS.x, COFFER_POS.z);
    }
    this.bond.add('discovery', 2);
    this.datouRig.pulse();
    this.datouRig.reach();
    this.memories.add({
      ts: Date.now(),
      kind: 'want',
      key: 'coffer',
      mood: this.physics.getDatouState().mood,
    });
    this.ui.toast(t('coffer.opened'));
  }

  /** Bank an authored pattern with every cell revealed — a fully revealed
   *  hint IS the full blueprint (coffer reward contract, §9). */
  private bankFullBlueprint(form: FormId, context: string): void {
    const pat = patternForForm(form);
    if (!pat) return;
    const cells: number[] = [];
    for (let i = 0; i < 9; i++) if (pat.cells[i]) cells.push(i);
    this.workshopState.bankHint({
      pattern: canonical(pat),
      revealedCells: cells,
      context,
      day: dailyKey(),
    });
  }

  /** A landmark moment became a memory: card + bond + the warm pulse. */
  private handleLandmarkMemory(key: string): void {
    this.bond.add('discovery', 2);
    this.personality.note('explore');
    this.physics.applyPet();
    this.memories.add({
      ts: Date.now(),
      kind: 'want',
      key,
      mood: this.physics.getDatouState().mood,
    });
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
    this.personality.note('work');
    this.physics.applyPet();
    this.datouRig.pulse();
    // Reflect whichever loop is still running (0 when both stand down).
    const fill = this.harvest.active ? this.harvest.fill : this.forage.fill;
    this.datouRig.setBucketFill(fill, this.forage.bucketCapacity);
    if (!this.harvest.active && !this.forage.active) this.datouRig.setCarrying(false);
    this.ui.toast(t('forage.delivered', { n: String(items.length) }));
    this.forageMenu.refresh();
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
    if (!this.isGatherable(mat)) {
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
    this.personality.note('play');
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
    this.personality.note('explore');
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

    // Deferred coffer-open: walked to the chest?
    if (this.pendingCoffer) {
      if (Math.hypot(COFFER_POS.x - this.player.x, COFFER_POS.z - this.player.z) <= GATHER_REACH) {
        this.openCoffer();
        this.pendingCoffer = false;
      } else if (!this.player.hasTarget) {
        this.pendingCoffer = false;
      }
    }

    // Deferred landmark engage: walked to the chime / community coffer?
    if (this.pendingLandmark) {
      const lm = this.pendingLandmark;
      if (Math.hypot(lm.x - this.player.x, lm.z - this.player.z) <= GATHER_REACH + 0.4) {
        this.pendingLandmark = null;
        this.landmarks.engage(lm);
      } else if (!this.player.hasTarget) {
        this.pendingLandmark = null;
      }
    }

    // The authored areas: arrival, the chime beat, the coffer tell.
    this.landmarks.update(dt, this.player.x, this.player.z);

    // The scripted first hook (§6): once, a little into the session, if the
    // home coffer is open and something has been made — Datou looks east.
    if (this.firstHookIn > 0) {
      this.firstHookIn -= dt;
      if (this.firstHookIn <= 0 && this.cofferOpen && this.workshopState.madeCount() >= 1) {
        const anchor = this.landmarks.takeFirstHook();
        if (anchor) this.companion.promptCurious(anchor);
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

    // Keep the Fetch menu's working banner (bucket dots) live while open.
    if (this.forageMenu.isOpen()) {
      this.forageMenuRefreshIn -= dt;
      if (this.forageMenuRefreshIn <= 0) {
        this.forageMenuRefreshIn = 0.5;
        this.forageMenu.refresh();
      }
    }

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
      this.landmarks.mapMarks(),
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
