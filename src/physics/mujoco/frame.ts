/**
 * Coordinate-frame conversion between the game (Three.js, Y-up) and MuJoCo
 * (Z-up). This is the single place the swap is defined — see
 * docs/MUJOCO_DESIGN.md §3. Keeping it here (and unit-tested for round-trip
 * identity) means the rest of the codebase never reasons about Z-up.
 *
 *   game (x, y, z)        mujoco (X, Y, Z)
 *      x  (east)    <->      X
 *      z  (south)   <->      Y
 *      y  (up)      <->      Z
 *
 * Heading: the game uses yaw about +Y with yaw=0 facing +Z (per
 * PhysicsAdapter.ts and PlaceholderPhysics, which computes yaw = atan2(vx, vz)).
 * The Datou body's local forward in MuJoCo is +X, rotated by a hinge about +Z
 * by angle theta. Forward(game) = (sin yaw, 0, cos yaw) maps to the MuJoCo XY
 * vector (sin yaw, cos yaw); MuJoCo forward = (cos theta, sin theta). Equating
 * gives theta = pi/2 - yaw (and the inverse, yaw = pi/2 - theta).
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Game-space position -> MuJoCo planar (X, Y) for the slide joints. */
export function gamePosToMujocoXY(pos: { x: number; z: number }): [number, number] {
  return [pos.x, pos.z];
}

/** MuJoCo planar (X, Y) + height Z -> game-space position. */
export function mujocoToGamePos(X: number, Y: number, Z: number): Vec3 {
  return { x: X, y: Z, z: Y };
}

/** Game velocity (x, z) -> MuJoCo planar velocity (X, Y). */
export function gameVelToMujocoXY(vx: number, vz: number): [number, number] {
  return [vx, vz];
}

/** MuJoCo planar velocity (X, Y) -> game velocity (x, y=0, z). */
export function mujocoVelToGame(vX: number, vY: number): Vec3 {
  return { x: vX, y: 0, z: vY };
}

/** Game yaw (about +Y, 0 = +Z) -> MuJoCo hinge angle (about +Z). */
export function gameYawToMujoco(yaw: number): number {
  return Math.PI / 2 - yaw;
}

/** MuJoCo hinge angle (about +Z) -> game yaw (about +Y, 0 = +Z). */
export function mujocoYawToGame(theta: number): number {
  return Math.PI / 2 - theta;
}

/** Wrap an angle to (-pi, pi]. Used when comparing yaws in tests/controllers. */
export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let x = a % twoPi;
  if (x <= -Math.PI) x += twoPi;
  if (x > Math.PI) x -= twoPi;
  return x;
}
