# Community Landmark Plan — A Park That Leads Somewhere

**Status:** Implemented through Phase 2 (2026-06-11) — Phases 0–2 are in the
codebase (`src/world/landmarks.ts`, `src/game/LandmarkDirector.ts`,
`src/art/landmarkProps.ts`); the full Commons → Garden → Camp chain runs with
coffers, clues, the donation socket, and the ruin-stones response. **Next:**
the Phase 1 exit gate (a first-time playtest of the Commons slice) and the
Phase 3 polish layers.  
**Date:** 2026-06-10  
**First slice:** One complete authored area (Trail Repair Commons), then two more
connected by a Datou-led discovery chain

## 1. Goal

Turn the current 500 m park from a field of repeated props into a place the
player can remember, describe, and become curious about — **with Datou as the
one who gets curious first.**

The loop the first release must create:

> Datou notices something far away → the player follows their companion's
> attention → they travel together → do one local activity together → find a
> community supply coffer → build something from its blueprint → leave a
> visible change → Datou notices the next place.

Success is not "the map contains more objects." Success is that a player says:

- "Datou heard the chime before I saw anything — we found the repair stop
  together."
- "We restarted the water garden, and it pointed us toward the old relay camp."
- "I want to go back because the place changed and there is still something
  unresolved."

This direction serves the product north star directly: **make Datou feel
alive.** A landmark the player finds by following a map marker is content; a
landmark the player finds by trusting Datou's ears is companionship. Every
mechanism below routes discovery through the robot wherever possible.

The community-made framing fits the existing game: the Workshop already
produces furnishings and tools, resource nodes imply a local material economy,
and Datou is a worker-companion robot. Landmarks are useful, handmade places
with evidence of previous visitors — not monuments.

## 2. What the Codebase Already Gives Us

This revision is grounded in a code survey (2026-06-10). The plan reuses these
systems rather than inventing parallel ones:

| Need                       | Existing system                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Anchor locations           | `layout.ts` already places the trail cluster (bench 128,−32 · signpost · bulletin · picnic), lake jetty (21,122) + reed ring, Old Pine (−120,−110) + mushroom ring, and **ruin stones at (168,−158)** for the far mystery |
| Full-blueprint reward      | `WorkshopState.bankHint(hint)` with **all 9 cells revealed** — exactly what the home starter coffer already grants     |
| Material grants            | `Backpack.add(id, n)`; the backpack `Map` holds any `ItemId`, uncapped                                                  |
| Blueprint patterns         | `chime`, `planter`, `wayfinder` are already authored `EXACT_PATTERNS` (see §7 for the verified bundles)                 |
| Coffer prop                | `drawCoffer(seed, isOpen)` in `art/props.ts`, with open/closed states — needs accent variants only                      |
| Datou pointing at things   | The want loop's `curious` expression: `{ kind: 'curious', dirX, dirZ }` — head tilt + gaze toward a POI, already anchored to real undiscovered spots |
| Cooperative animation      | DatouRig arm reach/carry poses, eye plates (5 states), head lift/rot, sit and play-bow postures                         |
| Memory + bond              | `Companion` memory events and milestone cards, persisted                                                                |
| Persistence convention     | `wwd.*` localStorage keys, daily keys as `wwd.spots.<yyyymmdd>`                                                         |
| i18n                       | `src/i18n.ts` EN/ZH with parity test; `place.*`, `thing.*`, `coffer.*`, `memory.*` domains in use                       |

What does **not** exist and must be built: an authored-area data layer, scatter
clearings around authored compositions, the area-specific props/sprites, the
three cooperative activities, and landmark-aware Datou wants. That is the real
scope — everything else is wiring.

## 3. Current Design Review (unchanged diagnosis)

The world has a strong close-up style and a pleasant home glade, but weak
large-scale identity:

- `layout.ts` destinations are mostly enlarged ordinary props — they mark
  coordinates without creating memorable places.
- Repeated cutout scatter makes distant areas visually interchangeable.
- Daily spots reward arrival but rarely motivate the journey.
- Generic prop reactions end in a toast; they reveal no local history and
  change nothing.
- The fully revealed minimap tells the player the park's shape before play does.

The core problem is **uniform information value**: every direction promises
roughly the same flowers and reactions. Curiosity needs a visible information
gap and evidence that resolving it produces something specific.

## 4. Research Applied

Five findings from level-design research (references in §13):

1. **Landmarks must attract and identify** — contrast, silhouette, light, and
   motion beat raw prop size.
