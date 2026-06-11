/**
 * Workshop Tree tab (BUILDING_SYSTEM §6 tab 2, W4).
 *
 * The building tree as a hand-drawn branching diagram, one branch per form
 * family. Per node: MADE = inked (full color); HINTED = pencil silhouette;
 * UNKNOWN forms aren't shown individually — each branch carries a count badge
 * of what remains ("Vessels · 4 of 23 found"), Don't-Starve fog over a
 * Minecraft-size space. Neighbor-teaching (W4) reveals silhouettes one step out
 * from what you've made.
 */

import { t, tDyn } from '../i18n';
import type { WorkshopState } from '../game/workshop/WorkshopState';
import { FORM_IDS, FORMS, type FormFamily, type FormId } from '../game/workshop/forms';
import {
  materialsAcceptedBy,
  parseItemId,
  isValid,
  sizesFor,
  finishesFor,
  itemId,
  type ItemId,
} from '../game/workshop/items';
import { cachedItemSpriteUrl, itemSpriteUrl } from '../game/workshop/sprites';
import { EXACT_PATTERNS } from '../game/workshop/patterns';
import { canonical } from '../game/workshop/pattern';
import { recipeCard, type RecipeCardCallbacks } from './workshopRecipe';

const FAMILY_ORDER: FormFamily[] = ['component', 'furnishing', 'structure', 'datou', 'keepsake', 'tool'];
const FORMS_BY_FAMILY = new Map(
  FAMILY_ORDER.map((family) => [
    family,
    FORM_IDS.filter((id) => FORMS[id].family === family),
  ]),
);
const VARIANT_COUNTS = new Map(
  FORM_IDS.map((form) => [
    form,
    materialsAcceptedBy(form).length * sizesFor(form).length * finishesFor(form).length,
  ]),
);
const REPRESENTATIVE_ITEMS = new Map(
  FORM_IDS.map((form) => {
    const material = materialsAcceptedBy(form)[0];
    return [
      form,
      itemId({
        form,
        material,
        size: sizesFor(form)[0],
        finish: finishesFor(form)[0],
      }),
    ];
  }),
);
const FAMILY_VARIANT_COUNTS = new Map(
  FAMILY_ORDER.map((family) => [
    family,
    (FORMS_BY_FAMILY.get(family) ?? []).reduce(
      (total, form) => total + (VARIANT_COUNTS.get(form) ?? 0),
      0,
    ),
  ]),
);

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}

export function renderTree(state: WorkshopState, recipeCb?: RecipeCardCallbacks): HTMLDivElement {
  const wrap = div('ws-tree');
  const madeByForm = groupMadeItems(state.madeIds());
  const hinted = hintedForms(state);
  const taughtTiers = taughtFamilyTiers(madeByForm);
  const pendingSprites: Array<{ img: HTMLImageElement; id: ItemId }> = [];
  let openPop: HTMLDivElement | null = null;
  const closePop = (): void => {
    openPop?.remove();
    openPop = null;
  };

  for (const family of FAMILY_ORDER) {
    const forms = FORMS_BY_FAMILY.get(family) ?? [];
    if (forms.length === 0) continue;

    const branch = div('ws-branch');
    const totalVariants = FAMILY_VARIANT_COUNTS.get(family) ?? 0;
    const madeVariantCount = forms.reduce((n, form) => n + (madeByForm.get(form)?.length ?? 0), 0);

    const head = div('ws-branch-head');
    head.append(document.createTextNode(t(`workshop.family.${family}` as never)));
    const count = div('ws-branch-count');
    count.textContent = t('workshop.foundOf', {
      n: String(madeVariantCount),
      total: String(totalVariants),
    });
    head.append(count);
    branch.append(head);

    const items = div('ws-branch-items');
    for (const form of forms) {
      const made = madeByForm.get(form) ?? [];
      const isHinted = hinted.has(form);
      // Show a form node if you've made any variant, OR it's hinted/neighbor-
      // taught. Otherwise it stays in the branch's "still to find" count.
      // God mode reveals the whole tree so anything can be conjured.
      if (!recipeCb?.god && made.length === 0 && !isHinted && !taughtTiers.has(familyTier(form))) continue;
      const node = div('ws-node');
      const plate = div('ws-node-plate');
      const img = document.createElement('img');
      const repId = made[0] ?? REPRESENTATIVE_ITEMS.get(form)!;
      const cachedUrl = cachedItemSpriteUrl(repId);
      if (cachedUrl) img.src = cachedUrl;
      else pendingSprites.push({ img, id: repId });
      img.alt = '';
      plate.append(img);
      const name = div('ws-node-name');
      if (made.length > 0) {
        name.textContent = tDyn(`form.${form}`);
      } else {
        node.classList.add('silhouette');
        name.textContent = tDyn(`form.${form}`);
      }
      node.append(plate, name);
      // Click a node → toggle a recipe popover. The popover is fixed-positioned
      // in the viewport (not nested in the scroll container) and clamped on-
      // screen, so edge/bottom nodes never spill out or get clipped.
      if (recipeCb) {
        node.classList.add('tappable');
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasMine = openPop?.dataset.form === form;
          closePop();
          if (wasMine) return;
          const pop = div('ws-pop');
          pop.dataset.form = form;
          pop.append(recipeCard(form, recipeCb));
          document.body.append(pop);
          positionPop(pop, node);
          openPop = pop;
        });
      }
      items.append(node);
    }
    if (items.childElementCount === 0) {
      const none = div('ws-branch-count');
      none.textContent = t('workshop.branchLocked');
      branch.append(none);
    } else {
      branch.append(items);
    }
    wrap.append(branch);
  }
  // Tap elsewhere, scroll, or resize closes an open recipe popover.
  wrap.addEventListener('click', closePop);
  wrap.addEventListener('scroll', closePop, true);
  hydrateSprites(wrap, pendingSprites);
  return wrap;
}

