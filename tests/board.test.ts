import { describe, expect, it } from 'vitest';
import { applyCommand, ARCHETYPE_LIST, boardOptionsFor, Cell, createGame, GRID_W, spawnSchedule, step, TOTAL_WAVES, wavePlan } from '../src/sim';
import type { Family, GameState, Grade, Tower } from '../src/sim';

let nextX = 5;
function addTower(s: GameState, family: Family, grade: Grade, extra: Partial<Tower> = {}): Tower {
  const t: Tower = { id: s.nextId++, x: nextX++, y: 20, kind: 'gem', family, grade, level: 0, cooldown: 0, targeting: 'first', auraBonus: 0, kills: 0, damage: 0, builtWave: 1, ...extra };
  s.towers.push(t);
  s.grid[t.y * GRID_W + t.x] = Cell.Tower;
  return t;
}

describe('board actions', () => {
  it('combines matching towers in place, leaving stones', () => {
    const s = createGame('b');
    const a = addTower(s, 'ruby', 0);
    const b = addTower(s, 'ruby', 0);
    const opts = boardOptionsFor(s, a.id);
    const combine = opts.find((o) => o.kind === 'boardCombine')!;
    expect(combine).toMatchObject({ consumed: [b.id], result: { family: 'ruby', grade: 1 } });
    expect(applyCommand(s, { type: 'board', option: combine }).result.ok).toBe(true);
    expect(s.towers).toHaveLength(1);
    expect(s.towers[0]).toMatchObject({ id: a.id, grade: 1 });
    expect(s.grid[b.y * GRID_W + b.x]).toBe(Cell.Stone);
  });

  it('offers +2 with four of a kind', () => {
    const s = createGame('b');
    const a = addTower(s, 'topaz', 1);
    for (let i = 0; i < 3; i++) addTower(s, 'topaz', 1);
    const grades = boardOptionsFor(s, a.id).filter((o) => o.kind === 'boardCombine').map((o) => o.kind === 'boardCombine' && o.result.grade);
    expect(grades).toEqual([2, 3]);
  });

  it('forges specials from board gems, and masters from specials', () => {
    const s = createGame('b');
    const sap = addTower(s, 'sapphire', 0);
    addTower(s, 'diamond', 0);
    addTower(s, 'topaz', 0);
    const forge = boardOptionsFor(s, sap.id).find((o) => o.kind === 'boardRecipe' && o.recipeId === 'quicksilver')!;
    applyCommand(s, { type: 'board', option: forge });
    expect(s.towers.find((t) => t.id === sap.id)).toMatchObject({ kind: 'special', specialId: 'quicksilver' });

    const m = createGame('m');
    const sun = addTower(m, 'ruby', 4, { kind: 'special', specialId: 'sunstone' });
    addTower(m, 'ruby', 4, { kind: 'special', specialId: 'bloodstone' });
    addTower(m, 'ruby', 4);
    const master = boardOptionsFor(m, sun.id).find((o) => o.kind === 'boardRecipe' && o.recipeId === 'sunheart');
    expect(master).toBeTruthy();
    applyCommand(m, { type: 'board', option: master! });
    expect(m.towers).toHaveLength(1);
    expect(m.towers[0].specialId).toBe('sunheart');
  });

  it('upgrades specials by feeding a board gem, from either side', () => {
    const s = createGame('b');
    const qs = addTower(s, 'sapphire', 4, { kind: 'special', specialId: 'quicksilver' });
    const dia = addTower(s, 'diamond', 3);
    expect(boardOptionsFor(s, dia.id).some((o) => o.kind === 'boardUpgrade' && o.towerId === qs.id)).toBe(true);
    const up = boardOptionsFor(s, qs.id).find((o) => o.kind === 'boardUpgrade')!;
    applyCommand(s, { type: 'board', option: up });
    expect(s.towers).toHaveLength(1);
    expect(s.towers[0].level).toBe(1);
  });

  it('rejects forged or out-of-phase board actions', () => {
    const s = createGame('b');
    const a = addTower(s, 'ruby', 0);
    const b = addTower(s, 'opal', 0);
    const bad = applyCommand(s, { type: 'board', option: { kind: 'boardCombine', towerId: a.id, consumed: [b.id], result: { family: 'ruby', grade: 1 } } });
    expect(bad.result.ok).toBe(false);
    s.phase = 'wave';
    expect(boardOptionsFor(s, a.id)).toHaveLength(0);
  });
});

describe('waves and creeps', () => {
  it('builds a valid, deterministic plan for any seed', () => {
    for (const seed of ['a', 'b', 'c', 'dd', 'eee']) {
      const plan = wavePlan(seed);
      expect(plan).toHaveLength(TOTAL_WAVES);
      expect(JSON.stringify(wavePlan(seed).map((w) => w.groups.map((g) => g.archetype.id)))).toEqual(JSON.stringify(plan.map((w) => w.groups.map((g) => g.archetype.id))));
      for (const w of plan) {
        expect(w.groups.length).toBeGreaterThan(0);
        for (const g of w.groups) expect(g.count).toBeGreaterThan(0);
        expect(spawnSchedule(w).length).toBe(w.groups.reduce((n, g) => n + g.count, 0));
      }
      expect(plan[9].kind).toBe('boss');
    }
  });

  it('has a broad roster with every spawned child defined', () => {
    expect(ARCHETYPE_LIST.length).toBeGreaterThanOrEqual(40);
    const ids = new Set(ARCHETYPE_LIST.map((a) => a.id));
    for (const a of ARCHETYPE_LIST) {
      if (a.abilities.split) expect(ids.has(a.abilities.split.id)).toBe(true);
      if (a.abilities.brood) expect(ids.has(a.abilities.brood.id)).toBe(true);
    }
  });

  it('splits on death and shields absorb damage', () => {
    const s = createGame('split');
    // Find a seed wave with a splitter; otherwise inject one directly.
    s.phase = 'wave';
    s.spawn = { elapsed: 0, next: 0, total: 0 };
    const parent = { id: 999, archetype: 'mudgolem', air: false, hp: 1, maxHp: 100, armor: 0, speed: 1, baseSpeed: 1, regen: 0, bounty: 1, lifeCost: 1, dist: 10, seg: 0, x: 0, y: 0, px: 0, py: 0, slowAmount: 0, slowTime: 0, poisonDps: 50, poisonTime: 5, poisonSource: -1, shredAmount: 0, shredTime: 0, shield: 0, maxShield: 0, abilityCd: 9, burrowTime: 0, haste: 0, enraged: false, elite: false };
    s.creeps.push(parent);
    step(s);
    expect(s.creeps.filter((c) => c.archetype === 'mudling')).toHaveLength(3);

    const t = createGame('shield');
    t.phase = 'wave';
    t.spawn = { elapsed: 0, next: 0, total: 0 };
    t.creeps.push({ ...parent, id: 5, archetype: 'scarab', hp: 100, shield: 50, maxShield: 50, poisonDps: 30, poisonTime: 1 });
    for (let i = 0; i < 30; i++) step(t);
    const c = t.creeps[0];
    expect(c.shield).toBeLessThan(50);
    expect(c.hp).toBe(100);
  });
});