2. **Partial concealment creates questions** — obstruction, out-of-place
   objects, and spatial connections drive exploration.
3. **A discovery should open the next information gap** — clues suggest, never
   expose.
4. **Breadcrumbs must preserve agency** — environmental lines and companion
   attention, not objective markers.
5. **Places need thematic beats** — approach, reveal, activity, payoff,
   aftermath.

One finding this game adds: **a companion is the best breadcrumb.** Datou's
gaze is diegetic, warm, ignorable, and already implemented. Use the robot
before adding any environmental signage.

Practical rule:

> Every authored area gets a unique silhouette, a Datou sense, a cooperative
> activity, a persistent change, and a clue toward another area.

## 5. Area Design Grammar

Each area uses the same template. **Seven required layers** (down from eleven —
the cut layers return as polish, §11 Phase 3):

| Layer            | Requirement                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------- |
| **Datou sense**  | A robot-appropriate way Datou notices the area from afar (sound, smell, signal) that drives curious-want gazes |
| **Distant lure** | One tall silhouette + one slow accent (lamp warmth, cloth sway) readable before individual props |
| **Approach**     | A 20–40 s route with two breadcrumbs and one partially blocked view                           |
| **Heart**        | A compact composition of 3–5 related props, not one isolated object                           |
| **Local verb**   | One cooperative activity: the player is the hands, **Datou is the instrument or partner**     |
| **Coffer**       | One community supply coffer: full blueprint + exact starter materials (§7)                    |
| **State change + clue** | A visible persistent improvement, and a diegetic hint toward the next area             |

Optional layers, added only after the core works: threshold prop, secret,
revisit variation, donation socket.

Density in three rings:

- **Horizon ring (40–120 m):** silhouette + one accent only. ⚠ Verify in
  Phase 0 how far a 7–9 m plate actually reads at the normal follow camera —
  if visibility is shorter than hoped, **Datou's sense is the primary lure
  channel and the silhouette is secondary**, not the reverse.
- **Approach ring (10–40 m):** breadcrumbs, framing masses, small evidence.
- **Activity ring (0–10 m):** unique props, interaction, readable state,
  coffer.

Quiet connective meadow stays quiet. Contrast is the budget.

**Baseline guardrails** (binding, per `DESIGN_BASELINE.md`): amber lamp
"rhythm" means slow breathing on a lamp glow, never blinking; ribbons and
pennants sway on wind curves, never flap frantically; the relay's
"intermittent pulse" is a soft 4–6 s breath. ≤ 3 dominant colors per area, one
accent each. No new UI markers anywhere in this plan.

## 6. The Datou Thread (new)

The chain is companion-led. Implementation is one small extension to the
existing want loop:

- Add landmark areas as **high-priority curious-want anchors**. When the
  player is within a landmark's notice radius (~60–80 m) and the area is
  `unseen`, Datou's next curious want anchors to it: he stops, ears up, head
  turns, holds the gaze longer than a normal want. Each area gets a bespoke
  notice beat: he *hears* the chime (head cocks side to side), *smells* the
  water (low head, sniff cadence), *feels* the relay (he is a robot — a brief
  full-body still, then LED-soft attention; the only one of the three the
  player could never sense alone).
- **First hook, scripted once:** the session after the home starter coffer has
  been opened and one item made, Datou throws a strong curious want toward the
  Repair Commons from the home glade. No UI, no toast — just the robot looking
  east, refusing to drop it for a few beats. Following him is the tutorial.
- Datou may lead 3–4 steps toward a noticed area, then look back — the
  existing guided-approach pattern from Spots. He never takes movement control.
- Within 4–6 m of an unopened coffer, Datou gives the coffer tell (existing
  spot-discovery posture + a new sniff/paw beat). The player still chooses.
- Personality shades presentation only: an Explorer notices at longer range
  and leads sooner; a Calm Datou holds a longer, softer gaze. Every
  personality can complete everything.

Why this is the attractive version: the player's memory of finding each place
*contains Datou*. The discovery chain doubles as relationship content, and it
costs one want-anchor extension instead of a signage system.

## 7. First Three Areas

Starter bundles below are **verified against `EXACT_PATTERNS`** (chime =
4 plant + 1 found · planter = 7 wood + 1 plant · wayfinder = 3 found ×stacks +
2 stone), and all named materials exist in the `materials.ts` registry with the
right groups.

### A. The Trail Repair Commons

