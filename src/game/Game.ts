import * as THREE from 'three';
import type { DatouMood, PhysicsAdapter } from '../physics/PhysicsAdapter';
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
  private readonly camera: THREE.PerspectiveCamera;
  private readonly cameraTarget = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  private readonly world: World;
  private readonly player: Player;
  private readonly datou: Datou;
  private readonly input: Input;
  private readonly physics: PhysicsAdapter;

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
    this.scene.fog = new THREE.Fog(0xd9eef7, 28, 70);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 9, 14);
    this.camera.lookAt(0, 0, 0);

    this.setupLights();

    this.world = new World();
    this.player = new Player();
    this.datou = new Datou();
    this.input = new Input(canvas);

    this.scene.add(this.world.group);
    this.scene.add(this.player.group);
    this.scene.add(this.datou.group);

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

  stop(): void {
    this.running = false;
    this.physics.dispose();
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffe8b8, 0.95);
    sun.position.set(12, 18, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);

    const hemi = new THREE.HemisphereLight(0xc9e8ff, 0x6ba35a, 0.3);
    this.scene.add(hemi);
  }

  private tick(now: number): void {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT);
    this.lastTime = now;

    const input = this.input.poll();
    this.player.update(input, dt);

    if (input.clicked) {
      this.handleClick(input.clickNdcX, input.clickNdcY);
    }

    this.physics.setPlayerPosition(this.player.position.x, this.player.position.z);
    this.physics.step(dt);

    const state = this.physics.getDatouState();
    this.datou.apply(state);
    this.updateMoodHUD(state.mood);

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame((t) => this.tick(t));
  }

  private handleClick(ndcX: number, ndcY: number): void {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (this.datou.intersectsRay(this.raycaster)) {
      this.physics.applyPet();
    }
  }

  private updateCamera(dt: number): void {
    const desiredX = this.player.position.x * 0.6;
    const desiredY = 9;
    const desiredZ = this.player.position.z + 12;

    const lerp = Math.min(1, dt * 3.5);
    this.camera.position.x += (desiredX - this.camera.position.x) * lerp;
    this.camera.position.y += (desiredY - this.camera.position.y) * lerp;
    this.camera.position.z += (desiredZ - this.camera.position.z) * lerp;

    this.cameraTarget.x += (this.player.position.x - this.cameraTarget.x) * lerp;
    this.cameraTarget.y += (1 - this.cameraTarget.y) * lerp;
    this.cameraTarget.z += (this.player.position.z - this.cameraTarget.z) * lerp;
    this.camera.lookAt(this.cameraTarget);
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
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
}

const MOOD_COLORS: Record<DatouMood, string> = {
  happy: '#ffd166',
  calm: '#ffe8a3',
  curious: '#c9e8ff',
  tired: '#d9d0c7',
};
