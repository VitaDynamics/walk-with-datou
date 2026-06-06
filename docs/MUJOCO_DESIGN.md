# MuJoCo-WASM Physics Integration — Design & Plan

**Status:** Proposed (for review)
**Branch:** `feat/mujoco-physics`
**Author:** physics integration
**Date:** 2026-06-06

This document is the architecture design and rollout plan for replacing the
kinematic `PlaceholderPhysics` stub with a real MuJoCo simulation, compiled to
WebAssembly. It is meant to be reviewed **before** any implementation lands.

---

## 1. Goals & non-goals

### Goals

1. Drive Datou's body with the real MuJoCo engine (`@mujoco/mujoco` WASM build)
   while keeping the existing `PhysicsAdapter` contract intact — no changes to
   `Game.ts`, `World.ts`, or `Datou.ts` should be required to flip the backend.
2. Keep `PlaceholderPhysics` as a first-class fallback (older devices, CI, and
   A/B testing), per the rationale already in `docs/PHYSICS_INTEGRATION.md`.
3. Load the engine lazily and asynchronously so the game still boots instantly;
   the placeholder runs until MuJoCo is ready.
4. Land the WASM asset in-repo and serve it correctly through Vite + GitHub Pages.

### Non-goals (this phase)

- Full skeletal/legged locomotion with a trained policy. Phase 1 simulates a
  **rigid Datou puck** with a velocity controller; realistic gait is a later
  phase (see §8).
- Multi-threaded (`SharedArrayBuffer`) build. GitHub Pages cannot send the
  COOP/COEP headers the MT build requires (see §6). We ship single-threaded.
- Rendering MuJoCo geoms directly via `mjv_updateScene`. The game keeps its
  stylised Three.js Datou mesh; MuJoCo is the *motion source*, not the renderer.

---

## 2. The asset we're integrating

`/home/fengchen/feng-ws/mujoco/wasm/dist/` is the official Google DeepMind
`@mujoco/mujoco` build (Apache-2.0). Relevant files:

| File | Size | Purpose |
|------|------|---------|
| `mujoco_st.js` | ~280 KB | single-threaded ESM loader (`export default loadMujoco`) |
| `mujoco_st.wasm` | ~8.5 MB | single-threaded engine |
| `mujoco_st.d.ts` | ~134 KB | TypeScript declarations for `MainModule` |
| `mujoco.js` / `mujoco.wasm` | ~8.7 MB | multi-threaded build (not used — see §6) |

**Decision:** we vendor the **single-threaded** trio (`mujoco_st.*`). The `.wasm`
is ~8.5 MB; that is the headline cost of this change and is discussed in §6.

The loader is an Emscripten factory: `loadMujoco(opts?) => Promise<MainModule>`.
By default Emscripten fetches the `.wasm` sibling to the `.js`; we override
`locateFile` so the URL is resolved by Vite's asset pipeline (see §5.2).

### Key API facts (from the dist `.d.ts` and demo app)

- `mujoco.MjModel.from_xml_string(xml)` → compiles a model from an MJCF string.
- `new mujoco.MjData(model)` → simulation state.
- `mujoco.mj_step(model, data)` advances by `model.opt.timestep`.
- `data.qpos` / `data.qvel` are **live Float64 views** into WASM heap — reading
  them after a step is free; they update in place.
- Embind handles are **not GC'd** — every `MjModel`, `MjData`, etc. must be
  `.delete()`d in `dispose()`. Our adapter owns exactly these handles, so
  cleanup is bounded and easy to audit.

---

## 3. Coordinate frames — the one thing that will bite us

This is the highest-risk detail, so it is called out first.

| | Up axis | Datou facing | Notes |
|---|---|---|---|
| **Three.js / game** | `+Y` | yaw 0 → `+Z` (per `PhysicsAdapter.ts`) | ground plane is XZ |
| **MuJoCo** | `+Z` | model author's choice | ground plane is XY |

The MuJoCo demo app reflects this with `camera.up.set(0, 0, 1)`. Our adapter
must therefore do a **frame swap at the boundary** so the rest of the game never
sees MuJoCo's Z-up world:

