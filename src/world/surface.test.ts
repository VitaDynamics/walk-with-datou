import { describe, it, expect } from 'vitest';
import { surfaceAt } from './surface';
import { LAKE } from './scatter';
import { DESTINATION_ZONES } from './zones';

describe('surfaceAt', () => {
  it('reports water at the lake centre', () => {
    expect(surfaceAt(LAKE.x, LAKE.z)).toBe('water');
  });

  it('reports sand just outside the lake radius', () => {
    // A few metres past the water edge, along +x from the lake centre.
    expect(surfaceAt(LAKE.x + LAKE.radius + 2, LAKE.z)).toBe('sand');
  });

  it('reports wood on the jetty planks', () => {
    expect(surfaceAt(21, 122)).toBe('wood');
  });

  it('reports path along a home→zone-heart line', () => {
    // Midpoint of the home→trail path — dead centre of a worn line.
    const trail = DESTINATION_ZONES.find((z) => z.id === 'trail')!;
    expect(surfaceAt(trail.x * 0.5, trail.z * 0.5)).toBe('path');
  });

  it('reports grass in the open meadow away from paths and water', () => {
    // A point chosen to sit clear of every path segment and the lake.
    expect(surfaceAt(-80, 80)).toBe('grass');
  });

  it('is deterministic', () => {
    expect(surfaceAt(12.3, -45.6)).toBe(surfaceAt(12.3, -45.6));
  });
});
