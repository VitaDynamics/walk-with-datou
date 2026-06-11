# BOBO character refactor — implementation spec

Companion to `docs/CHARACTER_REFACTOR_PLAN.md` (the *why* and the canon);
this is the *how*: concrete APIs, wiring tables, constants, and tests,
grounded in the code as of commit `2d82cda`. Update the status column as
phases land.

| Phase | Scope | Status |
|---|---|---|
| C1 | `character.ts` + `emotion.ts` engines + Game wiring | **implemented** |
| C2 | Rig motion language: limits, gaze, blink grammar, stagger, 小踏步 | **implemented** |
| C3 | Signature clips, emotion grammar, ear light | **core implemented** (more clips + eye plates pending) |
| C4 | Voice (`voice.ts`, i18n pools, chip rework) | planned (§5) |
| C5 | Proactive behaviors (`behaviors.ts`) | planned (§6) |
| C6 | Inventor reframe | planned — blocked on INTERACTION_AUDIT §4 |
| C7 | Day cycle + rain *scene* | planned (§7) — note: rain *data* already exists |
| C8 | Divergence + bestFriend tier | planned (§8) |

---

## 0. Code facts the design binds to (verified)

- **Rig** (`src/datou/DatouRig.ts`): single smoothed `Pose` lerped at
  `k = 1−exp(−dt·7)` (line ~416); blink = timed texture swap (uniform 0.12 s);
  facing = instant `flip.scale.x` sign flip from screen-space velocity;
  `petPulse` lean; eye plates: `neutral|happy|curious|sleepy|blink`.
- **Brain** (`src/game/Companion.ts`): rest→windup→active→approach→cooldown;
  3 wants; expression = `none|attention|play|curious{dir}`.
- **Bond** (`src/game/Bond.ts`): integer, thresholds 15/30/50/70/90,
  persisted `wwd.bond` (Game.ts save tick ~line 1853).
- **Mood** (`src/physics/PlaceholderPhysics.ts:193`): happy/calm/curious/
  tired from speed+timers, crosses the `PhysicsAdapter` contract
  (`DatouState.mood`) — **do not remove from the contract** (MuJoCo backend
  implements it too). Emotion *overrides* it on the render side only.
- **Weather already exists**: `src/game/workshop/weather.ts` — seeded daily
  `clear|breeze|rain|fog` + season + world tint, already wired into
  inspiration (`Game.ts:1237`). C1 reads `weatherFor()` for the rain-fear
  emotion *today*; C7 only adds the visible drizzle + shelter behavior.
- **Pet event**: `Game.ts:512` (`events.petted = true; physics.applyPet()`),
  comfort hold completes at `Game.ts:639`.
- **Rng**: `src/physics/mujoco/rng.ts` mulberry32 — use for any
  gameplay-relevant randomness; `Math.random` allowed for cosmetic only
  (blink intervals).
- **Palette accent**: `ROBOT.accent = '#d9a441'` (`src/art/palette.ts`) —
  the ear light's only permitted color.

---

## 1. C1 — `src/datou/character.ts`

Pure constants + functions. No state, no imports beyond types.

```ts
export type TraitId =
  | 'curious' | 'lively' | 'helpful' | 'brave'
  | 'humorous' | 'mischievous' | 'chatty';

export type FamiliarityStage = 'stranger' | 'friend' | 'closeFriend' | 'bestFriend';

/** Stage from bond — reuses Bond's existing thresholds (no save migration). */
export function familiarityStage(bond: number): FamiliarityStage;
// <15 stranger · <50 friend · <90 closeFriend · ≥90 bestFriend

/** The expressiveness scalar (refactor plan R1/R2). */
export function amplitude(stage: FamiliarityStage): number;
// 0.35 / 0.6 / 0.85 / 1.0

/** Gaze urgency toward the player by stage (bible: turn speed encodes
 *  familiarity — uniform for strangers, snappy for friends). */
export function gazeUrgency(stage: FamiliarityStage): number;
// 0.25 / 0.55 / 0.8 / 1.0

/** Clip permission by stage (R1: big moves are earned). */
export function clipAllowed(clip: SignatureClip, stage: FamiliarityStage): boolean;
// stranger: stretch, stomp, shiver only (functional/biological)
// friend+: spin · closeFriend+: buttWiggle, shyTurn · bestFriend: easterEgg
```

## 2. C1 — `src/datou/emotion.ts`

Discrete emotion + intensity with per-emotion decay. Pure, deterministic
(event-driven + exponential decay; zero RNG). The renderer never reads
physics mood for *expression* once this lands — mood remains a locomotion
flavor only.

