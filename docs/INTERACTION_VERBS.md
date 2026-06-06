# Interaction Verbs — Playing _with_ Datou

**Status:** Proposed (for review)
**Date:** 2026-06-06
**Scope:** A detailed design of the **player↔Datou interaction verbs** — the moment-to-moment things a player _does_ to and with the companion dog — with a code-level mapping onto the existing `Game.ts` loop and `PhysicsAdapter`. Web prototype, near-term (Roadmap Sprints 1–3).

> **Companion docs.** This is one of three:
>
> - **Gameplay design** (wants, bond, explore, diary, personality) — the _systems_ these verbs feed. Verbs here cite its features as **GF1–GF6**.
> - **`docs/ENVIRONMENT_DESIGN.md`** — the _world_ and its **object-manipulation verbs** (§4.2: push/throw/carry/break…). This doc is the **creature-interaction** half; the two meet at **fetch** (you throw a world object → Datou retrieves it) and at **shared POIs**.
> - This doc zooms all the way in on the **verbs themselves**: their input, tell, response window, feedback, payoff, failure behaviour, and code path.
>
> **Reference:** the companion-rapport language of _Pokémon Pokopia_ (read Datou's wants → respond → rapport), adapted to a non-verbal dog.

---

## Context — why a verbs doc

The gameplay design establishes the _loop_ (be present → Datou signals a want → you respond → a moment lands → bond grows). But "you respond" is doing a lot of quiet work. **What, concretely, can the player do?** Today it's exactly one verb — _click to pet_. A companion you can only pet is a companion you watch, not one you play with.

This doc enumerates the **interaction verbs** that make Datou feel like a real, responsive creature, and specifies each to implementation depth: the same treatment the environment doc gave its world-manipulation verbs, but pointed at the dog instead of the props. The design rule mirrors the environment doc's: **the verb is resolved by context, not chosen from a menu** — the player has a tiny, consistent input vocabulary, and _Datou's state + what you're near_ decides what that input means.

**Anti-goals** (inherited from the gameplay design): no command menu, no numbers, no fail-states that punish, no twitch demands. Every verb is cozy, readable, and forgiving. The dog should feel _read and answered_, not _operated_.

---

## 1. The input vocabulary (small on purpose)

Three input channels cover every verb. Keeping the vocabulary tiny is what makes the dog feel intuitive rather than operated:

| Channel               | Desktop                       | Touch (later) | Meaning                                                                               |
| --------------------- | ----------------------------- | ------------- | ------------------------------------------------------------------------------------- |
| **Direct touch**      | click/tap _on Datou_          | tap on Datou  | "I'm reaching for you" — pet, take/give, wake                                         |
| **Contextual action** | `E` / on-screen prompt        | prompt button | the one context-resolved verb (shared with the world's `E`, §ENV 4.1)                 |
| **Presence & motion** | where you walk / stand / face | same          | call-by-approach, lead-by-walking, wait-by-standing — _implicit_ verbs with no button |

The third channel is the most important and the most overlooked: **a huge share of dog interaction is just body language and position.** Walking away is "come on"; crouching still is "come here"; standing at a thing is "look at this." We treat these as first-class verbs (§3), not ambient behaviour — they're how you "talk" to Datou without UI.

> **Why context-resolution, not a command wheel:** a wheel turns a companion into a unit you issue orders to (RTS feel). Context-resolution keeps it a relationship — you _offer_ and Datou _responds_ with its own agency (it can decline a play-bow if tired). This is the 默契 pillar in the controls themselves.

---

## 2. The verb set — direct & contextual

Each verb below is specified as: **input → tell/precondition → response window → feedback → payoff → on-miss**. "On-miss" matters as much as payoff — cozy means missing is never punished.

### V1 — Pet (the keystone, exists today)

- **Input:** click/tap on Datou (existing raycast → `physics.applyPet()`, Game.ts:140).
- **Precondition:** Datou within reach / on screen. Best landed _during_ an attention want (GF1).
- **Feedback:** mood→`happy`, tail wag speeds up (existing `Datou.apply`), a soft "pleased" wiggle, optional heart particle.
- **Payoff:** small bond tick; satisfies an _attention_ want; diminishing returns within a session (GF2) so it can't be farmed.
- **On-miss:** clicking empty ground does nothing (no false pet). Petting a _tired_ Datou gives a sleepier, gentler reaction — feedback, not refusal.
- **Depth to add:** **petting location** — clicking head vs back vs belly gives subtly different reactions (head-tilt, lean-in, roll-over), and Datou learns a _favourite spot_ over time (a tiny per-Datou trait feeding GF5 personality). Cheap richness on the verb we already have.

### V2 — Call / summon

- **Input:** _contextual_ (a "call" prompt when Datou is far and idle), or _implicit_ via approach/crouch (§3).
- **Tell:** Datou's ears perk and it orients to you before committing — a readable "heard you" beat, then it trots over (reuse `follow` mode toward player, `setMode('follow')`).
- **Response window:** Datou's eagerness scales with bond + mood (a bonded/ happy Datou bounds over; a tired one ambles; a very independent Adventurer-leaning Datou may finish what it's sniffing first — GF5). **This hesitation is a feature**, not lag: it's where 默契 lives.
- **Payoff:** re-centres the pair, sets up a pet/play; tiny proximity bond trickle.
- **On-miss:** if Datou is mid-want (curious about a POI) it may glance at you but not come — a legible "in a minute" that teaches you to read its focus.

### V3 — Play (initiate a romp)

- **Input:** click Datou _while it play-bows_, or the contextual "play" prompt; throwing a toy (V6) also starts play.
- **Tell:** the _play_ want (GF1) — front-down/rear-up bow, quick spins, fast wag. Unlocks/strengthens with bond (GF2 ~30).
- **Beat:** a short **chase loop** — Datou darts, pauses, invites, darts again (a simple 2–3 waypoint romp using `explore`/`setTarget`), or a **fetch** if a throwable is present (V6 → ENV MovableProps).
- **Payoff:** the biggest single-interaction bond gain; mood→`happy`; prime diary material ("we played until the two-legs got tired").
- **On-miss:** ignore the bow and it relaxes after its wind-up — no penalty, just a slightly wistful settle.

### V4 — Lead / go-together (you point the way)

- **Input:** _implicit_ — walk decisively toward a place (especially a landmark/POI) and Datou, if bonded enough (GF2 ~70 makes it eager), reads your heading and converges; or the contextual "let's go" at a trailhead.
- **Tell:** Datou glances at you (the GF2 ~15 "glance back" habit), then matches your direction — the _player-led_ explore path (GF3).
- **Payoff:** shared arrival at a POI = a shared moment (+bond, diary). This is the verb that makes _you_ able to show Datou something, the mirror of Datou leading you.
- **On-miss:** low bond → Datou wanders its own way; the _consequence_ is simply that leading gets more responsive as you bond — progression you feel.

### V5 — Wait / settle-together

- **Input:** _implicit_ — stand still a while.
- **Tell/Payoff:** at higher bond (GF2 ~50) Datou **lies down at your feet**; a quiet, low-key bond trickle and a mood→`calm`. The cozy "just being together" beat that the whole product hypothesis rests on.
- **On-miss:** n/a — there's no wrong way to stand still. (This verb is pure reward for presence.)

### V6 — Give / take / fetch (the bridge to the world)

This is where creature-interaction meets **object-manipulation** (ENV §4.2 `MovableProps`):

- **Take from Datou:** Datou trots up carrying a found souvenir/stick (its carry verb, ENV §4.2.1) and offers it; click/contextual **take** → it parents to you / registers at the home post (GF3 souvenir). The hand-off _is_ a bond beat.
- **Give to Datou:** offer a held toy → Datou takes it in its mouth (re-parent), may parade it or drop it to invite a throw.
- **Throw → fetch:** you throw a ball/stick (ENV throw verb) → Datou chases via `explore`/`setTarget` to the landed prop, carries it back (ENV carry), and offers it (→ take). The full loop is the play core (V3).
- **Payoff:** fetch is the highest-frequency joyful loop; each return is a small bond tick + a reason to throw again.
- **On-miss:** a low-bond or tired Datou may watch the throw without chasing — readable, never an error state.

> **Cross-doc contract:** the _object physics_ (arc, landing, carry re-parent) lives in ENV `MovableProps`; the _decision to chase and the bond payoff_ live here in `Companion`. Neither doc owns both halves — they meet at the prop interface.

### V7 — Wake / rouse

- **Input:** click/tap a sleeping/resting Datou, or approach noisily.
- **Tell:** a sleepy Datou (mood→`tired`, the GF "stationary too long" state) is curled or lying.
- **Feedback:** a slow stretch-and-yawn rouse animation → back to `calm`. Gentle, never jarring.
- **Payoff:** re-engages without penalty; the stretch is a charming, diary-worthy micro-moment.

---

## 3. Implicit verbs — talking to Datou with your body

The implicit channel deserves its own section because it carries the _relationship_ feel. None of these have a button; all are read from the player's **position, motion, and facing** relative to Datou:

| Implicit verb             | Player does                     | Datou reads it as              | Backed by                     |
| ------------------------- | ------------------------------- | ------------------------------ | ----------------------------- |
| **Come here**             | crouch/stand still + face Datou | "called gently"                | proximity + facing → `follow` |
| **Come on / this way**    | walk away decisively            | "let's move"                   | heading → V4 lead             |
| **Look at this**          | stand at a prop/POI facing it   | "the two-legs found something" | player-led POI (GF3)          |
| **Back off / give space** | step away during a tense beat   | "okay, easing off"             | distance → calmer mood        |
| **Match pace**            | walk slowly vs briskly          | mirror — amble vs trot         | player speed → Datou gait     |

**Design payoff:** because these need _no UI_, a brand-new player is already "talking" to Datou the instant they walk — the controls teach the relationship before any tutorial does. This is the cheapest, highest-impact richness in the whole doc: it's mostly _interpretation_ of inputs the engine already has (player pos/yaw/speed, all in `Player`).

**Readability rule:** Datou should always give a _legible micro-tell_ that it registered an implicit verb (an ear-flick, a glance, a head-turn) so the player learns the body-language is being heard — otherwise implicit verbs feel like nothing happened. One shared `acknowledge()` micro-animation, triggered whenever `Companion` classifies an implicit intent.

---

## 4. Resolution — how one button means the right thing

The contextual action (`E`/prompt) and direct touch must resolve unambiguously. The resolver (in `Companion` / a small `Interaction` arbiter shared with the world, ENV §5.1) picks the single best verb by priority each frame:

```
on contextual action / tap:
  if tapping directly on Datou:
     Datou.resting           → V7 wake
     Datou.offering an item   → V6 take
     active play want (bow)   → V3 play
     else                     → V1 pet
  else (near a world prop):   → defer to ENV verb (kick/pick-up/jump-in…)
  else (at a trailhead/POI):  → V4 lead / GF3 commit
  else                        → V2 call (if Datou far & idle)
```

- **One prompt at a time.** Like the world verbs, never show two competing prompts; nearest-eligible wins, with Datou-direct touch taking precedence when the cursor is on the dog.
- **Generous targets.** Never require pixel-perfect clicks on the dog — the existing whole-body hitbox (`Datou.hitbox`, Datou.ts:76) already does this; keep it generous.
- **Implicit verbs run in parallel**, always, with no prompt — they're classification of movement, not button-resolved.

---

## 5. Code mapping

All of this is **game-layer**; **no `PhysicsAdapter` break** (same conclusion as the other two docs). The verbs sit in the `Companion` brain the gameplay doc already introduces.

- **`Companion.ts`** (gameplay doc, GF) gains a **verb resolver** (§4) and per-verb handlers. It reads `DatouState` (pos/mood/velocity) + `Player` (pos/yaw/speed) and the `input` snapshot, classifies **implicit verbs** every frame, resolves the **explicit verb** on action/tap, and calls the existing levers: `physics.setMode('follow'|'explore')`, `physics.setTarget(...)`, `physics.applyPet()`, plus `bond.addBond(...)` / `diary.record(...)` on success.
- **Game loop:** slots into the insertion point the gameplay doc already specs (between `getDatouState()` and `datou.apply`, Game.ts:113). The existing **click → raycast → applyPet** path (Game.ts:140) becomes the _direct-touch_ dispatch into the resolver.
- **`Datou.ts` expressions:** add poses/micro-animations the verbs need — play-bow, gaze-turn, sit, lie-down, stretch-yawn, `acknowledge()` ear-flick — following the existing mood-driven tail/head pattern (`Datou.apply`, Datou.ts:84). A small `applyExpression(verbState)` alongside `apply(state)`.
- **Fetch / give / take:** delegate object motion to ENV **`MovableProps`** (V6); `Companion` only decides chase + payoff.
- **Input:** the existing `Input` already distinguishes tap-vs-drag (Input.ts) so dragging the camera never fires a verb — reuse as-is. Add an `action` (`E`) flag to `InputState`.
- **Personality hooks:** per-Datou traits (favourite pet spot, call-eagerness, lead-readiness) are small fields the verbs read, fed by GF5 drift — no new system.

---

## 6. Onboarding (verbs teach themselves)

Diegetic, no menus — extends the gameplay doc's onboarding:

1. **Walking is the first verb.** The moment the player moves, Datou reacts (glance, match pace) — the implicit channel teaches itself instantly.
2. **First explicit verb is pet**, surfaced by the first attention want + the "?" bubble (gameplay doc onboarding).
3. **One new verb per early want:** attention→pet, play-bow→play, offered-stick→take/throw — each introduced when its tell first appears, never as a list.
4. **The contextual prompt is the only on-screen teacher**, and it auto-fades as verbs are used reliably (mirrors the "?" bubble graduation).

---

## 7. Verification

- **Manual (`npm run dev`):** each verb fires from the right context and _only_ that context; one prompt at a time; tap-on-Datou never collides with camera drag; implicit verbs produce a visible `acknowledge()` tell; fetch round-trips (throw → chase → carry → take) end-to-end with a bond tick.
- **Feel / user test (n=3–5):** ≥2/3 testers, _unprompted_, do something beyond petting in the first session (call, throw, lead) — proof the verb vocabulary is discoverable. And: do testers describe Datou as "responding to me," not "doing its own thing"?
- **Unit tests (vitest, repo convention — cf. `collision.test.ts`):** verb-resolver picks the correct verb per state matrix (resting→wake, offering→take, bow→play, else→pet); implicit-verb classification from (player pos/yaw/speed, Datou pos) is deterministic; on-miss paths never deduct bond or throw errors; resolver never returns two prompts.
- **No `PhysicsAdapter` change; CI (`typecheck`/`lint`/`build`) stays green.**

---

## 8. Open questions for review

1. **Contextual key:** share one `E` for _both_ world props and Datou verbs (recommended — one button to learn), or separate keys for creature vs world? (Recommend: shared, resolver disambiguates.)
2. **Implicit-verb aggressiveness:** how eagerly should walking-away read as "lead"? Too eager feels like Datou won't leave you alone; too shy feels unresponsive. (Recommend: bond-gated — eager only past GF2 ~70, tunable.)
3. **Pet-location depth:** ship favourite-spot learning in Sprint 1, or defer to the personality sprint (GF5)? (Recommend: ship the _reactions_ in S1, defer _learning_ to S4.)
4. **Voice/whistle later:** reserve an audio "call" verb (mic/keyword) for a post-prototype sprint? (Recommend: out of scope now; note the seam in V2.)
5. **Verb set size:** ship all of V1–V7 in the first two sprints, or a core slice (pet/call/play/fetch) first? (Recommend: pet+call+implicit in S1; play+fetch+take in S2; wait/wake fold in cheaply.)
