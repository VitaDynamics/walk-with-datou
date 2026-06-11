/**
 * The two designed walkers (Mei & An) and their five outfit "directions",
 * ported from the "Main Character Concepts" handoff. The walker the player
 * controls is one of these characters in one of these outfits; the HumanRig
 * draws head / torso / leg plates from this data.
 *
 * Geometry lives in the HumanRig; here we keep only identity (skin, hair,
 * personality stance) and wardrobe (top / bottom / shoes / accessories).
 */

import { WALKER as W } from './palette';

export type CharId = 'mei' | 'an';
export type DirId = 'scout' | 'pajama' | 'cape' | 'picnic' | 'rain';
export type AgeId = 'kid' | 'teen' | 'adult';

export const AGE_ORDER: AgeId[] = ['kid', 'teen', 'adult'];

/**
 * Per-age figure metrics (the design's `AGE_M`): the head stays big while the
 * torso and limbs stretch with age, so the three ages read as the same cast at
 * kid / teen / adult. Coordinates are in the shared ~210×218 figure frame.
 */
export interface AgeMetrics {
  hrx: number;
  hry: number;
  /** Visible neck length between chin and collar — kids stay chibi, adults stretch. */
  neckL: number;
  torsoH: number;
  shW: number;
  hipW: number;
  legL: number;
  armL: number;
  limbW: number;
  legW: number;
}

export const AGE_M: Record<AgeId, AgeMetrics> = {
  kid: { hrx: 37, hry: 34, neckL: 4, torsoH: 39, shW: 45, hipW: 40, legL: 40, armL: 31, limbW: 9.5, legW: 11 },
  teen: { hrx: 32, hry: 29.5, neckL: 7, torsoH: 52, shW: 45, hipW: 40, legL: 59, armL: 47, limbW: 8.5, legW: 10 },
  adult: { hrx: 29.5, hry: 28, neckL: 9, torsoH: 60, shW: 49, hipW: 43, legL: 73, armL: 58, limbW: 9, legW: 10.2 },
};

export interface Cast {
  id: CharId;
  name: string;
  skin: string;
  hair: string;
}

export const CAST: Record<CharId, Cast> = {
  mei: { id: 'mei', name: 'Mei', skin: W.skinMei, hair: W.hairMei },
  an: { id: 'an', name: 'An', skin: W.skinAn, hair: W.hairAn },
};

export interface TopSpec {
  type: 'tee' | 'dress' | 'pjTop' | 'raincoat';
  color: string;
  sleeves: 'short' | 'long';
  stripes?: string;
}

export interface BottomSpec {
  type: 'none' | 'pants' | 'pjPants' | 'overalls' | 'overallShorts' | 'shorts' | 'pinafore';
  color?: string;
}

export interface ShoeSpec {
  boot: boolean;
  color: string;
}

export type Extra =
  | 'satchel'
  | 'neckerchief'
  | 'bucketHat'
  | 'strawHat'
  | 'nightcap'
  | 'sleepMask'
  | 'cape'
  | 'hood';

export interface Fit {
  top: TopSpec;
  bottom: BottomSpec;
  socks: string | null;
  shoes: ShoeSpec;
  extras: Extra[];
  extraColors?: Partial<Record<'satchel' | 'scarf' | 'hat' | 'band' | 'cape' | 'mask', string>>;
}

export interface Direction {
  title: string;
  fits: Record<CharId, Fit>;
}

export const DIRECTION_ORDER: DirId[] = ['scout', 'pajama', 'cape', 'picnic', 'rain'];

export const DIRECTIONS: Record<DirId, Direction> = {
  scout: {
    title: 'Trailside Scout',
    fits: {
      mei: {
        top: { type: 'tee', color: W.butter, sleeves: 'short' },
        bottom: { type: 'overallShorts', color: W.sage },
        socks: W.cream,
        shoes: { boot: true, color: W.peachD },
        extras: ['satchel'],
        extraColors: { satchel: W.sageD },
      },
      an: {
        top: { type: 'tee', color: W.sage, sleeves: 'long' },
        bottom: { type: 'shorts', color: W.creamD },
        socks: null,
        shoes: { boot: false, color: W.butter },
        extras: ['bucketHat', 'neckerchief'],
        extraColors: { hat: W.sageD, scarf: W.peach },
      },
    },
  },
  pajama: {
    title: 'Pajama Stroll',
    fits: {
      mei: {
        top: { type: 'dress', color: W.peachL, sleeves: 'long', stripes: W.peach },
        bottom: { type: 'none' },
        socks: null,
        shoes: { boot: false, color: W.butter },
        extras: ['sleepMask'],
        extraColors: { mask: W.peach },
      },
      an: {
        top: { type: 'pjTop', color: W.butterL, sleeves: 'long' },
        bottom: { type: 'pjPants', color: W.sageL },
        socks: null,
        shoes: { boot: false, color: W.peach },
        extras: ['nightcap'],
        extraColors: { hat: W.butter },
      },
    },
  },
  cape: {
    title: 'Storybook Cape',
    fits: {
      mei: {
        top: { type: 'dress', color: W.butterL, sleeves: 'short' },
        bottom: { type: 'none' },
        socks: null,
        shoes: { boot: true, color: W.peachD },
        extras: ['cape'],
        extraColors: { cape: W.peach },
      },
      an: {
        top: { type: 'tee', color: W.creamD, sleeves: 'long' },
        bottom: { type: 'pants', color: W.sageD },
        socks: null,
        shoes: { boot: true, color: W.butter },
        extras: ['cape'],
        extraColors: { cape: W.sage },
      },
    },
  },
  picnic: {
    title: 'Picnic Sunday',
    fits: {
      mei: {
        top: { type: 'tee', color: W.butter, sleeves: 'short' },
        bottom: { type: 'pinafore', color: W.peach },
        socks: null,
        shoes: { boot: false, color: W.peachD },
        extras: ['strawHat'],
        extraColors: { band: W.peachD },
      },
      an: {
        top: { type: 'tee', color: W.butterL, sleeves: 'short' },
        bottom: { type: 'overalls', color: W.sage },
        socks: null,
        shoes: { boot: false, color: W.peachD },
        extras: ['strawHat'],
        extraColors: { band: W.sageD },
      },
    },
  },
  rain: {
    title: 'Drizzle Day',
    fits: {
      mei: {
        top: { type: 'raincoat', color: W.butter, sleeves: 'long' },
        bottom: { type: 'none' },
        socks: null,
        shoes: { boot: true, color: W.sage },
        extras: ['hood'],
      },
      an: {
        top: { type: 'raincoat', color: W.peach, sleeves: 'long' },
        bottom: { type: 'none' },
        socks: null,
        shoes: { boot: true, color: W.butter },
        extras: ['hood'],
      },
    },
  },
};
