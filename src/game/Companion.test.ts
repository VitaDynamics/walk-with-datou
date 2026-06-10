import { describe, expect, it } from 'vitest';
import type { DatouMode, DatouState } from '../physics/PhysicsAdapter';
import { SpotField, type Spot } from '../world/Spots';
import { SPOT_ANCHORS } from '../world/layout';
import { Bond } from './Bond';
import { Companion, type CompanionEvents } from './Companion';

function datouAt(x: number, z: number): DatouState {
  return {
    position: { x, y: 0, z },
    yaw: 0,
    velocity: { x: 0, y: 0, z: 0 },
    mood: 'calm',
  };
}

const PAD = { x: 0, z: 3.2 };

const NO_EVENTS: CompanionEvents = { petted: false, comforted: false, guidedTo: null };

interface Recorded {
  modes: DatouMode[];
  targets: { x: number; z: number }[];
  discovered: Spot[];
  satisfied: string[];
}

function makeActions(): { rec: Recorded; actions: ConstructorParameters<typeof Companion>[1] } {
  const rec: Recorded = { modes: [], targets: [], discovered: [], satisfied: [] };
  return {
    rec,
    actions: {
      setMode: (m) => rec.modes.push(m),
      setTarget: (x, z) => rec.targets.push({ x, z }),
      onDiscover: (s) => rec.discovered.push(s),
      onWantSatisfied: (k) => rec.satisfied.push(k),
    },
  };
}

/** Step the companion in small ticks for `seconds` (events on first tick only). */
function run(
  c: Companion,
  datou: DatouState,
  seconds: number,
  events: CompanionEvents = NO_EVENTS,
): void {
  const dt = 0.1;
  for (let t = 0; t < seconds; t += dt) {
    c.update(datou, PAD, events, dt);
    events = NO_EVENTS;
  }
}

describe('Companion want loop (diorama)', () => {
  it('surfaces an attention want after rest and grants bond when petted', () => {
    const bond = new Bond();
    const { actions } = makeActions();
    const c = new Companion(bond, actions, () => 0); // rest = REST_MIN, want = attention
    expect(c.activeWant).toBeNull();

    run(c, datouAt(1, 1), 7.2); // through rest into windup
    expect(c.activeWant).toBe('attention');
    expect(c.expression.kind).toBe('attention');

    run(c, datouAt(1, 1), 1.5); // into the active window
    const before = bond.level;
    run(c, datouAt(1, 1), 0.2, { ...NO_EVENTS, petted: true });
    expect(bond.level).toBeGreaterThan(before);
    expect(c.activeWant).toBeNull();
  });

  it('expires an ignored want gracefully and restores the home stance', () => {
    const bond = new Bond();
    const { rec, actions } = makeActions();
    const c = new Companion(bond, actions, () => 0);
    c.homeMode = 'follow';

    run(c, datouAt(1, 1), 7.2 + 1.5 + 7.5); // rest + windup + full active window
    expect(c.activeWant).toBeNull();
    expect(bond.level).toBe(0);
    expect(rec.modes).toContain('follow');
  });

  it('anchors curious wants on a real undiscovered spot and gazes toward it', () => {
    const bond = new Bond();
    const { actions } = makeActions();
    const spots = new SpotField(20260610, SPOT_ANCHORS);
    const c = new Companion(bond, actions, () => 0.6, spots); // 0.6 ≥ 0.55 → curious
    const datou = datouAt(0, 0);

    run(c, datou, 7 + 0.6 * 8 + 0.3); // rest = REST_MIN + 0.6 * (REST_MAX - REST_MIN)
    expect(c.activeWant).toBe('curious');
    expect(c.activeSpotId).not.toBeNull();
    expect(c.expression.kind).toBe('curious');
  });

  it('turns a guided curious want into a discovery on arrival', () => {
    const bond = new Bond();
    const { rec, actions } = makeActions();
    const spots = new SpotField(20260610, SPOT_ANCHORS);
    const c = new Companion(bond, actions, () => 0.6, spots);
    const datou = datouAt(0, 0);

    run(c, datou, 7 + 0.6 * 8 + 1.6); // into the active window
    expect(c.activeSpotId).not.toBeNull();
    const spot = spots.get(c.activeSpotId!)!;

    // Player taps at the spot → Datou approaches it.
    run(c, datou, 0.2, { ...NO_EVENTS, guidedTo: { x: spot.x, z: spot.z } });
    expect(rec.modes).toContain('explore');
    expect(rec.satisfied).toContain('curious');

    // Datou arrives → the find fires once.
    run(c, datouAt(spot.x, spot.z), 0.3);
    expect(rec.discovered.map((s) => s.id)).toEqual([spot.id]);
    expect(bond.level).toBeGreaterThanOrEqual(2);
  });

  it('discovers a spot via direct investigation even without an active want', () => {
    const bond = new Bond();
    const { rec, actions } = makeActions();
    const spots = new SpotField(20260610, SPOT_ANCHORS);
    const c = new Companion(bond, actions, () => 0.99, spots); // long rest — no want yet
    const spot = spots.spots[0];

    c.investigate(spot.x + 0.3, spot.z);
    run(c, datouAt(spot.x, spot.z), 0.3);
    expect(rec.discovered.map((s) => s.id)).toEqual([spot.id]);
  });

  it('a comforting hold always grants bond', () => {
    const bond = new Bond();
    const { actions } = makeActions();
    const c = new Companion(bond, actions, () => 0.99);
    run(c, datouAt(1, 1), 0.2, { ...NO_EVENTS, comforted: true });
    expect(bond.level).toBeGreaterThan(0);
  });

  it('trickles bond while Datou keeps you company at the pad', () => {
    const bond = new Bond();
    const { actions } = makeActions();
    const c = new Companion(bond, actions, () => 0.99);
    run(c, datouAt(PAD.x + 0.5, PAD.z - 0.5), 25);
    expect(bond.level).toBeGreaterThan(0);
  });
});
