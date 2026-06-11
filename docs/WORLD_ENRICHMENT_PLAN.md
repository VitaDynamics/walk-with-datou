# World enrichment — the Living Park plan (E1–E8)

**Goal:** the 500 m park currently *renders* dense (~2 800 plates) but *plays*
empty — almost nothing has a name, most plates don't respond, the resource
nodes are invisible, there are no animals, and the 501-form workshop space
never shows up in the world unless the player places something. This plan
turns the park into a place that answers back: everything touchable is named,
the big things stage small events, bulk resources are visible landmarks, the
park grows food, and small creatures share it with you and Datou.

**North star (unchanged):** make Datou feel alive. Every phase below must add
a way for Datou to react, initiate, or be involved — enrichment that doesn't
route through the companion is just clutter.

**Binding constraints (DESIGN_BASELINE.md overrides this doc):**
calm/premium/minimal · one focal point per screen · ≤ 3 dominant colors ·
no neon/glow/particles/bouncing/arcade anything · motion = breathing, drift,
gentle settle · UI = quiet chips and capsules, never floating HUD labels over
the world. Animals and events must read as *quiet park life*, not spawned
game content.

---

## §0 Current-state audit (what this plan builds on)

| System | State | Files |
| --- | --- | --- |
| Scatter | 16 kinds, ~2 800 plates + ~10 000 grass; 6 pickable kinds; verbs `sniff/rustle/hop/watch/drink/none` | `src/world/scatter.ts`, `src/world/World.ts` |
| Curated props | ~30 major props + 21 landmark areas with inspections | `src/world/layout.ts`, `src/world/landmarks.ts` |
| Resource nodes | **Wired and working** (tap → Datou harvests with tool) but only **7 placements** in a 500×500 m world, none visible from home, no names | `src/game/workshop/nodes.ts`, `Harvest.ts`, `Game.ts` (`placeNodes`) |
| Forms | 501 forms, 18 materials, 76 exact patterns, rarity discovery — **player-placed only**; the world itself never uses them | `src/game/workshop/forms.ts`, `formCatalog.ts` |
| Farm | Plots exist; crops limited to berry/flower/mushroom | `src/game/Farm.ts` |
| Names | Only landmark inspections have text anchors; scatter, placed items, and nodes are anonymous | — |
| Animals | None (birds/bees/frogs are thematic names only) | — |
| Tools | axe/pickaxe used; **shears and scoop have no use case** | `src/game/workshop/tools.ts` |

Unimplemented promises from BUILDING_SYSTEM.md this plan closes: world echoes
(§5), neighbor teaching, world placement of forms (W5–W7).

---

## E1 — Everything touchable is named (fixes "no name, not interactable")

**Design goal:** the park answers when you reach out. One quiet voice, never
a labelled HUD.

- **Name chip, not floating labels.** Reuse the existing thought-chip pattern
  (`src/ui/Console.ts`): tapping any prop/scatter/node/placed item shows ONE
  soft pill near the bottom — name + a one-line observation ("Reed — it
  creaks in the wind"). Auto-fades ~2.5 s. Never more than one at a time
  (baseline: one focal point). No labels are ever drawn in the 3D scene.
- **`nameKey` on every interactive thing.**
  - `KindDef` gains `nameKey` (`thing.tree`, `thing.reed`, …) — 16 keys.
  - Major props and nodes reuse the same scheme (`thing.old-pine`,
    `node.great-tree`, …).
  - Placed workshop items already compose names via `itemName()`
    (`src/game/workshop/items.ts:149`) — route taps on `wwd.placed` cutouts
    through the same chip.
- **No dead taps.** Audit `verb: 'none'`: grass stays mute (ground detail,
  intentional), everything else gets a verb. New verbs where the current five
  don't fit: `nudge` (pebble/twig — Datou paws it), `peer` (mushroom rings,
  hollow stumps).
- **Placed items become inspectable** (today they are static decoration):
  tap → chip with the item's composed name + a maker line ("you built this,
  spring"), and Datou gives a small proud reaction to things *he* inspired.
- **i18n:** EN/中文 for every key in `src/i18n.ts`; observations are 2–3
  seeded variants per kind so the park doesn't repeat itself in one walk.

**Done when:** walking 60 s and tapping anything yields a name and a response;
zero anonymous interactive plates remain.

