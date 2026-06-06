# Gameplay Design — Playable Interaction Features for _Walk with Datou_

**Status:** Proposed (for review)
**Date:** 2026-06-06
**Scope:** Player-facing interaction _systems_ for the next 1–2 sprints (Roadmap Sprints 1–4), with a code-level mapping onto the existing Three.js + `PhysicsAdapter` architecture. Web prototype only.
**Reference:** Adapts the companion-rapport design language of _Pokémon Pokopia_ (Game Freak / Omega Force, 2026) to a single-companion dog-walking sim.

> **Companion docs.** This is one of three:
>
> - **This doc** — the _systems_ (wants, bond, explore, daily ritual, character, diary). Features are labelled **F1–F6**; the other docs cite them as **GF1–GF6**.
> - **`docs/INTERACTION_VERBS.md`** — the _creature-interaction verbs_ (pet, call, play, lead, fetch…) that the player uses to answer these systems.
> - **`docs/ENVIRONMENT_DESIGN.md`** — the _world_ (zones, landmarks) and its _object-manipulation verbs_ (push/throw/carry/break…). The two verb docs meet at **fetch**.

---

## Context — why this doc exists

`walk-with-datou` is a web prototype that validates the _interaction model_ for VitaDynamics' real robot dog **Datou (大头)** before the hardware ships. The README states three hypotheses to prove cheaply: (1) does a step-less "walk with a dog" build real attachment; (2) does one shared **bond** metric beat per-feature scores; (3) does an **AI-written daily diary** make each user's Datou feel uniquely theirs.

Today the prototype (Sprint 0) is a walkable park where Datou follows/wanders and you click to pet. The `PhysicsAdapter` contract already anticipates four behaviour modes (`idle | follow | explore | leashed`) and four moods (`happy | calm | curious | tired`), and the MuJoCo design already specs a deterministic **replay/snapshot** surface for the diary. So the _substrate_ for richer interaction exists — what's missing is the **interaction layer**: the readable two-way loop that turns "a dog mesh that moves" into "a companion you understand."

The company's four themes — **companionship, environment exploration, tacit understanding (默契), character** — map cleanly onto Pokopia's strongest idea: _understanding your companion's wants is literally what drives progression._ This doc designs that loop for a dog, against the next two sprints.

### What we deliberately adapt (not copy) from Pokopia

| Pokopia                                         | Our adaptation                                                              | Why                                                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Comfort Level + "ask how's your comfort" → hint | **Datou's want signals** (sniff/look/sit) → you read and answer them        | Same diegetic, low-UI "getting to know you" loop, but for a non-verbal dog instead of talking Pokémon |
| Befriend → ability gift → new terraform tool    | **Bond → unlocked idle habits & new shared activities**                     | We're not a building game; rapport unlocks _behaviour_, not tools                                     |
| Requests (fetch/build tasks)                    | **Initiatives** — Datou proposes "let's go there / dig here" and you accept | Keeps the companion proactive (the "semi-autonomous partner" feel) without a quest log                |
| Environmental storytelling via diary scraps     | **AI-written daily diary** (already planned)                                | We already have determinism/replay specced for exactly this                                           |

**Anti-goal:** no combat, no inventory grind, no menus-as-gameplay, no numbers shown to the player. The dog should feel _read_, not _managed_.

---

## 1. The core interaction loop

One sentence: **You walk with Datou; Datou expresses wants; you respond; shared moments deepen a single bond; the bond changes who Datou is.**

```
        ┌─────────────────────────────────────────────────┐
        │                                                  │
   (1) Be present ──> (2) Datou signals a want ──> (3) You read & respond
        │  walk, follow,        sniff / look-at /          pet, play, go-there,
        │  just exist near       sit-and-wait                 wait, share-a-POI
        │                                                          │
        └──────────── (5) Personality drifts <── (4) A "moment" lands ──┘
                       over days (archetype)        +bond, diary remembers it
```

Every pillar plugs into one stage:

