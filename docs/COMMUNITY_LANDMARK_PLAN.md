# Community Landmark Plan — A Park That Leads Somewhere

**Status:** Proposed implementation plan  
**Date:** 2026-06-10  
**First slice:** Three authored community-made areas connected by a discovery chain

## 1. Goal

Turn the current 500 m park from a field of repeated props into a place the
player can remember, describe, and become curious about.

The first release should create this loop:

> Notice a distinctive place → wonder what happened there → travel with Datou
> → do one local activity together → leave a visible change → discover a clue
> to another place.

Success is not “the map contains more objects.” Success is that a player can
say:

- “I found the community repair stop by the amber flags.”
- “We restarted the water garden, and it pointed us toward the old relay camp.”
- “I want to return because the place changed and there is still something
  unresolved.”

The community-made direction fits the existing game particularly well. The
Workshop already produces furnishings and tools, the resource nodes imply a
local material economy, and Datou is a worker-companion robot. Park landmarks
can therefore be useful, handmade places with evidence of previous visitors,
not arbitrary monuments.

## 2. Current Design Review

The current world has a strong close-up visual style and a pleasant home glade,
but its large-scale identity is weak:

- `layout.ts` contains destinations, but most “major props” are enlarged
  versions of ordinary trees, rocks, benches, and signs. They mark coordinates
  without creating memorable places.
- Broad zone tinting and dense procedural scatter create quantity, but repeated
  cutouts make distant areas visually interchangeable.
- The paths are readable on the minimap but faint at normal play scale. They do
  not build anticipation through thresholds, framed views, or changing
  composition.
- Daily spots are invisible until Datou gets very close. They reward arrival
  but rarely motivate the journey.
- Generic prop reactions end in a toast and bond gain. They do not reveal local
  history, alter the area, or point toward a new destination.
- The fully revealed, clickable minimap communicates the whole park before the
  player has learned it through play.
- Landmark-sized resource nodes are primarily economy gates. They are not yet
  composed into social spaces with a purpose, story, or distinctive activity.

The resulting problem is **uniform information value**: most directions promise
roughly the same flowers, resources, and reactions. Curiosity needs a visible
information gap and evidence that resolving it will produce something specific.

## 3. Research Applied

The plan uses five findings from level-design research:

1. **Landmarks must attract and identify.** A visible landmark should pull the
   player toward it and give the surrounding district an unmistakable identity.
   Contrast, silhouette, composition, lighting, and motion are stronger than
   simply increasing prop size.
2. **Partial concealment creates questions.** Empirical work on
   curiosity-driven exploration identifies visual obstruction, out-of-place
   objects, extreme points, and spatial connections as useful exploration
   patterns.
3. **A discovery should create another information gap.** Curiosity is sustained
   when an answer supplies a meaningful clue to a new question. The clue should
   suggest rather than expose the exact destination.
4. **Breadcrumbs should support player agency.** Environmental lines, repeated
   materials, collectible traces, moving elements, and companion attention can
   make routes legible without turning exploration into objective-marker
   following.
5. **Places need thematic beats.** A destination is remembered through an
   approach, reveal, activity, payoff, and aftermath, not through one hero prop
   standing in an otherwise unchanged field.

Practical rule for this project:

> Every hero area must have a unique silhouette, local prop language, arrival
> ritual, Datou interaction, persistent change, and clue toward another area.

## 4. Area Design Grammar

Each authored area uses the same production template while expressing a
different identity.

| Layer             | Requirement                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Distant lure**  | One silhouette, color accent, light, smoke, motion, or sound readable before individual props |
| **Approach**      | A 20–40 second route with two breadcrumbs and at least one partially blocked view             |
| **Threshold**     | A clear transition such as an arch, fence gap, bridge, flag line, or vegetation opening       |
| **Heart**         | A compact social composition of 3–5 related hero props, not one isolated object               |
| **Local verb**    | One activity that requires both player intent and Datou’s action                              |
| **Story trace**   | Environmental evidence of who made the place and what they were trying to do                  |
| **Secret**        | One optional observation, item, or side path found by looking beyond the obvious interaction  |
| **State change**  | A visible improvement that persists after completion                                          |
| **Outbound clue** | A diegetic hint that creates curiosity about a different area                                 |
| **Revisit hook**  | A daily, weather, tool, Workshop, or relationship variation that changes the area later       |

