import { describe, expect, it } from 'vitest';
import {
  gameVelToMujocoXY,
  gameYawToMujoco,
  mujocoToGamePos,
  mujocoVelToGame,
  mujocoYawToGame,
  wrapAngle,
} from './frame';

describe('frame conversion', () => {
  it('round-trips position game -> mujoco -> game', () => {
    const cases = [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 0.35, z: -7 },
      { x: -12.5, y: 1, z: 4.2 },
    ];
    for (const g of cases) {
      const [X, Y] = [g.x, g.z]; // gamePosToMujocoXY
      const back = mujocoToGamePos(X, Y, g.y);
      expect(back.x).toBeCloseTo(g.x, 12);
      expect(back.y).toBeCloseTo(g.y, 12);
      expect(back.z).toBeCloseTo(g.z, 12);
    }
  });

  it('round-trips velocity', () => {
    const [X, Y] = gameVelToMujocoXY(1.4, -2.1);
    const back = mujocoVelToGame(X, Y);
    expect(back.x).toBeCloseTo(1.4, 12);
    expect(back.z).toBeCloseTo(-2.1, 12);
    expect(back.y).toBe(0);
  });

  it('round-trips yaw game -> mujoco -> game', () => {
    for (let yaw = -Math.PI; yaw <= Math.PI; yaw += 0.37) {
      const theta = gameYawToMujoco(yaw);
      expect(mujocoYawToGame(theta)).toBeCloseTo(yaw, 12);
    }
  });

  it('maps game yaw=0 (+Z forward) consistently with the heading convention', () => {
    // Game forward at yaw=0 is +Z. In mujoco XY that is (X=0, Y=1).
    // theta = pi/2 - 0 = pi/2; mujoco forward = (cos theta, sin theta) = (0, 1).
    const theta = gameYawToMujoco(0);
    expect(Math.cos(theta)).toBeCloseTo(0, 12);
    expect(Math.sin(theta)).toBeCloseTo(1, 12);
  });

  it('maps game yaw=+pi/2 (+X forward) consistently', () => {
    // yaw=+pi/2 faces +X in game => mujoco XY (1, 0). theta = 0.
    const theta = gameYawToMujoco(Math.PI / 2);
    expect(Math.cos(theta)).toBeCloseTo(1, 12);
    expect(Math.sin(theta)).toBeCloseTo(0, 12);
  });

  it('wrapAngle normalizes to (-pi, pi]', () => {
    expect(wrapAngle(0)).toBeCloseTo(0, 12);
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(2 * Math.PI + 0.1)).toBeCloseTo(0.1, 12);
  });
});
