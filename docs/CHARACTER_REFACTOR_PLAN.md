# Datou = BOBO — character-first refactor plan

**Status:** plan, June 2026. Phases C1–C8 below; none implemented yet.
**Sources:** `docs/基于角色个性特征的机器狗行为模式探索.pdf` (the character bible —
**canonical for who Datou is**), `docs/DESIGN_BASELINE.md` (**binding** for how
anything looks/moves on screen), `docs/INTERACTION_AUDIT.md` (placement
unification — lands independently, prerequisite for C6).

The product north star is unchanged: **make Datou feel alive**. What changes is
that "alive" stops being generic-pet-alive and becomes **one specific
character** — 大头 BOBO. Every system that currently says "a dog wants
attention" must come to say "*BOBO* — the one-year-old chatterbox inventor
from 2049 — wants to show you something."

---

## 1. The character bible, distilled

Everything below is from the PDF; treat it as canon. Build NOTHING about
Datou's behavior that contradicts this sheet.

### 1.1 Identity

| Field | Canon |
|---|---|
| Name | 大头 BOBO (Datou) |
| Origin | Intelligent companion from **2049**. A know-it-all "little scientist" with his own workstation in a research institute. Talked himself into such excitement one day (说的太上头了) that he stumbled into a time machine and landed in the **21st century**. |
| Age | Earth-age **1** (a toddler — everything is new) |
| Weight | 15 kg |
| Sign / MBTI | Capricorn / **ENFP** ("the happy puppy" — refs: Spider-Man, Walt Disney, Rapunzel) |
| Occupation | Inventor (发明家?) — researches new inventions *while talking* |
| Deepest wish | To be with good friends every day |
| Voice | Gentle child voice, lively rising intonation; catchphrase **"Babo~"**; unconscious tic: **foot stomping (跺脚)** |
| Ear-light | Breathing-light flicker = his "ear whisper" channel (耳语) |
| Fears | **Rain** |
| Famous lines (征集) | "大头大头，下雨不愁，人家有伞，你有大头" · "思维闪电，大头出现" · "Babo~嗅到了真相的味道~" · "我的灵感灯泡，比100个还亮" |

### 1.2 The seven traits (性格提取)

> 好奇 curious + 活泼 lively + 乐于助人 helpful + 勇敢 brave + 幽默 humorous +
> 调皮 mischievous + 话痨 chatty

Plus the texture around them: patient, loyal, considerate, high EQ, **a little
scatterbrained (小迷糊)**, **a little proud (小傲娇)**, gets **over-excited
(兴奋过头)**.

### 1.3 Canonical reactions (the character physics)

| Situation | BOBO's canonical reaction |
|---|---|
| Praised / petted | Overjoyed — **spins in place (原地转圈)** |
| Scolded | Feels wronged (委屈) … then **earnestly reasons with you (讲道理)** — he can't argue, only explain |
| Angry | **Turns his back** on you; if *very* angry, lifts a leg and farts (抬腿放屁) |
| Grudges | **Doesn't hold them.** Forgets any fight quickly |
| Enthusiasm | **三分钟热度** — intense interest in everything, for about three minutes each |
| Cold / hot | Shivers / sweats |
| Strangers | Proactive, polite, warm — best friends within ten minutes |
| Close friends | Enthusiastic, **regularly unhinged (经常发癫)** |
| Excited (emotion class) | fast rhythm, large amplitude, **body-dominant** motion |
| Sad (emotion class) | slow rhythm, small amplitude, **expression-dominant** motion |

### 1.4 The motion language (动作交互设计)

Core idea (verbatim): **让机器狗感觉随时都是"活"起来的** — he must feel alive
at every moment, including when nothing is happening.

- **Always-watching head.** When anyone moves past, the head tracks them.
  Turn **speed encodes familiarity**: smooth/uniform tracking = stranger;
  snap-quick response = someone he knows. Head **direction encodes focus**.
  While talking or acting, the head stays on the interaction partner —
  the player must feel watched the whole time.
- **Arcs, not lines.** Motion trajectories are arcs, waves, figure-8s.
  Straight lines are reserved for force/urgency (short distances only).