**Location:** the existing east-trail cluster (bench, signpost, bulletin board,
picnic table at ~124–138, −22..−44). Tighten the composition; the picnic table
may move ~10 m north to join the heart.

**Identity:** a friendly volunteer repair stop — mismatched wood, fabric, old
robot panels, amber safety lamps. Accent: **amber + patchwork rectangles.**

- **Datou sense:** he hears the tangled chime knocking in the wind from the
  meadow. Head-cock beat.
- **Distant lure:** one tall pennant mast (8–9 m, asymmetric silhouette), warm
  amber lamp breathing at dusk-tone.
- **Approach:** curve the existing path behind a bush/fence mass so the
  commons is not visible from home; breadcrumbs are dropped fasteners and one
  patched fence run.
- **Heart:** mast + bulletin board + workbench lean-to + the existing bench
  and signpost.
- **Activity — repair the message chime:** the chime hangs tangled, missing
  one part. Player inspects; Datou braces the post (arm reach pose) while the
  player supplies one common material. Completion animates the chime, lights
  the lamps, pins a new notice to the board. Memory card written.
- **Coffer — chime supply box:** patched lid, tucked under the bulletin-board
  steps, visible from the back of the heart, not the entrance. Datou paws at
  the stuck amber latch; player opens. Grants the full **`chime`** blueprint +
  `flower ×4, feather ×1` + a maker note: chimes marked friendly rest stops.
- **State change + clue:** lamps stay lit; chime sounds when the player passes
  (audible re-lure for returns). The new notice shows a water-stained pump
  garden sketch; a blue ribbon is tied to the board's lake-side corner, and
  ribbon scraps continue along the lake path.

### B. The Reedwater Pump Garden

**Location:** the existing lake jetty (21, 122) and reed bank.

**Identity:** a handmade wetland garden — a small robot-compatible pump once
watered floating planters. Accent: **water-blue + curving lines.**

- **Datou sense:** wet-earth smell — low head, sniff cadence, a small happy
  tail-less wiggle (rig shoulder roll).
- **Distant lure:** blue cloth sails and a crooked pump wheel above the reed
  line; the reed wall hides the center (the scatter system's existing reed
  ring does the concealment for free).
- **Approach:** blue ribbon scraps become irrigation hose and painted stakes;
  cross the jetty, round the reed screen, reveal pump + planters + a tiny rest
  platform.
- **Activity — restart the water loop:** player rotates/reconnects two channel
  pieces; Datou runs the pump in calm beats (carry/press pose, the bucket-fill
  visual language reused). Water visibly travels; paper plants lift and gain
  color.
- **Coffer — planter tool chest:** blue-lidded, lodged in a dry side channel
  behind the rest platform, so the optional path pays concretely. Datou braces
  the warped lid (existing brace pose); player releases two catches. Grants
  the full **`planter`** blueprint + `twig ×7, reed ×1` + a water-damaged
  sketch showing an empty planter socket in the garden.
- **State change + clue:** the garden stays watered and colored; one planter
  socket accepts the player's crafted planter (the first **donation socket** —
  install it here or place it anywhere). A floating marker drifts to the far
  channel carrying a triangular relay symbol; one planter holds pine needles
  and a stamped relay tag that does not belong at the lake.

### C. The Old Pine Relay Camp

**Location:** the existing woods heart — Old Pine (−120, −110) and the
mushroom ring.

**Identity:** a sheltered field camp where volunteers ran a low-tech park
relay from salvaged robot parts. Accent: **charcoal + triangles.**

- **Datou sense:** he *feels* the dormant relay — a full-body pause, then
  quiet fixed attention. Uncanny in a warm way; only Datou could find this.
- **Distant lure:** a narrow relay mast with three offset vanes breaking the
  tree line; a soft amber breath (4–6 s period) between trunks, intermittent
  because trunks occlude it as the player moves — motion from parallax, not
  blinking.
- **Approach:** pines block the direct view; triangular marks and cable ties
  wind the route; the final tree screen opens into the camp: mast, tool
  shelter, log seats, cable spool, Old Pine as canopy.
- **Activity — tune the relay together:** the player rotates two signal vanes;
  **Datou is the meter** — head direction, ear lift, and LED softness indicate
  alignment strength. Correct tuning wakes the mast, lights the camp, and
  plays one distant response tone.
- **Coffer — relay field case:** a narrow metal case in the hollow beneath Old
  Pine, reading as manufactured only after the player has followed the
  triangular marks. Datou detects a dormant signal in the latch and holds the
  case steady; the player opens it. Grants the full **`wayfinder`** blueprint
  + `old-bolt ×3, pebble ×2` + a relay-network fragment bearing an unfamiliar
  mark.