Area density should be authored in three rings:

- **Horizon ring, 40–120 m:** silhouette and one strong accent only.
- **Approach ring, 10–40 m:** breadcrumbs, framing masses, and small evidence.
- **Activity ring, 0–10 m:** unique props, interaction, readable state, and
  reward.

This avoids filling the entire map evenly. Quiet connective space is useful
when it contrasts with dense, meaningful destinations.

## 5. First Three Areas

### A. The Trail Repair Commons

**Location:** Existing east trail cluster around the bench, signpost, picnic
table, and bulletin board.

**Identity:** A friendly volunteer repair stop assembled from mismatched wood,
fabric, old robot panels, and amber safety lights.

**Distant lure**

- Tall fabric pennant mast with an asymmetric silhouette.
- Warm amber lamp rhythm visible through the pale meadow.
- A short line of flags and repaired fence pieces draws the eye toward the
  entrance.

**Approach and reveal**

- Curve the existing path behind a bush/fence mass so the whole commons is not
  visible from home.
- Place dropped fasteners, painted stones, and patched signs as breadcrumbs.
- Enter beneath a low community arch bearing several hand-painted maker marks.

**Activity: Repair the message chime**

- The chime is tangled and missing one small part.
- The player inspects the mechanism; Datou braces the post or uses the dorsal
  arm while the player supplies a common Workshop material.
- Completion animates the chime, turns on the lamps, and adds a new notice to
  the board.

**Story and clue**

- The notice board shows sketches from park volunteers, including a
  water-stained drawing of a pump garden and a blue ribbon tied to the eastern
  side.
- Following blue ribbon scraps leads toward the lake without exposing an exact
  map marker.

**Revisit**

- Notices rotate daily.
- Player-made small furnishings may be donated to the commons.
- Wind or rain changes the chime and pennant behavior.

### B. The Reedwater Pump Garden

**Location:** Existing lake jetty and reed bank.

**Identity:** A handmade wetland garden where the community once used a small
robot-compatible pump to water floating planters.

**Distant lure**

- Blue cloth sails and a crooked pump wheel rise above the reeds.
- Moving reflective ribbons and water ripples provide contrast against the
  static landscape.
- The jetty points directly at the garden but the reed wall hides its center.

**Approach and reveal**

- Blue ribbon breadcrumbs from the Commons become irrigation hose, painted
  stakes, and wet footprints.
- The player crosses the jetty, then rounds a dense reed screen to reveal the
  pump, planters, and a tiny covered rest platform.

**Activity: Restart the water loop**

- The player rotates or reconnects two simple channel pieces.
- Datou runs the pump in calm beats using the arm/tool system.
- Water travels visibly through the channels; wilted paper plants lift and the
  garden gains color.

**Story and clue**

- One planter contains pine needles and a stamped metal relay tag that does not
  belong at the lake.
- When the pump starts, a small floating marker reaches the far channel carrying
  the same triangular symbol used at the old woods relay.

**Secret**

- A dry side channel leads behind the rest platform to a community time capsule
  or unique Workshop finish reference.

**Revisit**

- Different flowers open by weather/season.
- Datou can collect a limited daily water sample or help tend one planter.
- A player-crafted ornament can be installed in an empty planter socket.

### C. The Old Pine Relay Camp

**Location:** Existing woods heart around the Great Tree, Old Pine, and mushroom
ring.

**Identity:** A sheltered field camp where volunteers maintained a low-tech
park relay using salvaged robot parts.

**Distant lure**

- A narrow relay mast with three offset signal vanes breaks the tree line.
- Intermittent amber pulses appear between trunks, visible but not continuously.
- The mast is deliberately out of place among the soft woods shapes.

**Approach and reveal**

- Dense pines block the direct view. Triangular marks, cable ties, and aligned
  mushroom clusters suggest a winding route.
- The route crosses itself once, letting the player understand a shortcut back
  to the meadow.
- The final tree screen opens into a small camp: mast, tool shelter, log seats,
  cable spool, and the Great Tree as a shared canopy.

