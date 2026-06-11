# Interaction Audit — Backpack, Crafting & Placement

**Status:** Review + proposal (June 2026). Scope: the gather → craft → place loop
across `src/game/Backpack.ts`, `Crafting.ts`, `workshop/`, and how the UI
(`Console.ts`, `Workshop.ts`) and `Game.ts` wire them together. Obeys
`DESIGN_BASELINE.md` (binding) — every fix below is checked against "make Datou
feel alive," one focal point, no game-HUD chrome.

The user's prompt named the smell exactly: **you make a thing, it goes into the
backpack, and from the backpack you place it on the ground — but you can never
do the reverse.** This audit confirms that and finds a cluster of related
asymmetries and dead systems around it.

---

## 1. How the loop actually works today

Two crafting systems coexist, and only one is live:

| System | Files | Status |
| --- | --- | --- |
| **Legacy crafting** | `Crafting.ts` (`RECIPES`, `craft`, `canCraft`) | **Dead.** `craft()`/`canCraft()` are called only in tests. `RECIPES` survives solely so `Console.ts:247` can pick a verb label ("Place"/"Wear"/"Throw") for crafted items already in the pack. |
| **Workshop** | `workshop/WorkshopState.ts`, `bench.ts`, `Workshop.ts` | **Live.** The 3×3 bench consumes materials, produces a generative `ItemId`, and drops the player straight into placement. |

The current happy path for a made item:

```
bench confirms make  →  handleMake()  →  this.placingItem = id
                     →  workshop.hide()  →  toast "tap the ground"
                     →  next ground tap  →  placeWorkshopItem(id, x, z, fresh)
                     →  Cutout placed, appended to wwd.workshopBuilt
```

Note what is **missing** from that chain: the made item never enters the
backpack as an item you hold. It exists for exactly one tap, then it is a
permanent fixture in the world. The backpack only ever holds **raw materials**
(plus a few legacy crafted ids like `garland`/`stick` from the old path).

---

## 2. The core asymmetry (the user's example), and why it matters

**Every placement is a one-way door.**

- You can take a material *out* of the world (gather a twig) → into the pack.
- You can turn pack materials *into* a placed fixture (bench make → world).
- You **cannot** pick a placed fixture back *up* into the pack.
- You **cannot** move a placed fixture even one metre.
- You **cannot** put a made item *into* the pack and place it later, or place
  the same made item in two spots, or carry it to show Datou first.

The copy already lies about this: cancelling placement toasts
`place.cancelled` = **"Put it back in the pack"** (`i18n.ts:69`) — but nothing
goes into the pack, because the made item was never a pack item. It just
evaporates. (Worse, in the Workshop path the materials were *already consumed*
when you dropped them on the bench cells, so an Esc-cancel after a make is a
silent loss of materials — see §3.)

Why this is a baseline problem, not just a UX nit: the north star is **a space
you and Datou co-transform over many sessions.** A home you decorate is a home
you *re-arrange.* If the first lantern you ever place is frozen forever 0.5 m
too far left, the room can only ever accrete, never be tended. That is the
opposite of "want to spend time here." Stray/Monument Valley spaces feel
inhabited because they look *arranged*, which implies someone could rearrange
them.

---

## 3. Other asymmetries & rough edges found

Beyond the headline, the same family of "the loop only runs one direction"
problems:

**A. Materials are consumed on bench-drop, not on confirm.**
`Workshop.ts` pulls materials via `takeOne()` as you place them on cells; a
make confirms against what's already on the bench. So an Esc out of placement
mode *after* a successful make discards the finished item **and** the materials
are gone. `onRefund` exists for clearing the bench, but the post-make cancel
path (`Game.ts:426`) sets `placingItem = null` without refunding or re-granting
the item. **Net: you can lose materials to a misclick.**

**B. No "undo last placement."** Placement is the single most error-prone verb
in the game (tap-to-place on a tilted ground pick), and it has no undo, no
move, no remove. One mis-tap is permanent.

**C. Resources have a dead-end tap.** Tapping a raw resource in the pack only
toasts `craft.resourceHint` ("craft with it, or plant it in a garden plot").
It can't *start* anything — not the bench, not planting. The pack is a label,
not a launchpad. (The bench is opened only from the in-world bench object.)

**D. Two pack item classes behave differently for no visible reason.** Legacy
crafted ids (`garland`, `stick`, `fence`, …) live in the pack and place via the
old `useItem` → `this.placing` path; Workshop items never live in the pack and
place via `placingItem`. Same verb ("Place"), two code paths, two save arrays
(`wwd.built` vs `wwd.workshopBuilt`), two placement renderers. A player can't
tell why some made things wait in the pack and others demand immediate
placement.

**E. Placement mode is modal and invisible.** Entering placement closes the
pack and shows a toast; there's no persistent "you are placing X — tap to
drop, Esc to cancel" affordance, no ghost preview of the item on the ground
before commit. You commit blind to a tap location you can't preview.

**F. Garden plot is a third, special-cased path.** `plot` is neither a Workshop
item nor a normal built item — it has its own branch in `handleTap`
(`Game.ts:476`) and its own `Farm` store. More surface area, more divergence.

