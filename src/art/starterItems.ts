import chimeUrl from '../assets/items/chime/default.png';
import gardenLanternUrl from '../assets/items/garden-lantern/default.png';
import mailboxUrl from '../assets/items/mailbox/default.png';
import mushroomLampUrl from '../assets/items/mushroom-lamp/default.png';
import petBedUrl from '../assets/items/pet-bed/default.png';
import repairToyUrl from '../assets/items/repair-toy/default.png';
import seedChestUrl from '../assets/items/seed-chest/default.png';
import sproutPotUrl from '../assets/items/sprout-pot/default.png';
import stoolUrl from '../assets/items/stool/default.png';
import type { PropSprite } from './props';
import { createCanvas, ctx2d } from './textures';

export const STARTER_ASSET_FORMS = [
  'sprout-pot',
  'mailbox',
  'mushroom-lamp',
  'chime',
  'pet-bed',
  'stool',
  'garden-lantern',
  'seed-chest',
  'repair-toy',
] as const;

export type StarterAssetForm = (typeof STARTER_ASSET_FORMS)[number];

const FRAME_WIDTH = 480;
const FRAME_HEIGHT = 600;

const URLS: Record<StarterAssetForm, string> = {
  'sprout-pot': sproutPotUrl,
  mailbox: mailboxUrl,
  'mushroom-lamp': mushroomLampUrl,
  chime: chimeUrl,
  'pet-bed': petBedUrl,
  stool: stoolUrl,
  'garden-lantern': gardenLanternUrl,
  'seed-chest': seedChestUrl,
  'repair-toy': repairToyUrl,
};

const spriteCache = new Map<StarterAssetForm, PropSprite>();

export function isStarterAssetForm(form: string): form is StarterAssetForm {
  return Object.hasOwn(URLS, form);
}

export function starterItemSpriteUrl(form: StarterAssetForm): string {
  return URLS[form];
}

/** Load an authored starter item into the same transparent frame as the food bowl. */
export function drawStarterItem(form: StarterAssetForm): PropSprite {
  const cached = spriteCache.get(form);
  if (cached) return cached;

  const canvas = createCanvas(FRAME_WIDTH, FRAME_HEIGHT);
  const image = new Image();
  image.decoding = 'async';
  const ready = new Promise<void>((resolve) => {
    image.onload = () => {
      ctx2d(canvas).drawImage(image, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
      resolve();
    };
    image.onerror = () => resolve();
  });
  image.src = URLS[form];

  const sprite = { canvas, aspect: FRAME_WIDTH / FRAME_HEIGHT, ready };
  spriteCache.set(form, sprite);
  return sprite;
}
