import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE_OPTIONS, buildDatouSceneXml } from './datou.scene';

describe('buildDatouSceneXml', () => {
  it('emits the ground plane and the Datou body', () => {
    const xml = buildDatouSceneXml({ ...DEFAULT_SCENE_OPTIONS, colliders: [] });
    expect(xml).toContain('name="ground"');
    expect(xml).toContain('name="datou"');
    expect(xml).toContain('type="capsule"');
    expect(xml).not.toContain('name="obstacle_0"');
  });

  it('emits a cylinder geom per collider, mapping game (x,z) -> mujoco (X,Y)', () => {
    const xml = buildDatouSceneXml({
      ...DEFAULT_SCENE_OPTIONS,
      colliders: [
        { x: 5, z: -2, radius: 0.5 },
        { x: -3, z: 4, radius: 0.45 },
      ],
    });
    expect(xml).toContain('name="obstacle_0"');
    expect(xml).toContain('name="obstacle_1"');
    // game (x=5, z=-2) -> mujoco pos X=5, Y=-2
    expect(xml).toMatch(/obstacle_0"[^>]*pos="5 -2 /);
    // radius is the cylinder's first size component
    expect(xml).toMatch(/obstacle_0"[^>]*size="0.5 /);
    expect(xml).toMatch(/obstacle_1"[^>]*pos="-3 4 /);
  });

  it('produces valid-looking MJCF (balanced mujoco tags)', () => {
    const xml = buildDatouSceneXml({
      ...DEFAULT_SCENE_OPTIONS,
      colliders: [{ x: 0, z: 0, radius: 1 }],
    });
    expect(xml.startsWith('<mujoco')).toBe(true);
    expect(xml.trimEnd().endsWith('</mujoco>')).toBe(true);
  });
});
