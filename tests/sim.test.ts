import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  Cell,
  checkPlacement,
  createGame,
  GEMS_PER_ROUND,
  GRID_W,
  keepOptionsFor,
  step,
  WAYPOINTS,
} from '../src/sim';
import type { GameState, PendingGem } from '../src/sim';
import { nextFloat, pickWeighted, seedRng } from '../src/sim/rng';
import { runBot } from '../scripts/bot';

function placeRow(s: GameState, y: number, from: number, n: number) {
  for (let i = 0; i < n; i++) {
    const r = applyCommand(s, { type: 'place', x: from + i, y });
    expect(r.result.ok).toBe(true);
  }
}

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = seedRng('abc');
    const b = seedRng('abc');
    const c = seedRng('abd');
    const xs = Array.from({ length: 5 }, () => nextFloat(a));
    expect(xs).toEqual(Array.from({ length: 5 }, () => nextFloat(b)));
    expect(xs).not.toEqual(Array.from({ length: 5 }, () => nextFloat(c)));
  });

  it('respects weights', () => {
    const r = seedRng(1);
    const counts = [0, 0, 0];
    for (let i = 0; i < 10000; i++) counts[pickWeighted(r, [70, 30, 0])]++;
    expect(counts[2]).toBe(0);
    expect(counts[0] / 10000).toBeGreaterThan(0.66);
    expect(counts[0] / 10000).toBeLessThan(0.74);
  });
});

describe('placement', () => {
  it('rejects waypoints, occupied tiles and bounds', () => {
    const s = createGame('t');
    const w = WAYPOINTS[1];
    expect(checkPlacement(s, w.x, w.y).ok).toBe(false);
    expect(checkPlacement(s, -1, 0).ok).toBe(false);
    expect(checkPlacement(s, GRID_W, 0).ok).toBe(false);
    applyCommand(s, { type: 'place', x: 10, y: 10 });
    expect(checkPlacement(s, 10, 10).ok).toBe(false);
  });

  it('refuses to fully block the route', () => {
    const s = createGame('t');
    // Enclose the spawn at (2,2). Diagonals don't count as exits (no corner
    // cutting), so closing the last orthogonal gap must be rejected.
    const ring = [
      [1, 1], [2, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3], [2, 3],
    ];
    let placed = 0;
    for (const [x, y] of ring) {
      if (s.phase === 'choose') {
        applyCommand(s, { type: 'keep', option: keepOptionsFor(s, s.pending[0].id)[0] });
        while ((s.phase as string) === 'wave') step(s);
      }
      const r = checkPlacement(s, x, y);
      if (placed === ring.length - 1) {
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toMatch(/block/);
      } else {
        expect(r.ok).toBe(true);
        applyCommand(s, { type: 'place', x, y });
      }
      placed++;
    }
  });

  it('moves to the choose phase after five gems and leaves stones behind', () => {
    const s = createGame('t');
    placeRow(s, 8, 6, GEMS_PER_ROUND);
    expect(s.phase).toBe('choose');
    const keep = keepOptionsFor(s, s.pending[2].id)[0];
    const { events } = applyCommand(s, { type: 'keep', option: keep });
    expect(s.phase).toBe('wave');
    expect(s.towers).toHaveLength(1);
    expect(s.grid.filter((c) => c === Cell.Stone)).toHaveLength(4);
    expect(events.some((e) => e.type === 'waveStart')).toBe(true);
  });
});