- **Companionship** → stages 1 & 3 (presence + response). The baseline feel.
- **Tacit understanding (默契)** → stages 2 & 3 (the _read_). The skill the player learns.
- **Environment exploration** → stage 4's richest moment-generator (POIs).
- **Character** → stages 4 & 5 (memory + drift). What makes _your_ Datou yours.

The loop runs continuously during a session; the **daily ritual** (one explore + one diary per real-world day) is the macro-cadence that brings players back tomorrow.

The _verbs_ the player uses at stage (3) are specified in **`docs/INTERACTION_VERBS.md`**; the _world_ those moments happen in is **`docs/ENVIRONMENT_DESIGN.md`**.

---

## 2. Feature designs

### F1 — Want signals & the "read" (default mode: companionship + 默契)

The heart of the design. Instead of a happiness _bar_, Datou periodically surfaces a **want** through body language, and the only way to satisfy it is to notice and respond correctly. This is the dog-equivalent of Pokopia's "ask comfort → get a hint" loop, but **the hint is behavioural, not textual** — you have to learn to read it.

**Want types (Sprint 1, start with 3):**

| Want                      | Tell (how Datou shows it)                                   | Correct response                                                   | Reward                |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ | --------------------- |
| _Wants attention_         | trots to player, sits, looks up, tail low-wag               | click-to-pet (existing) or stay close                              | bond +, mood→happy    |
| _Wants to play_           | play-bow (front down, rear up), quick spins, fast wag       | click while it bows → triggers a short chase/fetch beat            | bond ++, mood→happy   |
| _Curious about something_ | freezes, ears up, faces a direction, takes a step toward it | walk that way with it (follow the gaze) → reveals/approaches a POI | bond +, leads into F3 |

**Readability rules (the design contract):**

- A want has a visible **wind-up** (~1–2 s of the tell before it "expects" a response) so an attentive player can always catch it. No twitch-reaction demands.
- Exactly **one active want at a time.** Never stack signals — clarity over realism.
- **Ignoring a want is allowed and meaningful**, not punished: an unanswered want quietly expires (no bond loss, slight mood drift toward `calm`/`tired`). 默契 is built by _responding more often over time_, not by never missing one. This keeps the tone cozy.
- A small, **optional** "?" thought-bubble over Datou can be toggled on for new players (an onboarding crutch, see §4) and off once they can read the body language — this directly teaches the 默契 skill rather than replacing it.

**Why this is the keystone:** it converts the existing static `mood` enum into a _two-way protocol_. The player isn't watching a state; they're in a conversation. The responses live in `docs/INTERACTION_VERBS.md`.

### F2 — Bond: the single shared metric (companionship + character)

One integer `bond` (0–100+), persisted, fed by **every** interaction mode — exactly the README's hypothesis #2. No per-feature scores shown anywhere.

- **Inputs (small, additive):** answering a want, petting, completing a play beat, sharing a POI discovery, simply spending time in proximity (a slow trickle so passive walks still count).
- **Diminishing returns within a session** so you can't farm bond by spam-petting; the daily ritual (F4) is where the bigger gains live → reason to return.
- **Bond is never shown as a number.** It's expressed only through **unlocks** and Datou's growing repertoire:

