# Vendored MuJoCo WASM build

These files are the official Google DeepMind `@mujoco/mujoco` **single-threaded**
build (Apache-2.0). They are vendored rather than installed from npm because we
consume the VitaDynamics sim team's locally-built artifact.

| File | Purpose |
|------|---------|
| `mujoco_st.js` | Emscripten ESM loader, `export default loadMujoco` |
| `mujoco_st.d.ts` | TypeScript declarations (`MainModule`) |
| `mujoco_st.wasm` | The engine (~8.5 MB, tracked via Git LFS) |

## How to refresh

Rebuild the engine in the MuJoCo checkout, then copy the single-threaded trio:

```sh
# In the mujoco repo (see wasm/README.md for emsdk setup):
emcmake cmake -B build && cmake --build build

# Then, from the root of this repo:
SRC=/home/fengchen/feng-ws/mujoco/wasm/dist
cp "$SRC"/mujoco_st.js  src/physics/mujoco/vendor/
cp "$SRC"/mujoco_st.d.ts src/physics/mujoco/vendor/
cp "$SRC"/mujoco_st.wasm src/physics/mujoco/vendor/
```

The multi-threaded build (`mujoco.*`) is intentionally **not** vendored — it
needs COOP/COEP headers GitHub Pages cannot send. See `docs/MUJOCO_DESIGN.md` §6.

## Do not edit

These are generated artifacts. They are excluded from ESLint, Prettier, and
`tsc` (`include`) so they do not pollute our checks.
