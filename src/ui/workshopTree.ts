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
import { allItemIds, materialsAcceptedBy, parseItemId, sizesFor, finishesFor, itemId } from '../game/workshop/items';
import { itemSprite } from '../game/workshop/sprites';

const FAMILY_ORDER: FormFamily[] = ['component', 'furnishing', 'structure', 'datou', 'keepsake', 'tool'];

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}

/** Variants of a form that the player has made. */
function madeVariants(state: WorkshopState, form: FormId): string[] {
  return allItemIds().filter((id) => id.startsWith(form + ':') && state.hasMade(id));
}

/** Total reachable variants of a form. */
function variantCount(form: FormId): number {
  return materialsAcceptedBy(form).length * sizesFor(form).length * finishesFor(form).length;
}

/** A representative item id for a form (for the silhouette plate). */
function repItem(form: FormId): string {
  const mat = materialsAcceptedBy(form)[0];
  return itemId({ form, material: mat, size: sizesFor(form)[0], finish: finishesFor(form)[0] });
}

export function renderTree(state: WorkshopState): HTMLDivElement {
  const wrap = div('ws-tree');

  for (const family of FAMILY_ORDER) {
    const forms = FORM_IDS.filter((id) => FORMS[id].family === family);
    if (forms.length === 0) continue;

    const branch = div('ws-branch');
    const totalVariants = forms.reduce((n, f) => n + variantCount(f), 0);
    const madeVariantCount = forms.reduce((n, f) => n + madeVariants(state, f).length, 0);

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
      const made = madeVariants(state, form);
      const hinted = anyHintFor(state, form);
      // Show a form node if you've made any variant, OR it's hinted/neighbor-
      // taught. Otherwise it stays in the branch's "still to find" count.
      if (made.length === 0 && !hinted && !neighborTaught(state, form)) continue;
      const node = div('ws-node');
      const plate = div('ws-node-plate');
      const img = document.createElement('img');
      const repId = made[0] ?? repItem(form);
      img.src = itemSprite(repId).canvas.toDataURL();
      img.alt = '';
      plate.append(img);
      const name = div('ws-node-name');
      if (made.length > 0) {
        const spec = parseItemId(made[0]);
        name.textContent = tDyn(`form.${form}`);
        void spec;
      } else {
        node.classList.add('silhouette');
        name.textContent = tDyn(`form.${form}`);
      }
      node.append(plate, name);
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
  return wrap;
}

/** Is any exact pattern that yields this form currently hinted? */
function anyHintFor(state: WorkshopState, form: FormId): boolean {
  // Hints store a pattern key; we approximate "form is hinted" by checking the
  // hint list against the form's patterns lazily in W5. For W4 we treat made-
  // neighbors as the teaching source and leave hint coupling to W5.
  void state;
  void form;
  return false;
}

/**
 * Neighbor-teaching (§4): making any form reveals the silhouette of forms one
 * step away in the SAME family (the tree grows outward from what you've done).
 */
function neighborTaught(state: WorkshopState, form: FormId): boolean {
  const fam = FORMS[form].family;
  const famForms = FORM_IDS.filter((id) => FORMS[id].family === fam);
  // If you've made any item in this family, its same-tier neighbors light up.
  const madeInFamily = famForms.some((f) => madeVariants(state, f).length > 0);
  if (!madeInFamily) return false;
  const tier = FORMS[form].tier;
  return famForms.some((f) => FORMS[f].tier === tier && madeVariants(state, f).length > 0);
}