**G. The "components are not useful" toast.** Tapping a `bundle`/`stonepile`
toasts `craft.componentHint`. Correct, but it's another dead-end tap — the pack
tells you what something is *for* and then can't take you there.

---

## 4. Proposed direction — make placement a two-way, tended verb

The unifying idea: **a made item is an object you hold, and a placed item is
that same object set down.** Holding ↔ placing should be symmetric and
reversible, the way you'd set a real keepsake on a shelf and pick it up again.
This collapses the two code paths into one and removes most of §3 for free.

### 4.1 Made items go into the backpack first (not straight to placement)

`handleMake` should `backpack.add(id)` and **not** auto-enter placement. The
toast becomes "We figured out {thing} — it's in your pack." The pack is now the
staging area the BUILDING_SYSTEM doc already implies ("outputs … physically
enrich the home" — via the pack, like everything else).

Benefits: no lost-item-on-cancel (the item is safely in the pack); you can
carry it, show Datou, place it when you reach the right spot, or make several
and arrange them together. Materials still consume at make-time, which is now
honest because the *result* is also banked.

### 4.2 One placement path, reversible

Collapse `placing` (legacy) and `placingItem` (Workshop) into a single
`placeFromPack(itemId)` verb. Placing decrements the pack; **picking up**
increments it back and removes the world cutout. Concretely:

- **Place:** tap a pack item → enter placement → tap ground → `backpack.take(id)`,
  spawn cutout, push to a single `wwd.placed` array (replace the two arrays).
- **Pick up:** tap an *already-placed* cutout (when not in another mode) → a
  small in-world affordance ("Pick up / Move") → `backpack.add(id)`, remove
  cutout, drop from `wwd.placed`. This is the missing reverse arrow.
- **Move:** = pick up + immediately re-enter placement for that id (one tap to
  lift, one to set down). Cheap, and it's the verb that makes the home
  *tendable.*

Determinism note: placement positions are player-chosen, already saved in
`wwd.*Built`; nothing here touches the seeded RNG, so diary replay is
unaffected. Picking up must also drop the matching `wwd.placed` entry so reloads
stay consistent.

### 4.3 Placement preview (kills §3-E "place blind")

While in placement mode, render a low-opacity ghost of the item's cutout at the
current ground-pick point, following the pointer, before commit. Baseline-safe:
it's the same hand-drawn plate at ~35% ink, no glow, no grid, no reticle. Esc /
tap-pack cancels and (now harmlessly) returns nothing because the item is still
in the pack.

### 4.4 Make the pack a launchpad, not a label (§3-C/G)

- Tapping a **raw resource** opens the Workshop bench (if a bench is placed) or,
  if standing on/near a plot, offers plant. The dead-end toast becomes an
  action.
- Tapping a **component** opens the bench with that component pre-loaded as a
  hint, instead of just explaining it.
- Keep the explanatory text as a subtitle, not the whole interaction.

### 4.5 Fold the legacy systems away

- Delete `craft()`/`canCraft()` and the `RECIPES` *crafting* use; the Workshop
  is the crafting system. Keep a tiny `verbFor(itemId)` helper for the pack
  label (the only thing `RECIPES` was still doing) or derive the verb from the
  item's form family.
- Migrate `garland`/`stick`/`fence`/… either into the Workshop form registry or
  into the unified placed/wearable/throwable handlers so there's one of each
  verb, not two.
- Make `plot` a normal placed item that happens to register a `Farm` plot on
  drop, removing its special branch.

---

## 5. Smaller polish (independent, low-risk)

- **Honest cancel copy.** Until §4.1 lands, change `place.cancelled` so it
  doesn't claim "put it back in the pack" when nothing is. After §4.1 it
  becomes true again.
- **Refund on post-make cancel.** Immediate stopgap for §3-A: if the player
  cancels placement right after a make, re-grant the item (or its materials).
- **Stack count on placeables in the pack.** The pack already shows `×N`; make
  sure made items respect it so "make 3 lanterns, place them as a row" reads.
- **Single save schema.** One `wwd.placed: {id, x, z}[]` replacing `wwd.built`
  + `wwd.workshopBuilt`; write a one-time migration that merges both on load.

---

## 6. Suggested order of work

1. **§4.1** made-item-to-pack + **§5** refund/honest-copy — smallest change,
   removes the material-loss bug and the user's exact complaint in one step.
2. **§4.2** unified reversible placement (pick up / move) + single save schema —
   the headline feature; do the migration carefully.
3. **§4.3** ghost preview — pure polish on the new path.
4. **§4.4 / §4.5** pack-as-launchpad + delete legacy crafting — cleanup that
   shrinks the surface area the first three steps now share.

Each step ships green (matcher/grammar tests already exist; add tests for
pick-up round-trips and the save migration) and is QA'd against the Visual QA
checklist before the next. The last QA question is the bar: **does being able to
pick up, move, and re-arrange what you made together make you want to keep
tending this home with Datou?** Co-transformation only feels real if it runs
both directions.
