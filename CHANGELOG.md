# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Sprint 0 scaffold: Vite + TypeScript + Three.js project skeleton
- Cozy low-poly park scene with ground, trees, path, and a "home" post
- Player avatar with WASD / arrow-key movement and a third-person follow camera
- Datou placeholder (low-poly box-dog) with a kinematic wander AI
- Click-to-pet interaction that raises Datou's mood
- HUD showing current Datou mood
- `PhysicsAdapter` interface decoupling rendering from simulation
- `PlaceholderPhysics` default implementation
- `MujocoAdapter` stub - hook for the simulation team to wire MuJoCo via WASM
- Open-source project hygiene: README, LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT, ROADMAP,
  ARCHITECTURE, PHYSICS_INTEGRATION docs
- GitHub Actions CI: typecheck + lint + build on every push and PR
- Issue and PR templates

## [0.1.0] - TBD

Initial Sprint 0 release. See "Unreleased" above.
