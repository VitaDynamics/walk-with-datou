import { describe, expect, it, vi } from 'vitest';
import { Bond } from './Bond';
import { Companion, type CompanionActions } from './Companion';
import { PoiField, type PoiData } from './pois';
import type { DatouState } from '../physics/PhysicsAdapter';

function datouAt(x: number, z: number): DatouState {
  return {
    position: { x, y: 0, z },
    yaw: 0,
    velocity: { x: 0, y: 0, z: 0 },
    mood: 'calm',
  };
}

function makeActions(): CompanionActions & { modes: string[]; targets: Array<[number, number]> } {
  const modes: string[] = [];
  const targets: Array<[number, number]> = [];
  return {
    modes,
    targets,
    setMode: (m) => modes.push(m),
    setTarget: (x, z) => targets.push([x, z]),
  };
}

/** A deterministic rand sequence (cycles through the given values). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('Companion', () => {
  it('starts with no active want and shows nothing', () => {
    const c = new Companion(new Bond(), makeActions(), seq([0]));
    expect(c.activeWant).toBeNull();
    expect(c.expression.kind).toBe('none');
  });

  it('surfaces exactly one want after the rest interval, via a wind-up', () => {
    // rand low → short rest, attention want.
    const c = new Companion(new Bond(), makeActions(), seq([0]));
    const datou = datouAt(5, 0);
    const player = { x: 0, z: 0 };

    // Rest is REST_MIN + rand*(...) = 6s with rand 0. Step to just past it.
    for (let t = 0; t < 6.1; t += 0.1) c.update(datou, player, false, 0.1);
    // Now in wind-up: the tell is showing but it's the only want.
    expect(c.activeWant).toBe('attention');
    expect(c.expression.kind).toBe('attention');
  });

  it('grants bond when the player pets during an attention want', () => {
    const bond = new Bond();
    const c = new Companion(bond, makeActions(), seq([0]));
    const datou = datouAt(5, 0);
    const player = { x: 0, z: 0 };

    // Advance through rest + windup into the active window.
    for (let t = 0; t < 7.6; t += 0.1) c.update(datou, player, false, 0.1);
    expect(c.activeWant).toBe('attention');
    const before = bond.level;
    // Pet on this frame → satisfies the want.
    c.update(datou, player, true, 0.1);
    expect(bond.level).toBeGreaterThan(before);
    // Want resolved → no longer active.
    expect(c.activeWant).toBeNull();
  });

  it('expires an ignored want without punishing (no bond loss)', () => {
    const bond = new Bond(10);
    const c = new Companion(bond, makeActions(), seq([0]));
    const datou = datouAt(40, 0); // far away so "near" is false
    const player = { x: 0, z: 0 };
    const before = bond.level;

    // Rest (6) + windup (1.4) + full active window (6) + a bit → expires.
    for (let t = 0; t < 14.5; t += 0.1) c.update(datou, player, false, 0.1);
    expect(bond.level).toBe(before); // never decreased
    expect(c.activeWant).toBeNull(); // back to rest/cooldown
  });

  it('on a satisfied curious want, leads Datou toward the POI via explore', () => {
    // rand=0.5 selects curious early-game (pickWant: r>=0.6 is curious; 0.5<0.6
    // is attention) — so use a value >=0.6 for the want pick. The POI angle is
    // a*2π with a=0.7 → roughly +X/−Z; keep the player AT ORIGIN during windup
    // (so it isn't satisfied early), then jump the player onto the POI.
    const actions = makeActions();
    const rand = seq([0.7]); // curious; POI at a fixed bearing
    const c = new Companion(new Bond(), actions, rand);
    const datou = datouAt(0, 0);

    // Hold the player exactly on Datou through rest+windup so "curious" can't be
    // satisfied (player is not nearer the POI than Datou). rest = 6 + 0.7*8 =
    // 11.6s, windup 1.4s → into the active window by ~13.2s.
    for (let t = 0; t < 13.3; t += 0.1) c.update(datou, { x: 0, z: 0 }, false, 0.1);
    expect(c.activeWant).toBe('curious');
    const exp = c.expression;
    expect(exp.kind).toBe('curious');

    // Step the player a short way along the gaze direction. The POI is ≥8 m
    // out, so a 6 m step makes the player strictly nearer the POI than Datou
    // (datou is 0 m along) → satisfies, and an explore target is set.
    if (exp.kind === 'curious') {
      c.update(datou, { x: exp.dirX * 6, z: exp.dirZ * 6 }, false, 0.1);
    }
    expect(c.activeWant).toBeNull();
    expect(actions.modes).toContain('explore');
    expect(actions.targets.length).toBe(1);
  });

  it('anchors a curious want on a real POI and fires a discovery on arrival', () => {
    // A single POI 10 m out along +X (a=0.7 bearing is unused now — the want
    // picks the real POI regardless of the fallback angle).
    const poi: PoiData = { id: 7, kind: 'shiny-thing', x: 10, z: 0, zone: 'meadow' };
    const field = new PoiField([{ ...poi }]);
    const discovered: PoiData[] = [];
    const actions = makeActions();
    const c = new Companion(
      new Bond(),
      {
        ...actions,
        // Mirror Game's wiring: the discovery callback marks the field + would
        // reveal the marker. (The Companion fires the hook; the game owns state.)
        onDiscover: (p) => {
          discovered.push(p);
          field.discover(p.id);
        },
      },
      seq([0.7]), // curious want
      field,
    );
    const datou = datouAt(0, 0);

    // Hold the player at the origin (not at the POI) through rest + windup so the
    // want isn't satisfied early. rest = 6 + 0.7*8 = 11.6s, +1.4 windup.
    for (let t = 0; t < 13.3; t += 0.1) c.update(datou, { x: 0, z: 0 }, false, 0.1);
    expect(c.activeWant).toBe('curious');
    expect(c.activePoiId).toBe(7); // pointed at the real POI

    // Walk the player onto the POI → arrival satisfies the curious want.
    c.update(datou, { x: 10, z: 0 }, false, 0.1);
    expect(c.activeWant).toBeNull();
    expect(actions.modes).toContain('explore');
    expect(discovered.map((p) => p.id)).toEqual([7]);
    expect(field.isDiscovered(7)).toBe(true);
  });

  it('investigate() steers Datou to a point, grants bond once, and respects cooldown', () => {
    const bond = new Bond();
    const actions = makeActions();
    const c = new Companion(bond, actions, seq([0]));
    const datou = datouAt(0, 0);

    const before = bond.level;
    const got = c.investigate(20, 5);
    expect(got).toBeGreaterThan(0);
    expect(bond.level).toBeGreaterThan(before);
    expect(actions.modes).toContain('explore');
    expect(actions.targets).toContainEqual([20, 5]);

    // A second investigate immediately after is on cooldown: still steers Datou
    // (responsive), but grants no bond (can't farm by spam-clicking).
    const lvl = bond.level;
    const second = c.investigate(30, -8);
    expect(second).toBe(0);
    expect(bond.level).toBe(lvl);
    expect(actions.targets).toContainEqual([30, -8]);

    // After the cooldown elapses, investigate grants bond again.
    for (let t = 0; t < 4.2; t += 0.1) c.update(datou, { x: 0, z: 0 }, false, 0.1);
    expect(c.investigate(5, 5)).toBeGreaterThan(0);
  });

  it('investigate() cancels an active want', () => {
    const c = new Companion(new Bond(), makeActions(), seq([0])); // attention want
    const datou = datouAt(5, 0);
    const player = { x: 0, z: 0 };
    // Advance into the active want window.
    for (let t = 0; t < 7.6; t += 0.1) c.update(datou, player, false, 0.1);
    expect(c.activeWant).toBe('attention');
    c.investigate(40, 40);
    expect(c.activeWant).toBeNull();
  });

  it('keeps only one want active across a long run', () => {
    const c = new Companion(new Bond(), makeActions(), seq([0.1, 0.5, 0.9, 0.3]));
    const datou = datouAt(2, 0);
    const player = { x: 0, z: 0 };
    const spy = vi.fn();
    for (let t = 0; t < 60; t += 0.1) {
      c.update(datou, player, false, 0.1);
      if (c.activeWant) spy(c.activeWant);
    }
    // Never throws, and activeWant is always a single value or null (implicit).
    expect(spy).toHaveBeenCalled();
  });
});
