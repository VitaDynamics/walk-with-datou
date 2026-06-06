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

export interface DatouSceneOptions {
  /** MuJoCo integration timestep in seconds. */
  timestep: number;
  /** Half-extent of the (square) ground, metres. Matches the park in World.ts. */
  parkHalfExtent: number;
  /** Capsule radius (Datou body), metres. */
  bodyRadius: number;
  /** Capsule half-length, metres. */
  bodyHalfLength: number;
}

export const DEFAULT_SCENE_OPTIONS: DatouSceneOptions = {
  timestep: 0.005,
  parkHalfExtent: 22,
  bodyRadius: 0.35,
  bodyHalfLength: 0.45,
};

export function buildDatouSceneXml(opts: DatouSceneOptions = DEFAULT_SCENE_OPTIONS): string {
  const restHeight = opts.bodyRadius; // capsule resting on the ground (Z-up)
  return `<mujoco model="datou-puck">
  <option timestep="${opts.timestep}" gravity="0 0 -9.81" integrator="implicitfast"/>
  <size memory="16M"/>

  <default>
    <geom condim="1" friction="1 0.005 0.0001"/>
  </default>

  <worldbody>
    <geom name="ground" type="plane" size="${opts.parkHalfExtent} ${opts.parkHalfExtent} 0.1"
          pos="0 0 0" rgba="0.55 0.78 0.47 1"/>

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
