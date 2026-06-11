# The Workshop — Building System Design

**Status:** Design plan, approved direction (user request, June 2026). Implementation
phased — see §11. Obeys `DESIGN_BASELINE.md` (binding) and extends
`quadruped-game-design-research.md` ("relationships embedded in the world's
activities"; "the world remembers they were there").

---

## 1. Vision & pillars

Build a Minecraft-scale **making system** that stays a _companionship_ game:

1. **Big possibility space, zero menus of it.** 1 000+ craftable items, but the
   player is never shown a recipe book up front. You learn by **trying
   arrangements on the workbench** — and by walking with Datou, because…
2. **Datou is the muse and the forager.** New blueprint _hints_ come from Datou
   being somewhere, in some weather, in some mood — inspiration is a
   relationship event, not a tech-tree unlock. Datou also fetches materials
   into his **back bucket** faster than you could.
3. **Arrangement is meaning.** WHAT you place on the bench and WHERE you place
   it both matter (shape grammar, §4). A row is not a column; a ring is not a
   cross.
4. **Everything lands in the world.** Outputs are furnishings, structures,
   toys, and wearables that physically enrich the home and the park —
   "resources are only intermediaries; the real reward is that the relationship
   and the space are co-transformed."
5. **Determinism.** Same arrangement → same result, forever, for everyone.
   Seeded; replay/diary-safe; no `Math.random` in outcomes.

**Anti-goals:** combat gear, numeric power progression, grindy quotas, an
RPG-inventory aesthetic (baseline prohibition — the Workshop looks like a
**paper sketchbook**, not a loot grid).

---

## 2. The item space — how 1 000+ items exist without 1 000 authored assets

Items are points in a **generative grammar**, not hand-written entries:

```
ITEM = FORM( MATERIAL_PROFILE, SIZE, FINISH )
```

### 2.1 Materials (M ≈ 18 at launch, extensible)

Raw finds (existing + new gatherables):

| group | materials                                                                                   |
| ----- | ------------------------------------------------------------------------------------------- |
| wood  | twig, bark, plank\*, driftwood (lake), pine-branch (woods), **log** (Great Trees)           |
| stone | pebble, flat-stone, **stone-block** (Boulders), clay-lump (Clay Seams), flint (Flint Lodes) |
| plant | grass-wisp, reed, flower, berry, mushroom, pinecone, acorn                                  |
| found | feather, shell (lake), old-bolt (Bolt Caches — robot-flavored)                              |

Ground pickables stay the trickle; the **bulk** of wood/stone/mineral comes
from resource nodes worked with tools (§8) — the Terraria/Minecraft economy
that big structures need.

\* plank is itself crafted (twig bundle → split). Materials carry a
**profile**: color family (from the baseline palette), strength, flexibility,
"warmth". The profile drives both the sprite compositing and which forms accept
it.

### 2.2 Forms (F ≥ 500)

A form is a parametric hand-drawn template (same canvas-procedural pipeline as
today's `src/art/props.ts`, with material profile as input):

- **Components:** bundle, pile, cord, beam, post, panel, ring, vessel, wheel…
- **Furnishings:** fence, gate, bench, table, stool, lamp, lantern, planter,
  trellis, birdbath, chime, mobile, path-tile, sign, mat, basket…
- **Structures:** shelter, archway, pergola, bridge-plank, lookout-perch,
  shrine, well, cold-frame greenhouse…
- **For Datou:** garland, collar-charm, back-bucket upgrades, ramp, tunnel,
  ball-run…
- **Keepsakes:** memory-frame, postcard-stand, wind-vane, music-post…

The registry now includes 500+ distinct forms. The broad catalog is
**identity-first**: each id names a different object type and interaction
(`rocking-chair`, `rain-barrel`, `scent-gate`), never an adjective/material/
rarity reskin of another form. Every form carries silhouette, proportions,
functional cues, signature features, and a duplicate-review group. Asset
generation follows `ITEM_PROMPT.md`: six structural concepts are generated,
then CLIP/VLM duplicate checks retain only the best one to three assets.

Every form also has a discovery rarity:
**common · uncommon · rare · epic · legendary**. The fallback shape grammar
uses deterministic rarity-weighted selection, so unusual forms are genuinely
less frequent while the same bench arrangement still produces the same result.

### 2.3 The count

`F × eligible M × {sizes: S/M/L} × {finish: plain/banded/blossom}` —
500+ forms × eligible materials × sizes × finishes yields **tens of thousands
of distinct items**, each with
a deterministic id (`form:material:size:finish`), a generated sprite (template
recolored/re-detailed by material profile), and a generated name
("driftwood bench", "flint lantern", "tall reed trellis"). i18n via
`name = t(form) + t(material) (+ size adjective)` composition — no 1 000-row
string table.

Authoring cost is **forms × templates**, not items: ~40 drawing templates
(~25 already exist in some form) + 18 material palettes.

**Scaling authoring with agents:** new forms/materials/patterns are generated
by LLM agents using `docs/ITEM_AUTHORING_TEMPLATE.md` (a self-contained prompt
with the palette, draw-op language, schema and review checklist); output is
validated JSON compiled straight into the registry.

---

## 3. The workbench

A placeable Tier-2 structure (crafted from today's tree: 2 bundles + 1 stone
pile + 1 plank). Standing near it and tapping it opens the **Workshop window**
(§6). One bench serves the whole home; more can be placed anywhere (a bench at
the lake invites lake-material sessions — see inspiration triggers §5).

### 3.1 The bench grid

A **3×3 grid** (Minecraft homage, fits a phone screen). Drag items from the
backpack into cells; stack up to 3 per cell (stack **height** matters — a cell
with 3 pebbles is "heavy", 1 is "light").

### 3.2 Arrangement → outcome (the shape grammar)

Resolution order, all deterministic:

1. **Exact patterns** (authored, ~120 of them): specific shape + materials →
   specific item. E.g. `[twig][twig][twig]` in a row → _beam_; same in a
   column → _post_; ring of 8 pebbles around empty center → _stone ring
   (firepit base)_; cross of reeds with flower center → _reed chime_.
2. **Grammar rules** (the magic that fills the space): if no exact pattern
   matches, the bench reads the arrangement's **shape class** (row / column /
   L / T / cross / ring / block / diagonal / scatter), its **dominant
   material**, its **mass** (total stack height) and produces the grammar
   item: `shapeClass → form family`, `material → profile`, `mass → size`.
   A column of any wood → some post; heavier → taller. Mixed materials → the
   secondary material becomes the **finish** (flowers → blossom-banded). So
   _every_ sensible arrangement yields something — experimentation is never
   punished…
3. **Fizzle (with a wink):** a truly unreadable scatter produces a **curio**
   (a small odd keepsake, own collectible series, Datou sniffs it and sneezes).
   Failure is a tiny success.

Near-miss feedback: when an arrangement is 1 edit away from an _exact_ pattern
the player hasn't found, the bench's amber dot pulses softly and Datou leans
in, head tilted (no text, no arrows — readable, baseline-quiet). This is the
core "you're close, keep trying" loop.

### 3.3 Assembly moment

Confirm → a short calm beat: the plates slide together with a paper-rustle,
the new item pops in the hand-drawn grow-in we already use for discoveries.
First-time makes stamp a **memory card** ("We figured out the reed chime").

---

## 4. Discovery — never show the blueprint

- **Nothing is listed in advance.** The Workshop's tree view (§6) shows only:
  what you've **made** (full color), what you've **been inspired toward**
  (paper silhouette + the hint), and **counts** of what remains in each branch
  ("Vessels · 4 of 23 found") — Don't Starve-style fog over a Minecraft-size
  space.
- Sources of knowledge, in order of intended frequency:
  1. **Trying things** on the bench (grammar guarantees output; exact patterns
     are the treasures).
  2. **Datou's inspirations** (§5) — partial patterns.
  3. **World echoes:** examining setpieces with Datou can reveal one cell of a
     related pattern (the jetty teaches plank rows; the ruin stones teach the
     ring).
- A **made item teaches its neighbors**: making any _post_ reveals the
  silhouette (not the pattern) of post-family items one step away — the tree
  grows outward from what you've done, like Minecraft's progression intuition.

---

## 5. Inspiration — Datou as the muse

Datou periodically gets an **idea**: a new exact-pattern _hint_ (2–4 of the
pattern's cells shown; the rest blank). Delivery is in-character: Datou stops,
head-tilts at something real (the reeds, the rain, the campfire), the thought
chip shows a small sketch icon; tapping Datou banks the hint into the Workshop.

### 5.1 Trigger matrix

`trigger = zone × weather × season × time × Datou-state`, evaluated on a slow
tick (~90 s) with a seeded roll. Examples:

| context                            | inspires                                 |
| ---------------------------------- | ---------------------------------------- |
| lake + rain                        | vessels, shells, driftwood forms         |
| woods + fog + curious mood         | lanterns, lamp-posts, mushroom forms     |
| trail + clear + high bond          | benches, signs, social furnishings       |
| home + evening + tired             | mats, shelters, comfort forms            |
| ruins + any + Explorer personality | flint, wheel, mechanism forms            |
| winter season                      | cold-frame, warm forms (campfire family) |
| sniffing a Great Tree, no axe yet  | the AXE pattern hint (tool bootstrap)    |
| Bolt Cache + Explorer + high bond  | machined-tool patterns (tier 3)          |

### 5.2 Complexity gating (Datou's values)

Hint **tier** is gated by relationship depth, not player level:

- Bond < 30: tier-1 components & toys.
- Bond 30–70: furnishings; **mood** must match the form's temperament (a
  playful bow unlocks toy hints; calm unlocks furniture).
- Bond 70+: structures; **personality axes** (research doc §Personality) bias
  the branch — an Explorer-Datou inspires far-flung structures (bridge plank,
  lookout perch), a Guardian-Datou home structures (shelter upgrades, gates).
- Cooldown + pity timer: at least one inspiration per ~2 sessions, never more
  than one per 10 min. All seeded → diary-replayable.

**Prerequisites this adds:** a light **weather service** (seeded daily:
clear/breeze/rain/fog) and **season** (from the real date, 4 palettes/tints),
plus the personality axes from the research doc (already planned). Weather
also retints the world paint and changes ambient scatter slightly — calendar
return reasons for free.

---

## 6. The Workshop window

A **separate full overlay window** (not the small pack sheet), styled as a
paper sketchbook per the baseline — cream pages, ink headers, no grid-of-slots
RPG look. Three tabs:

1. **Bench** — the 3×3 grid (center), backpack strip (bottom), result easel
   (right). Drag/tap to place; stacks shown as small piles.
2. **Tree** — the building tree as a hand-drawn branching diagram (components →
   furnishings → structures, branches per form family). Made = inked; hinted =
   pencil silhouette with its partial pattern; unknown = a count badge per
   branch ("…and 19 still to find"). Pannable like a map page.
3. **Notebook** — banked inspirations (the sketch hints with where/when/with
   whom they happened — they double as memories), plus the curio collection.

Opens from the bench in-world, or the pack button long-press. Esc closes.

---

## 7. Datou the forager — and the dorsal arm

**Hardware update (approved):** Datou carries a small **mechanical arm on his
back** — a 2-segment manipulator with a two-finger gripper, folded flat along
the spine when idle (the silhouette stays clean). The arm is what actually
DOES the physical work: it picks small finds off the ground into the back
bucket, holds the fetch stick, steadies crops, and **wields the tools** of §8
(axe/pickaxe clamp into the gripper). Animation language stays calm: unfold →
reach → grip → stow, one beat each, never flailing.

- **Back bucket:** a small pannier rig plate on Datou's torso (visible; fills
  visibly: 0/3/6 sketch states). Capacity 6 (upgradeable via a crafted bucket
  form). The dorsal arm drops each pick into it over the shoulder — the
  signature work gesture.