describe('keep options', () => {
  function withPending(pending: Omit<PendingGem, 'id' | 'x' | 'y'>[]): GameState {
    const s = createGame('k');
    s.pending = pending.map((p, i) => ({ ...p, id: 100 + i, x: 5 + i, y: 5 }));
    for (const p of s.pending) s.grid[p.y * GRID_W + p.x] = Cell.Pending;
    s.phase = 'choose';
    return s;
  }

  it('offers +1 for pairs and +2 for four of a kind', () => {
    const s = withPending([
      { family: 'ruby', grade: 0 },
      { family: 'ruby', grade: 0 },
      { family: 'ruby', grade: 0 },
      { family: 'ruby', grade: 0 },
      { family: 'opal', grade: 1 },
    ]);
    const opts = keepOptionsFor(s, 100);
    expect(opts.filter((o) => o.kind === 'combine').map((o) => o.kind === 'combine' && o.result.grade)).toEqual([1, 2]);
    expect(keepOptionsFor(s, 104).filter((o) => o.kind === 'combine')).toHaveLength(0);
  });

  it('finds recipes from any ingredient tile', () => {
    const s = withPending([
      { family: 'sapphire', grade: 0 },
      { family: 'diamond', grade: 0 },
      { family: 'topaz', grade: 0 },
      { family: 'ruby', grade: 3 },
      { family: 'opal', grade: 0 },
    ]);
    for (const id of [100, 101, 102]) {
      expect(keepOptionsFor(s, id).some((o) => o.kind === 'recipe' && o.recipeId === 'quicksilver')).toBe(true);
    }
    expect(keepOptionsFor(s, 103).some((o) => o.kind === 'recipe')).toBe(false);
    const opt = keepOptionsFor(s, 101).find((o) => o.kind === 'recipe')!;
    applyCommand(s, { type: 'keep', option: opt });
    expect(s.towers[0]).toMatchObject({ kind: 'special', specialId: 'quicksilver', x: 6, y: 5 });
  });

  it('offers special upgrades using a matching gem', () => {
    const s = withPending([
      { family: 'diamond', grade: 3 },
      { family: 'ruby', grade: 0 },
      { family: 'ruby', grade: 1 },
      { family: 'opal', grade: 0 },
      { family: 'topaz', grade: 0 },
    ]);
    s.towers.push({ id: 1, x: 20, y: 20, kind: 'special', family: 'sapphire', grade: 4, specialId: 'quicksilver', level: 0, cooldown: 0, targeting: 'first', auraBonus: 0, kills: 0, damage: 0, builtWave: 1 });
    const up = keepOptionsFor(s, 100).find((o) => o.kind === 'upgrade');
    expect(up).toBeTruthy();
    applyCommand(s, { type: 'keep', option: up! });
    expect(s.towers[0].level).toBe(1);
    expect(s.grid.filter((c) => c === Cell.Stone)).toHaveLength(5);
  });

  it('rejects forged options', () => {
    const s = withPending([
      { family: 'ruby', grade: 0 },
      { family: 'opal', grade: 0 },
      { family: 'topaz', grade: 0 },
      { family: 'diamond', grade: 0 },
      { family: 'emerald', grade: 0 },
    ]);
    const r = applyCommand(s, { type: 'keep', option: { kind: 'combine', gemId: 100, steps: 1, result: { family: 'ruby', grade: 1 } } });
    expect(r.result.ok).toBe(false);
  });
});

describe('economy', () => {
  it('buys odds and removes stones with gold', () => {
    const s = createGame('e');
    s.gold = 100;
    expect(applyCommand(s, { type: 'upgradeOdds' }).result.ok).toBe(true);
    expect(s.oddsLevel).toBe(1);
    expect(s.gold).toBe(80);
    s.grid[10 * GRID_W + 10] = Cell.Stone;
    expect(applyCommand(s, { type: 'removeStone', x: 10, y: 10 }).result.ok).toBe(true);
    expect(s.grid[10 * GRID_W + 10]).toBe(Cell.Empty);
  });
});

describe('full runs', () => {
  it('is deterministic for a seed', () => {
    const a = runBot('det', { samples: 6, maxTicks: 30 * 60 * 8 });
    const b = runBot('det', { samples: 6, maxTicks: 30 * 60 * 8 });
    expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
    expect(a.waveReached).toBeGreaterThan(3);
  });

  it('survives a JSON round-trip mid-run', () => {
    const s = createGame('json');
    placeRow(s, 8, 6, GEMS_PER_ROUND);
    applyCommand(s, { type: 'keep', option: keepOptionsFor(s, s.pending[0].id)[0] });
    for (let i = 0; i < 200; i++) step(s);
    const copy: GameState = JSON.parse(JSON.stringify(s));
    for (let i = 0; i < 400; i++) {
      step(s);
      step(copy);
    }
    expect(JSON.stringify(copy)).toEqual(JSON.stringify(s));
  });
});
