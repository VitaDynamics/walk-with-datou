/**
 * Workshop Notebook tab (BUILDING_SYSTEM §6 tab 3, W5).
 *
 * Banked inspirations (the sketch hints with where/when/with-whom they
 * happened — they double as memories), plus the curio collection. Paper cards,
 * pencil hint-grids; no slot chrome.
 */

import { t } from '../i18n';
import type { WorkshopState } from '../game/workshop/WorkshopState';

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
    const grid = div('ws-hint-grid');
    const revealed = new Set(hint.revealedCells);
    for (let i = 0; i < 9; i++) {
      const c = div('ws-hint-cell');
      if (revealed.has(i)) c.classList.add('on');
      grid.append(c);
    }
    card.append(grid);
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