**Activity: Tune the relay together**

- The player rotates two signal vanes while Datou listens and indicates stronger
  alignment through head direction, LED pulse, and posture.
- Correct tuning wakes the mast, lights the camp, and plays a distant response
  from an unseen fourth location.

**Story and next mystery**

- Logs show the relay network was built to help lost park robots and visitors
  find community shelters.
- The response carries the mark of the existing far-corner machine site,
  creating the next expansion target without requiring it in this slice.

**Secret**

- A hollow beneath the Great Tree contains a volunteer badge, old Datou-shaped
  sketch, or rare pattern inspiration.

**Revisit**

- Signal strength and received snippets vary by weather and time.
- Higher bond lets Datou distinguish more complex signals.
- Later landmarks can join the network without changing this area’s core
  interaction.

## 6. Curiosity Chain

The three areas form a directed chain for a new player, but remain freely
discoverable:

`Home → Repair Commons → Pump Garden → Relay Camp → distant machine-site signal`

Rules:

- Every clue names a **quality**, not a coordinate: blue ribbons, water sounds,
  triangular relay marks, intermittent amber pulses.
- Datou may notice a clue and look or walk a few steps toward it, but never takes
  movement control from the player.
- Finding a later area early is valid. Its activity can be completed, and the
  earlier clue becomes recognition rather than wasted content.
- Each completed area adds a simple hand-drawn symbol to the map. Unvisited
  areas remain only as vague stains or player-visible silhouettes.
- A clue remains in the environment after discovery so the player can reconstruct
  how the places connect.

## 7. System and Content Changes

### Authored area data

Add a small data-driven area definition separate from broad biome zones:

```ts
interface LandmarkArea {
  id: 'repair-commons' | 'pump-garden' | 'relay-camp';
  center: { x: number; z: number };
  approachRadius: number;
  activityRadius: number;
  state: 'unseen' | 'noticed' | 'arrived' | 'completed';
  clueTo?: LandmarkArea['id'];
}
```

Keep exact prop placement curated in `layout.ts`. Procedural scatter should read
authored exclusion and density masks so it frames each area instead of
overlapping it.

### Landmark compositions

- Add purpose-built prop sprites for each area rather than scaling normal
  scatter art: pennant mast, repair arch, message chime, pump wheel, planter
  channels, relay mast, cable spool, and volunteer marks.
- Reuse generic benches, lamps, signs, fences, Workshop materials, and resource
  nodes as supporting pieces.
- Give each area one dominant accent and shape language:
  amber/patchwork rectangles, blue/curving water lines, and
  charcoal/triangular relay forms.

### Interaction state

- Implement one reusable landmark activity state machine:
  `idle → invited → player-engaged → datou-working → completed`.
- Store completion and installed decoration IDs in local persistence.
- Emit structured memory events containing area, activity, Datou mood, and
  installed contribution.
- Replace generic reaction toasts at hero props with physical response,
  animation, short sound hooks, and visible world-state change.

### Map and discovery

- Keep the minimap available, but mask unvisited authored details.
- Remove one-click travel into unseen areas; clicking known terrain may still
  set a walk target.
- Reveal the area symbol on arrival and its local connections on completion.
- The overview camera remains a creator/planning tool, but should not reveal
  secrets or activity states.

### Companion behavior

- Add area-specific interest points for Datou: smell the repair post, watch the
  water channel, listen at the relay.
- Use Datou as a readable detector: orientation, pause, LED, and small lead
  movements communicate clue strength.
- Personality changes presentation, not solvability. An Explorer approaches
  clues sooner; a Calm Datou observes longer; every personality can complete
  every activity.

## 8. Implementation Sequence

### Phase 1 — Area framework and blockout

- Add landmark area definitions, progression state, save keys, scatter exclusion
  masks, and debug visualization.
- Recompose the existing east, lake, and woods locations using temporary
  silhouettes.
- Tune sightlines at normal camera distance before producing final sprites.

**Exit criterion:** From home and along each route, players can notice a lure,
lose and regain sight of it, cross a threshold, and identify the destination
from a blurred screenshot.

### Phase 2 — Repair Commons vertical slice

- Build final Commons props, approach breadcrumbs, activity, completion state,
  memory event, and clue to the lake.
