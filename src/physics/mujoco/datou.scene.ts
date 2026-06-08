/**
 * Builds the MJCF (MuJoCo XML) for the Phase-1 "Datou puck": a capsule body
 * with a 3-DOF planar joint set (slide X, slide Y, hinge Z) over a ground
 * plane. This is the minimal model that yields position + heading for
 * DatouState while running on the real solver. See docs/MUJOCO_DESIGN.md §4.2.
 *
 * Frame note: MuJoCo is Z-up, so the slide joints (X, Y) span the game's
 * horizontal XZ plane and the hinge about Z is the game's yaw. frame.ts owns
 * the conversion.
 *
 * Joint order in qpos/qvel is the declaration order below: [slideX, slideY,
 * hingeZ]. MujocoAdapter relies on this layout.
 */

/** A solid obstacle as an XZ-plane circle (mirrors World's Collider). */
export interface SceneCollider {
  x: number;
  z: number;
  radius: number;
}

export interface DatouSceneOptions {
  /** MuJoCo integration timestep in seconds. */
  timestep: number;
  /** Half-extent of the (square) ground, metres. Matches the park in World.ts. */
  parkHalfExtent: number;
  /** Capsule radius (Datou body), metres. */
  bodyRadius: number;
  /** Capsule half-length, metres. */
  bodyHalfLength: number;
  /** Static park obstacles to emit as fixed cylinder geoms. */
  colliders: SceneCollider[];
}

export const DEFAULT_SCENE_OPTIONS: DatouSceneOptions = {
  timestep: 0.005,
  // Matches the 500×500 park (PARK_HALF 250 in game/World.ts), kept just inside
  // the player bound like the placeholder's PARK_HALF_EXTENT.
  parkHalfExtent: 245,
  bodyRadius: 0.35,
  bodyHalfLength: 0.45,
  colliders: [],
};

/**
 * Emit a static (unjointed) vertical cylinder geom per obstacle. Game-space
 * (x, z) maps to MuJoCo (X, Y) — frame.ts owns that swap — and the cylinder is
 * tall enough that the planar Datou body can never slip over it. `half_height`
 * is the cylinder's z half-extent in MuJoCo's Z-up frame.
 */
function buildColliderGeoms(colliders: SceneCollider[]): string {
  const halfHeight = 1.5;
  return colliders
    .map(
      (c, i) =>
        `    <geom name="obstacle_${i}" type="cylinder" size="${c.radius} ${halfHeight}" ` +
        `pos="${c.x} ${c.z} ${halfHeight}" rgba="0.48 0.29 0.15 1"/>`,
    )
    .join('\n');
}

export function buildDatouSceneXml(opts: DatouSceneOptions = DEFAULT_SCENE_OPTIONS): string {
  const restHeight = opts.bodyRadius; // capsule resting on the ground (Z-up)
  return `<mujoco model="datou-puck">
  <option timestep="${opts.timestep}" gravity="0 0 -9.81" integrator="implicitfast"/>
  <!-- The park emits one static cylinder geom per MAJOR obstacle (trees, rocks,
       logs, lampposts, the full lake-shore ring, landmarks, placed features).
       Small props (reeds, mushrooms) are flagged 'minor' in World and dropped
       before they reach here (see getPhysicsColliders / createPhysics), keeping
       this to ~1400 geoms instead of ~1800. They are all static, so static–
       static contacts are skipped and only Datou-vs-nearby pairs cost anything,
       but the model arrays still scale with geom count — 128M is ample. -->
  <size memory="128M"/>

  <default>
    <geom condim="1" friction="1 0.005 0.0001"/>
  </default>

  <worldbody>
    <geom name="ground" type="plane" size="${opts.parkHalfExtent} ${opts.parkHalfExtent} 0.1"
          pos="0 0 0" rgba="0.55 0.78 0.47 1"/>

${buildColliderGeoms(opts.colliders)}

    <body name="datou" pos="0 0 ${restHeight}">
      <joint name="slide_x" type="slide" axis="1 0 0" damping="6"/>
      <joint name="slide_y" type="slide" axis="0 1 0" damping="6"/>
      <joint name="hinge_z" type="hinge" axis="0 0 1" damping="2"/>
      <geom name="datou_body" type="capsule"
            fromto="${-opts.bodyHalfLength} 0 0 ${opts.bodyHalfLength} 0 0"
            size="${opts.bodyRadius}" mass="6" rgba="0.9 0.7 0.4 1"/>
    </body>
  </worldbody>
</mujoco>`;
}
