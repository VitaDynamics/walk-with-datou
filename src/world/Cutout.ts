/**
 * Cutout — a hand-drawn sprite standing in the 3D diorama.
 *
 * The Don't Starve trick: the world is 3D (real depth, real positions), but
 * everything in it is a flat painted plate that turns to face the camera
 * (cylindrical billboard — upright, rotating only around Y). Each cutout
 * carries its own soft contact shadow so it sits on the ground.
 */

import * as THREE from 'three';
import type { PropSprite } from '../art/props';
import { canvasTexture } from '../art/textures';

export interface CutoutOptions {
  /** World height of the plate in meters (width follows the sprite aspect). */
  height: number;
  /** Contact shadow radius in meters; 0 disables the shadow. */
  shadowRadius?: number;
  /** Lay the plate flat on the ground (decal) instead of billboarding. */
  decal?: boolean;
  /** Extra render order bias (decals under everything, icons above grass…). */
  renderOrder?: number;
}

let sharedShadowTexture: THREE.Texture | null = null;

export function setSharedShadowTexture(tex: THREE.Texture): void {
  sharedShadowTexture = tex;
}

export class Cutout {
  readonly group = new THREE.Group();
  readonly plane: THREE.Mesh;
  private readonly billboard: boolean;

  constructor(sprite: PropSprite, opts: CutoutOptions) {
    const tex = canvasTexture(sprite.canvas);
    const w = opts.height * sprite.aspect;
    const geo = new THREE.PlaneGeometry(w, opts.height);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.08,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    this.plane = new THREE.Mesh(geo, mat);
    this.billboard = !opts.decal;

    if (opts.decal) {
      this.plane.rotation.x = -Math.PI / 2;
      this.plane.position.y = 0.012;
      this.plane.material = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      });
      this.plane.renderOrder = opts.renderOrder ?? 1;
    } else {
      // Bottom-anchor: y=0 is where the plate meets the ground.
      geo.translate(0, opts.height / 2, 0);
      this.plane.renderOrder = opts.renderOrder ?? 0;
    }
    this.group.add(this.plane);

    const shadowR = opts.shadowRadius ?? 0;
    if (shadowR > 0 && sharedShadowTexture) {
      const sGeo = new THREE.PlaneGeometry(shadowR * 2, shadowR * 1.3);
      const sMat = new THREE.MeshBasicMaterial({
        map: sharedShadowTexture,
        transparent: true,
        depthWrite: false,
      });
      const shadow = new THREE.Mesh(sGeo, sMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.008;
      shadow.renderOrder = 0.5;
      this.group.add(shadow);
    }
  }

  setPosition(x: number, z: number, y = 0): void {
    this.group.position.set(x, y, z);
  }

  /** Turn the plate to face the camera's azimuth (call when the camera moves). */
  faceCamera(camYaw: number): void {
    if (this.billboard) this.plane.rotation.y = camYaw;
  }

  dispose(): void {
    this.plane.geometry.dispose();
    const mats = Array.isArray(this.plane.material) ? this.plane.material : [this.plane.material];
    for (const m of mats) m.dispose();
  }
}
