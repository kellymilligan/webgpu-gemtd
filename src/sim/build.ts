import { GEMS_PER_ROUND, MAX_ODDS_LEVEL, ODDS_COST, ODDS_TABLE, STONE_REMOVE_COST } from './data/economy';
import { GRID_H, GRID_W } from './data/map';
import { isSpecialIngredient, SPECIALS, SPECIALS_BY_ID } from './data/recipes';
import type { Ingredient } from './data/recipes';
import { computeGroundCells, testBlock } from './pathing';
import { nextInt, pickWeighted } from './rng';
import type { BoardOption, CommandResult, GameEvent, GameState, GemSpec, Grade, KeepOption, PendingGem, Tower } from './types';
import { Cell, FAMILIES, MAX_GRADE } from './types';

export type PlaceCheck =
  | { ok: true; pathLength: number }
  | { ok: false; reason: string; blockedLeg?: number };

export function canBuild(s: GameState): boolean {
  return s.phase === 'build' && s.pending.length < GEMS_PER_ROUND;
}

/** Validates a placement and reports the resulting ground path length. */
export function checkPlacement(s: GameState, x: number, y: number): PlaceCheck {
  if (!canBuild(s)) return { ok: false, reason: 'Not placing gems right now' };
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return { ok: false, reason: 'Out of bounds' };
  const c = s.grid[y * GRID_W + x];
  if (c === Cell.Waypoint) return { ok: false, reason: 'Waystones must stay clear' };
  if (c !== Cell.Empty) return { ok: false, reason: 'Tile is occupied' };
  const r = testBlock(s.grid, x, y);
  if (!r.cells) return { ok: false, reason: 'Would block the path', blockedLeg: r.blockedLeg };
  return { ok: true, pathLength: pathLength(r.cells) };
}

export function pathLength(cells: readonly number[]): number {
  let len = 0;
  for (let i = 1; i < cells.length; i++) {
    const dx = Math.abs((cells[i] % GRID_W) - (cells[i - 1] % GRID_W));
    const dy = Math.abs(((cells[i] / GRID_W) | 0) - ((cells[i - 1] / GRID_W) | 0));
    len += dx && dy ? Math.SQRT2 : 1;
  }
  return len;
}

export function currentPathLength(s: GameState): number {
  const r = computeGroundCells(s.grid);
  return r.cells ? pathLength(r.cells) : 0;
}

export function placeGem(s: GameState, x: number, y: number, events: GameEvent[]): CommandResult {
  const check = checkPlacement(s, x, y);
  if (!check.ok) return check;
  const family = FAMILIES[nextInt(s.rng, FAMILIES.length)];
  const grade = pickWeighted(s.rng, ODDS_TABLE[s.oddsLevel]) as Grade;
  const gem: PendingGem = { id: s.nextId++, x, y, family, grade };
  s.pending.push(gem);
  s.grid[y * GRID_W + x] = Cell.Pending;
  events.push({ type: 'placed', gem });
  if (s.pending.length === GEMS_PER_ROUND) s.phase = 'choose';
  return { ok: true };
}

const same = (a: GemSpec, b: GemSpec) => a.family === b.family && a.grade === b.grade;

/** Matches a recipe against pending gems, requiring `must` to be one of them. */
function matchRecipe(ingredients: readonly Ingredient[], pending: readonly PendingGem[], must: PendingGem): number[] | null {
  if (ingredients.some(isSpecialIngredient)) return null;
  const gems = ingredients as readonly GemSpec[];
  const mustIdx = gems.findIndex((ing) => same(ing, must));
  if (mustIdx < 0) return null;
  const used = new Set<number>([must.id]);
  const consumed: number[] = [];
  for (let i = 0; i < ingredients.length; i++) {
    if (i === mustIdx) {
      consumed.push(must.id);
      continue;
    }
    const m = pending.find((p) => !used.has(p.id) && same(p, gems[i]));
    if (!m) return null;
    used.add(m.id);
    consumed.push(m.id);
  }
  return consumed;
}