```ts
export type EmotionKind =
  | 'neutral' | 'joy' | 'excited' | 'proud'
  | 'wronged' | 'miffed' | 'afraid' | 'startled' | 'shy';

export type EmotionEvent =
  | 'pet' | 'comfort' | 'praise'        // touch + want answered
  | 'discover' | 'landmark'             // novelty → excited (三分钟热度)
  | 'craft' | 'helped' | 'fetch'        // inventor pride
  | 'greetPlayer'                       // session start → excited
  | 'ignoredWant'                       // ×3 within decay → wronged
  | 'startle'                           // sudden nearby tap
  | 'rainStart' | 'rainEnd'             // his one fear
  | 'overPraise';                       // praise streak → shy

export interface EmotionState { kind: EmotionKind; intensity: number; } // 0..1

export class EmotionEngine {
  apply(event: EmotionEvent): void;
  update(dt: number): void;
  get state(): EmotionState;            // current winner (highest intensity)
  /** 'excited-class' (body-dominant) | 'sad-class' (expression-dominant) | null */
  get grammar(): 'excited' | 'sad' | null;
}
```

**Decay table** (intensity halves every `halfLife` seconds; an emotion below
0.12 yields to the next strongest, then `neutral`):

| Emotion | Set to | Half-life | Notes |
|---|---|---|---|
| joy | 1.0 | 9 s | pet/comfort/praise; re-applying refreshes |
| excited | 1.0 | **75 s** (≈3 min to fade-out — 三分钟热度) | discover/landmark/greet |
| proud | 0.9 | 25 s | craft/helped/fetch |
| wronged | 0.8 | **18 s** | needs 3 `ignoredWant` within 90 s (counter decays too) |
| miffed | 0.7 | **12 s** | rainStart while exposed, toy interrupted (C5) |
| afraid | 0.9 | sustained while rain, then 8 s | rainStart sets, rainEnd releases |
| startled | 1.0 | 2 s | snaps gaze; decays into residual `excited` 0.3 |
| shy | 0.8 | 7 s | overPraise (4th praise within 30 s) |