| Bond | Unlock (an _idle habit_ or _activity_, never a stat)                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| ~15  | Datou starts **glancing back at you** while wandering (checks you're there)                                  |
| ~30  | **Play** want unlocks a fetch mini-beat; Datou brings a "stick" back                                         |
| ~50  | Datou **lies at your feet** when you stand still a while (the README's example)                              |
| ~70  | Datou **initiates** explore ("let's go" — F3) instead of only reacting                                       |
| ~90  | A signature personal habit picked by personality (F5), e.g. always circles the home post once before resting |

This makes progression _legible through behaviour_ — the Pokopia lesson that rapport, not a number, is the reward.

### F3 — Explore mode & shared discovery (environment exploration)

Promotes the existing `explore` mode from "Datou picks a path, you watch" into a **shared-attention** mechanic.

- **Procedural POIs** (Roadmap Sprint 2): 1–2 per session from a template library, placed in the park (a curious smell, a butterfly, a shiny thing, a puddle, a buried something). Lightweight `THREE.Group` markers; no new geometry pipeline. The _environmental_ half of a POI (the reactive prop) is specced in `docs/ENVIRONMENT_DESIGN.md` §4.1.
- **Two ways a POI enters play:**
  1. _Datou-led:_ a _Curious_ want (F1) points you toward a POI. You follow the gaze → you both arrive → Datou reacts (sniff/dig/alert animation) → **shared moment** (+bond, diary-worthy).
  2. _Player-led:_ you walk toward something; if Datou is bonded enough it notices your heading and converges (the "glance back / follow your lead" behaviour — the _lead_ verb).
- **The reaction is the payoff**, not a collectible. Some POIs yield a tiny tangible (a "treasure" Datou digs up that appears at the home post) to give the daily ritual a visible souvenir, but the felt reward is _we noticed this together._
- **Daily gate:** the richer explore beat runs **once per real-world day** (Sprint 2) — scarcity that makes it a ritual, not a grind.

This is where the most _diary-worthy_ moments are generated (§F6), so explore and character are tightly coupled.

### F4 — The daily ritual (companionship + retention)

The macro-loop that earns "come back tomorrow":

1. Open the tab → Datou greets you (greeting intensity scales with bond and with days-since-last-visit — a longer absence = a bigger, more touching greeting).
2. One **explore** beat is available (the daily gate).
3. At session end (or on demand), the day's **diary** entry is generated (F6).
4. Returning tomorrow → new greeting, new POIs, the diary remembers yesterday.

A gentle **streak** notion exists only as flavor in the diary ("third morning in a row…"), never as a punishing meter.

### F5 — Character & personality drift (character)

Datou is an _individual_, and _your_ Datou diverges from everyone else's over a week — README hypothesis #3, Roadmap Sprint 4.

- **Moods** (existing 4-state enum) remain the moment-to-moment surface, driven by recent interaction (already in `PlaceholderPhysics.updateMood`). Keep them numberless and animation-expressed (tail wag speed, head bob — already in `Datou.apply`).
- **Two archetypes** (Roadmap Sprint 4): **Adventurer** (favors exploration, initiates POIs sooner, restless idle) vs **Cuddler** (favors proximity, wants attention more, settles at your feet sooner).
- **Drift, not switch:** a **7-day rolling window** of _how you actually played_ nudges Datou toward an archetype. Lots of exploring → Adventurer; lots of petting/standing together → Cuddler. No instant flips; the change is felt over days.
- Personality biases **want frequency** (F1), **POI selection** (F3), small **verb traits** (`INTERACTION_VERBS.md` §5: favourite pet spot, call-eagerness, lead-readiness), and the **~90-bond signature habit** (F2) — so the same systems express personality without new mechanics.

### F6 — AI daily diary (character — the "uniquely yours" payoff)

A short first-person (Datou's POV) diary entry per day, written by an LLM (Roadmap Sprint 3, Claude Haiku / small model), grounded in **what actually happened** that session.

- **Grounding via the replay surface that MuJoCo already specs** (`docs/MUJOCO_DESIGN.md` §4.7: seeded RNG + input log + snapshot). The session emits a compact **event summary** — wants answered/missed, POIs shared, pet count, time together, mood arc, current archetype lean — and that summary is the LLM prompt context. Deterministic replay means the diary matches what the user saw.
- Tone: cozy, dog's-eye, a little funny. ("The two-legs found the shiny thing before me. I let them think it was their idea.")
- **Diary archive page** (Sprint 3) — the artifact users screenshot and share; the thing that makes a Datou feel _theirs_.

---

## 3. How this maps onto the existing code

The architecture is already shaped for this. **No `PhysicsAdapter` interface break is required** for Sprints 1–3; the want/bond/diary logic is _game-layer_ concerns, not physics.

### 3.1 New modules (one class per file, the repo convention)

```
src/game/
├── Companion.ts      NEW  the "brain": owns want-signal state machine, picks the
│                          active want, evaluates player responses, emits "moments".
│                          Reads DatouState (pos/mood/velocity) + player pos; calls
│                          physics.setMode/setTarget to act on a want. Also hosts the
│                          verb resolver (see docs/INTERACTION_VERBS.md §4-5).
├── Bond.ts           NEW  the single bond integer + unlock thresholds (F2). Pure
│                          logic + a tiny event API (addBond(reason, amount)).
├── pois.ts           NEW  POI template library + procedural placement (F3), as
│                          plain data + a spawn fn returning THREE.Group markers.
├── Poi.ts            NEW  one POI's mesh + reaction-trigger hitbox (mirrors Datou.ts).
└── Diary.ts          NEW  session event accumulator + entry generator (F6). The LLM
                           call is stubbed behind an interface so Sprint 1–2 run offline.

src/ui/
├── WantBubble.ts     NEW  optional "?" thought bubble (onboarding crutch, F1).
└── (HUD)             extend index.html HUD — greeting line, diary button.

src/state/
└── Storage.ts        NEW  IndexedDB wrapper (already promised in ARCHITECTURE.md
                           "State that survives a frame") — persists bond, visit
                           timestamps (daily gate), diary list.
```

### 3.2 Game loop integration (`Game.ts` `tick`)

The current `tick` (Game.ts:113) does: input → player.update → setPlayerPosition → step → getDatouState → apply → mood HUD → camera → render. Insert the companion brain between physics read-back and render:

```
... physics.step(dt)
const state = physics.getDatouState()
this.companion.update(state, this.player.position, input, dt)   // ← NEW: wants/responses
this.datou.apply(state)
this.datou.applyExpression(this.companion.currentWant)          // ← NEW: play-bow, gaze, sit poses
this.updateMoodHUD(state.mood)
this.wantBubble?.update(this.companion.currentWant, ...)        // ← NEW (optional)
... camera, render
```

- `Companion.update` decides if a want should fire, watches `input.clicked` / proximity / player heading to judge the response, and on success calls `bond.addBond(...)` + `diary.record(...)`. To _act_ on a want it uses the existing levers: `physics.setMode('explore')` + `physics.setTarget(poi.x, poi.z)` for a Curious want, etc.
- The existing **click → raycast → `physics.applyPet()`** path (Game.ts:140) is reused for the _attention_ and _play_ wants — `Companion` just interprets _when_ a pet lands during a want as a correct response.

### 3.3 Reusing what's already there

- **Modes:** `follow` (default presence), `explore`/`leashed` (`setTarget` for POI-led movement), `idle` (wander) — all already in the contract and implemented in `PlaceholderPhysics.computeDesiredTarget`. F3 just supplies POI coordinates as the target.
- **Mood:** `PlaceholderPhysics.updateMood` already derives `happy/curious/tired/calm`; `Companion` layers _wants_ on top without changing mood derivation.
- **Datou expressions:** `Datou.apply` already animates tail/head by mood (Datou.ts:84). Add `applyExpression(want)` for the play-bow, gaze-turn, and sit poses — same pattern, new poses.
- **Colliders & POI placement:** reuse `getParkColliders()` (World.ts:44) so POIs don't spawn inside trees.
- **Diary grounding:** reuse the MuJoCo **`InputRecorder` / snapshot** surface (`src/physics/mujoco/replay.ts`, already built) for deterministic session summaries.
- **Settings/HUD pattern:** the diary button + onboarding toggle follow the existing plain-DOM `Settings.ts` + `index.html` pattern (no framework).
- **Persistence:** matches the `Storage`-over-IndexedDB plan already named in `ARCHITECTURE.md`.

### 3.4 Does the `PhysicsAdapter` contract need to change?

**No, for Sprints 1–3.** Wants, bond, POIs, diary are game-layer. The one _optional_ future addition (Sprint 4+) would be a richer `getDatouState()` (e.g. a `gazeTarget` so the renderer can turn Datou's head toward a POI smoothly) — additive, non-breaking, and only if head-aim-from-physics looks better than game-layer aim. Flagged, not required now.

---

## 4. Onboarding & teaching the 默契 skill

Players must _learn to read_ Datou — that learning curve **is** the game. Teach it diegetically, Pokopia-style (no menu tutorials):

1. **First 60 seconds:** Datou comes to you and sits (attention want) with the **"?" bubble ON** and a one-line HUD nudge ("Datou wants something — try clicking it"). Success → bubble fades, nudge clears.
2. **Introduce wants one at a time** across the first session (attention → play → curious), each with the bubble, so the body-language vocabulary is built gradually.
3. **Bubble auto-dims** as the player answers wants reliably (a hidden "reads Datou well" counter); a Settings toggle lets them force it on/off. Turning the bubble off _is_ the graduation moment — now you read the dog, not the UI.
4. **No fail states.** Missed wants never punish; the worst case is a calmer, sleepier dog — which itself reads as feedback.

---

## 5. Sprint mapping (fits the existing Roadmap)

| Roadmap sprint                   | This doc's features                                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint 1 — Follow + Mood**     | F1 (3 want types + read loop), `Companion.ts`, `Datou.applyExpression`, optional `WantBubble`, onboarding step 1–2. _Gate:_ testers say "the dog feels like it has emotions." |
| **Sprint 2 — Explore + Daily**   | F3 (POIs + shared discovery), F4 (daily ritual + gate), `pois.ts`/`Poi.ts`, `Storage.ts` for the daily gate.                                                                  |
| **Sprint 3 — Diary + Bond**      | F2 (bond + unlocks), F6 (AI diary + archive), wire `Bond.ts`/`Diary.ts`, reuse replay surface.                                                                                |
| **Sprint 4 — Personality drift** | F5 (2 archetypes + 7-day drift), bias wants/POIs/signature habit.                                                                                                             |

Each sprint still ends in a playable demo — the doc's loop degrades gracefully (F1 alone is already a complete cozy experience; everything after deepens it).

---

## 6. Verification — how we'll know it works

**Per-feature, hypothesis-driven (matches the Roadmap's tester gates):**

- **F1 (read loop):** user test n=3–5. _Gate:_ ≥2/3 testers spontaneously say "the dog has emotions / wants something" **without** being told about wants. Instrument: % of wants answered before expiry (should rise within a single session as they learn).
- **F2 (single bond):** A/B the felt experience of one bond metric vs none; confirm players notice unlocks ("it started lying at my feet") without ever seeing a number.
- **F3 (explore):** D1 retention check on a small cohort (Roadmap Sprint 2 gate); qualitative "did finding things together feel good?"
- **F6 (diary):** blind-read test — show a user two diaries (theirs vs another player's); they should recognize their own. That's the "uniquely mine" proof.

**Engineering verification:**

- `npm run dev` → confirm the want state machine fires one-at-a-time, tells are visible, responses register, bond persists across reload (IndexedDB).
- Unit tests (vitest, already in the repo): `Companion` want-selection (one active at a time, wind-up timing, expiry-without-punishment), `Bond` threshold unlocks, `pois` placement avoids colliders, `Diary` event-summary shape. Mirrors the existing `*.test.ts` convention (`collision.test.ts`, `controller.test.ts`).
- Diary determinism: reuse the existing replay determinism test — same seed + input log ⇒ same session summary ⇒ stable diary grounding.
- CI (`typecheck`, `lint`, `build`) stays green; no `PhysicsAdapter` break.

---

## 7. Open questions for review

1. **Want vocabulary size:** start with 3 (attention/play/curious) and grow, or design the full set now? (Recommend: 3, grow per sprint.)
2. **POI souvenirs:** should explore yield a tangible "treasure" at the home post, or stay purely about the shared moment? (Recommend: 1 small tangible to anchor the daily ritual, kept minimal.)
3. **"?" bubble default:** ON for everyone first session, or only when a "needs help" heuristic triggers? (Recommend: ON first session, auto-dims.)
4. **Diary LLM:** confirm model + whether generation is client-side (key exposure risk) or via a tiny serverless endpoint. (Likely serverless even for the prototype.)
5. **Bond visibility:** truly never numeric, or a soft "heart that fills" for legibility? (Recommend: never numeric — behavioural unlocks only, per the README hypothesis.)
