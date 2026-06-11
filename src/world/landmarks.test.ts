import { describe, expect, it } from 'vitest';
import { matchExact, patternForForm } from '../game/workshop/patterns';
import { canonical } from '../game/workshop/pattern';
import { MATERIALS, groupOf } from '../game/workshop/materials';
import { WorkshopState } from '../game/workshop/WorkshopState';
import { CLEARINGS, LANDMARK_DEFS, LandmarkField } from './landmarks';

describe('landmark definitions', () => {
  it('grant blueprints that exist in the exact-pattern table', () => {
    for (const def of LANDMARK_DEFS) {
      const pat = patternForForm(def.coffer.blueprintForm);
      expect(pat, def.id).not.toBeNull();
      expect(matchExact(canonical(pat!))).toBe(def.coffer.blueprintForm);
    }
  });

  it('grant starter materials that exist in the registry and cover the pattern', () => {
    for (const def of LANDMARK_DEFS) {
      const pat = patternForForm(def.coffer.blueprintForm)!;
      // Units of each group needed by the pattern (stack-weighted).
      const need: Record<string, number> = {};
      for (let i = 0; i < 9; i++) {
        const g = pat.cells[i];
        if (g) need[g] = (need[g] ?? 0) + Math.max(1, pat.stacks[i]);
      }
      const granted: Record<string, number> = {};
      for (const [mat, n] of Object.entries(def.coffer.materials)) {
        expect(mat in MATERIALS, `${def.id} grants unknown material ${mat}`).toBe(true);
        const group = groupOf(mat as keyof typeof MATERIALS);
        granted[group] = (granted[group] ?? 0) + n;
      }
      // The bundle is exactly one build (§9) — group totals match the recipe.
      expect(granted, def.id).toEqual(need);
    }
  });

  it('chain clues forward without loops and keep coffers inside the heart', () => {
    for (const def of LANDMARK_DEFS) {
      if (def.clueTo) {
        expect(LANDMARK_DEFS.some((d) => d.id === def.clueTo)).toBe(true);
        expect(def.clueTo).not.toBe(def.id);
      }
      const d = Math.hypot(def.coffer.x - def.center.x, def.coffer.z - def.center.z);
      expect(d, `${def.id} coffer outside activity ring`).toBeLessThanOrEqual(
        def.activityRadius,
      );
    }
  });

  it('derives one exclusion + one damped clearing per area', () => {
    expect(CLEARINGS).toHaveLength(LANDMARK_DEFS.length * 2);
    for (const def of LANDMARK_DEFS) {
      const around = CLEARINGS.filter((c) => c.x === def.center.x && c.z === def.center.z);
      expect(around.some((c) => c.density === 0 && c.r === def.activityRadius)).toBe(true);
      expect(around.some((c) => c.density > 0 && c.r > def.activityRadius)).toBe(true);
    }
  });
});

