/**
 * Field-lab items — BOBO's ten co-inventions as touchable keepsakes.
 *
 * This is the PURE data model behind the feature (the catalogue from the design
 * handoff, recast as real park objects): for each item, its id, its art, the
 * player manipulation, Datou's canonical reaction (mapped onto the REAL rig's
 * existing grammar — no new rig art, his appearance never changes), the
 * familiarity stage it unlocks at, and the proactive behavior it seeds.
 *
 * Reaction mapping (design caption → our engine):
 *  - the loud personality bursts reuse the rig's signature clips (spin / stomp /
 *    backTurn / shyTurn), which are themselves familiarity-gated in character.ts;
 *  - the rest drive Datou through the emotion engine (proud / excited / startled
 *    / afraid → joy) so the read comes through the existing posture overlays.
 *
 * No rendering, no Three.js, no RNG — fully unit-testable.
 */

import type { EmotionEvent } from '../datou/emotion';
import type { SignatureClip, FamiliarityStage } from '../datou/character';
import type { VoiceContext } from '../datou/voice';

/** Manipulation keys — which re-plate flag the active sprite uses, and the verb. */
export type LabManip =
  | 'spark' // bulb catches
  | 'timeflicker' // dial wakes to 2049
  | 'deploy' // canopy pops up
  | 'light' // lantern breathes warm
  | 'unroll' // tools fan out
  | 'flick' // toy wobbles
  | 'crackle' // antenna throws a bolt
  | 'flip' // field-note turns over
  | 'ring' // chime swings
  | 'poof'; // the easter egg

/** One co-invention. `id` is its placed-keepsake id (`lab-<slug>`). */
export interface LabItem {
  /** Catalogue number (display only). */
  no: string;
  /** Placed-keepsake id, also the i18n stem (`lab.<id>.*`, `thing.<id>`). */
  id: string;
  /** The manipulation the tap runs (chooses the active sprite + duration). */
  manip: LabManip;
  /** Manipulation length in ms — short, single, ≤1.6 s (loudness budget). */
  manipDur: number;
  /** Plate height in meters (keeps Datou the focal point). */
  height: number;
  shadowRadius: number;
  /**
   * Datou's reaction once he arrives, in our engine's terms. `clip` is an
   * earned signature move (gated by character.ts); `clip2` plays a beat later
   * for the two-part reads (the poof's turn-away → shy). `emotion` always fires.
   */
  emotion: EmotionEvent;
  clip?: SignatureClip;
  clip2?: SignatureClip;
  /** The voice line context for BOBO's caption when it lands. */
  voice: VoiceContext;
  /** Familiarity stage at which the full reaction unlocks (below it: a muted beat). */
  minStage: FamiliarityStage;
  /** Rain changes this item's beat (only the shelter, today). */
  weatherAware?: boolean;
  /** Best-friend easter egg: a long cooldown in days between triggers. */
  cooldownDays?: number;
}

/**
 * The ten, in catalogue order. Stage gates follow the design handoff exactly
 * (the bulb's spin and the max-bond poof stay locked until earned); the calm,
 * functional items (time-machine, shelter, lantern, antenna, chime) read from
 * day one.
 */
export const LAB_ITEMS: readonly LabItem[] = [
  {
    no: '01',
    id: 'lab-bulb',
    manip: 'spark',
    manipDur: 1100,
    height: 0.7,
    shadowRadius: 0.3,
    emotion: 'praise', // joy + excited (the 发癫 spark)
    clip: 'spin', // 原地转圈 — earned at friend
    voice: 'labBulb',
    minStage: 'friend',
  },
  {
    no: '02',
    id: 'lab-time',
    manip: 'timeflicker',
    manipDur: 1400,
    height: 0.8,
    shadowRadius: 0.45,
    emotion: 'discover', // curious → 思乡 (the wistful dwell)
    voice: 'labTime',
    minStage: 'stranger',
  },
  {
    no: '03',
    id: 'lab-shelter',
    manip: 'deploy',
    manipDur: 900,
    height: 1.1,
    shadowRadius: 0.4,
    emotion: 'discover', // overridden to comfort/joy when it's raining
    voice: 'labShelter',
    minStage: 'stranger',
    weatherAware: true,
  },
  {
    no: '04',
    id: 'lab-lantern',
    manip: 'light',
    manipDur: 1300,
    height: 0.9,
    shadowRadius: 0.32,
    emotion: 'craft', // proud (the inventor beat)
    voice: 'labLantern',
    minStage: 'stranger',
  },
  {
    no: '05',
    id: 'lab-toolroll',
    manip: 'unroll',
    manipDur: 1000,
    height: 0.6,
    shadowRadius: 0.5,
    emotion: 'craft', // proud …
    clip: 'stomp', // … + 小踏步 (the stomp tic)
    voice: 'labToolroll',
    minStage: 'friend',
  },
  {
    no: '06',
    id: 'lab-wobble',
    manip: 'flick',
    manipDur: 1300,
    height: 0.55,
    shadowRadius: 0.28,
    emotion: 'praise',
    clip: 'spin', // circles the toy, delighted
    voice: 'labWobble',
    minStage: 'friend',
  },
  {
    no: '07',
    id: 'lab-antenna',
    manip: 'crackle',
    manipDur: 700,
    height: 1.0,
    shadowRadius: 0.28,
    emotion: 'startle', // snap-look (→ excited, an idea)
    voice: 'labAntenna',
    minStage: 'stranger',
  },
  {
    no: '08',
    id: 'lab-note',
    manip: 'flip',
    manipDur: 900,
    height: 0.7,
    shadowRadius: 0.3,
    emotion: 'discover',
    voice: 'labNote',
    minStage: 'friend',
  },
  {
    no: '09',
    id: 'lab-bell',
    manip: 'ring',
    manipDur: 900,
    height: 1.0,
    shadowRadius: 0.28,
    emotion: 'pet', // joy …
    clip: 'stomp', // … and the 跺脚 stomp tic on cue
    voice: 'labBell',
    minStage: 'stranger',
  },
  {
    no: '10',
    id: 'lab-poof',
    manip: 'poof',
    manipDur: 1600,
    height: 0.75,
    shadowRadius: 0.32,
    emotion: 'overPraise', // tips into shy
    clip: 'backTurn', // turns away first …
    clip2: 'shyTurn', // … then the bashful half-turn (a beat later)
    voice: 'labPoof',
    minStage: 'bestFriend',
    cooldownDays: 7,
  },
];

/** Fast lookup by placed-keepsake id. */
const BY_ID = new Map(LAB_ITEMS.map((it) => [it.id, it]));

export function labItemFor(id: string): LabItem | undefined {
  return BY_ID.get(id);
}

export function isLabItem(id: string): boolean {
  return BY_ID.has(id);
}
