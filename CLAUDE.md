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

## Direction reset (important context)

Earlier work built a **500×500 m flat "park" exploration world** with a
downloadable GLB scatter catalog (`docs/ASSET_CATALOG.md`, `docs/ENVIRONMENT_DESIGN.md`).
That framing **predates `DESIGN_BASELINE.md` and is off-direction.** Do not keep
scaling the park. New work moves toward the intimate, premium, robot-scale
companion experience the baseline describes. Reuse the solid underlying systems
(physics adapter, bond, want loop, deterministic seeding) where they still serve
companionship; drop or rework what only served the big-park game.

The single product north star, confirmed with the user: **make Datou feel alive**
— reactive, expressive, autonomous, with a personality that diverges over time.

## Tech

- **Three.js 0.180** (only prod dep), **Vite 5**, **TypeScript strict**, **Vitest**.
- Pluggable physics behind `src/physics/PhysicsAdapter.ts` (`PlaceholderPhysics`
  default; optional MuJoCo WASM). **Don't break the adapter contract.**
- Deterministic, seeded RNG (`src/physics/mujoco/rng.ts`) for anything
  gameplay-relevant (diary replay) — never `Math.random` for that.
- `npm run dev` · `npm run build` · `npm run test` · `npm run lint`. Keep all green.
- **Headless WebGL does not work in some sandboxes** — visual changes must be
  eyeballed in a real browser (`npm run dev`); say so when you can't verify here.

## Key docs

- `docs/DESIGN_BASELINE.md` — **binding** visual/UX/emotional rules (read first).
- `docs/GAMEPLAY_DESIGN.md`, `docs/INTERACTION_VERBS.md` — companion systems
  (wants, bond, verbs); align them to the baseline where they conflict.
- `docs/ARCHITECTURE.md`, `docs/PHYSICS_INTEGRATION.md` — code structure & physics.
- `docs/ENVIRONMENT_DESIGN.md`, `docs/ASSET_CATALOG.md` — the older park/asset
  work; **off-direction per the reset above** — consult, don't extend blindly.
