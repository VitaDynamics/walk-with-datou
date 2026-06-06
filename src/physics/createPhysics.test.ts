import { describe, expect, it } from 'vitest';
import { readRequestedBackend } from './createPhysics';

describe('readRequestedBackend', () => {
  it('defaults to placeholder', () => {
    expect(readRequestedBackend('')).toBe('placeholder');
    expect(readRequestedBackend('?foo=bar')).toBe('placeholder');
    expect(readRequestedBackend('?physics=placeholder')).toBe('placeholder');
  });

  it('opts into mujoco only on explicit ?physics=mujoco', () => {
    expect(readRequestedBackend('?physics=mujoco')).toBe('mujoco');
    expect(readRequestedBackend('?a=1&physics=mujoco&b=2')).toBe('mujoco');
  });

  it('ignores unknown values', () => {
    expect(readRequestedBackend('?physics=banana')).toBe('placeholder');
  });
});
