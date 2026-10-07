# AuraMesh

A client-side web editor for procedural abstract backgrounds: soft organic gradients, curated/custom colors, and fine film grain with reproducible seeds.

## Status

Target release: **0.1.0**. The project foundation from [#1](https://github.com/Peerapat-J/AuraMesh/issues/1) contains a minimal application shell, strict TypeScript, tests, and CI. [#3](https://github.com/Peerapat-J/AuraMesh/issues/3) adds validated configuration and deterministic scene data. Canvas rendering, editor controls, exports, and persistence described below are planned features and are not implemented yet; the visible page is still the bootstrap shell.

## Setup

Use **Node.js 22.23.1** from `.node-version` and **pnpm 11.19.0** from `package.json`. Activate the pinned Node version with your Node version manager, then install pnpm if needed:

```sh
npm install --global pnpm@11.19.0
```

From the repository checkout containing the bootstrap implementation:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The current page displays only **AuraMesh** and **Procedural background generator**.

## Verification

```sh
pnpm verify
```

This invokes `scripts/ci_local.sh`: lint → formatting check → strict typecheck → unit/component tests → production build. GitHub Actions invokes the same command after installing the pinned runtime and frozen dependencies.

Useful individual commands:

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `pnpm test`         | Watch unit/component tests                          |
| `pnpm test:run`     | Run tests once                                      |
| `pnpm lint`         | Check ESLint rules                                  |
| `pnpm format`       | Format source and documentation                     |
| `pnpm format:check` | Check formatting without editing                    |
| `pnpm typecheck`    | Check both application and configuration TypeScript |
| `pnpm build`        | Typecheck and build `dist/`                         |
| `pnpm preview`      | Serve the built output locally                      |

For a production smoke check:

```sh
pnpm build
pnpm preview
```

Open the printed URL (normally `http://localhost:4173`) and check the browser console. Browser regression tooling will begin in #4; `pnpm verify` currently covers the bootstrap checks only.

## Branch workflow

`main` is the release base, `dev` is the integration branch, and feature branches start from `dev` using `PJ/issue-<number>-<short-name>`. The first implementation branch is `PJ/issue-1-project-bootstrap`.

## Planned workflow

Choose a palette → Randomize or enter a seed → adjust Softness/Spread/Grain/Contrast → choose output dimensions → export PNG/JPEG. The browser renders the image locally and remembers the latest valid configuration in localStorage.

## Version 0.1.0 scope

- Light editor with responsive preview, keyboard access, and usable narrow layouts.
- At least six built-in palettes and a custom working palette of 3–6 colors.
- Editable/copyable seed and Randomize that preserves other settings.
- Square, landscape, portrait, A4 pixel presets, and validated custom dimensions.
- Exact-size opaque PNG/JPEG exports, including desktop 4K cases verified before release.
- One versioned local session with safe storage/export error recovery.
- Automated tests, manual visual/browser/accessibility QA, performance evidence, and static deployment.

The initial engine uses layered elliptical Canvas 2D gradients. It is a mesh-like visual effect, not a mathematical mesh control-point editor. No AI model, backend, account, database, or cloud renderer is part of 0.1.0.

PWA, share URLs, preset libraries/history, animation/video, WebGL/WebGPU, native wrappers, cloud sync, and dark theme are outside this release.

## Architecture

React controls → validated editor document → seeded scene and render style → shared gradient/contrast/grain pipeline → capped preview or exact-size export canvas.

The model and scene generation are independent of React/DOM; the browser renderer has no React dependency. Reproducing an image requires the seed and full rendering configuration, including renderer version. Preview and export at different resolutions need not have identical pixels or grain patterns.

Planned stack: TypeScript strict, React, Vite, pnpm, CSS Modules, Canvas 2D, Vitest, React Testing Library, Playwright, ESLint/Prettier, and GitHub Actions.

## Implementation plan

Start with **#1 → #3 → #4**. The complete single-developer order is #1 → #3 → #4 → #2 → #5 → #6 → #7 → #9 → #10 → #8 → #11 → finish #12/#13/#14 → #16 release. Browser smoke tests begin in #4 and grow with each feature.

- [Milestone 0.1.0](https://github.com/Peerapat-J/AuraMesh/milestone/1)
- [Roadmap and release contracts #15](https://github.com/Peerapat-J/AuraMesh/issues/15)
- [Deployment and release #16](https://github.com/Peerapat-J/AuraMesh/issues/16)
- [Detailed scope, architecture, issue review, implementation order, and QA plan](docs/version-0.1-plan.md)
- [Implemented engine contracts, defaults, PRNG and scene rules](docs/engine-contract.md)

This project keeps a hands-on learning workflow: implement core logic in small steps, use AI for explanation/review/debugging, and report executed automated checks separately from manual QA and pending checks. Browser support and performance limits will be documented from actual validation before release.