## E2 — Great things: large interactive setpieces with staged events

**Design goal:** 10–12 oversized, *individually authored* objects that anchor
each region and reward attention with a small staged moment — the park's
"wonder" budget, spent sparingly.

- **Cast (one clear focal point per area, scale 1.5–2.5× the largest scatter):**
  Old Pine (exists, gets its event) · a Great Oak near home · Ruin Stones ·
  the Jetty · a hollow lightning-struck trunk in the woods · a glacial erratic
  on the high meadow · the Pump Garden wheel · a willow over the lake ·
  the orchard's mother apple tree (E4) · the bolt-cache machine relic.
- **Special event = a staged beat, not a particle show.** Tap it (or Datou
  wanders to it on his own) → a 3–6 s authored sequence in baseline motion
  language: the oak sheds three drifting leaves and Datou tracks one; the
  jetty creaks and ripples ring out; the ruin stones hum and Datou's ears
  turn; the relic's one panel blinks awake and BOBO the inventor pup is
  *fascinated*. Camera eases in slightly, never cuts.
- **Datou-initiated:** wire into the C5 behavior engine (`src/datou/behaviors.ts`)
  — near a great thing he hasn't visited today, Datou may initiate (gaze,
  trot, perform his side of the event). His reaction is character-specific
  per setpiece (canon: BOBO loves mechanisms, is shy of the dark hollow).
- **Daily variation, deterministic:** which beat variant plays is
  date-seeded (`rng.ts`), so the diary can replay it.
