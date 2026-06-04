# Architecture

High-level shape of the code, and the conventions we follow. Keep this short - if it grows past
~200 lines, it has become a manual instead of a map.

## Modules

```
src/
├── main.ts              Entry point. Creates Game, starts loop.
├── game/
│   ├── Game.ts          Owns renderer / scene / camera / loop / objects.
│   ├── World.ts         Static park scene: ground, trees, path, lights, fog.
│   ├── Player.ts        Owner avatar + camera follow target.
│   ├── Datou.ts         Datou's visual mesh + per-frame sync from physics.
│   └── Input.ts         Keyboard + click input as observable state.
└── physics/
    ├── PhysicsAdapter.ts        Interface; the only contract Game depends on.
    ├── PlaceholderPhysics.ts    Default kinematic implementation.
    └── MujocoAdapter.ts         Stub for the simulation team.
```

## Layering

```
Game ──depends on──> PhysicsAdapter (interface)
                          ▲
                          │ implements
              ┌───────────┴───────────┐
   PlaceholderPhysics              MujocoAdapter
```

The rendering layer (`Game`, `World`, `Player`, `Datou` meshes) **never imports a concrete
physics implementation**. It is handed an adapter at construction time. This makes swapping
in MuJoCo (or any other sim) a one-line change in `main.ts`.

## Game loop

`Game.tick(dt)` runs every animation frame and does, in order:

1. Read input (`Input.poll()`)
2. Update player position (`Player.update(input, dt)`)
3. Inform physics of player position (`physics.setPlayerPosition(...)`)
4. Step physics (`physics.step(dt)`)
5. Read Datou state back (`physics.getDatouState()`) and apply to mesh
6. Update camera follow
7. Render

Fixed deltas are clamped to a max of 33 ms to avoid huge jumps when the tab is backgrounded.

## State that survives a frame

Almost nothing yet. Sprint 3 adds:

- A persistent `bond` integer
- A 30-day rolling list of session timestamps (for daily-gate enforcement)
- A diary list

All of these will live behind a small `Storage` module that wraps IndexedDB. No account
system in the prototype.

## Conventions

- One class per file; file name = class name (PascalCase).
- All public methods on game / physics types use `position: { x, y, z }` and `yaw: number` (radians)
  for spatial state. Three.js `Vector3` stays inside the rendering layer.
- No global state. Pass dependencies through constructors.
- Async work (e.g., loading models, awaiting MuJoCo) is gated by `await game.init()` before the
  first `tick`.

## When to add a module

Add a new file when an existing one passes ~200 lines OR introduces a second responsibility.
We prefer many small files over a few big ones.

## What we deliberately do NOT have

- No ECS / scene-graph indirection. Three.js is the scene graph; we do not need a second one.
- No state management library. The amount of state is small and lives in object fields.
- No router. The prototype is a single canvas.
- No SSR.
