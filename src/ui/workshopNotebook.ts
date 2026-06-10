/**
 * Workshop Notebook tab (BUILDING_SYSTEM §6 tab 3, W5).
 *
 * Banked inspirations rendered as LEGIBLE mini-blueprints: the thing it makes
 * (name + a pencil silhouette of its plate) and the 3×3 with the revealed
 * cells showing WHICH material group goes there (a small swatch), plus a
 * one-line recipe. So a hint reads "fetch stick · wood + wood" rather than a
 * blank grid. Plus the curio collection. Paper cards, no slot chrome.
 */

import { t, tDyn } from '../i18n';
import type { WorkshopState } from '../game/workshop/WorkshopState';
import { patternByKey, patternRecipe } from '../game/workshop/patterns';
import { GROUP_SWATCH, GROUP_LABELS } from './workshopRecipe';

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}

export function renderNotebook(state: WorkshopState): HTMLDivElement {
  const wrap = div('ws-notebook');
  const hints = state.hintList();
  const curios = state.curioList();

  if (hints.length === 0 && curios.length === 0) {
    const empty = div('ws-empty');
    empty.textContent = t('workshop.notebookEmpty');
    wrap.append(empty);
    return wrap;
  }

  for (const hint of hints) {
    const card = div('ws-hint-card');
    const pat = patternByKey(hint.pattern);

    // Title: the thing this blueprint makes (named, so it's not a mystery).
    if (pat) {
      const title = div('ws-hint-title');
      title.textContent = tDyn(`form.${pat.result}`);
      card.append(title);
    }

    // The grid: revealed cells show their material-group swatch; the rest are
    // faint blanks (still "discover the rest").
    const grid = div('ws-hint-grid');
    const revealed = new Set(hint.revealedCells);
    for (let i = 0; i < 9; i++) {
      const c = div('ws-hint-cell');
      if (pat && revealed.has(i) && pat.cells[i]) {
        c.classList.add('on');
        c.style.background = GROUP_SWATCH[pat.cells[i]!];
        c.title = GROUP_LABELS[pat.cells[i]!]();
      } else if (revealed.has(i)) {
        c.classList.add('on');
      }
      grid.append(c);
    }
    card.append(grid);

    // One-line recipe from the pattern (what materials, how many).
    if (pat) {
      const recipe = div('ws-hint-recipe');
      recipe.textContent = recipeLine(patternRecipe(pat));
      card.append(recipe);
    }

    if (hint.context) {
      const ctx = div('ws-hint-ctx');
      ctx.textContent = hint.context;
      card.append(ctx);
    }
    wrap.append(card);
  }

  if (curios.length > 0) {
    const head = div('ws-branch-head');
    head.textContent = t('workshop.curios', { n: String(curios.length) });
    wrap.append(head);
    const row = div('ws-branch-items');
    for (const tone of curios) {
      const node = div('ws-node');
      const plate = div('ws-node-plate curio');
      plate.textContent = ['✦', '✧', '❉', '✺', '❖'][tone % 5];
      plate.style.fontSize = '28px';
      plate.style.color = 'var(--accent-warm)';
      node.append(plate);
      row.append(node);
    }
    wrap.append(row);
  }
  return wrap;
}

function recipeLine(need: Partial<Record<string, number>>): string {
  return Object.entries(need)
    .map(([g, n]) => `${GROUP_LABELS[g as keyof typeof GROUP_LABELS]()} ×${n}`)
    .join(' · ');
}
