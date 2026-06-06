# Environment Design — A Park Worth Exploring

**Status:** Approved direction; ready to split into implementation tasks
**Date:** 2026-06-06
**Scope:** Redesign the park environment from a tiny flat plane into a **large (500×500 m) explorable world** that feels rich, varied, and worth re-walking daily — with a code-level mapping onto the existing `World.ts` / `Game.ts` / `CameraRig.ts`.

> **Scope decisions locked in (from review):** the world grows to **500×500 m**; the ground stays a **flat plane for now**; water is a **cheap flat translucent plane + ripple decals**; seasons run on a **configurable clock**; props stay **hand-built procedural `THREE` primitives** (no glTF pipeline). Heightfield terrain and slope-aware physics are deferred as one future phase. Near-term richness comes from **scale, zoning, landmarks, props, atmosphere, and interaction reactivity** — not terrain. See §9.
> **Companion doc:** the interaction/gameplay design (wants, bond, explore mode, POIs, diary). This doc is the _stage_; that doc is the _play_. They share the POI and daily-ritual systems.
> **References:** _A Short Hike_ (GDC postmortem), _Alba: A Wildlife Adventure_ (ustwo env-art writeups), _Cozy Grove_ / _Animal Crossing_ (daily-content model), The Level Design Book.

---

## Context — why this exists

The interaction design gives Datou things to _want_ and _do_, but the world it does them in is a 60×60 m flat green square: an S-curve path of 14 tiles, 12 trees clustered at the edges, one home post, 18 scattered flowers, flat lighting, static fog (`World.ts`, `Game.setupLights`). You can stand in one corner and see all four edges — the cardinal sin of small-world design. There is nothing to walk _toward_, no reason to take one route over another, and it looks identical on every visit.

This is the wrong stage for a game whose entire pitch is _"a cozy daily walk that builds attachment."_ The walk needs somewhere to go — so the world grows to **500×500 m** (~70× the area), big enough that you genuinely cannot see it all at once and every walk has a real distance to it. The current park footprint becomes roughly the **starting meadow** of a much larger park.

The good news: the research is unanimous that a _small_ space can feel rich and re-explorable with cheap, well-known techniques — and the codebase is already shaped to absorb them. `World.ts` already separates **visual build** from a **collider list** consumed by both the player and the physics backend, and `Game` already supports an orbit-follow camera, fog, and a day-lit directional sun. We extend those seams; we don't rebuild.

### Design north star (from the research)

> **Never let the player see the whole park at once. Always give them something to walk toward. Make the same path feel different tomorrow.**

Three principles, each with a section below: **(A) break sightlines & plant landmarks**, **(B) zone and mass the flat space**, **(C) make it alive & re-explorable** through clear interaction feedback, atmosphere, and daily/seasonal change.

---

## 1. The redesigned park — layout

A **500×500 m** park (coordinates roughly `-250..+250` on X and Z), with the **home post at the origin** as the anchor — the spawn, the "base," and where explore souvenirs return (see the gameplay doc). The old ~60×60 area around the origin becomes the **starting meadow**; the rest of the world opens outward from there.

At this scale a single contiguous field would feel _empty_, not _big_ — so the space is structured as **distinct zones radiating from the home meadow**, each with its own palette, prop kit, and **one or more landmarks ("weenies")** that rise above everything so there's always a next thing visible on the horizon to walk toward. Zones blend at the edges — no walls, no loading. Distances are tuned so the **nearest landmark of each zone is ~120–200 m from home** (a 30–60 s walk at the 4 m/s player speed — far enough to feel like a journey, near enough to reach in a session).

```
                       N  (deep woods — cool, shaded, dense)
        ┌───────────────────────────────────────────────────┐  +250
        │   ▲▲▲ pine forest        ▲▲ BIG OAK                │   ← Big Oak: tallest thing in the park,
        │   ▲ (dig spots,         ▲   (visible from far)     │     a horizon weenie from the meadow
        │      hidden den)                                   │
        │                              EAST GROVE             │
        │                            · LOOKOUT ·              │   ← Lookout Bench: a quiet destination
   W    │        · · · · · · · · · ·  BENCH  · · · · ·       │  E   revealed through the trees
 (rolling│      · ┌─────────────┐ ·                          │
 meadow,│      ·  │ HOME MEADOW │  ·   open grassland        │
 flowers│      ·  │  home post● │  ·   (gentle, safe)        │
  the   │      ·  │ (spawn 0,0) │  ·                         │
 default│      ·  └─────────────┘ ·                          │
 zone)  │        · · · · · · · · · ·                         │
        │                     ~~~~~~~~~~~~~~~~~               │
        │        riverbank    ~~~~  LAKE  ~~~~  ⌒ BRIDGE      │   ← Lake + Bridge: water landmark,
        │        (reeds,      ~~~~~~~~~~~~~~~~~               │     a long sightline across water
        └───────────────────────────────────────────────────┘  -250
                       S  (waterside — reeds, ducks, ripples)
       -250                                                +250
```