- **State change + next mystery:** the mast stays awake, camp lit. Camp logs
  say the relay helped lost park robots find community shelters. The response
  tone and fragment carry the mark of the **existing ruin stones at the
  meadow's far corner (168, −158)** — the next expansion target already
  standing in the world, requiring nothing new in this slice. The crafted
  wayfinder is a placeable keepsake; it never becomes a navigation arrow.

## 8. Curiosity Chain

`Home → Repair Commons → Pump Garden → Relay Camp → ruin-stones signal`

Rules:

- Every clue names a **quality**, not a coordinate: chime sound, blue ribbon,
  wet earth, triangular marks, an amber breath between trunks.
- Datou notices and gazes; he never takes control.
- Finding a later area early is valid — its activity completes normally, and
  the earlier clue becomes recognition instead of waste.
- Clues persist after discovery so the player can reconstruct the network.
- Each completed area adds a small hand-drawn symbol to the minimap.
  **The map otherwise stays as it is** — fully painted terrain, click-to-walk
  intact. We are not building fog of war; the symbols are the reveal layer.
  (If playtests show the painted map kills anticipation, revisit then — not
  speculatively.)

## 9. Community Coffer Reward Loop

Coffers are old volunteer supply containers — consistent with a community-made
park, no fantasy-treasure tone. The home starter coffer already established
the visual and mechanical language; these three are its themed siblings.

### Reward contract (uses existing APIs)

Opening a coffer runs one synchronous handler:

1. `workshopState.bankHint({ pattern, revealedCells: ALL_NINE, context })` —
   a fully revealed hint **is** the full blueprint; this is exactly how the
   home coffer works today. `bankHint` already dedupes by pattern, so a
   blueprint the player has independently discovered is naturally a no-op.
2. `backpack.add(...)` for each starter material.
3. Set the area's `cofferOpened` flag and save the landmark state
   (`wwd.landmarks`).
4. Write the shared memory event (area + blueprint).
5. Swap the prop to its open state (`drawCoffer(seed, true)` variant) —
   permanently, preserving where the reward came from.

All five steps run in one frame with synchronous localStorage writes; no
cross-system receipt ledger is needed. If the blueprint is already known the
materials still grant. Coffers never refill — renewable materials remain the
job of gathering, foraging, and nodes.

| Area                  | Blueprint   | Starter materials          | Intended first use                            |
| --------------------- | ----------- | -------------------------- | ---------------------------------------------- |
| Trail Repair Commons  | `chime`     | `flower ×4`, `feather ×1`  | Place at home or donate to the Commons         |
| Reedwater Pump Garden | `planter`   | `twig ×7`, `reed ×1`       | Place freely or install in the garden socket   |
| Old Pine Relay Camp   | `wayfinder` | `old-bolt ×3`, `pebble ×2` | Placeable keepsake; no navigation automation   |

The coffer grants the *opportunity*, not the object: the player still arranges
the materials on the bench and gets the making moment. The bundle is exactly
one build — spending it teaches the pattern's shape by hand.

### Material support (small, real task)

`reed`, `feather`, and `old-bolt` already exist in the `MaterialId` registry
and the backpack `Map` can hold them. What's actually needed: backpack-UI
display entries, `thing.*` i18n keys (EN+ZH), and pickup sprites if any later
become gatherable. No second material list — `materials.ts` stays the source
of truth.

### Placement and discovery rules

- Visible from at least one observation angle inside the activity ring; never
  directly in front of the landmark's main face.
- Datou gives the coffer tell within 4–6 m (§6); the player chooses.
- Opening is a short cooperative beat per container: paw a latch, brace a
  lid, steady a case.
- No coffer requires a tool, key, bond level, or another landmark.

## 10. System and Content Changes

### Authored area data (new module, e.g. `src/world/landmarks.ts`)

```ts
interface LandmarkArea {
  id: 'repair-commons' | 'pump-garden' | 'relay-camp';
  center: { x: number; z: number };
  noticeRadius: number;   // Datou sense range (~60–80)
  activityRadius: number; // ~10
  state: 'unseen' | 'noticed' | 'arrived' | 'completed';
  cofferOpened: boolean;
  coffer: {
    blueprintPattern: string;            // existing EXACT_PATTERNS key
    materials: Partial<Record<MaterialId, number>>;
  };
  clueTo?: LandmarkArea['id'];
}
```

