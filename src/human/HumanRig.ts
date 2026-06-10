/**
 * HumanRig — the player's cutout puppet: head, sweater torso (with the leash
 * arm), two trouser legs. Simple two-beat walk cycle, breathing idle, facing
 * flip. Exposes the leash hand's world position so the rope can attach.
 */

import * as THREE from 'three';
import { drawHumanHead, drawHumanLeg, drawHumanTorso } from '../art/humanParts';
import { canvasTexture } from '../art/textures';
import type { PropSprite } from '../art/props';

const LEG_LEN = 0.78;
const HIP_Y = 0.78;
const TORSO_H = 0.74;
const HEAD_H = 0.46;

function partPlane(
  sprite: PropSprite,
  height: number,
  anchor: 'top' | 'bottom',
  tint = 1,
): THREE.Mesh {
  const w = height * sprite.aspect;
  const geo = new THREE.PlaneGeometry(w, height);
  geo.translate(0, anchor === 'top' ? -height / 2 : height / 2, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: canvasTexture(sprite.canvas),
    transparent: true,
    alphaTest: 0.08,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  mat.color.setScalar(tint);
  return new THREE.Mesh(geo, mat);
}

export class HumanRig {
  readonly group = new THREE.Group();

  private readonly flip = new THREE.Group();
  private readonly torso: THREE.Mesh;
  private readonly head: THREE.Mesh;
  private readonly nearLeg: THREE.Mesh;
  private readonly farLeg: THREE.Mesh;
  private readonly shadow: THREE.Mesh;
  /** Local-space leash hand anchor (matches the drawn hand in the torso). */
  private readonly handLocal = new THREE.Vector3(0.42, 1.18, 0.05);
  private readonly handWorld = new THREE.Vector3();

  private gait = 0;
  private facing = 1;
  private time = 0;

  constructor(shadowTexture: THREE.Texture) {
    this.farLeg = partPlane(drawHumanLeg(2), LEG_LEN + 0.08, 'top', 0.82);
    this.farLeg.position.set(-0.05, HIP_Y, -0.03);
    this.nearLeg = partPlane(drawHumanLeg(1), LEG_LEN + 0.08, 'top');
    this.nearLeg.position.set(0.06, HIP_Y, 0.03);
    this.flip.add(this.farLeg, this.nearLeg);

    this.torso = partPlane(drawHumanTorso(3), TORSO_H, 'bottom');
    this.torso.position.set(0, HIP_Y - 0.06, 0.01);
    this.flip.add(this.torso);

    this.head = partPlane(drawHumanHead(4), HEAD_H, 'bottom');
    this.head.position.set(0.02, HIP_Y - 0.06 + TORSO_H - 0.1, 0.02);
    this.flip.add(this.head);

    this.group.add(this.flip);

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.7),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.006;
    this.shadow.renderOrder = 0.5;
    this.group.add(this.shadow);
  }

  /** World position of the leash hand (for the rope). */
  get handPosition(): THREE.Vector3 {
    this.handWorld
      .copy(this.handLocal)
      .setX(this.handLocal.x * this.facing)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.flip.rotation.y)
      .add(this.group.position);
    return this.handWorld;
  }

  update(dt: number, x: number, z: number, vx: number, vz: number, camYaw: number): void {
    this.time += dt;
    this.group.position.set(x, 0, z);
    this.flip.rotation.y = camYaw;

    const rightX = Math.cos(camYaw);
    const rightZ = -Math.sin(camYaw);
    const vScreen = vx * rightX + vz * rightZ;
    if (Math.abs(vScreen) > 0.12) this.facing = vScreen > 0 ? 1 : -1;
    this.flip.scale.x = this.facing;

    const speed = Math.hypot(vx, vz);
    const moving = speed > 0.1;
    this.gait += dt * (3 + speed * 3.2);
    const amp = moving ? 0.42 : 0;
    this.nearLeg.rotation.z = Math.sin(this.gait) * amp;
    this.farLeg.rotation.z = Math.sin(this.gait + Math.PI) * amp;

    const bob = moving ? Math.abs(Math.sin(this.gait)) * 0.04 : 0;
    const breath = moving ? 0 : Math.sin((this.time * Math.PI * 2) / 3.1) * 0.006;
    this.torso.position.y = HIP_Y - 0.06 + bob + breath;
    this.head.position.y = HIP_Y - 0.06 + TORSO_H - 0.1 + bob * 1.1 + breath;
    this.torso.rotation.z = moving ? Math.sin(this.gait) * 0.02 : 0;
  }
}
