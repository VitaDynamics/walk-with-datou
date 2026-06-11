# Item Authoring Template (LLM agent prompt)

> **Asset concept note:** use `docs/ITEM_PROMPT.md` first for identity design,
> six structural variants, image generation, and CLIP/VLM duplicate filtering.
> This document is the narrower implementation schema for converting an
> approved identity into Workshop metadata, recipes, and procedural op lists.
> Never create adjective/material/rarity reskins as separate forms.

**Purpose:** paste this whole document as the prompt for an LLM agent that
generates new Workshop content for _Walk with Datou_. The agent fills the
schema in §4 and returns ONLY valid JSON. Output is machine-validated and
compiled into the item registry (`docs/BUILDING_SYSTEM.md` is the system it
feeds). Humans review against the checklist in §7 before merge.

---

## 1. What you are making

_Walk with Datou_ is a calm, premium companion game: a player walks a
hand-drawn 500 m park with a small quadruped robot (Datou). Items are made on
a 3×3 workbench and placed into the shared world. You are authoring **FORMS**
(item archetypes), optional **MATERIALS**, and **EXACT PATTERNS** (signature
3×3 recipes). One form × its eligible materials × sizes × finishes yields
many items — author the archetype, not each variant.

**Tone rules (binding, from DESIGN_BASELINE.md):** warm, quiet, hand-made.
NO weapons, combat gear, traps, cages, neon, sci-fi clutter, skulls, or
anything that punishes the robot or the player. Every form must have a
**companionship hook**: a reason it makes the player and the robot want to be
in the world together.

## 2. Vocabulary you must use

### 2.1 Palette tokens (the ONLY colors allowed)

```
PAPER: skyTop #f7f3ea · skyBottom #ece5d6 · floor #ede7d8
INK:   line #3a372f · soft #5a564b · grain #4a463c
GROUND:base #d6d4b4 · blotchA #cccda6 · blotchB #c3c89c · blotchC #dcd9bb · path #e6ddc4 · edge #b9bd92
SAGE:  light #b5c2a2 · mid #94a781 · deep #7c8c7a · shade #67785f
CLAY:  pale #ecdfc9 · light #dcc3a4 · mid #c2a07c · deep #9a7e5e · blossom #d9b3a0
WATER: deep #9cb4ab · mid #abc1b7 · edge #c4d2c4 · sand #e2d8bd
ROBOT: shell #f1efe6 · shellShade #ddd9cb · dark #34373a · darkShade #26282b · visor #2c2f31 · accent #d9a441
LAMP_WARM: rgba(233,196,124,0.35)   // baked halo only, never bloom
```

Reference colors as `"SAGE.mid"` etc. Max 3 dominant families per sprite;
`ROBOT.accent` (amber) only as a small accent. Every shape gets an ink
outline (`INK.line` 3–6 px at 256-canvas scale).

### 2.2 Draw ops (your sprite language)

Sprites are compiled from an ordered op list on a transparent canvas
(origin top-left, y down; the item must touch the bottom margin — that's
the ground anchor). Allowed ops:

```
{op:"blob",   cx,cy,rx,ry, fill?, outline?, lineWidth?, n?, irregularity?}   // wobbly ellipse
{op:"rect",   x,y,w,h,r, fill?, outline?, lineWidth?}                        // rounded rect
{op:"line",   x0,y0,x1,y1, width, color, jitter?, segments?}                 // hand-wobbled stroke
{op:"path",   points:[[x,y],...], close?, fill?, outline?, lineWidth?}       // polygon (quad-smoothed)
{op:"grass",  x,baseY,height,lean,width,color}                               // curved blade
{op:"halo",   cx,cy,r}                                                       // warm baked glow (lamps/fire only)
{op:"speckle",x,y,w,h,count,color,alpha?,maxR?}                              // grain dots
```

Canvas sizes: pick from 128–512 per side; report `aspect = width/height`.
Coordinates are deterministic constants — NO randomness in your output (the
engine adds seeded wobble itself).

### 2.3 Material groups (for patterns & eligibility)

`wood` (twig, plank, log, driftwood, pine-branch, bark) ·
`stone` (pebble, flat-stone, stone-block, clay-lump, flint) ·
`plant` (grass-wisp, reed, flower, berry, mushroom, pinecone, acorn) ·
`found` (feather, shell, old-bolt)

### 2.4 Shape classes (3×3 grammar)

`row · column · L · T · cross · ring · block · diagonal · scatter`.
Exact patterns are normalized under rotation+mirror; stacks 1–3 per cell
(0 = empty). Your exact patterns must be UNIQUE as normalized shapes+materials
— prefer arrangements that _look like the thing_ (a ring of stones IS a
firepit).

