import * as THREE from 'three';
import { POI_KINDS, type PoiData, type PoiKind } from './pois';

/**
 * Visual markers for the POIs (docs/GAMEPLAY_DESIGN.md §F3). One small
 * THREE.Group per POI, all parented under `group`. Each marker has:
 *  - a faint ground ring so an attentive player can spot it from a distance;
 *  - a little kind-specific accent (a glint, a tuft, a ripple…);
 *  - a gentle idle bob, a stronger "Datou is curious about THIS one" highlight,
 *    and a one-shot reaction when it's discovered, after which it settles.
 *
 * Pure rendering, fed by ids from the PoiField (game logic). Mirrors Datou.ts:
 * state lives elsewhere; this just poses what it's told.
 */
export class PoiMarkers {
  readonly group = new THREE.Group();
  private readonly markers = new Map<number, Marker>();

  constructor(pois: readonly PoiData[]) {
    for (const p of pois) {
      const marker = buildMarker(p.kind);
      marker.group.position.set(p.x, 0, p.z);
      this.group.add(marker.group);
      this.markers.set(p.id, marker);
    }
  }

  /** Highlight the POI Datou is currently curious about (null = none). */
  setActive(id: number | null): void {
    for (const [mid, m] of this.markers) m.active = mid === id;
  }

  /** Begin the discovery reaction for a POI (plays once, then it settles dim). */
  reveal(id: number): void {
    const m = this.markers.get(id);
    if (m && !m.discovered) {
      m.discovered = true;
      m.revealT = 0;
    }
  }

  /** Animate all markers. `t` is absolute seconds (performance.now * 0.001). */
  update(dt: number, t: number): void {
    for (const m of this.markers.values()) {
      // Idle bob; active markers bob higher + spin their accent to draw the eye.
      const bob = m.active ? 0.18 : 0.06;
      const speed = m.active ? 4 : 1.6;
      m.accent.position.y = m.baseY + Math.abs(Math.sin(t * speed)) * bob;
      m.accent.rotation.y += dt * (m.active ? 2.2 : 0.4);

      // Ring brightens when active, dims once discovered.
      const ringMat = m.ring.material as THREE.MeshBasicMaterial;
      const targetOpacity = m.discovered ? 0.12 : m.active ? 0.55 : 0.28;
      ringMat.opacity += (targetOpacity - ringMat.opacity) * Math.min(1, dt * 5);

      if (m.discovered && m.revealT >= 0) {
        // A quick pop then settle: scale the accent up and back to a resting,
        // slightly smaller "found" state.
        m.revealT += dt;
        const pop = m.revealT < 0.3 ? 1 + (0.3 - m.revealT) * 2.2 : 1;
        const settle = THREE.MathUtils.clamp(1.0 - m.revealT * 0.25, 0.6, 1.0);
        m.accent.scale.setScalar(pop * settle);
        if (m.revealT > 1.5) m.revealT = -1; // done
      }
    }
  }
}

interface Marker {
  group: THREE.Group;
  ring: THREE.Mesh;
  accent: THREE.Object3D;
  baseY: number;
  active: boolean;
  discovered: boolean;
  /** ≥0 while the reveal animation is playing; -1 when finished. */
  revealT: number;
}

// Shared ring geometry + a translucent white base material (cloned per marker
// so each can fade independently).
const RING_GEO = new THREE.RingGeometry(0.55, 0.75, 20).rotateX(-Math.PI / 2);

function buildMarker(kind: PoiKind): Marker {
  const info = POI_KINDS[kind];
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    RING_GEO,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  ring.position.y = 0.02;
  group.add(ring);

  const accent = buildAccent(kind, info.color);
  group.add(accent);

  return { group, ring, accent, baseY: accent.position.y, active: false, discovered: false, revealT: -1 };
}

/** A small kind-specific accent that sits on the marker. Cheap primitives in
 *  the project's flat-shaded style. */
function buildAccent(kind: PoiKind, color: number): THREE.Object3D {
  const mat = new THREE.MeshStandardMaterial({ color, flatShading: true });
  switch (kind) {
    case 'shiny-thing': {
      // A faceted gem glint.
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mat);
      gem.position.y = 0.32;
      gem.castShadow = true;
      return gem;
    }
    case 'butterfly': {
      // Two little wing planes.
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.CircleGeometry(0.12, 6), mat);
        wing.position.set(s * 0.09, 0.4, 0);
        wing.rotation.y = s * 0.6;
        g.add(wing);
      }
      g.position.y = 0;
      return g;
    }
    case 'puddle': {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.45, 12).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.8, flatShading: true }),
      );
      disc.position.y = 0.03;
      return disc;
    }
    case 'burrow': {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.25, 10).rotateX(-Math.PI / 2), mat);
      hole.position.y = 0.025;
      const mound = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x6f5a3a, flatShading: true }),
      );
      mound.scale.y = 0.4;
      mound.position.y = 0.02;
      const g = new THREE.Group();
      g.add(mound, hole);
      return g;
    }
    case 'berry-bush': {
      const g = new THREE.Group();
      const bush = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.3, 0),
        new THREE.MeshStandardMaterial({ color: 0x3c7530, flatShading: true }),
      );
      bush.position.y = 0.3;
      bush.castShadow = true;
      g.add(bush);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const berry = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), mat);
        berry.position.set(Math.cos(a) * 0.25, 0.32, Math.sin(a) * 0.25);
        g.add(berry);
      }
      return g;
    }
    case 'sniff-spot':
    case 'scent-trail':
    default: {
      // A small tuft / scent wisp — a thin tilted cone.
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 5), mat);
      tuft.position.y = 0.24;
      tuft.rotation.z = 0.2;
      return tuft;
    }
  }
}
