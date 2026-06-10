# The Workshop — Building System Design

**Status:** Design plan, approved direction (user request, June 2026). Implementation
phased — see §10. Obeys `DESIGN_BASELINE.md` (binding) and extends
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

| group | materials                                                      |
| ----- | -------------------------------------------------------------- |
| wood  | twig, bark, plank\*, driftwood (lake), pine-branch (woods)     |
| stone | pebble, flat-stone, clay-lump (lake shore), flint (ruins)      |
| plant | grass-wisp, reed, flower, berry, mushroom, pinecone, acorn     |
| found | feather, shell (lake), old-bolt (trail/ruins — robot-flavored) |

\* plank is itself crafted (twig bundle → split). Materials carry a
**profile**: color family (from the baseline palette), strength, flexibility,
"warmth". The profile drives both the sprite compositing and which forms accept
it.

### 2.2 Forms (F ≈ 40 at launch)

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

### 2.3 The count

`F × eligible M × {sizes: S/M/L} × {finish: plain/banded/blossom}` —
40 × ~9 eligible materials avg × 3 × ~1.1 ≈ **1 180 distinct items**, each with
a deterministic id (`form:material:size:finish`), a generated sprite (template
recolored/re-detailed by material profile), and a generated name
("driftwood bench", "flint lantern", "tall reed trellis"). i18n via
`name = t(form) + t(material) (+ size adjective)` composition — no 1 000-row
string table.

Authoring cost is **forms × templates**, not items: ~40 drawing templates
(~25 already exist in some form) + 18 material palettes.

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

## 7. Datou the forager

- **Back bucket:** a small pannier rig plate on Datou's torso (visible; fills
  visibly: 0/3/6 sketch states). Capacity 6 (upgradeable via a crafted bucket
  form).
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

## 8. Data model & determinism

```ts
ItemId = `${form}:${material}:${size}:${finish}`        // stable forever
Pattern = { cells: (MaterialGroup | null)[9], stacks: number[9] }
PatternKey = canonical(rot/mirror-normalized cells+stacks) // exact match key
GrammarResult = f(shapeClass, dominantMaterial, mass)      // pure function
InspirationRoll = Rng(daySeed ^ zone ^ weather ^ bondBucket)
```

- Save: `wwd.workshop = { made: ItemId[], hints: {pattern, revealedCells}[], curios: number[] }`.
- All sprites generated on demand and cached (`form template × material
profile`), so memory stays flat regardless of the 1 000-item space.
- Versioning: pattern tables and grammar are versioned; saves carry the
  version so discovered knowledge never invalidates.

---

## 9. UI/UX & baseline compliance

- Sketchbook visual language: ink on cream, pencil silhouettes, amber accents.
  ≤3 dominant colors. No slot-grid chrome, no rarity colors, no popup confetti.
- The bench's near-miss pulse and Datou's lean-in are the only "system"
  feedback — emotion-first, text-last.
- The Workshop never interrupts: inspirations bank quietly; nothing expires.
- The last QA question still rules: _does making things together make you want
  more time with the robot?_ Every form should answer it (most outputs are FOR
  the shared space or FOR Datou).

---

## 10. Implementation roadmap

| phase  | scope                                                                                                                                  | size |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **W1** | Material/profile registry; form-template refactor of existing sprites; ItemId scheme; generated names (i18n composition)               | M    |
| **W2** | Workbench item + Workshop window shell; 3×3 grid with stacks; exact-pattern matcher (first 40 patterns); assembly moment; memory cards | L    |
| **W3** | Shape grammar (row/column/L/T/cross/ring/block/scatter + mass/size/finish); curio fizzle; near-miss pulse                              | L    |
| **W4** | Tree tab (branch diagram, silhouettes, counts); neighbor-teaching                                                                      | M    |
| **W5** | Weather + season service (seeded; world tint variants); inspiration engine + trigger matrix + Notebook tab                             | L    |
| **W6** | Datou forage mode + back bucket rig plate + pin-a-material UX + autonomy hooks; speed rule audit                                       | M    |
| **W7** | Pattern authoring pass to ~120 exacts; form templates to 40; balancing; personality gating (depends on personality axes landing)       | L    |

Each phase ships green (tests for matcher canonicalization, grammar purity,
inspiration determinism) and is QA'd visually before the next.

### Metrics (per research doc)

patterns-found per session · grammar-makes vs exact-makes ratio ·
inspiration acceptance rate · forage deliveries per session · % of made items
placed in the world within 5 min · Workshop dwell time.

## 11. Risks

- **Space too opaque** → grammar guarantees output for any try; near-miss
  pulse; pity-timer inspirations.
- **1 000 items, 40 looks** → finishes/sizes must read distinctly at game
  scale; QA gate per form template.
- **Scope** → W1–W3 alone already deliver "workbench + experimentation +
  ~300 reachable items"; later phases are additive.
- **Baseline drift** → the sketchbook skin and the no-popup rule are
  non-negotiable; review each phase against the Visual QA checklist.
