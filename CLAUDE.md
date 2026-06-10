# walk-with-datou — agent guide

A **front-end companion game for a quadruped robot (Datou, 大头)**. The point of
the product is to make the user _want to spend time with the robot_ — calm,
premium, emotionally engaging companionship, **not** an action game or a
traditional web game.

## ⛔ Read this before any visual / UX / scene / asset / feature work

**`docs/DESIGN_BASELINE.md` is BINDING and overrides every other doc.** Read it
before touching anything the user sees. If a change would violate it, **redesign
the change before shipping**. The short version of the rules you will most often
break:

- **The robot is the main character and the primary visual focus.** One clear
  focal point per screen. Large negative space.
- **Aesthetic = Apple Vision Pro / Nothing OS / Teenage Engineering / Stray /
  Monument Valley.** Premium, warm, minimal, quiet. NOT a game HUD, NOT Flash/4399,
  NOT cyberpunk neon, NOT an RPG inventory.
- **Palette:** the warm low-saturation tokens in DESIGN_BASELINE (`#F5F2EC`
  background, `#7C8C7A` accent, etc.). **≤ 3 dominant colors per screen.**
- **No neon, glow, heavy outlines, random particles, spinning logos, bloom,
  oversized cartoon buttons, fake sci-fi dashboards.** (Full prohibition list in
  the baseline — if any appear, redesign first.)
- **World direction:** a warm robotics lab / future-home interior / miniature
  tabletop world — robot-scale and intimate. **Not** a big exploration map.
- **3D scenes:** ≤ 5 major objects, soft ambient + one warm key light, contact
  shadows, low-saturation PBR materials, calm camera.
- **Motion:** breathing, subtle idle, gentle gaze shifts. Never bouncing,
  flashing, spinning, shaking, or arcade-style.
- **Emotion is subtle and robotic** — eye shape, posture, movement rhythm,
  distance, reaction timing. No big cartoon faces.

## Required workflow (do not skip — from the baseline)

**Before** writing user-facing code, state: design goal · layout · visual
hierarchy · color usage · motion strategy · how it avoids cheap game aesthetics ·
how it serves companionship.

**After** writing it, run the **Visual QA checklist** (end of DESIGN_BASELINE.md)
and report: QA result · any prohibited pattern that slipped in · what changed ·
what still needs polish · whether it stays on-baseline. The last QA question is the
one that matters: _does this make the user want to spend more time with the robot?_

Build in **small phases and polish before expanding.** If a feature makes the
product feel cheaper, simpler, or more cluttered, redesign it.

## Current shape: the 500 m walk (June 2026, v2)

A **hand-drawn 500×500 m park you walk through WITH Datou** — Don't Starve's
cutout technique (ink-outlined canvas-drawn plates billboarded in 3D, all art
generated in code from the seeded Rng, `src/art/`) keyed to the baseline
palette. See `docs/quadruped-game-design-research.md` for the gameplay frame.

- **You are a human puppet** (`src/human/`): WASD / tap-to-walk, Shift run.
  Datou (chibi VITA mascot rig, `src/datou/DatouRig.ts` — real vita01evt
  joint layout: 2-segment Z-fold legs, neck head, no tail) walks with you on
  an inked **leash** (follow) or off (potters nearby). Tap to pet, hold to
  soothe.
- **World** (`src/world/`): zones (home/woods/lake/trail/meadow,
  `zones.ts`), one painted floor canvas (`art/worldPaint.ts` — paths, lake,
  baked prop shadows, hand-cut edge), ~2 800 scattered plates as
  InstancedMesh batches (`scatter.ts` pure + `World.ts` renderer).
- **Gather → craft → place** (`src/game/Backpack.ts`, `Crafting.ts`):
  daily-renewing pickables; recipes (fetch stick / cairn / garland /
  lantern); place keepsakes into the world; **fetch** mini-game
  (`Fetch.ts`). Tap any bush/rock/tree → Datou reacts in character.
- **Want loop + daily discoveries** (`Companion.ts`, `world/Spots.ts`):
  6 date-seeded hidden finds across zones; walking Datou past one reveals
  it. Bond → milestones → memory cards, all persisted (localStorage).
- **Console UI** (`src/ui/Console.ts`): status capsule, leash/backpack/
  memories actions, thought chip. i18n EN/中文 in `src/i18n.ts`.

The single product north star, confirmed with the user: **make Datou feel alive**
— reactive, expressive, autonomous, with a personality that diverges over time.

## Tech

- **Three.js 0.180** (only prod dep), **Vite 5**, **TypeScript strict**, **Vitest**.
- Pluggable physics behind `src/physics/PhysicsAdapter.ts` (`PlaceholderPhysics`
  default; optional MuJoCo WASM). **Don't break the adapter contract.** Both
  backends are tuned to glade scale (≈1.7 m/s, 6 m bounds); MuJoCo gets its
  obstacles from the pure `src/world/layout.ts`.
- Deterministic, seeded RNG (`src/physics/mujoco/rng.ts`) for anything
  gameplay-relevant (diary replay, daily spots, sprite plates) — never
  `Math.random` for that (cosmetic-only randomness like blinks is fine).
- `npm run dev` · `npm run build` · `npm run test` · `npm run lint`. Keep all green.
- Headless visual QA that has worked here: dev server + system Chrome
  `--headless=new --use-angle=swiftshader --screenshot --virtual-time-budget=12000`,
  then crop with PIL. Still eyeball real interactions in a browser when possible.
- `public/robots/` holds user-supplied robot models (untracked) — don't delete.

## Key docs

- `docs/DESIGN_BASELINE.md` — **binding** visual/UX/emotional rules (read first).
- `docs/BUILDING_SYSTEM.md` — the Workshop plan: generative 1 000+ item space,
  3×3 arrangement grammar, no-blueprint discovery, Datou inspirations &
  foraging. Implement in its W1–W7 phases.
- `docs/quadruped-game-design-research.md` — gameplay research behind the
  diorama loop (wants/rapport, daily return, memories, personality axes).
- `docs/GAMEPLAY_DESIGN.md`, `docs/INTERACTION_VERBS.md` — companion systems;
  align them to the baseline where they conflict.
- `docs/ARCHITECTURE.md`, `docs/PHYSICS_INTEGRATION.md` — code structure & physics
  (pre-refactor in places; the physics adapter sections still hold).
- `docs/ENVIRONMENT_DESIGN.md`, `docs/ASSET_CATALOG.md` — **historical** park/asset
  work, removed from the codebase; don't rebuild from these.
