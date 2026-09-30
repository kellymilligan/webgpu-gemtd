import { hashString, nextFloat, nextInt, seedRng } from '../rng';
import type { RngState } from '../rng';
import type { TimePhase } from '../types';
import { TIME_PHASES } from '../types';
import { ARCHETYPE_LIST, ARCHETYPES } from './creeps';
import type { Archetype } from './creeps';

export const TOTAL_WAVES = 50;
export const WAVES_PER_PHASE = 3;
export const START_LIVES = 50;
export const START_GOLD = 20;

export function phaseForWave(wave: number): TimePhase {
  return TIME_PHASES[Math.floor((wave - 1) / WAVES_PER_PHASE) % TIME_PHASES.length];
}

/** 0 early, 1 mid, 2 late: which creature tiers can appear. */
export function tierForWave(wave: number): 0 | 1 | 2 {
  return wave <= 10 ? 0 : wave <= 26 ? 1 : 2;
}

export type WaveKind = 'ground' | 'air' | 'mixed' | 'elite' | 'boss';

export interface WaveGroup {
  archetype: Archetype;
  count: number;
  interval: number;
  /** Seconds after wave start that this group begins spawning. */
  delay: number;
  hp: number;
  armor: number;
  bounty: number;
  lifeCost: number;
  speed: number;
  elite: boolean;
}

export interface WaveDef {
  wave: number;
  phase: TimePhase;
  kind: WaveKind;
  groups: WaveGroup[];
}

/** Base hit points for a standard creep on a given wave. Integer, precomputed. */
const HP_TABLE: number[] = Array.from({ length: TOTAL_WAVES + 1 }, (_, n) =>
  n === 0 ? 0 : Math.round(14 + 8 * n + 0.9 * n * n + 0.035 * n * n * n),
);

/** Softens the opening while the maze is still forming. */
const EARLY_EASE = [1, 0.5, 0.6, 0.7, 0.8, 0.9];

export function baseHp(wave: number): number {
  const n = Math.max(1, Math.min(wave, TOTAL_WAVES));
  return HP_TABLE[n] * (EARLY_EASE[n] ?? 1);
}

export function isAirWave(wave: number) {
  return wave >= 6 && wave % 5 === 1 && wave % 10 !== 0;
}

const BOSSES: Record<number, string> = { 10: 'colossus', 20: 'mothQueen', 30: 'treant', 40: 'matriarch', 50: 'blightheart' };

function pool(phase: TimePhase, maxTier: number, role: Archetype['role'], air: boolean | null): Archetype[] {
  return ARCHETYPE_LIST.filter(
    (a) => a.role === role && a.tier <= maxTier && a.phases.includes(phase) && (air === null || a.air === air),
  );
}

/** Prefers creatures from the newest unlocked tier, but can revisit old ones. */
function pickMain(rng: RngState, phase: TimePhase, tier: number, air: boolean, avoid?: string): Archetype {
  let list = pool(phase, tier, 'main', air);
  if (list.length === 0) list = pool(phase, 2, 'main', air);
  if (list.length === 0) list = ARCHETYPE_LIST.filter((a) => a.role === 'main' && a.air === air);
  const fresh = list.filter((a) => a.tier === tier && a.id !== avoid);
  const candidates = fresh.length > 0 && nextFloat(rng) < 0.65 ? fresh : list.filter((a) => a.id !== avoid);
  const from = candidates.length ? candidates : list;
  return from[nextInt(rng, from.length)];
}

function group(wave: number, a: Archetype, opts: { count?: number; delay?: number; elite?: boolean; speed?: number; hpScale?: number } = {}): WaveGroup {
  const elite = !!opts.elite;
  const hp = Math.max(1, Math.round(baseHp(wave) * a.hpMult * (opts.hpScale ?? 1) * (elite ? 4 : 1)));
  return {
    archetype: a,
    count: opts.count ?? a.count,
    interval: elite ? Math.max(a.interval, 1.4) : a.interval,
    delay: opts.delay ?? 0,
    hp,
    armor: a.armor + Math.floor(wave / 8) + (elite ? 2 : 0),
    bounty: Math.max(1, Math.round((1 + wave * 0.2) * a.bountyMult * (elite ? 4 : 1))),
    lifeCost: a.lifeCost * (elite ? 2 : 1),
    speed: opts.speed ?? a.speed,
    elite,
  };
}