/** Every keep choice available for a pending gem. */
export function keepOptionsFor(s: GameState, gemId: number): KeepOption[] {
  if (s.phase !== 'choose') return [];
  const gem = s.pending.find((p) => p.id === gemId);
  if (!gem) return [];
  const opts: KeepOption[] = [{ kind: 'keep', gemId, result: { family: gem.family, grade: gem.grade } }];
  const twins = s.pending.filter((p) => same(p, gem)).length;
  if (twins >= 2 && gem.grade < MAX_GRADE) {
    opts.push({ kind: 'combine', gemId, steps: 1, result: { family: gem.family, grade: (gem.grade + 1) as Grade } });
  }
  if (twins >= 4 && gem.grade + 2 <= MAX_GRADE) {
    opts.push({ kind: 'combine', gemId, steps: 2, result: { family: gem.family, grade: (gem.grade + 2) as Grade } });
  }
  for (const sp of SPECIALS) {
    const consumed = matchRecipe(sp.ingredients, s.pending, gem);
    if (consumed) opts.push({ kind: 'recipe', gemId, recipeId: sp.id, consumed });
  }
  for (const t of s.towers) {
    if (t.kind !== 'special') continue;
    const sp = SPECIALS_BY_ID[t.specialId!];
    const need = sp.upgrades[t.level];
    if (need && t.level + 1 < sp.levels.length && same(need, gem)) {
      opts.push({ kind: 'upgrade', gemId, towerId: t.id, specialId: sp.id, toLevel: t.level + 1 });
    }
  }
  return opts;
}

export function allKeepOptions(s: GameState): KeepOption[] {
  return s.pending.flatMap((p) => keepOptionsFor(s, p.id));
}

function optionKey(o: KeepOption): string {
  return JSON.stringify(o);
}

export function applyKeep(s: GameState, option: KeepOption, events: GameEvent[]): CommandResult {
  if (s.phase !== 'choose') return { ok: false, reason: 'Nothing to keep yet' };
  const valid = keepOptionsFor(s, option.gemId).some((o) => optionKey(o) === optionKey(option));
  if (!valid) return { ok: false, reason: 'That option is not available' };
  const gem = s.pending.find((p) => p.id === option.gemId)!;

  let towerId: number;
  let stoneFrom: PendingGem[];
  if (option.kind === 'upgrade') {
    const t = s.towers.find((t) => t.id === option.towerId)!;
    t.level = option.toLevel;
    towerId = t.id;
    stoneFrom = s.pending;
  } else {
    const tower: Tower = {
      id: s.nextId++,
      x: gem.x,
      y: gem.y,
      kind: option.kind === 'recipe' ? 'special' : 'gem',
      family: option.kind === 'recipe' ? SPECIALS_BY_ID[option.recipeId].family : option.result.family,
      grade: option.kind === 'recipe' ? MAX_GRADE : option.result.grade,
      specialId: option.kind === 'recipe' ? option.recipeId : undefined,
      level: 0,
      cooldown: 0,
      targeting: 'first',
      auraBonus: 0,
      kills: 0,
      damage: 0,
      builtWave: s.wave,
    };
    if (option.kind === 'recipe') s.stats.specialsMade++;
    s.towers.push(tower);
    s.grid[gem.y * GRID_W + gem.x] = Cell.Tower;
    towerId = tower.id;
    stoneFrom = s.pending.filter((p) => p !== gem);
  }
  const stones = stoneFrom.map((p) => ({ x: p.x, y: p.y }));
  for (const p of stones) s.grid[p.y * GRID_W + p.x] = Cell.Stone;
  s.pending = [];
  events.push({ type: 'kept', towerId, stones });
  return { ok: true };
}