- **Home meadow (center):** the cozy default and tutorial space — the old park, now the heart of a bigger world. Warm yellow-greens, tall-grass patches, dense flowers, butterflies. Open and safe-feeling; everything else is reachable from here.
- **Deep woods (N):** cooler, darker greens, a real **pine forest** dense enough to break sightlines, the **Big Oak** landmark (a horizon weenie seen from the meadow), sniff/dig spots and a hidden "den." Where curiosity-driven exploration concentrates.
- **Lake + waterside (S):** a large body of water (a _flat translucent plane_ for now — verticality deferred, §9) with a narrow walkable shoreline band, reeds, lily pads, ducks that paddle away, and ripples when you or Datou approach. The deep-water core is blocked. The **Bridge** crosses a narrow neck — a photogenic landmark and a long sightline across the water.
- **East grove + Lookout Bench (E→center):** a quiet destination framed by tall trees, a flower-lined approach, and a distinctive bench silhouette. It is called the **Lookout Bench** in the flat-world release; the future heightfield can raise this area into a true hilltop vista without changing its gameplay role.

Because the world is large, treat it as **a few dense "islands of interest" connected by quieter grassland**, not a uniform field — the dense pockets (forest, lakeside, meadow heart) are where props and reactions concentrate; the connective grassland is the breathing room you walk through, kept sparse on purpose so the dense zones land.

**Paths:** a **main loop** from the home post out to each landmark and back, plus faint **side-trails** (breadcrumbed with stepping stones / lines of flowers) peeling off toward the hidden den, the lake's far shore, and the Lookout Bench. The current 14-tile S-curve becomes the meadow's local path; longer trails extend it outward. A single path "plays flat"; a branching trail network gives real route choices over a 500 m space.

**Edge treatment:** dissolve the hard 500×500 boundary by **clumping** trees, dense forest, hedges, and rocks along the perimeter so the edge reads as "the forest gets impassably thick" or "the water is too deep," not "the world ends." `clampToPark` (Player.ts:82) stays as the invisible backstop at `±250`.

---

## 2. Section A — Sightlines, landmarks, breadcrumbing

A 500×500 m world is large enough that the risk flips: instead of "you see everything at once," it's "you wander into empty grass and feel lost." The same techniques solve both — never reveal it all, and always keep a landmark on the horizon so the player is _pulled_ somewhere rather than aimless.

- **Block line-of-sight at mid-range.** The pine forest, hedge masses, and tall-grass stands break the view so the player sees fragments and is drawn to round them. The current all-edge tree placement does the opposite (keeps the center an empty bowl) — we move clusters _inward_ and vary their massing. On a flat plane (terrain deferred), **props do the occlusion work** the hill would otherwise do, so this is load-bearing, not decoration.
- **Horizon weenies — at least one per zone** (Big Oak, Lookout Bench grove, Bridge/Lake, plus the home post). Each is taller/more distinctive than its surroundings and **deliberately scaled to be visible across the open grassland** from ~150–200 m, so wherever you stand at least one "go there" pull is on the horizon. This is the Disney "weenie" rule, and at 500 m scale it's what prevents the open stretches from feeling empty. (Keep big landmarks inside the distance-fog cutoff — §4.3.)
- **Frame a reveal without elevation.** The East grove uses dense tree masses to hide the bench until the final approach, then opens into a quiet clearing. The future heightfield may turn this into an elevated vista, but the flat-world release must already make the destination satisfying.
- **Breadcrumb with rewards & contrast.** Lines of flowers, stepping stones, a curve of mushrooms, or a sparkle across the lake lead the eye and feet toward landmarks and secrets across the bigger distances. Players move toward **contrast and motion** — a bright prop against neutral grass, a flock of birds bursting up — not toward arrows. Use those, never UI markers.
- **Lure-and-reward.** Show a desirable thing slightly out of reach (a shiny under the bridge, a dig spot across the water) and make the player route around to it. Each detour is a micro-quest — and over a 500 m space these are what turn a long walk into a sequence of small goals rather than a trek.

---

## 3. Section B — Zoning & massing on a flat plane (the near-term richness)

With terrain deferred (§9), **the ground is a flat 500×500 plane for now** — so all the perceived richness must come from how the space is _zoned, massed, and dressed_. The good news: at 500 m scale, zoning + prop massing alone carries an enormous amount, because the player can't see across the whole world anyway. Verticality is designed below but parked as future work.

### 3.1 Near-term (flat plane): zoning, massing, scale

**Zone differentiation on a budget** (low-poly, near-zero texture cost):

