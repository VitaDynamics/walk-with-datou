import * as THREE from 'three';
import type { DatouMood, PhysicsAdapter } from '../physics/PhysicsAdapter';
import { Particles } from './ambient/Particles';
import { Wind } from './ambient/Wind';
import { CameraRig } from './CameraRig';
import { Datou } from './Datou';
import { Input } from './Input';
import { Player } from './Player';
import { World } from './World';

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
  private sun!: THREE.DirectionalLight;

  private readonly moodEl: HTMLElement | null;
  private lastTime = 0;
  private running = false;
  private currentMood: DatouMood | null = null;

  constructor(canvas: HTMLCanvasElement, physics: PhysicsAdapter) {
    this.physics = physics;

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

    this.scene.add(this.world.group);
    this.scene.add(this.player.group);
    this.scene.add(this.datou.group);
    this.scene.add(this.particles.points);

    this.moodEl = document.getElementById('mood-tag');

    window.addEventListener('resize', () => this.onResize());
  }

  async start(): Promise<void> {
    await this.physics.init();
    this.physics.setMode('follow');
    this.lastTime = performance.now();
    this.running = true;
    requestAnimationFrame((t) => this.tick(t));
  }

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
    // Movement is camera-relative: pass the current view yaw so "forward" is
    // always away from the camera, no matter how the user has dragged the view.
    this.player.update(input, dt, this.cameraRig.viewYaw);

    if (input.clicked) {
      this.handleClick(input.clickNdcX, input.clickNdcY);
    }

    this.physics.setPlayerPosition(this.player.position.x, this.player.position.z);
    this.physics.step(dt);

    const state = this.physics.getDatouState();
    this.datou.apply(state);
    this.updateMoodHUD(state.mood);

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

    requestAnimationFrame((t) => this.tick(t));
  }

  private handleClick(ndcX: number, ndcY: number): void {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.cameraRig.camera);
    if (this.datou.intersectsRay(this.raycaster)) {
      this.physics.applyPet();
    }
  }

  private updateMoodHUD(mood: DatouMood): void {
    if (!this.moodEl) return;
    if (mood === this.currentMood) return;
    this.currentMood = mood;
    this.moodEl.textContent = mood;
    this.moodEl.style.background = MOOD_COLORS[mood];
  }

  private onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.cameraRig.setAspect(window.innerWidth / window.innerHeight);
  }
}

const MOOD_COLORS: Record<DatouMood, string> = {
  happy: '#ffd166',
  calm: '#ffe8a3',
  curious: '#c9e8ff',
  tired: '#d9d0c7',
};
