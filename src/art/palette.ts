/**
 * Warm storybook palette — derived from the binding DESIGN_BASELINE tokens.
 *
 * The art direction is "hand-drawn cutout diorama": Don't Starve's technique
 * (ink outlines, painterly fills, paper texture) re-keyed to the baseline's
 * warm low-saturation palette. Three dominant families per screen:
 * paper cream · sage green · warm clay, with a warm charcoal ink as neutral.
 */

export const PAPER = {
  /** Backdrop gradient, top → bottom. */
  skyTop: '#f7f3ea',
  skyBottom: '#ece5d6',
  /** Flat paper floor far outside the glade. */
  floor: '#ede7d8',
} as const;

export const INK = {
  /** Outline ink — warm dark, never pure black. */
  line: '#3a372f',
  /** Softer ink for inner detail strokes. */
  soft: '#5a564b',
  /** Speckle / grain tone. */
  grain: '#4a463c',
} as const;

export const GROUND = {
  base: '#d6d4b4',
  blotchA: '#cccda6',
  blotchB: '#c3c89c',
  blotchC: '#dcd9bb',
  path: '#e6ddc4',
  edge: '#b9bd92',
} as const;

export const SAGE = {
  light: '#b5c2a2',
  mid: '#94a781',
  deep: '#7c8c7a',
  shade: '#67785f',
} as const;

export const CLAY = {
  pale: '#ecdfc9',
  light: '#dcc3a4',
  mid: '#c2a07c',
  deep: '#9a7e5e',
  blossom: '#d9b3a0',
} as const;

export const ROBOT = {
  shell: '#f1efe6',
  shellShade: '#ddd9cb',
  dark: '#34373a',
  darkShade: '#26282b',
  eye: '#1b1b1b',
  visor: '#2c2f31',
  /** Single small warm accent (Teenage-Engineering style), used sparingly. */
  accent: '#d9a441',
} as const;

/** Warm lamp glow tint (baked softly into sprites — never a real bloom). */
export const GLOW = 'rgba(217, 178, 199, 0)';
export const LAMP_WARM = 'rgba(233, 196, 124, 0.35)';

/** Contact-shadow ink (soft, warm, low alpha gradient center). */
export const SHADOW = 'rgba(58, 55, 47, 0.42)';