- **World echoes (closes BUILDING_SYSTEM §5):** each great thing, once per
  day, reveals one cell of a related craft pattern ("the jetty planks…
  *beam row*"), feeding the workshop discovery loop.
- **Tech:** a `Setpiece` descriptor (id, cutout(s), event script as a list of
  timed tweens + Datou clip + sound cue) + a tiny sequencer in `Game.ts`.
  Multi-plate setpieces (tree + separate falling-leaf plates) stay within the
  instancing budget.

**Done when:** every zone has ≥ 2 great things; each has a tap event and a
Datou-initiated variant; events respect cooldowns (one wonder at a time).

## E3 — A visible resource economy (fixes "I can't see any lode or trees")

**Design goal:** bulk-material sources read as *landmarks you plan a walk
around*, and the two dead tools get jobs.

- **7 → ~24 node placements.** Keep the curated far ones; add:
  - a **starter pair** visible from the home glade (great-tree at ~(–18, –26),
    old-boulder at ~(22, 18)) so the loop is discoverable in minute one;
  - 2–3 of each type distributed so every zone has a bulk source;
  - cluster flint/bolt in the ruin/corner "expedition" sites (keep scarcity).
- **Make them read as nodes.** The drawn states exist (`src/art/nodes.ts`);
  scale up (great-tree ≈ 8 m vs scatter trees 3.6–5.2 m), give each a painted
  ground apron + lead line in `worldPaint.ts` (the cart ruts to the quarry
  are already painted — finally bind them to a real quarry boulder pair).
- **Name + requirement in the chip, calmly:** "Flint lode — wants a sturdier
  pickaxe" instead of a lock icon. Charges state is shown by the existing
  4-stage art (full/worked/spent/regrowing), never by a progress bar.
- **New node types (gives shears & scoop a purpose):**
  | Node | Tool | Yields | Where |
  | --- | --- | --- | --- |
  | reed-bed | **shears** | reed ×4, grass-wisp ×2 | lake rim |
  | shell-bank | **scoop** | shell ×3, pebble ×2 | lakeshore sand |
  | driftwood drift | axe t1 | driftwood ×4, bark ×1 | south shore |
  | orchard windfall | none (gather) | fruit (E4) | meadow orchard |
- **Datou senses supply:** with the `wayfinder` equipped, Datou occasionally
  gazes toward the nearest workable node with charges left (reuses the
  curious-want gaze flow in `Companion.ts`) — navigation by companion, not
  by map markers.

**Done when:** from home you can *see* a great tree and a boulder; every
material group has a reachable bulk source; shears and scoop are craftable
*and worth crafting*.

## E4 — Orchard & garden: fruit and vegetables (fixes "no fruit/veg")

**Design goal:** the park feeds you. Food grows on *plants in the world* —
trees and bushes first, plots second — and ties into Farm, recipes, and
animals.

- **New flora kinds** (scatter + curated, drawn in `props.ts` palette):
  - **Fruit trees:** apple, pear, plum — blossom plate in spring, fruiting
    plate in summer/autumn (seasons already exist in `weather.ts`).
    Interaction: tap → Datou **nudges the trunk**, 1–3 fruit plates drop and
    settle (gentle arc, no bounce), become pickables. 2–3 charges/day,
    date-seeded.
  - **Berry/veg bushes:** blackberry bramble (woods), currant bush (trail),
    rosehip (meadow) — pick-by-hand like today's berries.
  - **Vegetable rows:** the Meadow Orchard apron at (60, –110) is *already
    painted with four tilled rows* — plant them: pumpkin, turnip, carrot,
    bean-pole rows as decal/billboard plates with daily pickable charges.
- **Materials & crops:** add `apple/pear/plum/pumpkin/turnip/carrot` to the
  `plant` material group; extend `Farm.CropKind` so harvested fruit/veg can
  be replanted in plots (fruit sapling = slow, multi-day, becomes a small
  fruit tree plate at the plot — the long-term keepsake of the food loop).
- **Counts (keep the meadow calm):** ~40 fruit trees total clustered around
  the orchard + a few strays; bushes ~120 across zones; rows are one curated
  set. Orchard becomes the obvious "food district" without papering the map.
- **Recipes/forms:** fruit feeds existing vessel/basket forms ("berry bowl"),
  and is what you offer animals in E5.

**Done when:** a walk to the orchard in autumn fills the basket with three
food types; spring shows blossom instead; Farm accepts the new crops.

## E5 — Animals (fixes "we need animals")

**Design goal:** park life that is *witnessed more than used* — calm,
seeded routines, never spawn-and-despawn arcade critters. Two layers:

**Ambient layer (cheap, many, atmosphere):**
- **Birds** — 2-plate cutouts (body + wing state) that perch on trees,
  benches, the signpost, *and any placed birdbath/bug-hotel* (placed
  workshop items finally matter in the world). Hop twice, fly off in a soft
  arc when you come within ~3 m. ~10 active around the player, pooled.
- **Butterflies** over the flower drift and orchard (2 alternating plates,
  slow sine drift — this is "gentle motion", not particles).
- **Fish ripples** in the lake (ring decals + a fin plate near the jetty;
  watching from the jetty end is itself a small E2 event).
- **Fireflies**: 3–5 slow drifting dim plates at dusk in the woods only —
  deliberately few; if it reads as a particle effect, cut it.

**Resident layer (few, named, persistent — the emotional payload):**
- **The cat** (trail commons): aloof; has a date-seeded daily routine
  (morning bench, noon bulletin board, evening lamp). Ignores you for days;
  feeding it (E4 fruit won't work — it wants the fish you can't catch,
  a quiet joke) it slowly tolerates Datou. Datou ↔ cat micro-scenes:
  careful mutual sniff, cat bats Datou's ear, both pretend it didn't happen.
- **The neighbor dog** (visits the trail loop on seeded days, not resident —
  Datou stays the only dog *of the home*): play-bows with Datou for a short
  chase-circle beat, then trots off. Bond moment, not a rival.
- **Ducks** (lake, 2–3): paddle a slow seeded circuit; accept berries;
  Datou points (frozen, one paw up — BOBO has *opinions* about ducks).
- **A squirrel** (old oak): caches things; very rarely "donates" a found
  material (acorn, shiny old-bolt) at the oak roots — a soft rare-material
  faucet that rewards visiting.
- Residents get name chips (E1), memory-card moments on first meeting, and
  entries in Datou's diary.

**Tech:** one `Critter` class (billboard cutout, 2–4 drawn states in
`src/art/critters.ts` via `wobbleInk`, simple steering + state machine:
`idle/move/react/flee/interact`), updated in `Game.update`, hard cap ~12
active, pooled. Routines and visit-days are date-seeded (deterministic,
diary-replayable); flutter timing may use `Math.random` (cosmetic).
Residents persist familiarity in `localStorage` (`wwd.critters`).

**Done when:** standing still for 30 s anywhere shows life; each resident
has a routine you can learn; Datou reacts in character to every species.

## E6 — The world uses the 501 forms (fixes "map still quite empty")

**Design goal:** the park looks *inhabited* — by its community and by your
history — using the form system as the furniture catalog instead of new art.

- **Authored placements from the catalog:** dress the 21 landmark areas with
  ~60 curated `PlacedEntry`-style items drawn through the existing form
  sprite pipeline — benches/tables at the picnic commons, lanterns pacing
  the trail, a drying rack at the pump garden, wind chimes at the knoll.
  Static layout data (`src/world/dressing.ts`), rendered like placed items,
  all tappable/named via E1.
- **Neighbor teaching (closes BUILDING_SYSTEM §5):** inspecting a dressed
  item reveals the silhouette of its form in the workshop tree — the world
  becomes the workshop's tutorial.
- **Density pass on the mid layer:** the gap today is mid-size filler.
  New scatter kinds: fallen log (sittable, `hop`), fern clumps (woods),
  cattail stands, lily pads (lake), stone rings, anthill. +400–600 plates
  total, clustered, keeping sightlines and negative space (no even peanut-
  butter spread — clumps with gaps read hand-placed).
- **Player history accumulates:** raise placed-item comfort cap; placed
  items influence critter behavior (E5) and Datou's idle preferences
  (he naps under *your* archway).

**Done when:** each landmark area has dressed furniture you can inspect, and
a fly-over screenshot no longer shows large featureless bands between zones.

## E7 — The park breathes (my additions for game feel)

- **Dusk pass:** time-of-day tint (real clock, gentle 2-stop grade — day /
  dusk); lamps and placed lanterns glow softly at dusk (small warm halo
  plate, well under the no-bloom line); fireflies (E5) only then.
- **Weather made visible:** `weather.ts` already rolls clear/breeze/rain/fog
  daily — render it: breeze = grass/reed plates sway a few degrees + petals
  drift; rain = soft streak overlay + darker ground tint + Datou shakes off
  under trees; fog = lowered fog distance (Three.js fog, already cheap).
  Rain days double Farm growth — a reason to love bad weather.
- **Ambient sound bed per zone** (if C4 voice infra allows): birdsong /
  reed wind / water lap, low and loopless-feeling (seeded variation).
- **Morning note:** on first open of the day, the thought chip surfaces one
  date-seeded park event as a hook — "the plums dropped overnight" /
  "the neighbor dog is around today" — turning E4/E5 systems into the daily
  check-in reason the baseline asks for.

## E8 — QA, performance & acceptance gate

- **Perf budget:** scatter additions stay instanced (target ≤ 60 draw calls
  for the world); critters pooled ≤ 12 active; setpiece sequencer runs ≤ 1
  event at a time; no per-frame canvas redraws.
- **Determinism:** all gameplay-relevant placement/routines/charges
  date-seeded via `rng.ts`; `Math.random` only for cosmetic flutter.
- **Tests:** scatter counts/clearings, node charge math, critter routine
  seeding, farm crop extension, i18n key completeness (every `nameKey`
  resolves in EN and 中文). `npm run test`/`lint`/`build` green per phase.
- **Visual QA per phase (binding workflow):** headless Chrome + SwiftShader
  screenshots at home/orchard/lake/ruins, day and dusk; run the
  DESIGN_BASELINE checklist; the gate question for every phase:
  *does this make the user want to spend more time with Datou?* If a phase
  reads cluttered or arcade, redesign before the next phase.

---

## Order & rationale

**E1 → E3 → E2 → E4 → E5 → E6 → E7**, QA (E8) inside every phase.

E1 first because it's cheap and fixes the most jarring break (dead taps).
E3 before E2 because the resource economy is already 90 % built and just
needs to be *seen*. E5 lands after E4 so animals have food to respond to.
Each phase ships polished on its own — if work stops after any phase, the
game is strictly better.

| Phase | Size | New save keys | New i18n |
| --- | --- | --- | --- |
| E1 names & verbs | S | — | ~60 keys |
| E2 setpieces | M | `wwd.setpieces` | ~36 keys |
| E3 nodes | M | (existing `wwd.nodes`) | ~12 keys |
| E4 orchard | M | `wwd.farm` ext | ~20 keys |
| E5 animals | L | `wwd.critters` | ~25 keys |
| E6 dressing | M | — | (composed) |
| E7 breathes | M | — | ~15 keys |
