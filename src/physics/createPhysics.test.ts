import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PHYSICS_PREF_KEY,
  readRequestedBackend,
  readSavedBackend,
  saveBackendPreference,
} from './createPhysics';

/** Minimal in-memory localStorage stub (vitest runs in node, no DOM). */
function installStorageStub(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

describe('readRequestedBackend', () => {
  beforeEach(() => installStorageStub());
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to placeholder when nothing is set', () => {
    expect(readRequestedBackend('')).toBe('placeholder');
    expect(readRequestedBackend('?foo=bar')).toBe('placeholder');
    expect(readRequestedBackend('?physics=placeholder')).toBe('placeholder');
  });

  it('opts into mujoco on explicit ?physics=mujoco', () => {
    expect(readRequestedBackend('?physics=mujoco')).toBe('mujoco');
    expect(readRequestedBackend('?a=1&physics=mujoco&b=2')).toBe('mujoco');
  });

  it('ignores unknown values', () => {
    expect(readRequestedBackend('?physics=banana')).toBe('placeholder');
  });

  it('uses the saved preference when no URL override is present', () => {
    saveBackendPreference('mujoco');
    expect(readRequestedBackend('')).toBe('mujoco');
  });

  it('URL override beats the saved preference', () => {
    saveBackendPreference('mujoco');
    expect(readRequestedBackend('?physics=placeholder')).toBe('placeholder');

    saveBackendPreference('placeholder');
    expect(readRequestedBackend('?physics=mujoco')).toBe('mujoco');
  });
});

describe('backend preference persistence', () => {
  beforeEach(() => installStorageStub());
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips through localStorage', () => {
    expect(readSavedBackend()).toBeNull();
    saveBackendPreference('mujoco');
    expect(readSavedBackend()).toBe('mujoco');
    expect(localStorage.getItem(PHYSICS_PREF_KEY)).toBe('mujoco');
  });

  it('rejects a corrupt stored value', () => {
    localStorage.setItem(PHYSICS_PREF_KEY, 'garbage');
    expect(readSavedBackend()).toBeNull();
  });
});