Persisted under `wwd.landmarks` (versioned like `wwd.workshop`). Exact prop
placement stays curated in `layout.ts`.

### Scatter clearings (small change to `scatter.ts`)

Add an authored `CLEARINGS: { x, z, r, density }[]` list consulted in
`placeable()` — the same shape as the existing lake-moat check. Full exclusion
inside the activity ring, damped density in the approach ring. No general
mask system.

### Landmark props (the real cost — budget it)

≈ 4–6 new sprites per area, reusing existing props as supporting cast:

- **Commons:** pennant mast, chime mechanism (tangled/repaired), lean-to,
  patched-coffer variant. Reuse: bench, signpost, bulletin, picnic, lamp,
  fence.
- **Garden:** pump wheel + sails, channel pieces (dry/wet), floating planters
  (wilted/lifted), blue-coffer variant. Reuse: jetty, reeds, rocks.
- **Camp:** relay mast (dormant/awake), tool shelter, cable spool, field-case
  variant. Reuse: Old Pine, mushrooms, logs, stones.

All drawn in the existing seeded-Rng cutout style (`src/art/`), one accent
color each.

### Interaction and activity state

- Per-area activity state on `LandmarkArea` (`idle → engaged → datou-working →
  completed`) — **as plain area code first**; extract a shared state machine
  only when building area 2 shows what is actually common.
- Replace toast-only reactions at landmark props with physical response,
  animation, and the world-state change.
- Emit existing-format memory events (area, activity, Datou mood).

### Companion behavior (`Companion.ts`)

- Landmark notice anchors for curious wants (§6), with per-area beat styling.
- The one scripted first-hook want toward the Commons.
- Coffer tell within 4–6 m of an unopened coffer.

### Map (`Minimap.ts`)

- Draw a hand-drawn area symbol for `arrived`/`completed` areas; connection
  strokes on completion. Nothing else changes.

## 11. Implementation Sequence

Re-phased for this repo's proven rhythm (small vertical slices, W1–W8 style):
prove one complete area before generalizing anything.

### Phase 0 — Groundwork (thin)

- `LandmarkArea` data + `wwd.landmarks` persistence + state transitions
  (unit-tested).
- Scatter `CLEARINGS` in `placeable()` (unit-tested).
- **Sightline check:** headless screenshots from home and along the east path
  with a temporary 9 m mast plate — establish at what distance tall
  silhouettes actually read at the follow camera. This number calibrates
  every lure (and decides how much weight the Datou sense must carry).

**Exit:** clearings hold, state persists, and we know our true horizon
distance.

> **Phase 0 findings (2026-06-10, measured):** `src/world/landmarks.ts`
> (LandmarkField + CLEARINGS) landed with tests. The sightline check
> (`?at=x,z,yaw` teleport + temporary 9 m mast at the Commons, headless
> SwiftShader shots at 130/90/60/40/25 m) showed the follow camera **never
> frames the horizon**: at pitch 0.62 rad with a 34° FOV the top of frame is
> ~18° below horizontal, so the visible world is a ~20 m ground disc (~45 m
> fully zoomed out) and tall plates beyond it are cropped by the frame top —
> the 9 m mast is invisible even at 25 m. Rain/fog days wash out the far half
> of even that disc (fog far-plane 28–50 m). **Calibration consequence: the
> Datou sense is the primary lure channel, ground-level breadcrumbs carry the
> approach ring, and tall silhouettes only establish identity inside ~20 m
> (plus the minimap paint).** The horizon-ring layer of §5 is effectively
> delivered by Datou + map, not by pixels.

### Phase 1 — Repair Commons, complete vertical slice

- Final Commons sprites, composition, approach curve and breadcrumbs.
- Datou notice beat + the scripted first-hook want.
- Chime repair activity, completion state, lit-lamps persistence.
- Coffer with grant handler (§9), memory event, map symbol.
- Blue-ribbon clue toward the lake.
- i18n EN/ZH for all new strings.

**Exit:** a first-time tester starting at home follows Datou to the Commons
with no markers, explains what the place was for, completes the chime with
Datou, finds the coffer, crafts the chime from the supplied bundle, and
mentions the lake clue unprompted. (This is the go/no-go gate for the whole
plan — if the slice doesn't produce "we found it together" reactions, fix
here before building two more.)

### Phase 2 — Complete the chain

