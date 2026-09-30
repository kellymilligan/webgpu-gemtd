# CLAUDE.md

**Facet** is a web-based reimagining of Bryan K's Warcraft III map *Gem TD*,
in isometric 3D with three.js WebGPU. It's the sister project to
[`webgpu-linetowerwars`](https://github.com/kellymilligan/webgpu-linetowerwars),
which shares the same taste and conventions.

Read `docs/DESIGN.md` for the direction, the decisions made and the current
state.

## How Kelly likes to work

- **Research first, then explain, then build.** Ask a few focused questions,
  each with a recommendation. Once Kelly says "proceed", build without
  further check-ins.
- **Git:** work directly on `main`. Commit in meaningful chunks with clear
  messages, and push when a chunk is done. No PRs unless asked.
- **Verify before reporting:**
  - `npm run typecheck`, `npm test` and `npx vite build`;
  - headless screenshots of the real app, sent to Kelly with a short
    caption.
- **Report honestly:**
  - say what was verified and what wasn't;
  - separate sandbox artefacts from real bugs;
  - flag half-remembered map details as guesses.
- **Keep summaries short:** what changed, how to try it, known gaps, and next
  steps.

## Creative taste

- **An homage, not a clone.** Keep the formula, with a new world and modern
  QoL.
- **Look and performance:** beautiful but performant, with 60 fps on
  mid-range hardware as the bar. Glow, refraction, distinct effects for each
  tower type, and a day/dusk/night/dawn cycle.
- **Minimal UI:**
  - world-anchored popovers and badges on the objects themselves;
  - avoid side panels, which Kelly called the old keep panel "clunky";
  - frosted glass, restrained typography.
- **Variety matters.** Kelly spots repetition quickly, so favour real
  mechanics over recolours.
- **Assets:** CC0 packs first, procedural where it looks good.

## Tech conventions

- **Stack:** TypeScript, Vite, three r186 `WebGPURenderer` with TSL, Preact,
  Vitest.
  - The pipeline class is `RenderPipeline`.
  - `PCFSoftShadowMap` isn't available in the WebGPU renderer; use
    `PCFShadowMap`.
- **Deterministic sim:**
  - `src/sim` is pure: seeded sfc32 RNG, 30 Hz ticks, plain-JSON state;
  - commands in, events out;
  - only `Math.sqrt` among the transcendental functions;
  - bump `version` and `SAVE_KEY` in `src/app/controller.ts` when the
    state schema changes.
- **Content lives in data tables:** `src/sim/data/` (gems, recipes, creeps,
  waves, economy, map). Wave plans are generated from the seed.
- **Balance:** `npm run balance -- N` runs the greedy bot. It plays worse than
  a human, so read it as a floor.
- **Screenshots:**
  - run `npx vite --port 5173`, then
    `node scripts/screenshot.mjs out.png --url 'http://localhost:5173/?seed=demo' --eval drive.js`;
  - drive the game through `window.facet.{ctl, view}` (e.g.
    `view.snapLighting('night')`, `ctl.setSpeed(10)`);
  - headless WebGPU is unusable in the sandbox, so the app falls back to
    WebGL 2 at about 1 fps, and effects linger in captures. That's an
    artefact, not a bug.
- **Killing the dev server:** use `kill $(pgrep -f "[n]ode.*vite --port 5173")`.
  A plain `pkill -f` pattern kills the calling shell.

## Open threads

- **Air waves are still "really tough"** (Kelly, after v0.3). Options
  discussed:
  - weaker or more spread-out flyers;
  - anti-air bonuses on more towers or specials;
  - an air-coverage preview while building.

  Ask which waves hurt, and how many gems covered the flight lines.
- **Boss waves** (especially 30) are where the bot dies. Tune after Kelly
  playtests.
- **Art pass:**
  - CC0 creature models to replace the primitive body plans;
  - vegetation;
  - the full gem shader;
  - effect trails.
- **Multiplayer race mode:** same seed, separate mazes.