export function removeStone(s: GameState, x: number, y: number, events: GameEvent[]): CommandResult {
  if (s.phase !== 'build' && s.phase !== 'choose') return { ok: false, reason: 'Only between waves' };
  if (s.grid[y * GRID_W + x] !== Cell.Stone) return { ok: false, reason: 'No stone there' };
  if (s.gold < STONE_REMOVE_COST) return { ok: false, reason: `Needs ${STONE_REMOVE_COST} gold` };
  s.gold -= STONE_REMOVE_COST;
  s.grid[y * GRID_W + x] = Cell.Empty;
  s.stats.stonesRemoved++;
  events.push({ type: 'stoneRemoved', x, y });
  return { ok: true };
}

export function oddsUpgradeCost(s: GameState): number | null {
  return s.oddsLevel < MAX_ODDS_LEVEL ? ODDS_COST[s.oddsLevel] : null;
}

export function upgradeOdds(s: GameState, events: GameEvent[]): CommandResult {
  if (s.phase === 'lost' || s.phase === 'won') return { ok: false, reason: 'Game over' };
  const cost = oddsUpgradeCost(s);
  if (cost === null) return { ok: false, reason: 'Odds are maxed' };
  if (s.gold < cost) return { ok: false, reason: `Needs ${cost} gold` };
  s.gold -= cost;
  s.oddsLevel++;
  events.push({ type: 'oddsUpgraded', level: s.oddsLevel });
  return { ok: true };
}

// ── Board actions: combining towers already placed, between waves ─────────

export function canUseBoard(s: GameState): boolean {
  return s.phase === 'build' || s.phase === 'choose';
}

const matches = (t: Tower, ing: Ingredient) =>
  isSpecialIngredient(ing) ? t.kind === 'special' && t.specialId === ing.special : t.kind === 'gem' && t.family === ing.family && t.grade === ing.grade;

/** Other towers sorted nearest-first, so combines consume the closest pieces. */
function byDistance(s: GameState, from: Tower): Tower[] {
  return s.towers
    .filter((o) => o !== from)
    .map((o) => ({ o, d: (o.x - from.x) ** 2 + (o.y - from.y) ** 2 }))
    .sort((a, b) => a.d - b.d || a.o.id - b.o.id)
    .map((e) => e.o);
}

function matchBoardRecipe(ingredients: readonly Ingredient[], t: Tower, others: Tower[]): number[] | null {
  const mustIdx = ingredients.findIndex((ing) => matches(t, ing));
  if (mustIdx < 0) return null;
  const used = new Set<number>([t.id]);
  const consumed: number[] = [];
  for (let i = 0; i < ingredients.length; i++) {
    if (i === mustIdx) continue;
    const m = others.find((o) => !used.has(o.id) && matches(o, ingredients[i]));
    if (!m) return null;
    used.add(m.id);
    consumed.push(m.id);
  }
  return consumed;
}

/** Every between-wave action that involves this tower. */
export function boardOptionsFor(s: GameState, towerId: number): BoardOption[] {
  if (!canUseBoard(s)) return [];
  const t = s.towers.find((x) => x.id === towerId);
  if (!t) return [];
  const others = byDistance(s, t);
  const opts: BoardOption[] = [];
  if (t.kind === 'gem') {
    const twins = others.filter((o) => o.kind === 'gem' && same(o, t));
    if (twins.length >= 1 && t.grade < MAX_GRADE) {
      opts.push({ kind: 'boardCombine', towerId, consumed: [twins[0].id], result: { family: t.family, grade: (t.grade + 1) as Grade } });
    }
    if (twins.length >= 3 && t.grade + 2 <= MAX_GRADE) {
      opts.push({ kind: 'boardCombine', towerId, consumed: twins.slice(0, 3).map((o) => o.id), result: { family: t.family, grade: (t.grade + 2) as Grade } });
    }
    // This gem can feed a special's upgrade.
    for (const sp of s.towers) {
      if (sp.kind !== 'special') continue;
      const def = SPECIALS_BY_ID[sp.specialId!];
      const need = def.upgrades[sp.level];
      if (need && sp.level + 1 < def.levels.length && same(need, t)) {
        opts.push({ kind: 'boardUpgrade', towerId: sp.id, consumed: [t.id], specialId: def.id, toLevel: sp.level + 1 });
      }
    }
  } else {
    const def = SPECIALS_BY_ID[t.specialId!];
    const need = def.upgrades[t.level];
    if (need && t.level + 1 < def.levels.length) {
      const g = others.find((o) => o.kind === 'gem' && same(o, need));
      if (g) opts.push({ kind: 'boardUpgrade', towerId, consumed: [g.id], specialId: def.id, toLevel: t.level + 1 });
    }
  }
  for (const sp of SPECIALS) {
    const consumed = matchBoardRecipe(sp.ingredients, t, others);
    if (consumed) opts.push({ kind: 'boardRecipe', towerId, recipeId: sp.id, consumed });
  }
  return opts;
}