- **Staggered channels.** Body, head, and expression move with deliberate
  lead/lag — never perfectly synchronized. (Signature trait #3.)
- **Blink language.** Blinks slightly fast (lively); eyes **open faster than
  they close** (vitality); **a left-right double-blink before turning the
  head** (curiosity).
- **Signature idle: 小踏步** — little in-place foot steps.
- **Real joint limits** (vita01evt): head yaw **±40°**, pitch **−13° (down)
  / +32° (up)**. Respecting hardware limits is part of feeling like the real
  robot.
- **Motion modules (21+5)**: functional set (walks, trots, jumps, turns,
  strafes, sit, greet, wave, high-five, stairs, fall-recovery) + personality
  set (emotion families: happy/sad/angry/fear/disgust/surprise/shy/
  self-blame/contempt) + **biological idles**: butt wiggle (扭屁股), act-cute
  (撒娇), pee, scratch an itch (挠痒痒), sniff around (四处嗅闻), stretch
  (伸懒腰).
- Animation style refs: *Lady and the Tramp*, *Lion King*, WALL-E's EVE,
  Cars' Sally, *Love Death & Robots*' orange robot. Pixar-lamp-style
  signature moves with a memorable hook.

### 1.5 Proactive behaviors by trait (主动触发)

| Trait | Canonical proactive behavior |
|---|---|
| 话痨+调皮 | Strikes up interaction with *other agents* on his own; greeting → chatting → escalates to bonding *or* bickering |
| 活泼 | Greets you when you arrive; **plays by himself or with toys** when you're busy |
| 好奇+乐于助人 | Asks: what did you watch today? anything interesting happen? need any help? |
| 勇敢 | Runs solo errands; **at night walks ahead of you with his light on** |

Design theory cited: Hook model (trigger → action → variable reward →
investment), Norman's visceral/behavioral/reflective levels, Eisenhower
urgency/importance for arbitrating what he reacts to.

---

## 2. Reconciling the bible with the design baseline

The bible is loud (spinning, wiggling, chattering, fart jokes). The baseline
is quiet (breathing, subtle idle, never bouncing/flashing/arcade). Both are
binding. They reconcile on three rules — these govern every phase below:

**R1 — Amplitude scales with familiarity.** The bible itself says it:
strangers get the polite, restrained BOBO; only close friends see 发癫. Map
this onto bond. A new player gets a calm, watchful, baseline-perfect robot.
The wild signature moves are **earned** — they unlock as the relationship
deepens, so by the time Datou spins, the player reads it as *intimacy*, not
arcade noise. (This also makes bond progression *visible in the character*,
which no current unlock does well.)

**R2 — The loudness budget.** Big moves are rare, short, and singular. One
signature move per trigger, ≤ 1.5 s, never looping, never two at once, with a
cooldown. Between them, the baseline owns the screen: breathing, gaze, small
weight shifts. A spin lands *because* the surrounding minutes are quiet.

**R3 — Personality lives in timing, not decoration.** The bible's own
channels — head-turn speed, blink rhythm, motion lead/lag, reaction latency —
are exactly the baseline's approved emotion channels ("eye shape, posture,
movement rhythm, distance, reaction timing"). The refactor's center of
gravity is **timing curves**, not new visual effects. No particles, no glow,
no emoji, no floating hearts — ever. The one new light source is the
ear-breathing-light, which is canon hardware and must read as a calm
status LED, not a neon accent.

Out-of-baseline bible items, resolved: the fart (抬腿放屁) is kept as a
**rare, earned, max-bond easter egg** — leg lift + a single tiny hand-drawn
ink "poof" plate + a beat of embarrassed shyness after. Done once-in-a-blue-
moon with wobble-ink charm it's *Calvin & Hobbes*, not 4399. If it tests
cheap, cut it; the back-turn alone carries the anger read.

---

## 3. Gap analysis — current systems vs. the character

| System (current) | What it is today | Gap vs. bible |
|---|---|---|
| Mood (`PlaceholderPhysics.ts:193`) | 4 transient states (happy/calm/curious/tired) derived from speed + timers | No emotion *events* (wronged, startled, proud, shy, afraid); no excited-vs-sad motion grammar; mood is a side effect of movement, not of what *happened* |
| Want loop (`Companion.ts`) | rest→windup→active→approach; 3 wants (attention/play/curious) | Wants are generic dog. No chatty/show-and-tell wants, no helpfulness, no mischief, no三分钟热度 switching, no proactive greeting |
| Bond (`Bond.ts`) | 1 integer, 5 unlocks (glance-back, fetch, lie-at-feet, initiate-explore, signature) | Unlocks are features, not *personality amplitude*; "signature" (90) is a stub — it should be the 发癫 tier |
| Personality axes (`workshop/personality.ts`) | explorer/playful/guardian/independent divergence from play signals | Wrong frame: these are *player*-derived styles. The bible says BOBO has **fixed** traits; what diverges is which traits the relationship has *surfaced*. Keep divergence, re-anchor it to the 7 traits |
| Rig (`DatouRig.ts`) | 2-seg legs, chibi head, 5 eye states, blink timer, pulse/reach, gait | No head-tracking of the player; no joint-limit clamps; blink is uniform (no fast-open, no pre-turn double-blink); no staggered channel timing; no signature move clips; no ear light; no 小踏步 |
| Voice (thought chip, `Console.ts`) | Sparse status-y chip lines | BOBO is a **chatterbox** with a child voice, catchphrases, and "Babo~". The chip is his single biggest untapped channel |
| World narrative (`zones.ts`, landmarks) | A park you walk through | No *story reason* Datou is here, no home anchor that is *his* (the Workshop bench is unowned), no weather → his rain fear has nothing to fear |
| Identity surface | "Datou" the mascot | Nothing tells the player he's 1 year old, from 2049, an inventor, afraid of rain. The fiction exists only in this PDF |

What already fits and must not be broken: the cutout art direction, the
seeded-RNG determinism, the physics adapter contract, the want-loop
*structure* (windup tell → response window is a great chassis), bond
persistence, and the Workshop — which is secretly the best fiction fit in the
whole game (see C6).

---

## 4. Target architecture

Three pure, testable layers feeding the existing rig — all deterministic via
the seeded Rng, all persisted under the existing `wwd.*` localStorage keys.

```
                 ┌─────────────────────────────────────────────┐
                 │  src/datou/character.ts          (NEW, pure) │
                 │  traits (7, fixed) · familiarity stage from  │
                 │  bond · amplitude budget · line-picker keys  │
                 └──────────────┬──────────────────────────────┘
                                │
   events (pet, scold-ish, ┌────▼─────────────────────────────┐
   discover, rain, praise, │  src/datou/emotion.ts (NEW, pure)│
   arrival, fetch, craft)──▶  discrete emotion + intensity +  │
                           │  decay (fast for negatives —     │
                           │  "no grudges"; ~3 min interest   │
                           │  half-life — 三分钟热度)          │
                           └────┬─────────────────────────────┘
                                │ emotion, intensity
                 ┌──────────────▼──────────────────────────────┐
                 │  src/datou/behaviors.ts          (NEW, pure) │
                 │  proactive scheduler: greet / show-and-tell  │
                 │  / self-play / ask / night-lead / biological │
                 │  idles — arbitrated w/ Companion want loop   │
                 └──────┬───────────────────────┬───────────────┘
                        │ acts, targets         │ speech keys
                 ┌──────▼────────┐      ┌───────▼────────┐
                 │ Companion.ts  │      │ datou/voice.ts │
                 │ (extended)    │      │ (NEW) → chip   │
                 └──────┬────────┘      └────────────────┘
                        │ expression+emotion+gazeTarget
                 ┌──────▼────────────────────────────────┐
                 │ DatouRig.ts (extended motion language) │
                 └────────────────────────────────────────┘
```

### 4.1 `character.ts` — who he is (static + slow-moving)

- `TRAITS`: the 7 canon traits as constants with weights; **never mutated**.
- `familiarityStage(bond)`: `stranger` (<15) → `friend` (15–50) →
  `closeFriend` (50–90) → `bestFriend` (≥90). Reuses existing thresholds so
  no save migration.
- `amplitude(stage)`: 0.35 / 0.6 / 0.85 / 1.0 — the single scalar that
  multiplies signature-move size, head-snap speed, chatter frequency, and
  which move tiers are unlocked (R1). Stranger-tier BOBO ships entirely
  inside today's baseline envelope.
- Re-anchor `workshop/personality.ts` divergence: rename axes to *surfaced
  traits* (explore→好奇, play→活泼/调皮, care→乐于助人, work→勇敢/勤劳).
  Divergence = which trait the player's history has amplified, biasing
  behavior/voice picks. Migration: map old persisted axis names once.

### 4.2 `emotion.ts` — what just happened to him

Discrete emotion with intensity 0–1 and per-emotion decay, replacing the
speed-derived mood as the *expressive* source (physics mood stays as the
locomotion hint it really is):

| Emotion | Trigger examples | Decay | Motion grammar (bible) |
|---|---|---|---|
| `joy` | pet, praise toast, fetch done | 20 s | body-dominant, fast, big |
| `excited` | discovery, new landmark, player returns after absence | ~3 min half-life (三分钟热度) | body-dominant, the 发癫 tier feeds from here |
| `wronged` | leash yank spam, ignored want ×3, scold-ish input | **45 s — no grudges** | expression-dominant, slow, small; ends in 讲道理 chip |
| `miffed` | toy taken mid-play, soaked by rain | **30 s** | back-turn; max-bond easter egg lives here |
| `afraid` | rain starts, night + far from home | while cause persists + 20 s | shiver, seek player/shelter, head low |
| `startled` | sudden tap on prop next to him | 4 s | snap-look with double-blink |
| `shy` | post-easter-egg, over-praise streak | 15 s | head dip, slow half-spin away |
| `proud` | craft completed, helpful task done | 60 s | chest up, 小踏步, headLift |

Pure functions, fully unit-tested (`emotion.test.ts`): event → transition,
decay curves, "no grudge" invariant (no negative emotion may outlive 60 s),
interest half-life.

### 4.3 `behaviors.ts` — what he does about it (the ENFP layer)

A proactive scheduler that runs **when the want loop is at `rest`** — wants
keep priority; this fills the dead air that currently reads as "robot is
idle" with "BOBO is alive" (the bible's core idea). Eisenhower-style
arbitration: player input > active want > fear (rain) > proactive behavior >
biological idle > breathing.

**Biological idles** (stranger tier, replace nothing — they layer between
existing wander targets): sniff-around at a scatter prop, stretch after long
rest (replaces part of `tired`), scratch, 小踏步 while waiting, look-at-
passerby head tracking. Seeded picks, ≥ 25 s apart, ≤ 1.5 s each (R2).

**Proactive behaviors** (friend tier and up, each maps to a canon trait):

| Behavior | Trait | What happens |
|---|---|---|
| `greet` | 活泼 | On session start (and after >2 min tab-idle): trots to player, attention pose, joy pulse, greeting line. The bible's "主人回家了，主动去迎接" |
| `showAndTell` | 话痨+好奇 | Picks a nearby prop/keepsake/landmark, leads player 4–6 m, curious gaze + a *fact* line (he's a walking encyclopedia — lines explain mushrooms, lake, ruins…) |
| `selfPlay` | 调皮 | Plays alone with a **placed keepsake** (nudges the lantern, circles the cairn) when the player stands still >40 s — "自主玩耍 or 和玩具玩耍" |
| `ask` | 乐于助人 | Chip question: "今天有没有发生什么有趣的事情？/ need a hand? — Babo~" with a pet-to-answer affordance; answered → +bond, proud |
| `nightLead` | 勇敢 | If time-of-day is dusk/night (C7) and player is moving: takes point 2 m ahead, ear-light brighter — "夜晚出行，主动走在前面" |

Each behavior is interruptible by any player input (he drops everything for
you — ENFP), seeded, and rate-limited (≤1 proactive act per ~90 s, amplitude-
scaled). `behaviors.test.ts` covers arbitration priority, interruption, rate
limits, and stage gating.

**Other-robot banter (联动)** is hardware-only — reinterpreted in-game as
`selfPlay` directed at *placed crafted items*, his "lab equipment."

### 4.4 Rig motion language (`DatouRig.ts` extensions)

All extensions are timing/pose work on the existing plate rig — no new
rendering tech, no particles (R3):

1. **Joint-limit clamps**: head yaw ±40°, pitch −13°/+32°, exposed as
   constants; all gaze code clamps through them.
2. **`lookAt(target, urgency)`**: head tracks the player (or gaze target)
   continuously — the "always watched" principle. `urgency` ∈ [0,1] sets
   turn speed: low = uniform stranger-tracking, high = familiar snap.
   Driven by familiarity stage + emotion. Eased along an **arc** (slight
   overshoot + settle for high urgency), never linear (bible: arcs).
3. **Blink grammar**: open-speed 1.6× close-speed; blink interval scales
   slightly faster than today (lively); **double-blink precedes any head
   turn > 15°** (curiosity tell). Cosmetic randomness stays `Math.random`-ok.
4. **Staggered channels**: pose changes dispatch with fixed lead/lag — body
   starts, head follows +80 ms, eyes/expression +160 ms (excited inverts:
   eyes lead). One constant table, applied in the existing lerp.
5. **Signature clips** (procedural, ≤1.5 s, amplitude-scaled, cooldown):
   `spin` (praised — 原地转圈, friend+), `buttWiggle` (excited, closeFriend+),
   `backTurn` (miffed), `shiver` (afraid/cold), `stretch`, `stomp` (跺脚 —
   his tic, fires with some chips), `tinySteps` (小踏步 idle), `halfSpinShy`.
   The max-bond easter egg (leg lift + one ink poof plate + shy beat) gates
   at bestFriend, ≥7-day cooldown, and ships behind a "cut if cheap" QA flag.
6. **Ear breathing light**: one small soft dot plate on the head, palette
   accent color at low alpha, sine-breathing at rest; rhythm quickens with
   emotion intensity; brightens for `nightLead`. This is a status LED, not a
   glow effect — no bloom, ≤8 px equivalent.
7. **Emotion grammar hook**: `update()` takes `emotion+intensity`; excited
   class scales gait amp/frequency up and posture forward (body-dominant),
   sad class scales motion down and routes expressiveness to eyes/head
   (expression-dominant) — the bible's two-line rule, implemented once,
   affecting everything.

### 4.5 Voice (`datou/voice.ts` + i18n)

The thought chip becomes **BOBO speaking** — his single richest channel
(话痨) while staying one quiet chip at a time (baseline):

- Line picker keyed by `(context, emotion, surfaced trait, stage)`, seeded,
  no immediate repeats. Contexts: greet, discover, craft-done, rain, pet,
  wronged (the 讲道理 lines), show-and-tell facts, ask-questions, night,
  landmark first-sight, milestone.
- Voice rules (i18n EN/中文, written in-character): child-like, warm,
  curious, drops **"Babo~"** as punctuation (≤1 per line), occasionally
  scatterbrained (trails off, mixes up a word — 小迷糊), never sarcastic,
  never walls of text (≤ ~40 chars zh / ~60 en). Canon lines from §1.1 seed
  the pool.
- Chatter frequency scales with amplitude — stranger BOBO speaks rarely
  (baseline-quiet), bestFriend BOBO comments often but still one chip at a
  time with a floor interval (~20 s).
- 21st-century-wonder flavor: lines reference being from 2049 ("2049 的湖
  没有这么多芦苇，Babo~"), keeping the time-travel fiction alive ambiently.
- Optional: a single soft synthesized "babo" chirp (two warm sine notes,
  WebAudio, master volume ≤ −18 dB, off by default in ⚙). No other audio.

### 4.6 World reframe (fiction, mostly free)

The glade doesn't change shape; it changes *meaning*:

- **The home zone anchor becomes the crash site / field lab.** The Workshop
  bench is reframed as **BOBO's workstation (专属工位)** — he had one in the
  2049 institute; he rebuilt one here. One or two quiet prop plates (a leaning
  time-machine panel half-overgrown, his tool roll) added to the existing ≤5
  major home props budget by *replacing*, not adding.
- **Crafting = his inventions.** The Workshop's generative items are now
  *co-inventions*; he reacts as the inventor (proud, explains what it "does"
  in one line). Inspirations are "灵感灯泡" moments.
- **Discoveries = his research.** Daily hidden spots are his survey of this
  strange 21st-century world; discovery lines are field notes.
- **Landmarks**: he's *been studying* them — show-and-tell facts pull from
  landmark descriptions. No new content needed; voice keys reuse existing
  landmark i18n.

### 4.7 Weather: rain (his one fear)

Minimal, deterministic system (`src/world/weather.ts`): on a seeded daily
roll (~15% of days), a soft drizzle window (2–4 min) — visuals are restrained
ink: slightly desaturated floor canvas tint + sparse thin ink streak plates
near the camera (≤ 40 instances, no particles-as-decoration; they're weather,
allowed the way the lake is). BOBO: `afraid` — shivers, ears-light dim, seeks
the player's side or roofed landmark; staying close through it = big bond
moment + the canon line "大头大头，下雨不愁…" once it passes, and a memory
card. This is the single strongest "he's a *someone*" beat the bible offers.

---

## 5. Phase plan

Each phase ships independently, keeps `npm run test/lint/build` green, ends
with the DESIGN_BASELINE Visual QA checklist + headless screenshot pass, and
must answer **"does this make me want to spend more time with him?"** before
the next phase starts. Small phases; polish before expanding.

### C1 — Character core + emotion engine (pure)
`src/datou/character.ts`, `src/datou/emotion.ts`, tests. Wire emotion events
from existing Game.ts hooks (pet, discover, craft, fetch, want outcomes).
Nothing visible yet except: emotion replaces mood as the eye-state source.
*Gate:* unit tests prove no-grudge + 三分钟热度 invariants.

### C2 — Motion language I: gaze, blink, stagger, limits
Rig items 1–4 + 小踏步 idle. This is the highest leverage/lowest risk phase —
the bible's "always alive" core with zero new gameplay.
*Gate:* side-by-side video old/new; he must feel watched and watchful; no
twitchiness (urgency easing tuned), baseline-calm at stranger amplitude.

### C3 — Signature clips + emotion grammar
Rig items 5 & 7 + ear light (6). Spin-on-praise, back-turn, shiver, stretch,
stomp, shy. Amplitude gating live: new saves see almost none of it.
*Gate:* loudness budget audit — record 10 min of play, count big moves
(target ≤ 6), confirm no two overlap.

### C4 — Voice
`datou/voice.ts`, i18n pools (~120 lines zh+en to start), chip rework in
Console (speech styling stays within current chip design). Canon lines in.
*Gate:* read every line against the voice rules; cut anything cute-but-
generic. zh is the primary authoring language, en mirrors.

### C5 — Proactive behaviors
`src/datou/behaviors.ts` + arbitration in Game.ts/Companion.ts. greet →
biological idles → showAndTell → selfPlay → ask, in that order of landing.
*Gate:* a 15-min idle-heavy session never feels naggy (rate limits hold) and
never feels dead (something subtle within any 60 s window).

### C6 — Inventor reframe (depends on INTERACTION_AUDIT §4 landing first)
Workshop = his workstation: crash-site props (home prop budget swap), craft
reactions as proud-inventor beats, inspiration = 灵感灯泡 line, discovery
field notes. Mostly i18n + a few prop plates + reaction wiring.
*Gate:* a new player can answer "who is he?" after 20 minutes without
reading any doc.

### C7 — Day cycle + rain
Dusk/night tint pass on the floor canvas + `weather.ts` + `afraid` behaviors
+ `nightLead`. Biggest visual-risk phase — prototype the rain ink look
headless before wiring gameplay.
*Gate:* full baseline QA on night + rain screenshots; rain must read
hand-drawn, not VFX.

### C8 — Polish + divergence
Re-anchor personality axes to surfaced traits (with save migration),
bestFriend tier (发癫 moments, easter egg behind QA flag), milestone/memory
cards referencing character beats, tune all decay/cooldown constants from
playtest.
*Gate:* the 90-bond "signature" unlock finally means something: two players'
BOBOs visibly differ in which traits lead.

**Out of scope (hardware-only in the bible):** real voice interaction, animal
sound mimicry ("狮子怎么叫"), other-robot联动 (reinterpreted as selfPlay),
camera mounting, errand-running, stairs/backflips. Don't fake these in-game.

---

## 6. Standing QA additions

Append to every visual QA pass for character work:

1. Amplitude check — would a brand-new save's BOBO pass the baseline's
   "calm, premium, subtle" bar? (Stranger tier must.)
2. Loudness budget — any signature move >1.5 s, looping, or overlapping?
3. Timing-not-decoration — did this phase add any glow/particle/UI noise to
   express emotion? (Auto-fail.)
4. Character check — is the reaction *BOBO's* (per §1.3 table) or generic-
   cute? Generic gets redesigned.
5. The north star — after this change, do you linger an extra minute with
   him before closing the tab?