/**
 * Place a fixed-position popover beside the node, clamped to the viewport.
 * Prefers below-and-aligned; flips above if it would clip the bottom; nudges
 * horizontally so it never spills off either edge. 12 px margin.
 */
function positionPop(pop: HTMLDivElement, node: HTMLElement): void {
  const M = 12;
  const r = node.getBoundingClientRect();
  const pw = pop.offsetWidth || 200;
  const ph = pop.offsetHeight || 180;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Centered under the node by default.
  let left = r.left + r.width / 2 - pw / 2;
  let top = r.bottom + 8;
  // Flip above if it would run off the bottom.
  if (top + ph + M > vh) top = r.top - ph - 8;
  // Clamp into the viewport on both axes.
  left = Math.max(M, Math.min(left, vw - pw - M));
  top = Math.max(M, Math.min(top, vh - ph - M));

  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

function groupMadeItems(ids: ItemId[]): Map<FormId, ItemId[]> {
  const grouped = new Map<FormId, ItemId[]>();
  for (const id of ids) {
    const spec = parseItemId(id);
    if (!spec || !isValid(spec)) continue;
    const variants = grouped.get(spec.form);
    if (variants) variants.push(id);
    else grouped.set(spec.form, [id]);
  }
  return grouped;
}

function taughtFamilyTiers(madeByForm: ReadonlyMap<FormId, readonly ItemId[]>): Set<string> {
  const taught = new Set<string>();
  for (const form of madeByForm.keys()) taught.add(familyTier(form));
  return taught;
}

function familyTier(form: FormId): string {
  return `${FORMS[form].family}:${FORMS[form].tier}`;
}

function hydrateSprites(
  wrap: HTMLDivElement,
  pending: Array<{ img: HTMLImageElement; id: ItemId }>,
): void {
  if (pending.length === 0) return;
  let cursor = 0;
  const next = (): void => {
    if (!wrap.isConnected) return;
    const end = Math.min(cursor + 3, pending.length);
    for (; cursor < end; cursor++) {
      const { img, id } = pending[cursor];
      if (img.isConnected) img.src = itemSpriteUrl(id);
    }
    if (cursor < pending.length) window.requestAnimationFrame(next);
  };
  window.requestAnimationFrame(next);
}

/** Forms with at least one banked-hint pattern (built once per render). */
function hintedForms(state: WorkshopState): Set<FormId> {
  const banked = new Set(state.hintList().map((h) => h.pattern));
  const out = new Set<FormId>();
  for (const p of EXACT_PATTERNS) {
    if (banked.has(canonical(p))) out.add(p.result as FormId);
  }
  return out;
}