```
game (x, y, z)   <->   mujoco (X, Y, Z)
   x  (east)     <->     X
   z  (south)    <->     Y
   y  (up)       <->     Z
```

So: `gamePos = { x: qpos.X, y: qpos.Z, z: qpos.Y }` and the inverse on the way
in. Yaw maps from MuJoCo's rotation about `+Z` to the game's rotation about
`+Y`. All of this lives in **one** `frame.ts` helper with unit tests, so the
swap is defined once and never duplicated.

> ⚠️ **Doc bug to fix in the same PR:** `docs/PHYSICS_INTEGRATION.md` line 43
> says `yaw: 0 = +X`, but `src/physics/PhysicsAdapter.ts` says `0 faces +Z`.
> The code is the source of truth. The design here follows `+Z`; we will
> correct the stale doc.

---

## 4. Architecture

### 4.1 Where the new code lives

```
src/physics/
├── PhysicsAdapter.ts        (unchanged — the contract)
├── PlaceholderPhysics.ts    (unchanged — fallback)
├── MujocoAdapter.ts         (REWRITTEN — real implementation, replaces the stub)
└── mujoco/                  (NEW — implementation details, not part of the contract)
    ├── loader.ts            wraps loadMujoco() + locateFile, returns MainModule
    ├── frame.ts             game<->mujoco coordinate + yaw conversion (unit-tested)
    ├── datou.scene.ts       builds the MJCF model string (Datou + ground)
    └── controller.ts        maps DatouMode/target -> ctrl/qvel each step
```

`MujocoAdapter` stays the **only** file the rest of the repo imports; everything
under `mujoco/` is private to it. This preserves the "rendering layer only talks
to `PhysicsAdapter`" invariant.

### 4.2 The MuJoCo model (Phase 1: "Datou puck")

A minimal MJCF, authored in `datou.scene.ts` to match the park in `World.ts`
(60×60 m ground, `PARK_HALF_EXTENT = 22`):

- `plane` ground geom on MuJoCo's XY (= game XZ).
- One free-ish Datou body: a `capsule` (Datou's body) on a **planar joint set**
  — two `slide` joints (X, Y) + one `hinge` (yaw about Z). This gives us
  position + heading with 3 DOF, which is exactly what `DatouState` needs, and
  avoids the cost/instability of a full floating base before we have a gait.
- `condim="1"` contacts to keep it cheap and stable at 60 fps.
- No obstacle geoms in Phase 1 (trees are visual only). Phase 2 can pull real
  colliders once `World.getColliders()` exists (already promised in
  `PHYSICS_INTEGRATION.md` note 2).

### 4.3 Control strategy (how modes become motion)

The adapter is a thin **outer controller**. Each `step(dt)`:

1. Pick a desired waypoint from current mode (reuse the exact logic already
   proven in `PlaceholderPhysics.computeDesiredTarget`):
   - `follow` → player position (stop at `FOLLOW_MIN_DIST`)
   - `explore` / `leashed` → `target`
   - `idle` → wander target
2. Compute a desired planar velocity toward the waypoint, capped at a max speed.
3. Write it into the slide-joint actuators (`data.ctrl`) — or, in Phase 1,
   directly set `qvel` for the planar joints (velocity servo). MuJoCo integrates
   contacts/limits, so Datou still respects the ground and joint ranges.
4. `mj_step` enough times to cover `dt` (the demo's
   `while (data.time - start < dt) mj_step(...)` pattern).
5. Read back `qpos`/`qvel`, convert via `frame.ts`, cache into `DatouState`.

Mood reuses the placeholder's estimator (happy timer on `applyPet`, curious
when moving, tired when idle) — mood is a game concept, not physics, so it stays
identical across both backends. This keeps Phase 1 behaviour-compatible with the
placeholder while running on the real solver, which de-risks the swap.

### 4.4 Fixed-timestep loop

