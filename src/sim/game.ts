import { applyBoard, applyKeep, pathLength, placeGem, removeStone, upgradeOdds } from './build';
import { beginSpawns, stepWave } from './combat';
import { START_GOLD, START_LIVES } from './data/waves';
import { GRID_H, GRID_W, WAYPOINTS } from './data/map';
import { airRoute, computeGroundCells, routeFromCells } from './pathing';
import { seedRng } from './rng';
import { applyAuras } from './towers';
import type { Command, CommandResult, GameEvent, GameState } from './types';
import { Cell } from './types';

export function createGame(seed: string): GameState {
  const grid = new Array<number>(GRID_W * GRID_H).fill(Cell.Empty);
  for (const w of WAYPOINTS) grid[w.y * GRID_W + w.x] = Cell.Waypoint;
  const s: GameState = {
    version: 2,
    seed,
    rng: seedRng(seed),
    tick: 0,
    phase: 'build',
    wave: 1,
    lives: START_LIVES,
    gold: START_GOLD,
    oddsLevel: 0,
    grid,
    towers: [],
    pending: [],
    creeps: [],
    projectiles: [],
    spawn: null,
    nextId: 1,
    groundRoute: routeFromCells(computeGroundCells(grid).cells!),
    airRoute: airRoute(),
    stats: { kills: 0, leaks: 0, goldEarned: 0, stonesRemoved: 0, specialsMade: 0, mazeLengthByWave: [] },
  };
  return s;
}

export function applyCommand(s: GameState, cmd: Command): { result: CommandResult; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let result: CommandResult;
  switch (cmd.type) {
    case 'place':
      result = placeGem(s, cmd.x, cmd.y, events);
      if (result.ok) refreshRoute(s);
      break;
    case 'keep':
      result = applyKeep(s, cmd.option, events);
      if (result.ok) startWave(s, events);
      break;
    case 'board':
      result = applyBoard(s, cmd.option, events);
      break;
    case 'removeStone':
      result = removeStone(s, cmd.x, cmd.y, events);
      if (result.ok) refreshRoute(s);
      break;
    case 'upgradeOdds':
      result = upgradeOdds(s, events);
      break;
    case 'setTargeting': {
      const t = s.towers.find((t) => t.id === cmd.towerId);
      if (t) {
        t.targeting = cmd.targeting;
        result = { ok: true };
      } else result = { ok: false, reason: 'No such tower' };
      break;
    }
  }
  return { result, events };
}

function refreshRoute(s: GameState) {
  const r = computeGroundCells(s.grid);
  if (r.cells) s.groundRoute = routeFromCells(r.cells);
}

function startWave(s: GameState, events: GameEvent[]) {
  const r = computeGroundCells(s.grid);
  // Placement validation guarantees a route; stay defensive for loaded saves.
  if (r.cells) s.groundRoute = routeFromCells(r.cells);
  s.stats.mazeLengthByWave.push(r.cells ? Math.round(pathLength(r.cells)) : 0);
  applyAuras(s.towers);
  for (const t of s.towers) t.cooldown = 0;
  s.phase = 'wave';
  beginSpawns(s);
  events.push({ type: 'waveStart', wave: s.wave });
}

/** Advances the simulation one fixed tick. */
export function step(s: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  if (s.phase === 'wave') {
    s.tick++;
    stepWave(s, events);
  }
  return events;
}
