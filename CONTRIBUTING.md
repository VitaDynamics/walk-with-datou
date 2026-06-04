# Contributing to Walk with Datou

Thanks for your interest. This is a small, fast-moving prototype; the bar is "does the change move
the prototype toward the next sprint goal in [ROADMAP.md](./docs/ROADMAP.md)?".

## Getting started

```bash
git clone git@github.com:VitaDynamics/walk-with-datou.git
cd walk-with-datou
npm install
npm run dev
```

## Workflow

1. **Open an issue first** for anything bigger than a one-line fix. Match an existing issue
   template if one fits.
2. Create a branch from `main`: `feat/<short-name>`, `fix/<short-name>`, or `docs/<short-name>`.
3. Make focused commits. One commit = one logical change.
4. Run before pushing:
   ```bash
   npm run typecheck
   npm run lint
   npm run format:check
   npm run build
   ```
5. Open a PR against `main`. Use the PR template. Link the issue it closes.
6. Resolve every review comment (fix or reply) before merge.

## Commit messages

Short, imperative, explain the _why_ when it is not obvious:

```
add follow-mode AI for Datou

Datou now steers toward the player when within 8 units. This unblocks
Sprint 1's "feels like a companion" user test.
```

## Code style

- TypeScript strict mode is on. Avoid `any`.
- Prettier + ESLint enforced. Run `npm run format` before committing.
- Keep files small. One class / one concept per file.
- 2-space indent, single quotes, trailing commas - all enforced by Prettier.

## What we are NOT optimizing for (yet)

- Mobile / touch input - desktop only for the prototype
- Multiplayer
- Account systems / cloud sync
- Realistic dog graphics (we use low-poly placeholders)
- Localization beyond English + Simplified Chinese in docs

If your change pulls in any of the above, please explain in the PR why it is needed _now_ vs.
later.

## Reporting bugs

Open a GitHub issue using the bug report template. Include:

- Browser + OS
- Steps to reproduce
- What you expected vs. what happened
- Screenshot or short clip if visual

## Questions

Open a [Discussion](https://github.com/VitaDynamics/walk-with-datou/discussions) thread rather than
an issue.