- **Command:** in the Workshop or pack, pin a material ("need twigs") → leash
  off, Datou enters **forage mode**: seeks the nearest matching pickables
  within ~60 m (`World.nearestInstance` already supports this), trots
  (5.8 m/s — already faster than the player's 5.4 run; this stays a rule:
  **Datou is always quicker than you**), picks into the bucket with the sniff
  pose, and returns to dump into your pack with the happy pulse. Bond ticks
  per delivery; a full solo delivery writes a memory ("Datou kept bringing me
  stones").
- **Autonomy & personality:** off-leash idle Datou occasionally forages
  unprompted toward materials matching banked hints (Independent personality
  forages more; Dependent prefers carrying while you walk). Wants can anchor
  on "Datou wants to forage" as a fourth want kind.
- **Boundaries (research doc):** foraging is suggestible, never demanded;
  ignoring Datou's deliveries is never punished.

---

## 8. Resource nodes & tools — bulk materials, worked together

The Terraria/Minecraft layer: a few **huge, landmark-sized sources** that
yield materials in bulk — but only when Datou works them with the right tool.
The player is the maker; **Datou is the worker robot** (he literally is one) —
and it stays companionship: you crafted his tool, you stand by while he works,
and the haul is _ours_.

### 8.1 Node types

| node            | where                                        | tool          | yields (per worked session)               |
| --------------- | -------------------------------------------- | ------------- | ----------------------------------------- |
| **Great Tree**  | woods hearts, 1–2 in the meadow              | axe           | 8–14 logs + bark + a twig burst           |
| **Old Boulder** | meadow, ruins                                | pickaxe       | 8–14 stone-blocks + flat-stones + pebbles |
| **Clay Seam**   | lake shore bank                              | pickaxe (t1+) | 6–10 clay-lumps                           |
| **Flint Lode**  | ruin stones outcrop                          | pickaxe (t2+) | 6–10 flint + pebbles                      |
| **Bolt Cache**  | "old machine site" (new far-corner setpiece) | pickaxe (t3)  | 4–8 old-bolts + a curio chance            |

Nodes are extra-large hand-drawn plates (Great Tree ≈ 9 m) with **visible
harvest states**: full → worked → stump/rubble → regrowing silhouette. They
**always come back** (anti-FOMO): seeded daily charges; Great Trees regrow
over ~2 days with visible stages; lodes refresh weekly.

### 8.2 Tools — items in the same grammar

Tools are just forms: `axe | pickaxe | shears | scoop` × material tier —
discovered on the bench like everything else (the axe's first hint comes from
Datou sniffing a Great Tree, §5.1). **Tiers gate nodes, Terraria-style:**

- **t1 wooden** (twig/plank + cord): Great Trees, Old Boulders.
- **t2 flint** (flint + beam): + Clay Seams, Flint Lodes; ~1.5× yield.
- **t3 machined** (old-bolt + plank + cord): + Bolt Caches; ~2× yield, faster.

Tools clamp into the **dorsal arm's gripper** (§7) — the equipped tool is
visible riding on Datou's back, and the work swings are the arm's, not body
slams. **Soft durability:**
after ~30 swings a tool dulls (−50 % yield, drawn with a chipped edge); one
pebble at the bench re-sharpens it instantly. Tools never break.

### 8.3 The work loop

Equip a tool → tap a node → Datou trots over, braces, and the **arm** works
in **calm beats** (3–6 swings, paper _tok_, a small plate shake on the node — never
frantic): each beat drops a yield burst into his bucket; when the bucket
fills he trots the haul back to you, dumps it with the happy pulse, and
returns — until the node's daily charges are spent or you call him off.
Standing close to "steady" the work gives +20 % yield (being together pays).
First harvest of each node type stamps a memory card.

**Care boundaries:** a tired Datou gently refuses heavy work and sits — the
relationship outranks the economy (research-doc boundary rules). No tool
equipped → he paws at the node and head-shakes: a readable "we need
something for this", which doubles as the tool-hint nudge.

### 8.4 Why this matters to the tree

Bulk logs/blocks justify the heavy components (beams, panels, blocks) that
tier-3 structures (pergola, bridge-plank, well, lookout-perch) consume in
quantity — the economy finally has a supply side scaled to its demand side.

---

## 9. Data model & determinism

```ts
ItemId = `${form}:${material}:${size}:${finish}`        // stable forever
Pattern = { cells: (MaterialGroup | null)[9], stacks: number[9] }
PatternKey = canonical(rot/mirror-normalized cells+stacks) // exact match key
GrammarResult = f(shapeClass, dominantMaterial, mass)      // pure function
InspirationRoll = Rng(daySeed ^ zone ^ weather ^ bondBucket)
```

- Save: `wwd.workshop = { made: ItemId[], hints: {pattern, revealedCells}[], curios: number[] }`.
- Nodes: `wwd.nodes = { [nodeId]: { charges, lastRefresh } }` (placements are
  layout data + a seeded pass, like landmarks). Tools:
  `wwd.tools = { equipped: ItemId | null, dullness: Record<ItemId, number> }`.
- All sprites generated on demand and cached (`form template × material
profile`), so memory stays flat regardless of the 1 000-item space.
- Versioning: pattern tables and grammar are versioned; saves carry the
  version so discovered knowledge never invalidates.

---

## 10. UI/UX & baseline compliance

- Sketchbook visual language: ink on cream, pencil silhouettes, amber accents.
  ≤3 dominant colors. No slot-grid chrome, no rarity colors, no popup confetti.
- The bench's near-miss pulse and Datou's lean-in are the only "system"
  feedback — emotion-first, text-last.
- The Workshop never interrupts: inspirations bank quietly; nothing expires.
- The last QA question still rules: _does making things together make you want
  more time with the robot?_ Every form should answer it (most outputs are FOR
  the shared space or FOR Datou).

---

## 11. Implementation roadmap

| phase  | scope                                                                                                                                                                         | size |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **W1** | Material/profile registry; form-template refactor of existing sprites; ItemId scheme; generated names (i18n composition)                                                      | M    |
| **W2** | Workbench item + Workshop window shell; 3×3 grid with stacks; exact-pattern matcher (first 40 patterns); assembly moment; memory cards                                        | L    |
| **W3** | Shape grammar (row/column/L/T/cross/ring/block/scatter + mass/size/finish); curio fizzle; near-miss pulse                                                                     | L    |
| **W4** | Tree tab (branch diagram, silhouettes, counts); neighbor-teaching                                                                                                             | M    |
| **W5** | Weather + season service (seeded; world tint variants); inspiration engine + trigger matrix + Notebook tab                                                                    | L    |
| **W6** | Datou forage mode + back bucket rig plate + pin-a-material UX + autonomy hooks; speed rule audit                                                                              | M    |
| **W7** | Pattern authoring pass to ~120 exacts; form templates to 40; balancing; personality gating (depends on personality axes landing)                                              | L    |
| **W8** | Resource nodes & tools: node plates + harvest states + renewal; tool forms/tiers/mounting; work loop + poses; durability; bolt-cache setpiece (needs W1 registry + W6 bucket) | L    |

Each phase ships green (tests for matcher canonicalization, grammar purity,
inspiration determinism) and is QA'd visually before the next.

### Metrics (per research doc)

patterns-found per session · grammar-makes vs exact-makes ratio ·
inspiration acceptance rate · forage deliveries per session · % of made items
placed in the world within 5 min · Workshop dwell time.

## 12. Risks

- **Space too opaque** → grammar guarantees output for any try; near-miss
  pulse; pity-timer inspirations.
- **1 000 items, 40 looks** → finishes/sizes must read distinctly at game
  scale; QA gate per form template.
- **Scope** → W1–W3 alone already deliver "workbench + experimentation +
  ~300 reachable items"; later phases are additive.
- **Tool walls** → t1 tools are discoverable in the first session (Great
  Tree sniff hint + a 2-cell pattern); gating is about _reach_, never about
  blocking the core loop.
- **Baseline drift** → the sketchbook skin and the no-popup rule are
  non-negotiable; review each phase against the Visual QA checklist.
