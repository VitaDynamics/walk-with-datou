# Physics Integration

This document is the contract between the **rendering / game layer** (this repo) and the
**simulation engine** (VitaDynamics' MuJoCo-based stack, owned by the sim team).

## TL;DR

- Rendering layer only ever talks to [`PhysicsAdapter`](../src/physics/PhysicsAdapter.ts).
- The default implementation is [`PlaceholderPhysics`](../src/physics/PlaceholderPhysics.ts) -
  a simple kinematic stub good enough for Sprint 0-2.
- [`MujocoAdapter`](../src/physics/MujocoAdapter.ts) is a stub today. The sim team fills it in
  when MuJoCo-WASM is ready.

To switch implementations:

```ts
// src/main.ts
import { PlaceholderPhysics } from './physics/PlaceholderPhysics';
import { MujocoAdapter } from './physics/MujocoAdapter';

const physics = useMujoco ? new MujocoAdapter(config) : new PlaceholderPhysics();
```

## The interface

```ts
interface PhysicsAdapter {
  init(): Promise<void>;
  step(dt: number): void;
  setMode(mode: DatouMode): void;
  setPlayerPosition(x: number, z: number): void;
  setTarget(x: number, z: number): void; // for leashed / explore goal
  applyPet(): void; // signal a pet event
  getDatouState(): DatouState;
  dispose(): void;
}

type DatouMode = 'idle' | 'follow' | 'explore' | 'leashed';

interface DatouState {
  position: { x: number; y: number; z: number }; // metres, world frame
  yaw: number; // radians, rotation about +Y, 0 faces +Z
  velocity: { x: number; y: number; z: number };
  mood: 'happy' | 'calm' | 'curious' | 'tired';
}
```

Conventions:

- All units are metres, seconds, radians.
- World axes: `+Y` is up, `+X` is east, `+Z` is south. (Three.js default.)
- `step(dt)` is called at most once per render frame with `dt` clamped to `[0, 0.033]`.

## Notes for the MuJoCo team

When you wire MuJoCo:

1. Compile MuJoCo's WASM build (see [`google-deepmind/mujoco`](https://github.com/google-deepmind/mujoco))
   and load it inside `MujocoAdapter.init()`.
2. Map a `.xml` scene that places Datou at the origin and provides ground + obstacles matching
   the park layout in `src/game/World.ts` (a function `World.getColliders()` will be added in
   Sprint 1 so you can pull collider geometry directly).
3. The `setMode` calls correspond to high-level intents. Translate them to your controller's
   inputs (e.g., `'follow'` -> waypoint = `playerPosition`; `'explore'` -> waypoint = next POI).
4. `getDatouState().position` and `.yaw` are read every frame to position the rendered mesh. Joint
   positions for full skeletal animation can be added later via an additional
   `getJoints?(): Float32Array` method.
5. `applyPet()` is a "user interaction" event - the controller can choose to bump mood, do a
   little happy spin, etc.

## Why an adapter at all

- Lets us ship Sprint 0-2 without blocking on the sim team.
- Lets us A/B test physics behaviour - same game, two backends, side-by-side user studies.
- Lets us run the game on devices where MuJoCo-WASM is too heavy (older laptops) by falling back
  to the placeholder.

## Open questions for the sim team

- What is the smallest MuJoCo build (which solver, which features) we can ship for a 60 fps web
  target?
- Do we need a deterministic mode for reproducing diary events from the same seed?
- Can MuJoCo's state be serialized cheaply so we can save / restore "where Datou was"?
