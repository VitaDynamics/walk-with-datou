# walk-with-datou — agent guide

A **front-end companion game for a quadruped robot (Datou, 大头)**. The point of
the product is to make the user *want to spend time with the robot* — calm,
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
one that matters: *does this make the user want to spend more time with the robot?*

Build in **small phases and polish before expanding.** If a feature makes the
product feel cheaper, simpler, or more cluttered, redesign it.

## Current shape: the companion diorama (June 2026 refactor)

The old **500×500 m "park" exploration world** (WASD avatar, GLB scatter
catalog, fetch/inventory) was **removed** in the diorama refactor on
`feat/mujoco-physics` — see `docs/quadruped-game-design-research.md` for the
gameplay rationale. What exists now:

- **One hand-drawn glade diorama** (~13 m): Don't Starve's cutout technique
  (ink-outlined canvas-drawn plates, billboarded in 3D) keyed to the baseline
  palette. All art is generated in code (`src/art/`) with the seeded Rng —
  no downloaded assets.
- **Pointer-first play**: tap Datou to pet · hold to soothe · tap the glade to
  explore together · drag to turn the diorama. No keyboard.
- **Want loop** (`src/game/Companion.ts`): Datou surfaces one want via body
  language; curious wants anchor on **daily date-seeded hidden discoveries**
  (`src/world/Spots.ts` + `src/world/layout.ts`).
- **Bond → milestones → memories**: bond, today's finds, and memory cards
  persist in localStorage (`src/game/Bond.ts`, `Memories.ts`).
- **Datou** is a segmented puppet rig (`src/datou/DatouRig.ts`): gait,
  breathing, eye-plate emotion, sit/play-bow/curious postures.
- **Console UI** (`src/ui/Console.ts` + index.html): status capsule, three
  soft actions, thought chip, memories sheet. i18n EN/中文 in `src/i18n.ts`.

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
- `docs/quadruped-game-design-research.md` — gameplay research behind the
  diorama loop (wants/rapport, daily return, memories, personality axes).
- `docs/GAMEPLAY_DESIGN.md`, `docs/INTERACTION_VERBS.md` — companion systems;
  align them to the baseline where they conflict.
- `docs/ARCHITECTURE.md`, `docs/PHYSICS_INTEGRATION.md` — code structure & physics
  (pre-refactor in places; the physics adapter sections still hold).
- `docs/ENVIRONMENT_DESIGN.md`, `docs/ASSET_CATALOG.md` — **historical** park/asset
  work, removed from the codebase; don't rebuild from these.