describe('LandmarkField', () => {
  it('starts every area unseen with a closed coffer', () => {
    const f = new LandmarkField();
    for (const a of f.areas) {
      expect(a.progress).toBe('unseen');
      expect(a.cofferOpened).toBe(false);
    }
  });

  it('moves forward through notice → arrive → complete, never backward', () => {
    const f = new LandmarkField();
    expect(f.notice('repair-commons')).toBe(true);
    expect(f.get('repair-commons')!.progress).toBe('noticed');
    expect(f.notice('repair-commons')).toBe(false); // already noticed
    expect(f.arrive('repair-commons')).toBe(true);
    expect(f.notice('repair-commons')).toBe(false); // cannot regress
    expect(f.get('repair-commons')!.progress).toBe('arrived');
    expect(f.complete('repair-commons')).toBe(true);
    expect(f.arrive('repair-commons')).toBe(false);
    expect(f.get('repair-commons')!.progress).toBe('completed');
  });

  it('supports out-of-order discovery (arrive or complete while unseen)', () => {
    const f = new LandmarkField();
    expect(f.arrive('relay-camp')).toBe(true);
    expect(f.get('relay-camp')!.progress).toBe('arrived');
    const g = new LandmarkField();
    expect(g.complete('pump-garden')).toBe(true);
    expect(g.get('pump-garden')!.progress).toBe('completed');
  });

  it('opens each coffer exactly once', () => {
    const f = new LandmarkField();
    expect(f.openCoffer('repair-commons')).toBe(true);
    expect(f.openCoffer('repair-commons')).toBe(false);
    expect(f.get('repair-commons')!.cofferOpened).toBe(true);
  });

  it('notices only unseen areas inside their notice radius', () => {
    const f = new LandmarkField();
    const commons = f.get('repair-commons')!.def;
    // Just inside the radius, west of the commons.
    const near = f.nearestNoticeable(commons.center.x - commons.noticeRadius + 1, commons.center.z);
    expect(near?.def.id).toBe('repair-commons');
    // Far away: nothing.
    expect(f.nearestNoticeable(0, 0)).toBeNull();
    // Noticed areas stop anchoring.
    f.notice('repair-commons');
    expect(f.nearestNoticeable(commons.center.x - 5, commons.center.z)).toBeNull();
  });

  it('reports the area at a point and the nearest unopened coffer', () => {
    const f = new LandmarkField();
    const camp = f.get('relay-camp')!.def;
    expect(f.areaAt(camp.center.x + 2, camp.center.z - 3)?.def.id).toBe('relay-camp');
    expect(f.areaAt(0, 0)).toBeNull();
    const c = f.nearestUnopenedCoffer(camp.coffer.x + 1, camp.coffer.z, 6);
    expect(c?.def.id).toBe('relay-camp');
    f.openCoffer('relay-camp');
    expect(f.nearestUnopenedCoffer(camp.coffer.x + 1, camp.coffer.z, 6)).toBeNull();
  });

  it('round-trips through serialize/restore', () => {
    const f = new LandmarkField();
    f.notice('repair-commons');
    f.arrive('repair-commons');
    f.complete('repair-commons');
    f.openCoffer('repair-commons');
    f.arrive('pump-garden');
    f.firstHookDone = true;
    f.socketFilled = true;
    f.chimeDonated = true;
    f.capsuleFound = true;
    const g = new LandmarkField();
    g.restore(JSON.parse(JSON.stringify(f.serialize())));
    expect(g.serialize()).toEqual(f.serialize());
    expect(g.socketFilled).toBe(true);
    expect(g.chimeDonated).toBe(true);
    expect(g.capsuleFound).toBe(true);
    // Older saves without the newer flags stay valid.
    const h = new LandmarkField();
    h.restore({ v: 1, areas: [], firstHookDone: false });
    expect(h.socketFilled).toBe(false);
    expect(h.chimeDonated).toBe(false);
    expect(h.capsuleFound).toBe(false);
  });

  it('scales the notice radius for personality shading only', () => {
    const f = new LandmarkField();
    const commons = f.get('repair-commons')!.def;
    const justOutside = commons.center.x - commons.noticeRadius - 5;
    expect(f.nearestNoticeable(justOutside, commons.center.z)).toBeNull();
    // An Explorer (×1.2) senses it from the same spot.
    expect(f.nearestNoticeable(justOutside, commons.center.z, 1.2)?.def.id).toBe(
      'repair-commons',
    );
  });

  it('never re-grants a coffer across reloads (the §9 idempotence guard)', () => {
    const f = new LandmarkField();
    expect(f.openCoffer('repair-commons')).toBe(true);
    const g = new LandmarkField();
    g.restore(f.serialize());
    expect(g.openCoffer('repair-commons')).toBe(false);
    // …and the hint bank dedupes by pattern, so even a double grant of the
    // blueprint itself is a no-op (WorkshopState.bankHint contract).
    const ws = new WorkshopState('wwd.test.workshop');
    const pat = patternForForm('chime')!;
    const hint = { pattern: canonical(pat), revealedCells: [0, 1], context: 'x' };
    expect(ws.bankHint(hint)).toBe(true);
    expect(ws.bankHint(hint)).toBe(false);
    expect(ws.hintList()).toHaveLength(1);
  });

  it('restore tolerates garbage and unknown areas', () => {
    const f = new LandmarkField();
    f.restore(null);
    f.restore('nonsense');
    f.restore({ v: 99, areas: [{ id: 'no-such-place', progress: 'completed' }, null, 7] });
    f.restore({ areas: [{ id: 'repair-commons', progress: 'sideways', cofferOpened: 'yes' }] });
    expect(f.get('repair-commons')!.progress).toBe('unseen');
    expect(f.get('repair-commons')!.cofferOpened).toBe(false);
  });
});
