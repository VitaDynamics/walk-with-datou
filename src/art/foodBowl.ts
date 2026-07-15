import emptyUrl from '../assets/items/food-bowl/empty.png';
import enjoyedUrl from '../assets/items/food-bowl/enjoyed.png';
import filledUrl from '../assets/items/food-bowl/filled.png';
import rewardUrl from '../assets/items/food-bowl/reward.png';
import type { PropSprite } from './props';
import { createCanvas, ctx2d } from './textures';

export const FOOD_BOWL_STAGES = ['empty', 'filled', 'enjoyed', 'reward'] as const;
export type FoodBowlStage = (typeof FOOD_BOWL_STAGES)[number];

const FRAME_WIDTH = 480;
const FRAME_HEIGHT = 600;
const URLS: Record<FoodBowlStage, string> = {
  empty: emptyUrl,
  filled: filledUrl,
  enjoyed: enjoyedUrl,
  reward: rewardUrl,
};

const spriteCache = new Map<FoodBowlStage, PropSprite>();

export function foodBowlSpriteUrl(stage: FoodBowlStage): string {
  return URLS[stage];
}

/** Load one authored bowl state into the same-sized canvas used by every stage. */
export function drawFoodBowl(stage: FoodBowlStage): PropSprite {
  const cached = spriteCache.get(stage);
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
  image.src = URLS[stage];

  const sprite = { canvas, aspect: FRAME_WIDTH / FRAME_HEIGHT, ready };
  spriteCache.set(stage, sprite);
  return sprite;
}

export function nextFoodBowlStage(stage: FoodBowlStage): FoodBowlStage {
  const index = FOOD_BOWL_STAGES.indexOf(stage);
  return FOOD_BOWL_STAGES[Math.min(index + 1, FOOD_BOWL_STAGES.length - 1)];
}

export function normalizeFoodBowlStage(stage: unknown): FoodBowlStage {
  return FOOD_BOWL_STAGES.includes(stage as FoodBowlStage) ? (stage as FoodBowlStage) : 'empty';
}
