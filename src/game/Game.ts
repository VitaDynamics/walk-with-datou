/**
 * Game — the diorama orchestrator.
 *
 * Owns the renderer, the glade, the rig, the want loop, and the console, and
 * routes the three pointer gestures into companionship verbs:
 *   tap Datou → pet · hold Datou → soothe · tap glade → explore together.
 * The physics adapter contract is untouched: this layer only reads
 * getDatouState() and pulls the mode/target levers.
 */

import * as THREE from 'three';
import { canvasTexture, paintBackdrop, paintContactShadow } from '../art/textures';
import { DatouRig } from '../datou/DatouRig';
import type { PhysicsAdapter } from '../physics/PhysicsAdapter';
import { Console, type Stance } from '../ui/Console';
import { Diorama, WALK_RADIUS } from '../world/Diorama';
import { SPOTS_PER_DAY, SpotField, dailyKey, dailySeed, type Spot } from '../world/Spots';
import { Bond } from './Bond';
import { CameraRig } from './CameraRig';
import { Companion, type CompanionEvents, type WantKind } from './Companion';
import { Memories } from './Memories';
import { Pointer } from './Pointer';

const MAX_DT = 1 / 30;
/** Bond level at which the trust bar reads full (kept abstract for the player). */
const TRUST_FULL = 120;
const BOND_KEY = 'wwd.bond';
const SPOTS_KEY_PREFIX = 'wwd.spots.';
/** A hold this long counts as a real soothing session → memory. */
const COMFORT_MEMORY_SECONDS = 2.5;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly cameraRig: CameraRig;
  private readonly diorama: Diorama;
  private readonly rig: DatouRig;
  private readonly physics: PhysicsAdapter;
  private readonly companion: Companion;
  private readonly bond: Bond;
  private readonly memories = new Memories();
  private readonly spots: SpotField;
  private readonly ui: Console;
  private readonly pointer: Pointer;
  private readonly raycaster = new THREE.Raycaster();

  private readonly events: CompanionEvents = { petted: false, comforted: false, guidedTo: null };
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

    this.diorama = new Diorama();
    this.scene.add(this.diorama.group);

    this.rig = new DatouRig(canvasTexture(paintContactShadow()));
    this.scene.add(this.rig.group);

    // --- Relationship state (persists across sessions) ---
    this.bond = new Bond(this.loadBond());
    this.spots = new SpotField(dailySeed(), this.diorama.spotAnchors, SPOTS_PER_DAY);
    this.spots.restoreFound(this.loadFoundSpots());
    for (const s of this.spots.spots) if (s.found) this.diorama.revealSpot(s);

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

    this.ui = new Console(this.memories, {
      onStance: (stance) => this.setStance(stance),
    });
    this.ui.setFoundToday(this.spots.foundCount, this.spots.spots.length);
    this.ui.setTrust(this.bond.level / TRUST_FULL);

    this.pointer = new Pointer(canvas, {
      onTap: (x, y) => this.handleTap(x, y),
      onHoldStart: (x, y) => this.handleHoldStart(x, y),
      onHoldEnd: (duration) => this.handleHoldEnd(duration),
      onDrag: (dx) => this.cameraRig.addDrag(dx),
      onZoom: (d) => this.cameraRig.addZoom(d),
    });

    // The "you" the physics follows is the resting pad.
    this.physics.setColliders?.(this.diorama.colliders);
    this.physics.setPlayerPosition(this.diorama.padPosition.x, this.diorama.padPosition.z);
    this.physics.setMode('idle');

    window.addEventListener('resize', this.onResize);
    window.addEventListener('beforeunload', () => this.saveBond());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  // --- pointer verbs ---

  private handleTap(clientX: number, clientY: number): void {
    this.ui.notifyInteracted();
    const hit = this.pick(clientX, clientY);
    if (hit === 'datou') {
      this.events.petted = true;
      this.physics.applyPet();
      this.rig.pulse();
      return;
    }
    if (hit) {
      // Clamp the guide point inside the walkable glade.
      const len = Math.hypot(hit.x, hit.z);
      const s = len > WALK_RADIUS ? WALK_RADIUS / len : 1;
      this.events.guidedTo = { x: hit.x * s, z: hit.z * s };
    }
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

  /** Raycast a screen point: Datou's tap plate, else the glade floor. */
  private pick(clientX: number, clientY: number): 'datou' | { x: number; z: number } | null {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.cameraRig.camera);
    if (this.raycaster.intersectObject(this.rig.hitMesh, false).length > 0) return 'datou';
    const ground = this.raycaster.intersectObject(this.diorama.groundMesh, false)[0];
    if (ground) return { x: ground.point.x, z: ground.point.z };
    return null;
  }

  // --- companionship events ---

  private setStance(stance: Stance): void {
    this.ui.notifyInteracted();
    this.companion.homeMode = stance;
    this.physics.setMode(stance);
  }

  private handleDiscover(spot: Spot): void {
    this.spots.markFound(spot.id);
    this.diorama.revealSpot(spot);
    this.physics.applyPet(); // a find makes Datou visibly happy
    this.rig.pulse();
    const entry = {
      ts: Date.now(),
      kind: 'discovery' as const,
      key: `${spot.art}@${spot.place}`,
      mood: this.physics.getDatouState().mood,
    };
    this.memories.add(entry);
    this.ui.toast(this.ui.memoryText(entry));
    this.ui.setFoundToday(this.spots.foundCount, this.spots.spots.length);
    this.saveFoundSpots();
  }

  private handleWantSatisfied(kind: WantKind): void {
    this.physics.applyPet();
    this.rig.pulse();
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

    // While soothing, keep the warmth flowing (mood + a soft lean now and then).
    if (this.comforting) {
      this.comfortPulseIn -= dt;
      if (this.comfortPulseIn <= 0) {
        this.comfortPulseIn = 0.9;
        this.physics.applyPet();
        this.rig.pulse();
      }
    }

    this.physics.step(dt);
    const state = this.physics.getDatouState();

    this.companion.update(state, this.diorama.padPosition, this.events, dt);
    this.events.petted = false;
    this.events.comforted = false;
    this.events.guidedTo = null;

    // Bond milestones become memories + a quiet toast.
    for (const unlock of this.bond.takeUnlocks()) {
      const entry = { ts: Date.now(), kind: 'milestone' as const, key: unlock, mood: state.mood };
      this.memories.add(entry);
      this.ui.toast(this.ui.memoryText(entry));
    }

    // Render layers.
    const datouPos = new THREE.Vector3(state.position.x, 0, state.position.z);
    this.cameraRig.update(dt, datouPos);
    this.diorama.update(dt, this.cameraRig.azimuth);
    this.rig.update(dt, state, this.companion.expression, this.cameraRig.azimuth);

    // Console sync.
    this.ui.setMood(state.mood);
    this.ui.setTrust(this.bond.level / TRUST_FULL);
    const want = this.companion.activeWant;
    if (want) {
      const head = datouPos.clone().setY(1.15).project(this.cameraRig.camera);
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
      this.saveBond();
    }

    this.renderer.render(this.scene, this.cameraRig.camera);
    requestAnimationFrame(this.tick);
  };

  private readonly onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraRig.resize(window.innerWidth / window.innerHeight);
  };

  // --- persistence ---

  private loadBond(): number {
    try {
      return Number(localStorage.getItem(BOND_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  private saveBond(): void {
    try {
      localStorage.setItem(BOND_KEY, String(this.bond.level));
    } catch {
      // Private mode — the relationship lives for the session only.
    }
  }

  private loadFoundSpots(): number[] {
    try {
      const raw = localStorage.getItem(SPOTS_KEY_PREFIX + dailyKey());
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
    } catch {
      return [];
    }
  }

  private saveFoundSpots(): void {
    try {
      localStorage.setItem(SPOTS_KEY_PREFIX + dailyKey(), JSON.stringify(this.spots.foundIds()));
    } catch {
      // Non-fatal.
    }
  }

  dispose(): void {
    this.running = false;
    this.pointer.dispose();
    window.removeEventListener('resize', this.onResize);
    this.physics.dispose();
    this.renderer.dispose();
  }
}