- **Palette per zone.** Each zone gets a distinct base-green tint and prop kit — the cheapest way to make "somewhere else" read as elsewhere. (Meadow warm yellow-green; woods cool dark green; waterside teal/blue.) Use **gradient vertex colors** rather than textures (the Alba technique). At 500 m, a large flat plane benefits from a **subtle ground-color gradient between zones** so the transitions read even without elevation.
- **Dedicated prop kits** with **variant + spawn-weight** so clusters look organic, not stamped: meadow = tall-grass/flower/butterfly; woods = pine/fern/log/mushroom; waterside = reed/lilypad/rock/duck.
- **Massing does the verticality's job.** Since there are no hills to break sightlines, **prop massing is the occlusion**: a dense pine stand 5–8 m tall walls off a view as effectively as a ridge would. Use tall, clustered foliage at zone boundaries to create the "round the corner and the next zone reveals" beat on flat ground.
- **Clumping over even scatter.** Props in irregular clusters (the current evenly-jittered flowers read as monotonous), with **dense islands of interest separated by sparse connective grassland** (§1) so the world has rhythm rather than uniform density across 250,000 m². Clumping also dissolves straight edges.
- **Hero props carry the richness.** A handful of higher-detail heroes (the bench, the bridge, the Big Oak, a small fountain by the home post) do the heavy lifting; everything else is simple repeated kit — important at this scale, where there's a lot of ground to fill cheaply.
- **Scale-aware density / instancing.** 500×500 needs **far more props** than 60×60 to not feel barren — use `InstancedMesh` / merged geometry per kit per zone and **distance culling** so the prop count stays performant (see §8). Don't hand-place at this scale; spawn from per-zone weighted scatter (`zones.ts` + seeded scatter).

### 3.2 Future: verticality & terrain (fully deferred — §9)

**Designed, not built yet.** When the heightfield phase lands, two terrain moves transform the flat plane:

1. **Raise the hill ridge** (E→center): a gentle smoothed rise. Creates the vista landmark, hides the area behind it (a reveal as you crest it), and gives the eye something to climb.
2. **Sink the lake basin** (S): lowering one region adds verticality as cheaply as raising one, and gives water a real basin instead of a flat plane. The **bridge** spans it.

> **Implementation note — terrain (future):** the current ground is a single `PlaneGeometry(60,60,1,1)`. The near-term change only grows it to a flat `PlaneGeometry(500,500,1,1)`. The future terrain phase introduces a subdivided plane and a deterministic `height(x,z)` function, then threads that height through the player, Datou render state, camera, props, and POIs. We will not add a placeholder `terrain.ts` or slope plumbing during the flat-world phase; it does not improve the current interaction prototype.

---

## 4. Section C — Make it alive (reactivity + atmosphere)

A cozy world rewards curiosity with _visible change_ — and the dog is the built-in curiosity engine. These tie directly into the gameplay doc's POI / want systems.

### 4.1 Interaction loop and reactive elements

Every environmental interaction follows the same readable loop:

1. **Invitation:** contrast, motion, sound, or Datou's attention makes a nearby point interesting.
2. **Approach:** the player moves closer; Datou looks, slows, or leads without taking control away.
3. **Response:** ambient reactions fire automatically, while meaningful actions use one explicit contextual interaction.
4. **Confirmation:** animation + sound + a brief Datou reaction make the result unmistakable.
5. **Payoff:** the interaction reveals a route, creates a playful beat, or awards a persistent souvenir.

This separates **ambient reactions** from **consequential actions**. Grass rustling and birds scattering should happen on proximity. Digging up a souvenir or committing to a POI should require explicit player input so rewards never feel accidental. The existing click-to-pet behavior remains direct manipulation of Datou; environmental POIs should expose a single context-sensitive action rather than a different key for every prop. For the desktop prototype, bind that action to `E` and a clickable on-screen prompt, while keeping the action itself input-agnostic for later controls.

Trigger-volume reactions fire when the **player or Datou** enters a radius. Consequential rows also expose a contextual prompt when the player is close enough:

| Element             | Trigger                       | Feedback / result                                       | Ties into                                   |
| ------------------- | ----------------------------- | ------------------------------------------------------- | ------------------------------------------- |
| Bushes / tall grass | proximity                     | quick scale/rotate rustle + sound                       | ambient life                                |
| Birds               | proximity                     | small flock bursts upward and later re-settles          | motion as a visual lure                     |
| Butterflies         | proximity                     | disperse and re-settle                                  | meadow flavor; chase target for _play_ want |
| Lake shoreline      | contact/proximity             | short-lived ripple decal; splash in the shallow band    | waterside flavor                            |
| **Sniff spots**     | Datou enters radius           | Datou slows, focuses, sniffs; clue becomes visible      | _curious_ want → POI                        |
| **Dig spots**       | contextual action after sniff | Datou digs; souvenir is revealed and registered at home | explore payoff + daily souvenir             |
| Lookout Bench       | contextual action             | player and Datou pause; camera settles for a quiet beat | companionship / session pacing              |
| Ducks / rabbits     | proximity                     | paddle or dart away, then reset after cooldown          | "the world notices you"                     |