## 3. Authoring rules

1. **Tiering:** tier 1 = components/toys (≤4 filled cells), tier 2 =
   furnishings (4–7 cells, may need tier-1 components), tier 3 = structures
   (6–9 cells, MUST consume ≥2 crafted components). Bigger = heavier mass.
2. **Eligible materials:** 3–12 per form; pick what's physically sensible
   (no berry benches). Sizes S/M/L map to world heights you give in
   `world.heightM` (S×0.7, L×1.4).
3. **Names** compose as `material + form (+ size adj)` — give the FORM noun
   in English and 简体中文; never bake material into the noun.
4. **Companionship hook is mandatory** — one sentence: what does Datou or the
   pair DO with it? (sit, nap, drink, play, mark a memory, light a corner…)
5. **Inspiration trigger** — one context line (`zone × weather × season ×
mood/bond`) where Datou would hint this form.
6. **Placement** — `billboard` (stands up) or `decal` (flat on ground);
   collider radius 0 if walk-through.
7. Determinism: no randomness, no dates, no references to anything outside
   this document.

## 4. Output schema (return ONLY this JSON)

```json
{
  "forms": [
    {
      "id": "kebab-case-noun",
      "family": "component|furnishing|structure|datou-gear|keepsake|tool",
      "tier": 1,
      "use": "place|wear|throw|tool|component",
      "nameEn": "stool",
      "nameZh": "小凳",
      "eligibleMaterials": ["twig", "plank", "driftwood"],
      "world": {
        "heightM": 0.55,
        "shadowRadiusM": 0.5,
        "colliderM": 0.3,
        "placement": "billboard"
      },
      "companionshipHook": "Datou hops up and perches beside you at the campfire.",
      "inspiration": "trail + clear + calm mood, bond 30+",
      "sprite": {
        "canvas": [256, 224],
        "ops": [
          {
            "op": "line",
            "x0": 70,
            "y0": 210,
            "x1": 78,
            "y1": 130,
            "width": 12,
            "color": "CLAY.deep"
          },
          {
            "op": "line",
            "x0": 186,
            "y0": 210,
            "x1": 178,
            "y1": 130,
            "width": 12,
            "color": "CLAY.deep"
          },
          {
            "op": "blob",
            "cx": 128,
            "cy": 118,
            "rx": 88,
            "ry": 24,
            "fill": "CLAY.light",
            "outline": "INK.line",
            "lineWidth": 5
          }
        ]
      },
      "patterns": [
        {
          "result": "stool",
          "cells": [
            [null, null, null],
            ["wood", null, "wood"],
            ["wood", "wood", "wood"]
          ],
          "stacks": [
            [0, 0, 0],
            [1, 0, 1],
            [2, 1, 2]
          ],
          "comment": "two legs under a seat — looks like a stool"
        }
      ]
    }
  ],
  "materials": [],
  "notes": "anything the reviewer should know, one short paragraph max"
}
```

New materials (optional, rare) need: `id, group, sourceHint (where found in
the park), profile: {palette: "CLAY", strength: 1-3, flexibility: 1-3,
warmth: 1-3}, nameEn, nameZh`.

## 5. What good looks like (style exemplars)

- _bench_: two clay posts + two plank lines, grain ticks — 12 ops.
- _lantern_: dark stem line, paper cone path, warm `halo`, `ROBOT.accent`
  dot — 8 ops.
- _birdbath_: pedestal path + bowl blob + `WATER.mid` ellipse + tiny
  blossom bird — 9 ops.

Aim for 6–16 ops per sprite. Underdraw, don't overdraw: flat fills, one
shade pass, ink outline. If your sprite needs >20 ops, simplify the design.

## 6. Batch request format

The requester will say e.g. “Generate 8 tier-2 furnishings for the LAKE
branch”. Honor the branch (materials/hooks should fit the zone), avoid ids
already listed in the request's `existingIds`, and return 1 exact pattern per
form (2 for tier-3).

## 7. Reviewer checklist (the agent should self-check before returning)

- [ ] JSON parses; only schema fields; only palette tokens; only listed ops.
- [ ] Item touches the bottom of its canvas; aspect matches canvas.
- [ ] ≤3 dominant color families; amber accent small; ink outlines present.
- [ ] No prohibited content (weapons/combat/neon/punishment).
- [ ] Companionship hook is concrete (an action, not a vibe).
- [ ] Pattern looks like the thing; unique under rotation/mirror; cell count
      fits the tier; tier-3 consumes components.
- [ ] Names: EN noun + 中文名, no material baked in.
- [ ] No randomness, no out-of-doc references.