MuJoCo wants a fixed `timestep` (we'll use `0.005 s`); the game delivers a
variable `dt` clamped to `[0, 1/30]`. The adapter accumulates `dt` and steps the
solver an integer number of times, carrying the remainder — standard fixed-step
accumulator. This decouples physics stability from frame rate.

### 4.5 Lifecycle & async init

`Game.start()` already `await`s `physics.init()`. `MujocoAdapter.init()` will:

1. `await loadMujoco()` (downloads ~8.5 MB `.wasm`, compiles).
2. Compile the MJCF, allocate `MjData`.
3. `mj_forward` once to populate derived state.

Because `Game` awaits init, the **graceful-degradation** wrapper (§4.6) decides
whether we ever construct the MuJoCo adapter at all.

### 4.6 Backend selection & fallback

`main.ts` chooses the backend behind a tiny async factory `createPhysics()`:

- Respect an explicit override: `?physics=placeholder` / `?physics=mujoco` query
  param (and/or a `localStorage` flag) for A/B testing and quick debugging.
- Default: **try MuJoCo, fall back to placeholder** on any init failure
  (WASM fetch error, unsupported browser, compile error). The fallback is
  logged and surfaced once in the HUD so we know which backend a user is on.

This makes the 8.5 MB download non-fatal: a user on a flaky connection still
gets a playable game.

---

## 5. Build, bundling & serving

### 5.1 Vendoring the asset

Copy the single-threaded trio into the repo:

```
src/physics/mujoco/vendor/
├── mujoco_st.js
├── mujoco_st.d.ts
└── mujoco_st.wasm        # ~8.5 MB, committed via Git LFS (see §5.3)
```

We vendor (rather than `npm install @mujoco/mujoco`) because the local build at
`/home/fengchen/feng-ws/mujoco/wasm` is the team's canonical artifact and is not
published to npm with a pinned version we control. A short `UPDATING.md` notes
the source path and rebuild command so refreshing the asset is a documented,
one-command copy.

### 5.2 Vite wiring

The `.wasm` must be emitted as a hashed asset and its URL handed to Emscripten:

```ts
import wasmUrl from './vendor/mujoco_st.wasm?url';
import loadMujoco from './vendor/mujoco_st.js';

const mujoco = await loadMujoco({ locateFile: () => wasmUrl });
```

`?url` lets Vite fingerprint and copy the file to `dist/assets`. `base: './'`
is already set in `vite.config.ts`, so the hashed URL is relative and works
under the GitHub Pages subpath (`/walk-with-datou/`). No config change needed
beyond confirming `.wasm` is treated as an asset (Vite does this by default).

### 5.3 Git LFS for the 8.5 MB binary

An 8.5 MB binary in normal Git history bloats every clone forever. **Proposal:**
track `*.wasm` via Git LFS. This needs a `.gitattributes` entry and that GitHub
Pages' deploy action checks out LFS files (`actions/checkout` with
`lfs: true`). This is a review decision — see Open Question Q1.

### 5.4 CI / typecheck

`mujoco_st.d.ts` gives us types, but it declares a big ambient `MainModule`.
We'll wrap it so `MujocoAdapter` consumes a narrow local interface (only the
~8 symbols we use) rather than leaking `any` everywhere. `npm run typecheck`
(already in `package.json`) must stay green.

---

## 6. Threading, COOP/COEP & GitHub Pages

The MT build needs `Cross-Origin-Opener-Policy: same-origin` +
`Cross-Origin-Embedder-Policy: require-corp`. **GitHub Pages cannot set custom
response headers**, so the MT build is a non-starter for the public deploy. We
ship single-threaded. If we later need MT for a trained policy, that implies a
different host (Netlify/Cloudflare/self-hosted) — tracked as a future decision,
not blocking this phase.

Single-threaded MuJoCo stepping a ~3-DOF model at 60 fps is comfortably within
budget; the cost here is download size and compile time, not per-step CPU.

---

## 7. Performance & risk budget