function validBoardOption(s: GameState, o: BoardOption): boolean {
  const t = s.towers.find((x) => x.id === o.towerId);
  if (!t) return false;
  const consumed = o.consumed.map((id) => s.towers.find((x) => x.id === id));
  if (consumed.some((c) => !c || c === t) || new Set(o.consumed).size !== o.consumed.length) return false;
  const parts = consumed as Tower[];
  switch (o.kind) {
    case 'boardCombine': {
      const steps = parts.length === 1 ? 1 : parts.length === 3 ? 2 : 0;
      return (
        steps > 0 &&
        t.kind === 'gem' &&
        parts.every((p) => p.kind === 'gem' && same(p, t)) &&
        o.result.family === t.family &&
        o.result.grade === t.grade + steps &&
        o.result.grade <= MAX_GRADE
      );
    }
    case 'boardRecipe': {
      const sp = SPECIALS_BY_ID[o.recipeId];
      if (!sp || parts.length !== sp.ingredients.length - 1) return false;
      const pool = [t, ...parts];
      const used = new Set<number>();
      return sp.ingredients.every((ing) => {
        const m = pool.find((p) => !used.has(p.id) && matches(p, ing));
        if (m) used.add(m.id);
        return !!m;
      });
    }
    case 'boardUpgrade': {
      if (t.kind !== 'special' || t.specialId !== o.specialId || o.toLevel !== t.level + 1 || parts.length !== 1) return false;
      const def = SPECIALS_BY_ID[o.specialId];
      const need = def.upgrades[t.level];
      return !!need && o.toLevel < def.levels.length && parts[0].kind === 'gem' && same(parts[0], need);
    }
  }
}

export function applyBoard(s: GameState, o: BoardOption, events: GameEvent[]): CommandResult {
  if (!canUseBoard(s)) return { ok: false, reason: 'Only between waves' };
  if (!validBoardOption(s, o)) return { ok: false, reason: 'That combination is not available' };
  const t = s.towers.find((x) => x.id === o.towerId)!;
  const gone = new Set(o.consumed);
  const stones = s.towers.filter((x) => gone.has(x.id)).map((x) => ({ x: x.x, y: x.y }));
  for (const p of stones) s.grid[p.y * GRID_W + p.x] = Cell.Stone;
  s.towers = s.towers.filter((x) => !gone.has(x.id));
  switch (o.kind) {
    case 'boardCombine':
      t.grade = o.result.grade;
      break;
    case 'boardRecipe': {
      const sp = SPECIALS_BY_ID[o.recipeId];
      t.kind = 'special';
      t.specialId = sp.id;
      t.family = sp.family;
      t.grade = MAX_GRADE;
      t.level = 0;
      s.stats.specialsMade++;
      break;
    }
    case 'boardUpgrade':
      t.level = o.toLevel;
      break;
  }
  events.push({ type: 'boardAction', towerId: t.id, x: t.x, y: t.y, stones });
  return { ok: true };
}