- Pump Garden, then Relay Camp, using the contracts Phase 1 proved — extract
  shared area/activity/coffer code as the second area demands it.
- Early-discovery handling (later area found first stays completable).
- Relay response keyed to the existing ruin stones; no new far content.
- Garden donation socket (the first Workshop-contribution hook).

**Exit:** 4 of 5 testers voluntarily pursue a second place after the first;
3 of 5 can sketch the rough spatial relationship of the three areas.

### Phase 3 — Revisit and polish (the deferred grammar layers)

- One revisit variation per area (notices rotate; weather changes chime/sails;
  relay snippets vary).
- Thresholds, secrets (time capsule, Old Pine hollow extras), remaining
  donation sockets.
- Sound cues, Datou personality presentation shading.
- Scatter retuning where generic props still compete with authored hearts.

**Exit:** returning players identify one visible change per completed area and
have one new reason to interact.

## 12. Test Plan

### Automated (Vitest, matching existing coverage patterns)

- Landmark state transitions are deterministic; save/load restores state,
  `cofferOpened`, and map reveal (pattern: `Spots.test.ts`).
- The coffer grant handler is idempotent: rapid repeats, reload mid-session,
  and already-known blueprints all grant materials exactly once and never
  corrupt `wwd.workshop`.
- Awarded fully-revealed hints appear in the Notebook but the form stays
  un-made until crafted (pattern: existing workshop tests).
- `CLEARINGS` exclude scatter from activity rings across seeds
  (pattern: `scatter.test.ts`).
- Areas found out of order complete and don't break clues.
- i18n parity test covers all new keys (already enforced).

### Visual and playtest

- Squint/blur screenshots: each area keeps a distinct focal shape and accent.
- Record first destination chosen, time-to-first-notice, whether the tester
  followed Datou's gaze or wandered, route, hesitations, clue comprehension.
- Ask testers to name each place and draw the route after 15 minutes —
  recognition over accuracy.
- Verify testers understand the coffer gives a build opportunity, not an
  object, and can craft it unaided.
- Baseline QA checklist per `DESIGN_BASELINE.md` on every new sprite and
  motion: no blinking, no flapping, ≤3 dominant colors, robot stays the focal
  point during activities.

### Performance

- Scatter stays instanced; unique animated pieces only inside activity rings.
- No meaningful frame-time regression on the mid-range laptop baseline.

## 13. Metrics

Primary:

- % of players who voluntarily travel to a second authored area.
- % who can name or describe an area after the session.
- % of discoveries initiated by following Datou (vs. stumbled on) — the
  signature stat for this plan.

Supporting:

- Median time from completing one area to committing toward the next clue.
- Coffer discovery rate, blueprint craft rate, % of crafted rewards installed
  back into their source area.
- Memories created at authored areas vs. generic props.

Do not optimize collected-item counts. The outcome is a chain of remembered
places and shared moments.

## 14. Scope Boundaries

Included in the first slice:

- Three authored areas, their Datou-led clue chain, activities, coffers,
  persistence, map symbols, and the layout/scatter changes that frame them.

Deferred:

- Terrain heightfields or world rebuilds; NPCs; quest logs or screen-space
  markers; minimap fog of war; redesigning biomes before the loop is
  playtested; building anything at the ruin stones beyond the relay's distant
  response.

## 15. References

- Gómez-Maureira et al., "Level Design Patterns That Invoke Curiosity-Driven
  Exploration," CHI PLAY 2021: https://doi.org/10.1145/3474698
- Acevedo et al., "Procedural Game Level Design to Trigger Spatial
  Exploration," FDG 2022: https://doi.org/10.1145/3555858.3563272
- To et al., "Integrating Curiosity and Uncertainty in Game Design," DiGRA/FDG
  2016: https://doi.org/10.26503/dl.v2016i1.793
- The Level Design Book, "Wayfinding":
  https://book.leveldesignbook.com/process/blockout/wayfinding
- The Level Design Book, "Disneyland" landmark and themed-area analysis:
  https://book.leveldesignbook.com/studies/irl/disneyland
- Martin Nerurkar, "No More Wrong Turns," Game Developer:
  https://www.gamedeveloper.com/design/no-more-wrong-turns
- Mobius Digital, "The Intentionality of Wandering":
  https://www.mobiusdigitalgames.com/news/the-intentionality-of-wandering
- GDC Vault, "Crafting a Tiny Open World: A Short Hike Postmortem":
  https://gdcvault.com/play/1026613/Independent-Games-Summit-Crafting-A