Reactive elements use a small state machine (`idle → invited → active → cooldown/reset`) rather than firing every frame. The environmental half of a POI is the prop and its feedback; the gameplay half decides why Datou cares and whether a reward is available.

**Interaction guardrails:**

- Keep prompts local and temporary; show one only when an action is available.
- Datou may suggest a destination, but normal movement and camera control always remain with the player.
- Never require pixel-perfect clicking on small world props. Use generous XZ trigger radii and the contextual action.
- A POI must not deadlock if the player reaches it before Datou; it can wait for or call Datou into the interaction.
- Repeated ambient interactions reset; daily rewards do not.

### 4.2 Environmental interaction verbs (manipulating the world)

The §4.1 loop covers _noticing_ and _reacting_. This section is the richer half: the **verbs that let the player and Datou change the world** — push, move, knock over, break/scatter, carry, throw, and use. These are what turn a pretty backdrop into a place you can _play with_. They are deliberately small, physical, and reversible — cozy, not destructive — and they reuse the existing kinematic collision model so nothing here needs the deferred physics engine.

#### 4.2.1 The verb set

Every interactable prop declares **which verbs it supports** (a small flags set in its `props.ts` definition), and the single contextual action (`E` / click-prompt from §4.1) resolves to the right verb by context. The near-term set:

