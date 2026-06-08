import * as THREE from 'three';
import type { DatouMode, DatouMood, PhysicsAdapter } from '../physics/PhysicsAdapter';
import { Particles } from './ambient/Particles';
import { Wind } from './ambient/Wind';
import { Bond } from './Bond';
import { CameraRig } from './CameraRig';
import { Companion } from './Companion';
import { Datou } from './Datou';
import { Input } from './Input';
import { Player } from './Player';
import { PoiField, type PoiData } from './pois';
import { Inventory } from './Inventory';
import { InventoryUI } from '../ui/InventoryUI';
import { DatouFetch } from './DatouFetch';
import { PoiMarkers } from './Poi';
import { featureById, type Feature } from './features';
import { FeatureUI } from '../ui/FeatureUI';
import { Highlighter } from './Highlight';
import { onLangChange, t } from '../i18n';
import { World, getMovableSpecs, catalog, type MovableSpec } from './World';
import { MovableProps } from './MovableProps';
import { MovablePropRenderer } from './MovablePropRenderer';
import { resolveAction, type ActionResolution } from './Interaction';
import { loadManifestKinds } from './catalog/manifest';

const MAX_DT = 1 / 30;

/**
 * Top-level orchestrator. Owns the renderer, scene, camera, and the loop.
 * Depends only on the PhysicsAdapter interface so a different simulation
 * backend can be swapped in by changing one line in main.ts.
 */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly cameraRig: CameraRig;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  private readonly world: World;
  private readonly player: Player;
  private readonly datou: Datou;
  private readonly input: Input;
  private readonly physics: PhysicsAdapter;
  private readonly wind = new Wind();
  private readonly particles = new Particles();
  private readonly bond = new Bond();
  private readonly companion: Companion;
  private readonly pois = new PoiField();
  private readonly poiMarkers: PoiMarkers;
  private readonly featureUI = new FeatureUI();
  private readonly highlighter = new Highlighter();
  private readonly movables = new MovableProps();
  private readonly movableRenderer = new MovablePropRenderer();
  private readonly inventory = new Inventory();
  private readonly fetch: DatouFetch;
  /** Datou's body as a soft pusher of movable props (ENV §4.2.2). */
  private readonly DATOU_BODY_RADIUS = 0.45;
  private readonly PLAYER_RADIUS = 0.4;
  /** The prop the player is currently carrying, if any. */
  private carriedPropId: number | null = null;
  private currentAction: ActionResolution | null = null;
  private lastBackpackCount = 0;
  private sun!: THREE.DirectionalLight;

  private readonly moodEl: HTMLElement | null;
  private readonly creatorBannerEl: HTMLElement | null;
  private readonly actionPromptEl: HTMLElement | null;
  private readonly canvas: HTMLCanvasElement;
  private hoveredFeatureId: string | null = null;
  private hoveredPropName: string | null = null;
  private lastTime = 0;
  private running = false;
  private currentMood: DatouMood | null = null;

  constructor(canvas: HTMLCanvasElement, physics: PhysicsAdapter) {
    this.physics = physics;
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd9eef7);
    // Fog reaches much farther now the park is 500×500: it fades distant
    // geometry into the sky (cozy + hides the far edges) while keeping nearby
    // landmarks readable. Fades to the background colour. Coordinated with the
    // camera far plane (CameraRig). See docs/ENVIRONMENT_DESIGN.md §4.3.
    this.scene.fog = new THREE.Fog(0xd9eef7, 60, 320);

    this.cameraRig = new CameraRig(canvas, window.innerWidth / window.innerHeight);

    this.setupLights();

    this.world = new World();
    // Make the park's foliage sway in the shared wind shader.
    for (const mat of this.world.getSwayMaterials()) this.wind.apply(mat);
    this.player = new Player();
    this.player.setColliders(this.world.getColliders());
    // Let the physics backend collide Datou with the scene too. The MuJoCo
    // backend bakes obstacles into its model at init; the placeholder uses
    // these for push-out. Optional on the contract — guard the call.
    this.physics.setColliders?.(this.world.getColliders());
    this.datou = new Datou();
    this.input = new Input(canvas);

    // POI markers — the scattered things to discover. The PoiField (logic) and
    // the markers (visuals) share the same placement.
    this.poiMarkers = new PoiMarkers(this.pois.all());

    // The want/read loop. Companion drives Datou's behaviour through the physics
    // mode/target levers (a thin command sink), reads the real POIs so its
    // "curious" want points at something in the actual park, and feeds the
    // shared Bond. onDiscover ties a reached POI to a marker reveal.
    const companionActions = {
      setMode: (m: DatouMode) => this.physics.setMode(m),
      setTarget: (x: number, z: number) => this.physics.setTarget(x, z),
      onDiscover: (poi: PoiData) => {
        this.pois.discover(poi.id);
        this.poiMarkers.reveal(poi.id);
      },
    };
    this.companion = new Companion(this.bond, companionActions, Math.random, this.pois);

    // Fetch loop + Datou's backpack (package system). Shares the same steering
    // levers as the Companion; the player clicks an item → Datou goes and gets it.
    this.fetch = new DatouFetch(companionActions, this.movables, this.inventory);
    // The backpack panel self-mounts its DOM and subscribes to inventory changes.
    new InventoryUI(this.inventory);
    // Toast when Datou drops a fetched item into the backpack.
    this.inventory.onChange(() => {
      const n = this.inventory.backpackCount;
      if (n > this.lastBackpackCount) this.showToast('Datou added something to its pack 🎒');
      this.lastBackpackCount = n;
    });

    this.scene.add(this.world.group);
    this.scene.add(this.poiMarkers.group);
    this.scene.add(this.player.group);
    this.scene.add(this.datou.group);
    this.scene.add(this.particles.points);

    // Seed the movable props from the catalog's movable-kind scatter, and add
    // their renderer group. Deterministic (same seeded scatter every run).
    for (const spec of getMovableSpecs()) {
      this.spawnedMovableKeys.add(specKey(spec));
      this.movables.spawn(spec);
    }
    this.movableRenderer.sync(this.movables.list());
    this.scene.add(this.movableRenderer.group);

    this.moodEl = document.getElementById('mood-tag');
    this.creatorBannerEl = document.getElementById('creator-banner');
    this.actionPromptEl = document.getElementById('action-prompt');
    if (this.creatorBannerEl) this.creatorBannerEl.textContent = t('creator.banner');

    // Re-localise the dynamic in-canvas labels when the language switches.
    onLangChange(() => {
      if (this.creatorBannerEl) this.creatorBannerEl.textContent = t('creator.banner');
      // Force the mood tag to re-render in the new language next frame.
      const mood = this.currentMood;
      this.currentMood = null;
      if (mood) this.updateMoodHUD(mood);
    });

    window.addEventListener('resize', () => this.onResize());
  }

  async start(): Promise<void> {
    await this.physics.init();
    this.physics.setMode('follow');
    this.lastTime = performance.now();
    this.running = true;
    requestAnimationFrame((now) => this.tick(now));
    // Load the downloaded GLB catalog in the background. The game is fully
    // playable on procedural props before this resolves; GLB kinds (scatter +
    // colliders + movables) merge in when the manifest arrives. Non-blocking.
    void this.loadCatalogAssets();
  }

  /** Fetch the GLB manifest, merge the kinds into the world, and spawn any new
   *  movable props. Safe no-op if no assets have been fetched. */
  private async loadCatalogAssets(): Promise<void> {
    const kinds = await loadManifestKinds();
    if (kinds.length === 0) return;
    this.world.mergeManifestKinds(kinds);
    console.info(`[wwd] catalog: merged ${kinds.length} GLB kinds from manifest`);
    // The merged kinds may include new movables and changed colliders.
    this.player.setColliders(this.world.getColliders());
    for (const spec of getMovableSpecs()) {
      if (!this.spawnedMovableKeys.has(specKey(spec))) {
        this.spawnedMovableKeys.add(specKey(spec));
        this.movables.spawn(spec);
      }
    }
    this.movableRenderer.sync(this.movables.list());
  }

  private readonly spawnedMovableKeys = new Set<string>();

  /** Lightweight snapshot for debugging / automated checks (positions in metres). */
  debugState(): { player: { x: number; z: number }; datou: { x: number; y: number; z: number } } {
    const d = this.physics.getDatouState();
    return {
      player: { x: this.player.position.x, z: this.player.position.z },
      datou: { x: d.position.x, y: d.position.y, z: d.position.z },
    };
  }

  stop(): void {
    this.running = false;
    this.physics.dispose();
  }

  private setupLights(): void {
    // Warm afternoon grade (docs/ENVIRONMENT_DESIGN.md §4.2): a slightly warm
    // ambient + a warm low sun + a sky/ground hemi. Cheap, and colour does most
    // of the cozy emotional work.
    const ambient = new THREE.AmbientLight(0xfff1d8, 0.55);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffe0a8, 1.05);
    sun.position.set(40, 60, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    // Tight shadow frustum that FOLLOWS the player (see tick) — at 500 m we keep
    // it small for crisp near shadows and let distant geometry fog out, rather
    // than covering the whole park (which would collapse shadow resolution).
    const s = 36;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.scene.add(sun.target); // target is moved to the player each frame
    this.sun = sun;

    const hemi = new THREE.HemisphereLight(0xcfeaff, 0x6ba35a, 0.35);
    this.scene.add(hemi);
  }

  private tick(now: number): void {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    const input = this.input.poll();

    // Creator (free-fly) mode toggle: detaches the camera so you can survey the
    // whole park at high speed. WASD/arrows fly, Q/E (or Space) drop/rise,
    // Shift boosts. The player avatar holds still while you scout.
    if (input.toggleCreator) {
      const on = this.cameraRig.setFreeFly(!this.cameraRig.isFreeFly);
      this.setCreatorHud(on);
    }

    let petted = false;
    if (this.cameraRig.isFreeFly) {
      // Route movement to the flying camera; freeze the player.
      let ix = 0;
      let iz = 0;
      if (input.forward) iz -= 1;
      if (input.back) iz += 1;
      if (input.left) ix -= 1;
      if (input.right) ix += 1;
      const iy = (input.up ? 1 : 0) - (input.down ? 1 : 0);
      this.cameraRig.flyMove(ix, iz, iy, input.boost, dt);
      // No feature hover/highlight while flying.
      if (this.hoveredFeatureId !== null || this.hoveredPropName !== null) {
        this.hoveredFeatureId = null;
        this.hoveredPropName = null;
        this.canvas.style.cursor = '';
        this.featureUI.hideTip();
        this.highlighter.setTarget(null);
      }
    } else {
      // Movement is camera-relative: pass the current view yaw so "forward" is
      // always away from the camera, no matter how the user has dragged the view.
      this.player.update(input, dt, this.cameraRig.viewYaw);
      // Hover: name the feature under the cursor (tooltip + pointer cursor).
      this.updateHover(
        input.pointerOver,
        input.pointerNdcX,
        input.pointerNdcY,
        input.pointerPxX,
        input.pointerPxY,
      );
      if (input.clicked) {
        petted = this.handleClick(input.clickNdcX, input.clickNdcY);
      }
    }

    this.physics.setPlayerPosition(this.player.position.x, this.player.position.z);
    this.physics.step(dt);

    const state = this.physics.getDatouState();

    // Fetch loop: advance Datou's go-get-it state machine before the prop sim so
    // the carry flag is set this frame (steers Datou via the same explore/target
    // levers; drops the item into the backpack on delivery).
    this.fetch.update(state, this.player.position);

    // Movable props (ENV §4.2): step the kinematic prop sim after physics so it
    // sees the latest player + Datou positions. Player and Datou's body both
    // push pushable props; carried props track their carrier (a small forward
    // offset puts a Datou-carried item near its mouth).
    const datouMouth = {
      x: state.position.x + Math.sin(state.yaw) * 0.55,
      z: state.position.z + Math.cos(state.yaw) * 0.55,
    };
    this.movables.step(
      dt,
      [
        { x: this.player.position.x, z: this.player.position.z, radius: this.PLAYER_RADIUS },
        { x: state.position.x, z: state.position.z, radius: this.DATOU_BODY_RADIUS },
      ],
      this.world.getColliders(),
      {
        player: { x: this.player.position.x, z: this.player.position.z },
        datou: datouMouth,
      },
    );

    // Resolve the single contextual action for this frame (E / prompt), and fire
    // it on the action key. Direct-touch (click) is handled in handleClick. Only
    // meaningful when not free-flying (E doubles as fly-ascent there).
    if (!this.cameraRig.isFreeFly) {
      this.currentAction = resolveAction({
        player: { x: this.player.position.x, z: this.player.position.z, yaw: 0 },
        datou: state,
        movables: this.movables,
        cursorOnDatou: false,
      });
      if (input.action && this.currentAction) this.activateAction(this.currentAction);
    } else {
      this.currentAction = null;
    }
    this.updateActionPrompt(this.currentAction);

    this.movableRenderer.sync(this.movables.list());
    this.movableRenderer.update(this.movables.list());

    // Want/read loop: Companion may surface a want, judge the player's response
    // (including this frame's pet), grant bond, and steer Datou via the physics
    // levers. Then pose Datou for the active want. (docs/GAMEPLAY_DESIGN.md §F1.)
    this.companion.update(state, this.player.position, petted, dt);
    this.datou.apply(state);
    this.datou.applyExpression(this.companion.expression);
    this.updateMoodHUD(state.mood);

    // Highlight the POI Datou is currently curious about, and animate markers.
    this.poiMarkers.setActive(this.companion.activePoiId);
    this.poiMarkers.update(dt, now * 0.001);

    // Ease the hovered-feature glow + scale-up.
    this.highlighter.update(dt);

    // Ambient life: sway the foliage and drift the motes with the player.
    this.wind.update(dt);
    this.particles.update(dt, this.player.position);

    // Keep the shadow-casting sun centred on the player so its tight frustum
    // gives crisp shadows wherever you roam in the 500 m park. The light keeps
    // its direction (offset) and aims at the player's feet.
    this.sun.position.set(this.player.position.x + 40, 60, this.player.position.z + 22);
    this.sun.target.position.set(this.player.position.x, 0, this.player.position.z);
    this.sun.target.updateMatrixWorld();

    this.cameraRig.update(this.player.position, dt);
    this.renderer.render(this.scene, this.cameraRig.camera);

    requestAnimationFrame((next) => this.tick(next));
  }

  /** Returns true if the click landed on Datou (a pet). */
  private handleClick(ndcX: number, ndcY: number): boolean {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.cameraRig.camera);
    // Datou takes priority — a click on the dog is always a pet.
    if (this.datou.intersectsRay(this.raycaster)) {
      this.physics.applyPet();
      return true;
    }
    // Clicked an interactable, fetchable prop? Send Datou to go get it (it
    // carries it back and drops it into the backpack). The robot-dog "fetch" beat.
    const propId = this.movableRenderer.raycast(this.raycaster);
    if (propId !== null && this.fetch.request(propId)) {
      const name = catalog.get(this.movables.get(propId)?.kindId ?? '')?.name ?? 'it';
      this.showToast(`Datou is fetching ${name}…`);
      return false;
    }
    // Otherwise, did we click a named feature? Open its info card and send
    // Datou over to investigate it together (a shared moment, small bond).
    const feature = this.raycastFeature(ndcX, ndcY);
    if (feature) {
      const got = this.companion.investigate(feature.x, feature.z);
      this.featureUI.openCard(feature, got > 0 ? 'invite.investigate' : 'invite.onway');
    } else {
      // Clicking empty ground dismisses an open card.
      this.featureUI.closeCard();
    }
    return false;
  }

  /**
   * Dispatch a resolved contextual action (ENV §4.2 / INTERACTION_VERBS §4).
   * Interaction.ts chose the verb; here we drive MovableProps for world verbs and
   * the physics/Companion levers for creature verbs. Carry/throw/fetch first (the
   * play core), then push — the rest fold in cheaply on the same path.
   */
  private activateAction(action: ActionResolution): void {
    const px = this.player.position.x;
    const pz = this.player.position.z;

    if (action.target === 'movable' && action.propId !== undefined) {
      const id = action.propId;
      const prop = this.movables.get(id);
      if (!prop) return;
      const heading = this.cameraRig.viewYaw;
      const dirX = Math.sin(heading);
      const dirZ = Math.cos(heading);
      switch (action.verb) {
        case 'carry':
          this.movables.carry(id, 'player');
          this.carriedPropId = id;
          break;
        case 'throw':
          this.movables.throw(id, dirX, dirZ, 9, 4);
          if (this.carriedPropId === id) this.carriedPropId = null;
          break;
        case 'push':
          this.movables.push(id, prop.x - px, prop.z - pz, 6);
          break;
        case 'knockOver':
          this.movables.topple(id);
          break;
        case 'breakScatter':
          this.movables.break(id);
          break;
        case 'move':
          // Pick up and place a short step ahead.
          this.movables.drop(id, px + dirX * 1.5, pz + dirZ * 1.5);
          break;
        default:
          break;
      }
      return;
    }

    if (action.target === 'datou') {
      switch (action.verb) {
        case 'pet':
        case 'wake':
        case 'play':
          this.physics.applyPet();
          break;
        case 'call':
          this.physics.setMode('follow');
          this.physics.setTarget(px, pz);
          break;
        case 'take':
          // Taking an offered item: if Datou carries one, it transfers to player.
          break;
        default:
          break;
      }
    }
  }

  /** Raycast the feature hitboxes and resolve to the feature data, or null. */
  private raycastFeature(ndcX: number, ndcY: number): Feature | null {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.cameraRig.camera);
    const hits = this.raycaster.intersectObjects(this.world.featureHitboxes.children, false);
    for (const hit of hits) {
      const id = hit.object.userData.featureId as string | undefined;
      const feature = id ? featureById(id) : undefined;
      if (feature) return feature;
    }
    return null;
  }

  /** Show the hover tooltip for the feature OR interactable prop under the
   *  cursor, and set the pointer cursor so it reads as clickable. Named features
   *  take priority; otherwise the nearest interactable catalog/movable prop's
   *  name is shown so you can tell what a thing is just by pointing at it. */
  private updateHover(over: boolean, ndcX: number, ndcY: number, pxX: number, pxY: number): void {
    const feature = over ? this.raycastFeature(ndcX, ndcY) : null;
    const id = feature?.id ?? null;
    if (id !== this.hoveredFeatureId) {
      this.hoveredFeatureId = id;
      this.canvas.style.cursor = feature ? 'pointer' : '';
      // Move the glow + scale-up highlight to the newly hovered feature's mesh.
      this.highlighter.setTarget(feature ? (this.world.getFeatureMesh(feature.id) ?? null) : null);
    }
    if (feature) {
      this.featureUI.showTip(feature.id, pxX, pxY);
      this.hoveredPropName = null;
      return;
    }
    // No feature: try an interactable prop under the cursor.
    const propName = over ? this.raycastPropName(ndcX, ndcY) : null;
    if (propName !== this.hoveredPropName) {
      this.hoveredPropName = propName;
      this.canvas.style.cursor = propName ? 'pointer' : '';
    }
    if (propName) this.featureUI.showText(propName, pxX, pxY);
    else this.featureUI.hideTip();
  }

  /** The interactable prop's display name under the cursor, or null. */
  private raycastPropName(ndcX: number, ndcY: number): string | null {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.cameraRig.camera);
    const propId = this.movableRenderer.raycast(this.raycaster);
    if (propId === null) return null;
    const prop = this.movables.get(propId);
    if (!prop) return null;
    const kind = catalog.get(prop.kindId);
    if (!kind || !kind.interactable) return null;
    return kind.name;
  }

  private setCreatorHud(on: boolean): void {
    if (this.creatorBannerEl) this.creatorBannerEl.hidden = !on;
  }

  private lastPromptLabel: string | null = null;
  /** Show/hide the single contextual-action prompt (E + verb label). */
  private updateActionPrompt(action: ActionResolution | null): void {
    if (!this.actionPromptEl) return;
    const label = action ? action.label : null;
    if (label === this.lastPromptLabel) return;
    this.lastPromptLabel = label;
    if (!label) {
      this.actionPromptEl.hidden = true;
      return;
    }
    this.actionPromptEl.hidden = false;
    this.actionPromptEl.innerHTML = `<b>E</b>${label}`;
  }

  private readonly toastEl = document.getElementById('toast');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  /** Flash a transient message (fetch confirmations, deposits). */
  private showToast(text: string, ms = 2500): void {
    if (!this.toastEl) return;
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    this.toastEl.style.opacity = '1';
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      if (this.toastEl) this.toastEl.style.opacity = '0';
    }, ms);
  }

  private updateMoodHUD(mood: DatouMood): void {
    if (!this.moodEl) return;
    if (mood === this.currentMood) return;
    this.currentMood = mood;
    this.moodEl.textContent = t(`mood.${mood}` as const);
    this.moodEl.style.background = MOOD_COLORS[mood];
  }

  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraRig.setAspect(window.innerWidth / window.innerHeight);
  }
}

/** Stable key for a movable spec, so re-merging the catalog never double-spawns
 *  the same placement (the scatter is deterministic, so position identifies it). */
function specKey(s: MovableSpec): string {
  return `${s.kindId}@${s.x.toFixed(3)},${s.z.toFixed(3)}`;
}

const MOOD_COLORS: Record<DatouMood, string> = {
  happy: '#ffd166',
  calm: '#ffe8a3',
  curious: '#c9e8ff',
  tired: '#d9d0c7',
};