function buildWave(rng: RngState, wave: number, prevMain?: string): WaveDef {
  const phase = phaseForWave(wave);
  const tier = tierForWave(wave);
  const groups: WaveGroup[] = [];
  let kind: WaveKind;

  if (BOSSES[wave]) {
    kind = 'boss';
    const boss = ARCHETYPES[BOSSES[wave]];
    const escort = pickMain(rng, phase, tier, boss.air);
    groups.push(group(wave, escort, { count: Math.round(escort.count * 0.5), hpScale: 0.8 }));
    groups.push(group(wave, boss, { delay: (escort.count * 0.5) * escort.interval + 1.5 }));
  } else if (wave % 10 === 5 && wave >= 15) {
    kind = 'elite';
    const a = pickMain(rng, phase, tier, false, prevMain);
    groups.push(group(wave, a, { count: 3, elite: true }));
    const support = pool(phase, tier, 'support', false);
    if (support.length && wave > 10) groups.push(group(wave, support[nextInt(rng, support.length)], { count: 2, speed: a.speed, delay: 0.5 }));
  } else if (isAirWave(wave)) {
    kind = 'air';
    groups.push(group(wave, pickMain(rng, phase, tier, true)));
  } else {
    const main = pickMain(rng, phase, tier, false, prevMain);
    const roll = nextFloat(rng);
    const supports = pool(phase, tier, 'support', false);
    if (wave > 22 && roll < 0.25) {
      // A few flyers slipping in behind a ground pack.
      kind = 'mixed';
      const flyer = pickMain(rng, phase, tier, true);
      groups.push(group(wave, main, { count: Math.round(main.count * 0.75) }));
      groups.push(group(wave, flyer, { count: Math.max(3, Math.round(flyer.count * 0.35)), delay: 3 }));
    } else if (wave > 6 && supports.length && roll < 0.6) {
      // Support creatures travel at the pack's pace.
      kind = 'ground';
      groups.push(group(wave, main, { count: Math.round(main.count * 0.85) }));
      const sup = supports[nextInt(rng, supports.length)];
      groups.push(group(wave, sup, { count: sup.count, speed: main.speed, delay: main.interval * 1.5 }));
    } else if (wave > 12 && roll < 0.8) {
      // Two different packs back to back.
      kind = 'ground';
      const second = pickMain(rng, phase, tier, false, main.id);
      const c1 = Math.round(main.count * 0.6);
      groups.push(group(wave, main, { count: c1 }));
      groups.push(group(wave, second, { count: Math.round(second.count * 0.5), delay: c1 * main.interval + 1 }));
    } else {
      kind = 'ground';
      groups.push(group(wave, main));
    }
  }
  return { wave, phase, kind, groups };
}

const planCache = new Map<string, WaveDef[]>();

/** Every wave for a run. Seeded, so a seed always yields the same creatures. */
export function wavePlan(seed: string): WaveDef[] {
  let plan = planCache.get(seed);
  if (plan) return plan;
  const rng = seedRng(hashString(`waves:${seed}`));
  plan = [];
  let prev: string | undefined;
  for (let w = 1; w <= TOTAL_WAVES; w++) {
    const def = buildWave(rng, w, prev);
    prev = def.groups[0].archetype.id;
    plan.push(def);
  }
  if (planCache.size > 16) planCache.clear();
  planCache.set(seed, plan);
  return plan;
}

export function waveDef(seed: string, wave: number): WaveDef {
  return wavePlan(seed)[Math.max(1, Math.min(wave, TOTAL_WAVES)) - 1];
}

export interface SpawnEntry {
  time: number;
  group: number;
}

const scheduleCache = new WeakMap<WaveDef, SpawnEntry[]>();

/** Spawn times for every creep in a wave, in order. */
export function spawnSchedule(def: WaveDef): SpawnEntry[] {
  let s = scheduleCache.get(def);
  if (s) return s;
  s = [];
  def.groups.forEach((g, gi) => {
    for (let k = 0; k < g.count; k++) s!.push({ time: g.delay + k * g.interval, group: gi });
  });
  s.sort((a, b) => a.time - b.time || a.group - b.group);
  scheduleCache.set(def, s);
  return s;
}

/** Hit points for a spawned child, scaled to the wave it appears in. */
export function childHp(wave: number, a: Archetype): number {
  return Math.max(1, Math.round(baseHp(wave) * a.hpMult));
}