| Risk | Mitigation |
|------|------------|
| 8.5 MB WASM download hurts first paint | Lazy load; placeholder plays during download; asset is cached after first visit; consider `Content-Encoding` (Pages gzips → ~2–3 MB on the wire). |
| WASM compile jank on weak devices | `init()` is off the render path; placeholder runs until ready; fallback on failure. |
| Embind memory leaks | All handles owned by the adapter and freed in `dispose()`; a leak test in the unit suite creates/destroys an adapter N times and asserts no growth. |
| Coordinate-frame bugs | Single `frame.ts` with round-trip unit tests (`game→mujoco→game` is identity). |
| Solver instability at variable fps | Fixed-timestep accumulator (§4.4). |
| Determinism for diary replay (open Q from existing doc) | MuJoCo is deterministic given seed + timestep; we can expose a seed. Flagged in Q3. |

---

## 8. Phased rollout

**Phase 1 — Puck on the real solver (this PR's target).**
Vendor asset, wire Vite/LFS, rewrite `MujocoAdapter` with the 3-DOF planar
Datou + velocity controller + frame conversion + fallback. Behaviour matches
the placeholder but runs on MuJoCo. Ship behind `?physics=mujoco`, placeholder
stays default until we're confident.

**Phase 2 — Environment fidelity.**
Add `World.getColliders()` and feed real obstacle geoms (trees, home post) into
the MJCF so Datou navigates around them. Pull-not-push so World stays the layout
source of truth.

**Phase 3 — Legged Datou.**
Replace the puck with an articulated quadruped model + a gait controller (or a
trained policy exported from the hardware team's stack). This is where MT/COOP
+ a non-Pages host may become necessary.

**Phase 4 — Make MuJoCo the default**, placeholder demoted to explicit fallback.

---

## 9. Test plan

- **Unit:** `frame.ts` round-trip identity; controller waypoint selection per
  mode; fixed-step accumulator step-count math.
- **Integration (jsdom/headless or a small harness):** `init()` loads the WASM,
  `step()` advances `data.time`, `getDatouState()` returns finite, in-park
  values; `dispose()` frees handles with no double-delete.
- **Manual:** `?physics=mujoco` — Datou follows, wanders, responds to pet,
  stays in the park; toggle to `?physics=placeholder` and confirm parity.
- **CI:** `typecheck`, `lint`, `build` stay green; the `.wasm` is excluded from
  lint/format.

---

## 10. Open questions for review

- **Q1 — Git LFS vs. fetch-at-runtime vs. plain commit.** LFS keeps the repo
  thin but adds a checkout dependency to the Pages deploy. Alternative: host the
  `.wasm` on a CDN/release asset and fetch at runtime (no LFS, but an external
  dependency). Which do we want? *(Recommend: Git LFS.)*
- **Q2 — Default backend on `main`.** Keep placeholder as default through
  Phase 1–2 (lowest risk), or flip to MuJoCo-with-fallback sooner to get real
  usage data? *(Recommend: placeholder default until Phase 4.)*
- **Q3 — Determinism / save-restore.** The existing doc asks whether we need a
  deterministic mode for diary replay and cheap state serialization. MuJoCo
  supports both (seed + `mj_get/setState`). Is this a Phase 1 requirement or
  later?
- **Q4 — Scope of Phase 1 model.** Is the 3-DOF planar puck acceptable as the
  first MuJoCo milestone, or do we want at least a floating-base body from the
  start (more realistic fall/settle, but heavier and a bigger jump)?

---

## 11. Summary of changes this design implies

- `docs/MUJOCO_DESIGN.md` (this file).
- Rewrite `src/physics/MujocoAdapter.ts` (stub → real).
- New `src/physics/mujoco/{loader,frame,datou.scene,controller}.ts` + `vendor/`.
- `main.ts`: async `createPhysics()` factory with query-param override + fallback.
- `.gitattributes` (LFS) + deploy workflow `lfs: true` (pending Q1).
- Fix the stale yaw convention note in `docs/PHYSICS_INTEGRATION.md`.
- Unit/integration tests for frame conversion and adapter lifecycle.

No changes to `Game.ts`, `World.ts`, `Datou.ts`, `Player.ts`, or the
`PhysicsAdapter` interface itself.
