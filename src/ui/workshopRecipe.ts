/**
 * Shared recipe presentation for the Workshop UI — material-group swatches,
 * localized group labels, and the Tree-pane hover card (item plate + name +
 * what it needs, with a Build action when the player holds the stock).
 *
 * Keeps the Notebook blueprint and the Tree recipe reading the same so the
 * player learns one visual language: a swatch = a material group, a row of
 * swatches = an arrangement.
 */

import { t } from '../i18n';
import { CLAY, SAGE, ROBOT, WATER } from '../art/palette';
import type { MaterialGroup } from '../game/workshop/materials';
import { patternForForm, patternRecipe } from '../game/workshop/patterns';
import { itemSpriteUrl, cachedItemSpriteUrl } from '../game/workshop/sprites';
import {
  materialsAcceptedBy,
  sizesFor,
  finishesFor,
  itemId,
  formName,
  rarityFor,
  rarityName,
  type ItemId,
} from '../game/workshop/items';
import type { FormId } from '../game/workshop/forms';

/** A small color swatch per material group (representative palette tone). */
export const GROUP_SWATCH: Record<MaterialGroup, string> = {
  wood: CLAY.mid,
  stone: CLAY.pale,
  plant: SAGE.mid,
  found: ROBOT.dark,
};

/** Localized group names (lazy so they re-read on language change). */
export const GROUP_LABELS: Record<MaterialGroup, () => string> = {
  wood: () => t('group.wood'),
  stone: () => t('group.stone'),
  plant: () => t('group.plant'),
  found: () => t('group.found'),
};

void WATER;

export interface RecipeCardCallbacks {
  /** Does the player hold `n` of any material in `group`? */
  hasGroup(group: MaterialGroup, n: number): boolean;
  /** Build one of `form` now (consume materials, record, place/equip). */
  build(form: FormId): void;
  /** Ask Datou to go gather the missing materials for `form` (forage or work a node). */
  fetchFor(form: FormId): void;
  /** God mode active — offer a free Create regardless of held stock. */
  god?: boolean;
  /** God mode: make one of `form` for free. */
  create?(form: FormId): void;
}

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}

/** A representative item id for a form's plate. */
function repItem(form: FormId): ItemId {
  const mat = materialsAcceptedBy(form)[0];
  return itemId({ form, material: mat, size: sizesFor(form)[0], finish: finishesFor(form)[0] });
}

/**
 * Build the hover/click recipe card for a Tree node. Shows the plate, name,
 * the needed material groups (with swatches and counts), and a Build button —
 * enabled only when the player can satisfy every group.
 */
export function recipeCard(form: FormId, cb: RecipeCardCallbacks): HTMLDivElement {
  const card = div('ws-recipe');

  const head = div('ws-recipe-head');
  const plate = div('ws-recipe-plate');
  const img = document.createElement('img');
  const id = repItem(form);
  img.src = cachedItemSpriteUrl(id) ?? itemSpriteUrl(id);
  img.alt = '';
  plate.append(img);
  const title = div('ws-recipe-title');
  const name = div('ws-recipe-name');
  name.textContent = formName(form);
  const rarity = div('ws-recipe-rarity');
  const level = rarityFor(form);
  rarity.dataset.rarity = level;
  rarity.textContent = rarityName(level);
  title.append(name, rarity);
  head.append(plate, title);
  card.append(head);

  const pat = patternForForm(form);
  if (!pat) {
    const unknown = div('ws-recipe-unknown');
    unknown.textContent = t('workshop.recipeUnknown');
    card.append(unknown);
    // Even with no known pattern, god mode can conjure the form directly.
    if (cb.god && cb.create) {
      const create = document.createElement('button');
      create.type = 'button';
      create.className = 'ws-recipe-create';
      create.textContent = t('workshop.godCreate');
      create.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.create!(form);
      });
      card.append(create);
    }
    return card;
  }

  const need = patternRecipe(pat);
  const list = div('ws-recipe-needs');
  let canBuild = true;
  for (const [group, n] of Object.entries(need) as [MaterialGroup, number][]) {
    const row = div('ws-recipe-need');
    const sw = div('ws-recipe-swatch');
    sw.style.background = GROUP_SWATCH[group];
    const label = div('ws-recipe-need-label');
    const have = cb.hasGroup(group, n);
    if (!have) canBuild = false;
    label.textContent = `${GROUP_LABELS[group]()} ×${n}`;
    if (!have) label.classList.add('short');
    row.append(sw, label);
    list.append(row);
  }
  card.append(list);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ws-recipe-build';
  btn.disabled = !canBuild;
  btn.textContent = canBuild ? t('workshop.build') : t('workshop.needMore');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!btn.disabled) cb.build(form);
  });
  card.append(btn);

  // When short, offer to send Datou to gather the rest (forage / work a node).
  if (!canBuild) {
    const fetch = document.createElement('button');
    fetch.type = 'button';
    fetch.className = 'ws-recipe-fetch';
    fetch.textContent = t('workshop.askDatou');
    fetch.addEventListener('click', (e) => {
      e.stopPropagation();
      cb.fetchFor(form);
    });
    card.append(fetch);
  }

  // God mode: a free Create, always available, on top of the normal flow.
  if (cb.god && cb.create) {
    const create = document.createElement('button');
    create.type = 'button';
    create.className = 'ws-recipe-create';
    create.textContent = t('workshop.godCreate');
    create.addEventListener('click', (e) => {
      e.stopPropagation();
      cb.create!(form);
    });
    card.append(create);
  }
  return card;
}
