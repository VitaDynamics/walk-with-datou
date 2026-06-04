# Walk with Datou (大头) 🐕

> A cozy web game prototype where you take a virtual walk with **Datou (大头)**, a companion robot dog.
> Built to validate game mechanics before the physical robot ships.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](./.nvmrc)

## Why this exists

Datou is a real robot dog being built by [VitaDynamics](https://github.com/VitaDynamics). Before the
hardware ships, we are validating the _interaction model_ in a browser. The goal of this prototype is
to learn three things, cheaply and fast:

1. Does the **step-less, sit-at-your-desk** version of "walking with a dog" produce real attachment?
2. Does **one shared bond metric** across all interaction modes feel better than per-feature scores?
3. Does an **AI-written daily diary** make each user's Datou feel uniquely theirs?

The physics & sensing layer is designed to be swappable. The current prototype uses a placeholder
kinematic stub; in a later sprint we will plug in a [MuJoCo](https://mujoco.org/)-based simulation
shared with the hardware team. See [docs/PHYSICS_INTEGRATION.md](./docs/PHYSICS_INTEGRATION.md).

## Quick start

```bash
# Install deps (Node >= 20 required)
npm install

# Run the dev server
npm run dev

# Build production bundle
npm run build
```

Then open the URL printed by Vite (default `http://localhost:5173`).

**Controls:**

- `W` `A` `S` `D` or arrow keys - walk
- Click on Datou - pet (raises mood)

## Roadmap

See [docs/ROADMAP.md](./docs/ROADMAP.md) for the sprint-by-sprint plan. Current status:

- [x] **Sprint 0** - Walkable park, Datou wanders, player can pet
- [ ] Sprint 1 - Follow mode + mood state machine
- [ ] Sprint 2 - Explore mode + procedural POIs + once-per-day gate
- [ ] Sprint 3 - LLM-generated daily diary + bond metric
- [ ] Sprint 4 - Personality drift (2 archetypes)
- [ ] Sprint 5 - Public beta & metrics

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md). Short version:

```
src/
├── main.ts              Entry point
├── game/
│   ├── Game.ts          Bootstrap + main loop
│   ├── World.ts         Park scene, lighting, ground
│   ├── Player.ts        Owner avatar + WASD movement
│   ├── Datou.ts         Datou avatar (mesh only)
│   └── Input.ts         Keyboard + click input
└── physics/
    ├── PhysicsAdapter.ts        Interface contract
    ├── PlaceholderPhysics.ts    Stub used by default
    └── MujocoAdapter.ts         Hook for the sim team
```

## Contributing

We welcome issues and PRs. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before opening one.

## License

[MIT](./LICENSE) © 2026 VitaDynamics

---

## 中文简介

**Walk with Datou** 是 [VitaDynamics](https://github.com/VitaDynamics) 机器狗「大头」的 Web 游戏原型。
我们把硬件未发布前需要验证的玩法（陪伴、探路、默契度、性格分化）先在浏览器里跑出来，用 Three.js 渲染、
TypeScript 写逻辑，物理层留口子接公司已有的 MuJoCo 仿真引擎。

设计与开发的详细规划见 [docs/ROADMAP.md](./docs/ROADMAP.md)、[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)、
[docs/PHYSICS_INTEGRATION.md](./docs/PHYSICS_INTEGRATION.md)。