- Add its map reveal behavior and persistence.

**Exit criterion:** A first-time tester finds the Commons without a HUD marker,
can explain what the place was used for, completes the activity with Datou, and
notices the lake clue.

### Phase 3 — Complete the three-area chain

- Build Pump Garden and Relay Camp using the proven area/activity contracts.
- Add early-discovery handling and persistent state changes.
- Connect the Relay Camp response to the future machine-site mystery.

**Exit criterion:** At least 4 of 5 testers voluntarily pursue a second place
after completing the first, and at least 3 can later sketch the rough spatial
relationship of the three areas.

### Phase 4 — Revisit variation and polish

- Add one weather/time variation and one Workshop contribution socket per area.
- Add sound cues, subtle motion, and Datou personality presentation.
- Reduce or relocate generic scatter where it competes with authored
  compositions.

**Exit criterion:** Returning players can identify one visible change in each
completed area and have one new reason to interact without resetting progress.

## 9. Test Plan

### Automated

- Area state transitions are deterministic and completion rewards are idempotent.
- Save/load restores completion, installed items, clues, and map reveal state.
- Scatter never places blocking props inside authored approach/activity masks.
- An area found out of sequence remains completable and does not break clues.
- Map clicks cannot target masked authored interiors.
- All three areas emit correctly localized memory and interaction keys.

### Visual and playtest

- Run a squint/blur test: each area keeps a distinct focal shape and accent.
- Record first destination chosen, time to first notice, route taken, hesitation
  points, and whether the next clue was understood.
- Ask testers to name each place and draw the route after 15 minutes. Recognition
  matters more than exact map accuracy.
- Observe rather than explain. Add guidance only where repeated testers fail to
  perceive an intended lure.
- Test at normal follow camera, maximum normal zoom, and overview mode.

### Performance

- Preserve instancing for generic scatter.
- Keep unique animated pieces limited to activity rings.
- Target no meaningful frame-time regression on the current mid-range laptop
  baseline.

## 10. Metrics

Primary:

- Percentage of players who voluntarily travel to a second authored area.
- Percentage who can name or describe an area after the session.
- Median time from completing one area to committing toward the next clue.

Supporting:

- Route diversity without prolonged disorientation.
- Landmark activity completion rate.
- Return visits and Workshop contributions per area.
- Number of memories created at authored areas versus generic scatter props.

Do not optimize for collected-item count. The intended outcome is a chain of
remembered places and shared moments.

## 11. Scope Boundaries

Included in the first slice:

- Three authored areas and their connecting clue chain.
- New landmark props, activities, persistence, map reveal, and Datou tells.
- Small layout and scatter changes needed to frame those areas.

Deferred:

- Terrain heightfields or a full world rebuild.
- NPC simulation and populated community characters.
- A complete quest log or screen-space objective markers.
- Redesigning every biome before the three-area loop is playtested.
- Building the far machine site beyond the Relay Camp’s distant response.

## 12. References

- Gómez-Maureira et al., “Level Design Patterns That Invoke
  Curiosity-Driven Exploration,” CHI PLAY 2021:
  https://doi.org/10.1145/3474698
- Acevedo et al., “Procedural Game Level Design to Trigger Spatial
  Exploration,” FDG 2022:
  https://doi.org/10.1145/3555858.3563272
- To et al., “Integrating Curiosity and Uncertainty in Game Design,” DiGRA/FDG
  2016: https://doi.org/10.26503/dl.v2016i1.793
- The Level Design Book, “Wayfinding”:
  https://book.leveldesignbook.com/process/blockout/wayfinding
- The Level Design Book, “Disneyland” landmark and themed-area analysis:
  https://book.leveldesignbook.com/studies/irl/disneyland
- Martin Nerurkar, “No More Wrong Turns,” Game Developer:
  https://www.gamedeveloper.com/design/no-more-wrong-turns
- Mobius Digital, “The Intentionality of Wandering”:
  https://www.mobiusdigitalgames.com/news/the-intentionality-of-wandering
- GDC Vault, “Crafting a Tiny Open World: A Short Hike Postmortem”:
  https://gdcvault.com/play/1026613/Independent-Games-Summit-Crafting-A
