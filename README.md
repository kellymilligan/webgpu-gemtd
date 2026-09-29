# webgpu-gemtd

A web-based tower defence game inspired by *Gem TD* by Bryan K, working
title **Facet**. It's built with TypeScript, three.js (WebGPU with a WebGL 2
fallback) and Preact.

See [`docs/DESIGN.md`](docs/DESIGN.md) for the design direction.

## Running

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # sim unit tests
npm run typecheck
npm run balance    # headless bot runs, e.g. `npm run balance -- 20`
```

URL options:
- `?seed=abc` starts a fresh run with a fixed seed.
- `?renderer=webgl` or `?renderer=webgpu` forces a backend.

## Controls

| Action | Input |
|---|---|
| Place a gem, select a gem or stone | Left click |
| Pan | Drag, or `WASD` / arrow keys |
| Zoom | Mouse wheel |
| Rotate 90° | `Q` / `E` |
| Pause, speed | `Space`, `1` `2` `3` |
| Codex | `C` |
| Improve gem odds | `U` |
| Deselect | `Esc` / right click |

## Layout

- **`src/sim`:** the deterministic, seeded game simulation. It has no
  rendering imports. The data tables live in `src/sim/data`.
- **`src/render`:** the three.js scene: board, gems, creeps, VFX, overlays
  and time-of-day lighting.
- **`src/ui`:** the Preact HUD and panels.
- **`src/app`:** the controller that bridges the sim, renderer and UI (loop,
  selection, hover previews, autosave).
- **`scripts`:** the headless bot and the balance runner.
