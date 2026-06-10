/**
 * The Workshop — ItemId scheme, eligibility & generated names
 * (BUILDING_SYSTEM §2.3, §9).
 *
 * An item is a point in the grammar `ITEM = FORM(MATERIAL, SIZE, FINISH)`,
 * addressed by a stable string id:
 *
 *     ItemId = `${form}:${material}:${size}:${finish}`   // stable forever (§9)
 *
 * This module is the pure core of W1: it builds/parses ids, decides which
 * (form, material, size, finish) tuples are *valid* (a form only accepts
 * materials whose group it lists; only forms that opt into sizes/finishes get
 * more than one), enumerates the whole reachable space (the ~1 000 count of
 * §2.3), and composes display names from the i18n table WITHOUT a per-item
 * string row (§2.3: `name = t(form) + t(material) (+ size adjective)`).
 *
 * No drawing, no state, no `Math.random` — everything here is a pure function
 * of the static FORMS/MATERIALS tables, so ids and counts are identical for
 * everyone, forever (diary/replay-safe).
 */

import { tDyn } from '../../i18n';
import { FORMS, FORM_IDS, form as formDef, type FormId, type Size, type Finish } from './forms';
import { MATERIALS, type MaterialId } from './materials';

export interface ItemSpec {
  readonly form: FormId;
  readonly material: MaterialId;
  readonly size: Size;
  readonly finish: Finish;
}

export type ItemId = string; // `${form}:${material}:${size}:${finish}`

const SEP = ':';

/** Build the stable id for a spec. */
export function itemId(spec: ItemSpec): ItemId {
  return [spec.form, spec.material, spec.size, spec.finish].join(SEP);
}

/** Parse an id back to a spec. Returns null if malformed or unknown. */
export function parseItemId(id: ItemId): ItemSpec | null {
  const parts = id.split(SEP);
  if (parts.length !== 4) return null;
  const [form, material, size, finish] = parts;
  if (!(form in FORMS)) return null;
  if (!(material in MATERIALS)) return null;
  if (size !== 'S' && size !== 'M' && size !== 'L') return null;
  if (finish !== 'plain' && finish !== 'banded' && finish !== 'blossom') return null;
  return { form: form as FormId, material: material as MaterialId, size, finish };
}

/** Does this form accept this material's group? */
export function accepts(form: FormId, material: MaterialId): boolean {
  const def = formDef(form);
  if (!def.accepts.includes(MATERIALS[material].group)) return false;
  // A form may further restrict to a whitelist of physically-sensible materials.
  return def.materials ? def.materials.includes(material) : true;
}

/**
 * Sizes a form actually varies over: just `M` if the form opted out of sizes
 * (so its id space doesn't triple for no visual difference).
 */
export function sizesFor(form: FormId): readonly Size[] {
  return formDef(form).sizes ? (['S', 'M', 'L'] as const) : (['M'] as const);
}

/** Finishes a form varies over: just `plain` unless it opted into finishes. */
export function finishesFor(form: FormId): readonly Finish[] {
  return formDef(form).finishes ? (['plain', 'banded', 'blossom'] as const) : (['plain'] as const);
}

/** Is this a valid, reachable item? (form accepts material; size/finish in range.) */
export function isValid(spec: ItemSpec): boolean {
  if (!accepts(spec.form, spec.material)) return false;
  if (!sizesFor(spec.form).includes(spec.size)) return false;
  if (!finishesFor(spec.form).includes(spec.finish)) return false;
  return true;
}

/**
 * Enumerate every reachable item id, in a stable order (form → material →
 * size → finish, all in registry order). This is the ground truth for §2.3's
 * ~1 000-item count and for the Tree-tab "X of N found" badges (W4).
 */
export function allItemIds(): ItemId[] {
  const ids: ItemId[] = [];
  for (const form of FORM_IDS) {
    for (const material of materialsAcceptedBy(form)) {
      for (const size of sizesFor(form)) {
        for (const finish of finishesFor(form)) {
          ids.push(itemId({ form, material, size, finish }));
        }
      }
    }
  }
  return ids;
}

/** Materials a form accepts, in registry order. */
export function materialsAcceptedBy(form: FormId): MaterialId[] {
  return (Object.keys(MATERIALS) as MaterialId[]).filter((m) => accepts(form, m));
}

/** Total reachable item count (the §2.3 headline number). */
export function itemCount(): number {
  return allItemIds().length;
}

// --- Names (§2.3): composed, never tabled ------------------------------------

/**
 * Display name = material + form, with a size adjective for S/L (M is the
 * unmarked base). All three fragments come from the i18n table by *id*, so two
 * locales cover the whole 1 000-item space with ~60 keys, not 1 000 rows.
 *
 * Locale word order differs (EN "tall reed trellis"; ZH "高·芦苇·花架"), so the
 * assembly itself is localized via the `name.order` / `name.sizeAdj.*` keys —
 * the composition lives in the table, the vocabulary is reused.
 */
export function itemName(spec: ItemSpec): string {
  const material = tDyn(`material.${spec.material}`);
  const form = tDyn(`form.${spec.form}`);
  const sizeAdj = spec.size === 'M' ? '' : tDyn(`name.sizeAdj.${spec.size}`);
  // `name.order` is a localized template with {size} {material} {form} slots;
  // empty {size} collapses cleanly (the template trims doubled separators).
  return tDyn('name.order', { size: sizeAdj, material, form })
    .replace(/\s{2,}/g, ' ')
    .replace(/·\s*·/g, '·')
    .replace(/^[·\s]+|[·\s]+$/g, '')
    .trim();
}