**Invariants (tested):** no negative emotion (`wronged|miffed|afraid|
startled`) may have intensity > 0.12 more than **60 s** after its last
triggering event (no grudges — afraid exempt while rain persists);
positive events *immediately clear* `wronged`/`miffed` (he forgets the
moment you're kind); `startle` overrides everything for its 2 s.

**Eye mapping** (until new eye plates land in C3 polish):
`joy|excited|proud → happy` · `startled|afraid → curious` (wide) ·
`wronged|shy → sleepy` (lidded reads as downcast) · `miffed|neutral → neutral`.

**Tests** (`emotion.test.ts`): transition per event; half-life math;
no-grudge invariant sweep (apply every negative, step 60 s, assert ≤0.12);
positive-clears-negative; ignoredWant counter (2 ignores ≠ wronged, 3 = yes);
rain sustain + release; winner selection.

## 3. C2 — rig motion language (`DatouRig.ts`)

New per-frame input (one optional arg, default keeps old behavior so tests
and MuJoCo path don't break):

```ts
export interface CharacterChannel {
  emotion: EmotionState;
  grammar: 'excited' | 'sad' | null;
  amplitude: number;        // 0.35..1 from character.ts
  gazeX: number; gazeZ: number;  // usually the player
  gazeUrgency: number;      // 0..1
}
update(dt, state, expression, camYaw, ch?: CharacterChannel)
```

1. **Joint limits.** `HEAD_PITCH_DOWN = 13°`, `HEAD_PITCH_UP = 32°` →
   `pose.headRot` clamped to `[-0.56, 0.227]` rad after every composition
   (positive headRot = droop/down in this rig). Yaw ±40° governs how far the
   eyes may offset toward an off-facing gaze before a facing flip is forced.
2. **Gaze.** When expression is `none` and the gaze target is within 4.5 m,
   facing turns toward it. A facing flip is **preceded by a double-blink**
   (two 0.07 s closes 0.12 s apart) and delayed by `0.22 − 0.16·urgency` s —
   strangers track lazily, friends snap (bible: speed encodes familiarity).
   Velocity-driven facing (movement) keeps priority and skips the ceremony.
3. **Blink grammar.** Blink becomes eye-plate **scale.y animation**:
   close over 0.075 s, hold 0.04 s, open over 0.045 s (open ≈1.6× faster —
   vitality). Interval 2.2–4.8 s (slightly faster than the old 2.6–5.6 —
   lively). Blink texture swaps in at the closed midpoint as before.
4. **Stagger.** The single pose lerp splits into two followers: body keys
   ease toward the target at `k7`; head keys (`headRot/headLift/headBob`)
   ease toward the **body follower's value** (chained easing ≈ +80 ms lag).
   `grammar === 'excited'` inverts: head eases at `k10` directly (eyes/head
   lead, body lags) — the bible's body-dominant vs expression-dominant rule.
5. **小踏步.** At rest with `excited|joy|proud` and intensity > 0.35: gait
   phase keeps advancing at a low fixed rate with `legAmp = 0.07·amplitude`
   — tiny in-place steps, never while a clip plays.
6. **Emotion grammar multipliers.** excited-class: gait freq ×(1+0.18·i·amp),
   bob ×1.2, posture +forward 0.02; sad-class: legAmp ×0.8, lerp k ×0.7
   (slower), all expressiveness routed to head/eyes.

## 4. C3 — signature clips + ear light (`DatouRig.ts`)

```ts
export type SignatureClip =
  | 'spin'        // praised — 原地转圈: flip yaw +2π eased 0.9 s, tiny hop
  | 'backTurn'    // miffed — face away from gaze, head droop, 1.2 s hold
  | 'shiver'      // afraid/cold — bodyRot ±0.025 at 14 Hz, 1.0 s
  | 'stretch'     // after long rest — slow play-bow in/out, 1.4 s
  | 'stomp'       // 跺脚 tic — front thigh double-lift, 0.5 s
  | 'shyTurn';    // shy — half turn away + head dip, 0.8 s
playClip(clip: SignatureClip): boolean;  // false if one is already playing
```

Rules (refactor plan R2): one clip at a time; every curve ≤1.5 s; all
amplitudes ×`ch.amplitude`; *callers* own cooldowns (Game/behaviors), the
rig only refuses overlap. Stage gating via `clipAllowed()` happens at the
call site. The `spin` reads as a paper-doll twirl (the plate passes edge-on
twice) — verified charming in headless QA before tuning further.

**Ear light**: one 0.035-radius dot plate on the head dome,
`ROBOT.accent` at base alpha 0.35, sine-breathing `0.5 + 0.5·sin` at
0.45 Hz rest → up to 1.1 Hz scaled by emotion intensity. No glow texture,
no bloom — a status LED (baseline R3). Brightens to alpha 0.55 only for
`nightLead` (C7).

**Pending in C3 polish:** `buttWiggle` + easter-egg clips (bestFriend tier,
C8 gates them anyway); two new eye plates (`soft` downcast, `wide`
surprise) in `art/datouParts.ts` to replace the sleepy/curious stand-ins.

## 5. C1 wiring map (Game.ts)

| Hook (existing line ≈) | Emotion event | Extra |
|---|---|---|
| pet tap `:512` | `pet`; 4th praise in 30 s → engine emits shy itself | `playClip('spin')` if `clipAllowed` + 20 s cooldown |
| comfort hold `:639` | `comfort` | — |
| `handleDiscover` `:1571` | `discover` | — |
| `handleWantSatisfied` `:1591` | `praise` | — |
| `handleFetchComplete` `:1543` | `fetch` | — |
| workshop make / curio banked `:1200,1253` | `craft` | proud beat replaces nothing |
| landmark noticed (companion cb) | `landmark` | — |
| want expired ×: Companion gains `onWantExpired` callback | `ignoredWant` | new optional action, fired from `expire()` |
| session start (constructor, once) | `greetPlayer` | full greet behavior is C5; emotion-only now |
| rain | `rainStart` | **deliberately NOT wired until C7**: a sustained `afraid` with no visible drizzle would read as a bug, not a fear. The engine + shiver path are ready and tested. |
| milestone unlock loop `:1747` | `praise` | — |

Per-frame: `emotion.update(dt)`; rig call at `:1778` gains the
`CharacterChannel` (gaze = player position; urgency/amplitude from
`familiarityStage(bond.level)`). Console mood word maps emotion when
intensity > 0.4 (joy/excited/proud→happy, afraid/startled→curious,
wronged/shy→tired word stays out — C4 replaces this surface with voice).

## 6. C5 preview — `behaviors.ts` arbitration (planned)

Priority: player input > active want (Companion) > afraid (rain shelter) >
proactive (greet → showAndTell → ask → selfPlay → nightLead) > biological
idle (stretch/stomp/sniff) > breathing. Implemented as a scheduler ticked
only while Companion is `rest` and Fetch/Forage/Harvest idle; emits
the same `CompanionActions` levers + `playClip` + voice keys. Rate: ≤1
proactive per 90 s ÷ amplitude; biological ≥25 s apart. Seeded `Rng`
(`dailySeed ^ 0xb0b0`). Tests: priority, interruption-on-input, rate, stage
gates.

## 7. C7 preview — rain scene (planned)

`weatherFor()` already decides rainy days. Add: drizzle window picker
(seeded, 2–4 min within session), ink-streak instanced plates (≤40, near
camera), floor tint via existing `tintFor`, `afraid` sustained during the
window, shelter-seek = `setMode('follow')` override + shiver clips, the
canon line + memory card on first sheltered-through rain.

## 8. C8 preview — divergence (planned)

`workshop/personality.ts` axes renamed to surfaced traits
(explore→curious, play→lively/mischievous, care→helpful, work→brave) with
a one-shot `wwd.personality` value migration; surfaced trait biases voice
picks and behavior weights; bestFriend tier enables buttWiggle/easter egg
behind a QA flag.

## 9. Test & QA matrix

- `character.test.ts` — stage thresholds (14/15/49/50/89/90), amplitude
  monotonic, clip gating table.
- `emotion.test.ts` — §2 invariants.
- Existing suites must stay green untouched: rig param is optional;
  `PhysicsAdapter` contract unchanged.
- Headless QA (CLAUDE.md recipe) after C2/C3: screenshot at rest (stranger
  amplitude — must be indistinguishable from pre-refactor calm) and a
  staged spin frame.
- Loudness budget audit (plan §5 C3 gate) before enabling spin by default.