| Verb                    | What it does                                                                                                                         | Example props                                                                   | Driver                            | Persistence                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------- |
| **Push / nudge**        | Continuous: the prop slides along the ground as the player (or Datou's body) presses into it.                                        | beach ball, pinecone, small log, fallen apple, snowball                         | collision push-out, reversed      | session (rests where left)                            |
| **Move / reposition**   | Discrete pick-up-and-place via the contextual action (no held-item carry needed).                                                    | flower pot, garden gnome, a stick onto a pile                                   | contextual action                 | session (or persisted if "tidying")                   |
| **Knock over / topple** | A one-shot tip-over animation + settle; the prop now lies on its side and reads as "disturbed."                                      | reed stalks, a stack of pots, a sign, tall grass tuft, a cairn                  | contextual action or Datou bump   | session, auto-rights after cooldown                   |
| **Break / scatter**     | A prop made of parts bursts into a few sub-pieces that scatter and settle (no gore — leaves, petals, splinters, pebbles, snow puff). | dry leaf pile, mushroom cap, dandelion puff, a stick, a snowman                 | contextual action or Datou pounce | session; some leave a small residue (a scatter decal) |
| **Carry / fetch**       | Player or Datou holds one small object and can drop/deliver it; the spine of fetch and "bring it home."                              | stick, ball, bone, found souvenir                                               | attach-to-mouth/hand transform    | until dropped/delivered                               |
| **Throw / toss**        | Releases a carried object with a simple ballistic arc; lands, bounces once, rests. Datou can chase.                                  | ball, stick (the core _play_ loop)                                              | simple projectile integrator      | lands as a pushable prop                              |
| **Use / activate**      | Trigger a prop's special behavior in place.                                                                                          | water pump (fills a trough → ripples), bell post (rings, scatters birds), swing | contextual action                 | momentary, some persistent (filled trough)            |

**Design rule:** the verb is a property of the _prop_, not a mode the player toggles. Walk up to a ball → prompt reads "kick"; walk up to a leaf pile → "jump in"; walk up to a stick → "pick up." One button, context-resolved, so the world feels uniformly interactive without a verb menu.

#### 4.2.2 Datou as an interaction agent (the 默契 hook)

The strongest, most on-brand interactions are the ones **you and Datou do together** — this is where environment manipulation feeds the companionship/tacit-understanding pillar:

- **Datou acts on the world on its own:** pounces a leaf pile (scatter), noses a ball (push), tips a light prop (knock over), digs (the existing dig POI). Driven by its current want/mood — a _curious_ Datou investigates; a _playful_ Datou pounces. These are the moments the diary loves to record.
- **Shared verbs:** you throw → Datou chases and **carries it back** (fetch); you point/lead toward a prop → Datou interacts with it; Datou brings you a found object → you take it (move/carry). The hand-off _is_ the bond beat.
- **Datou as a soft physics actor:** because Datou already has a body position + velocity in `DatouState`, its body can **push pushable props** just by walking into them (same reversed collision push-out as the player). No special-casing — Datou bumping a ball down a slope is emergent and delightful.

#### 4.2.3 How this works without the physics engine (kinematic model)

All verbs above run on the **existing kinematic, XZ-plane, circle-collision model** — no MuJoCo, no rigid-body solver, consistent with the flat-world phase:

- **Movable props are dynamic colliders.** Today colliders are static (`getParkColliders()`). We add a small set of **movable props** with `{x, z, radius, mass?}` whose position can change. A new `MovableProps` system owns them; each frame it (a) lets the player/Datou push them via the same `resolveCircleCollisions` math run in reverse (the _prop_ yields), and (b) applies light damping so a pushed prop coasts and settles. This is a tiny, well-understood 2D system — circles on a plane — not a physics dependency.
- **Push/throw use a 2-line integrator.** A pushed or thrown prop gets a planar velocity, integrates `pos += vel·dt`, decays `vel *= damping`, and resolves against static colliders + world bounds. Throw adds a cosmetic vertical arc (render-only `y`, since the ground is flat) that doesn't affect the XZ sim — cheap and stable.
- **Knock-over / break are animation state, not simulation.** "Toppled" and "broken" are _states_ of the prop with canned settle animations and optional scatter decals — they don't need a solver. The scatter pieces are short-lived particles, not persistent colliders.
- **Carry is a transform re-parent.** A carried object parents to the carrier's hand/mouth bone (or a fixed offset); drop re-parents to the world at the carrier's position. Identical pattern to how `Datou.ts` already parents tail/ears.

> **Why kinematic, not the engine:** the deferred MuJoCo phase could later make these props _truly_ rigid (real rolling, stacking, slopes). But the **cozy feel** — a ball you nudge, a leaf pile that scatters, a stick you throw — is fully achievable kinematically today, and stays deterministic for the diary (§6). When MuJoCo lands, movable props can graduate to real bodies behind the same prop interface, no gameplay rewrite. Flagged as the natural future upgrade, not a blocker.

#### 4.2.4 Persistence, reset & the cozy contract

Environment manipulation must stay _cozy_ — playful and consequence-light, never griefable or punishing:

- **Reversible by default.** Ambient disturbances (toppled reeds, scattered leaves, rustled grass) **auto-right / regrow after a cooldown** so the world heals and never accumulates damage. The park is always freshly pretty next visit.
- **Intentional persistence is opt-in.** A few acts _should_ stick because they're meaningful: a souvenir delivered to the home post, a stick added to a growing pile, a trough you filled, a flower that blooms where Datou dug. These persist via the planned `Storage` (IndexedDB) and are the visible "I changed this place" reward.
- **No destruction of landmarks or navigation.** Hero props and colliders that define routes (Big Oak, bridge, fences) are **not** breakable/movable — only small dressing is. This keeps the world legible and prevents the player from softlocking traversal.
- **Determinism preserved.** Movable-prop initial placement is **date-seeded** like the rest of daily dressing (§6); within a session the sim is deterministic given the same inputs, so the diary can faithfully replay "Datou knocked the pail into the lake."
- **Tone:** scatter is petals and leaves, never anything that reads as harm. "Destroy" here means _disturb and delight_, in the _Untitled Goose Game_-lite register — mischief without malice.

#### 4.2.5 Code mapping

- **New `src/game/MovableProps.ts`** — owns the dynamic-collider list, the push/throw integrator, and topple/break/carry state machines. Stepped from `Game.tick` right after `physics.step` (so it sees the latest player + Datou positions). Pure XZ math; unit-testable like `collision.ts`.
- **`props.ts` (from §5.1)** gains a `verbs` flag set + `movable`/`breakable`/`carryable` metadata per prop, and emits the cosmetic scatter/topple animations.
- **`Reactive.ts` (§5.1)** already routes the contextual action; it dispatches to the prop's resolved verb.
- **`collision.ts`** is reused as-is for the prop-vs-static and mover-vs-prop resolution — same circle math, the proven path.
- **No `PhysicsAdapter` change.** Movable props are a game-layer system; the adapter still only simulates Datou's locomotion. (The future MuJoCo upgrade in §4.2.3 would be additive.)

#### 4.2.6 Sprint phasing for verbs

Not all at once — sequence by payoff:

1. **Carry + throw + fetch** (the _play_ core) — highest emotional payoff, directly serves the bond/play want. Ship first.
2. **Push/nudge** (ball, pinecone) — emergent delight, tiny code on top of (1)'s integrator.
3. **Scatter/jump-in** (leaf piles, dandelions) — cheap, seasonal, very cozy.
4. **Knock-over + use** (reeds, pump, bell) — flavor and small puzzles, lands with the zone build-out.

### 4.3 Atmosphere (ranked by cozy-payoff-per-effort)

1. **Warm color grade + directional sun.** The cheapest mood transformation; color does most of the emotional work (Alba's whole feel is a warm palette). A subtle warm LUT / tone tweak + the existing `sun` light tuned warmer, gentle bloom.
2. **Distance fog — already present, now load-bearing.** At 500 m it does triple duty: cozy mood, hiding the world's _far_ edges, and **bounding draw distance for performance** (fade distant props/zones into the sky so they needn't render at full detail). Tune the fog `near/far` outward from the current `28/70` to suit the new scale (e.g. fog reaching ~120–180 m), keep big landmarks _inside_ the visible band so they read as horizon weenies, and fade to the sky color (already `0xd9eef7`). The camera `far` plane (`200`, CameraRig.ts:42) and `MAX_DIST` zoom (`32`) likely need raising for the larger world — coordinate fog far with the far plane so culling and fog agree. Shift fog color with time-of-day (§4.4).
3. **Ambient particles.** Drifting pollen motes in sun shafts by day; **fireflies at dusk/night**; occasional falling leaves (autumn). A few low-count emitters add enormous life.
4. **Wind on foliage.** A simple vertex-shader sway on grass/trees/flowers makes the static scene feel like it's breathing. One shader applied across the foliage kit.
5. **Ambient + foley sound.** Gentle layered birdsong, rustling leaves, water lapping, wind, plus paw/footstep foley (grass crunch, splash). Core to a "sense of place." (Hooks only this sprint; assets later.)

> **Tone guardrail:** keep the register light — ~85–90% whimsical, the occasional gentle moodier beat (a quiet dusk). The cozy baseline always dominates.

### 4.4 Daily / seasonal change (why you come back tomorrow)

The same path at dusk, or in autumn, feels like a new place — this is what keeps a _static_ park fresh for a daily-visit game.

- **Real-time day/night cycle.** Lerp the sun angle + sky/fog color across morning→noon→dusk→night; swap motes→fireflies; change which creatures appear (birds by day, owls/fireflies at night). The existing single sun + fog are exactly the knobs this drives.
- **Daily procedural dressing.** Re-scatter sniff/dig spots and collectibles to new positions each real-world day (deterministic from the date seed — see §6) so the park is re-explorable without new geometry. Pairs with the gameplay doc's once-per-day explore gate.
- **Seasonal palette swap (longer-term).** A lightweight 4-season swap of the foliage palette (green → autumn orange → snow → spring blossom) makes the same map feel cyclically fresh and seeds long-term collection goals (season-gated butterflies/creatures, _Cozy Grove_ style).
- **Small persistent changes.** A sapling you pass is taller next week; a flower blooms where Datou dug; the bird box you find gets occupants. Returning feels rewarded, not repeated.

---

## 5. How this maps onto the existing code

The redesign extends the existing `World.ts` seams; **no `PhysicsAdapter` break is required.** `World` already cleanly separates the visual build from the collider list, and exposes both a free `getParkColliders()` and an instance `getColliders()` consumed by the player and the physics backend (`Game.ts:53-57`). The first implementation grows that flat-world structure and adds interaction systems around it.

### 5.1 New / changed modules

```
src/game/
├── World.ts            CHANGE  grow ground to 500×500 (flat for now); build zones
│                               (palette + prop kits) instead of one green plane;
│                               landmarks (oak, bench, bridge, fountain); trail net.
├── zones.ts            NEW     zone definitions: bounds (at 500-scale), palette,
│                               prop-kit + spawn weights. Consumed by World's build
│                               + dressing. Drives the per-zone scatter/instancing.
├── props.ts            NEW     low-poly prop factory (grass, reed, mushroom, rock,
│                               duck, bench, bridge, ball, stick…) as THREE.Group /
│                               InstancedMesh builders (procedural — no glTF, §9).
│                               Each prop declares its interaction `verbs` flags +
│                               movable/breakable/carryable metadata (§4.2.1).
├── MovableProps.ts     NEW     dynamic-collider list + push/throw planar integrator
│                               + topple/break/carry state machines (§4.2). Stepped
│                               from Game.tick after physics.step. Pure XZ math,
│                               unit-tested like collision.ts. No engine dependency.
├── ambient/
│   ├── DayNight.ts     NEW     drives sun angle + sky/fog color + particle swap by
│   │                          time-of-day. Reads/writes the scene's sun + fog.
│   ├── Particles.ts    NEW     motes / fireflies / leaves / scatter bursts (capped).
│   ├── Wind.ts         NEW     vertex-sway shader hook applied to foliage.
│   └── Reactive.ts     NEW     trigger state machines → invite/activate/reset;
│                              owns rustle/scatter/ripple feedback.
├── Interaction.ts      NEW     chooses the nearest eligible contextual action,
│                               resolves it to the prop's verb (§4.2.1), and exposes
│                               prompt/activate state to Game + UI.
└── dressing.ts         NEW     daily re-scatter of sniff/dig/collectible/movable
                                spots, seeded by the calendar date (deterministic).
```

`pois.ts` / `Poi.ts` from the gameplay doc consume `Reactive.ts` for the "Datou reacts here" beat and register consequential actions with `Interaction.ts`; the _play_ want (throw/fetch) and Datou's autonomous pounces drive `MovableProps.ts` — the two docs meet here.

### 5.2 Flat-ground contract now; heightfield as a future migration

The contract already says `DatouState.position.y` is **feet height**, "so on flat ground y = 0" (`PhysicsAdapter.ts:30`). During the current phase:

- **Player, POIs, and props:** use `y = 0`.
- **Datou:** continues to consume the backend's feet-height contract; both current backends report `y = 0` on flat ground.
- **Camera:** continues to orbit a constant-height pivot.

The future heightfield phase adds `terrain.ts` and updates these callers together, with focused grounding tests. A later phase may also feed the same heightfield into MuJoCo, but that is optional and does not require changing `PhysicsAdapter`.

### 5.3 Colliders & camera — reuse what's there

- **Colliders:** landmarks (oak trunk, bench, bridge posts, fountain), dense-forest perimeter, and the **lake's deep-water core** extend the existing `getParkColliders()` list (`World.ts:44`). Player push-out (`resolveCircleCollisions`, used in `Player.update`) and the backend's collision both already consume this list — one source of truth, unchanged plumbing. Leave a narrow shallow shoreline band outside the collider so player/Datou ripple and splash interactions can fire; the lake remains a flat visual plane, not a basin, until the heightfield ships.
- **Camera:** `CameraRig` already orbits/zooms and lerps a pivot at `PIVOT_HEIGHT`. Two near-term tweaks for the 500 m world: raise the **`far` plane** (currently `200`, CameraRig.ts:42) and likely the **`MAX_DIST` zoom-out** (currently `32`) so landmarks remain readable, in concert with the new fog far (§4.3). The future terrain phase will make the pivot follow ground height.
- **Player bounds:** bump `PARK_HALF` (Player.ts:13, currently `28`) and the backend's `PARK_HALF_EXTENT` to the new `±250`, and likely the base move `SPEED` (currently `4 m/s`) so crossing 500 m doesn't feel like a slog — or rely on `follow`/`explore` auto-traversal and a faster "let's go" lope for long hauls.
- **Lighting / fog:** `Game.setupLights` already builds the sun, hemi, ambient; `scene.fog` already exists. Shadow-camera frustum (`±28`, Game.ts:100-103) covers only the old park — at 500 m, **don't widen it to cover everything** (shadow quality would collapse); keep it tight around the player/camera and let distant geometry fog out. `DayNight.ts` animates sun/fog parameters per frame — no new scene structure.

### 5.4 Does `PhysicsAdapter` change? — No.

Zones, props, ambient, interactions, reactivity, and dressing are all **game/render-layer**. Physics keeps reasoning on the flat XZ plane with the same modes/targets. The contract is untouched (same conclusion as the gameplay doc).

---

## 6. Determinism (keeps the diary honest)

The MuJoCo design already specs deterministic replay for the AI diary (`docs/MUJOCO_DESIGN.md` §4.7: seeded RNG + input log). The environment must not reintroduce nondeterminism:

- **Daily dressing is date-seeded**, not `Math.random()`. Reuse the existing seeded PRNG (`src/physics/mujoco/rng.ts`, mulberry32) keyed by the calendar date so "today's park" is identical across reloads and reconstructable when the diary replays the session. (The current `World.buildTrees/buildFlowers` use raw `Math.random()` for _static cosmetic_ jitter — fine, because it never affects gameplay or replay; new _gameplay-relevant_ placement must be seeded.)
- **Reactive reset timing and rewards are game-state driven.** Cosmetic particles may vary, but POI availability, action completion, and souvenir awards must be reconstructable from the daily seed + input/event log.

---

## 7. Build priority (highest impact first) & sprint fit

Ordered by perceived-richness-per-effort, matching the research's recommendation:

1. **Flat-world scale + navigation structure** — grow the ground and bounds to 500×500 m; add zones, occluding prop masses, landmarks, and a forked path. _Now there is somewhere to go without relying on terrain._
2. **Core interaction slice** — implement one complete sniff → contextual dig → souvenir loop plus ambient grass/bird/water reactions. _Validates the player/Datou/environment relationship before multiplying content._
3. **Manipulation verbs (§4.2)** — `MovableProps.ts` + the verb set, sequenced per §4.2.6: **carry/throw/fetch first** (the play core), then push/nudge, then scatter/jump-in, then knock-over/use. _Turns the backdrop into something you can play with; directly serves the play/bond want._
4. **Interaction readability** — prompts, cooldown/reset behavior, generous trigger volumes, animation/SFX hooks, and the Lookout Bench pause. _Makes actions discoverable and outcomes clear._
5. **Atmosphere** — warm grade, tuned fog, foliage wind, and capped motes/fireflies. _Adds cozy mood without changing the interaction model._
6. **Daily dressing + configurable seasonal clock** — deterministic POI + movable-prop re-scatter, then palette/creature changes driven by an injectable clock. _Creates return freshness and remains testable._
7. **Additional prop kits, verbs, and POI templates** — expand only after the core loop tests well. _Content follows proven behavior._

**Sprint fit (aligns with the gameplay doc & roadmap):**

- _Sprint 1 stage work:_ item 1 plus minimal atmosphere — a navigable flat park with readable destinations.
- _Sprint 2 (Explore):_ items 2–4 land alongside POIs — the sniff/dig slice and the carry/throw/fetch verb core — followed by deterministic daily dressing.
- _Sprint 2–3:_ items 5–7 deepen mood, manipulation depth, and daily return after the interaction slice is validated.

Each step is independently shippable. Do not build all reactions or all verbs at once: ship the sniff/dig/souvenir slice and the carry/throw/fetch core, test them, then reuse the same trigger/action/verb contracts for the rest.

---

## 8. Verification

- **Visual / manual:** `npm run dev` — confirm you _cannot_ see all four edges from any ground position; each zone reads as distinct; landmarks pull you toward them; and the East grove reveals the Lookout Bench only on approach. Walk each route and confirm the flat water plane, paths, props, player, and Datou all sit at the intended `y`.
- **Interaction slice:** find a sniff spot, observe Datou's invitation, activate the contextual dig, receive clear audiovisual confirmation, and verify the souvenir appears at home. The action must remain available if the player reaches the spot before Datou.
- **Manipulation verbs (§4.2):** kick/push a ball and confirm it slides, coasts, settles, and resolves against static colliders + world bounds; throw a stick and confirm Datou chases, carries, and returns it (fetch); jump into a leaf pile and confirm it scatters then regrows after cooldown; confirm Datou's body pushes a pushable prop just by walking into it; confirm landmarks/route colliders are **not** movable or breakable. A persisted act (souvenir at home, stick on a pile) survives reload; an ambient disturbance heals.
- **Reactivity:** approach bushes/birds/lake with both player and Datou → reactions fire once per entry, enter cooldown, and reset without firing every frame.
- **Control:** movement and camera remain responsive during Datou invitations; only one contextual prompt appears; small props do not require precise pointer hits.
- **Determinism:** load the page twice on the same date → identical dig/collectible placement; change the (mocked) date → placement changes. A unit test asserts `dressing` is a pure function of the date seed.
- **Unit tests (vitest, repo convention — cf. `collision.test.ts`):** `getParkColliders()` includes blocking landmarks and lake boundaries; zone lookup returns the right zone per coordinate; trigger state transitions and nearest-action selection are deterministic; rewards cannot be granted twice; `MovableProps` push/throw integration is deterministic given the same inputs, props never tunnel through static colliders or leave the park, and verb resolution (`Interaction` → prop verb) picks the right verb per prop.
- **Clock tests:** inject fixed times to verify day/night and seasonal transitions without depending on the machine clock. The prototype may run accelerated; production cadence remains configuration, not hard-coded behavior.
- **Perf:** particle counts capped; instanced/merged foliage; confirm 60 fps on a mid laptop with the flat ground + props. Keep an eye on draw calls and trigger-query cost; only nearby interactions should update at full frequency.
- **CI:** `typecheck`, `lint`, `build` stay green; no `PhysicsAdapter` change.

---

## 9. Decisions and deferred work

| Topic               | Decision now                                                                                                                       | Deferred option                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Ground              | Flat 500×500 m plane                                                                                                               | Deterministic heightfield with raised East ridge and lowered lake basin                                      |
| Slope physics       | None; player and both physics backends remain on flat XZ ground                                                                    | Render-conforming height first, optional MuJoCo heightfield later                                            |
| Water               | Flat translucent plane + short-lived ripple decals                                                                                 | Animated shader surface only if the cheap treatment fails visually                                           |
| Object manipulation | Kinematic movable props (push/throw/carry/topple/break/use) on the existing XZ circle-collision model; cozy, reversible-by-default | Graduate movable props to real MuJoCo rigid bodies (rolling, stacking, slope) behind the same prop interface |
| Seasons             | Configurable clock with accelerated prototype/test presets                                                                         | Choose the production cadence after playtesting                                                              |
| Props               | Procedural `THREE` primitives, instanced/merged where useful                                                                       | Revisit glTF only when a specific asset cannot be expressed economically                                     |

The heightfield should be designed and implemented as one later project, not partially scaffolded into the interaction-focused flat-world work. The trigger/action contracts, daily seeds, zone IDs, and landmark roles should remain independent of ground elevation so that future terrain changes presentation without rewriting gameplay.
