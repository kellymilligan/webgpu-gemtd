import type { RngState } from './rng';

export const FAMILIES = [
  'ruby',
  'sapphire',
  'emerald',
  'topaz',
  'diamond',
  'amethyst',
  'opal',
  'aquamarine',
] as const;
export type Family = (typeof FAMILIES)[number];

/** 0 Chipped, 1 Flawed, 2 Clear, 3 Flawless, 4 Perfect. */
export type Grade = 0 | 1 | 2 | 3 | 4;
export const GRADE_NAMES = ['Chipped', 'Flawed', 'Clear', 'Flawless', 'Perfect'] as const;
export const MAX_GRADE: Grade = 4;

export const TIME_PHASES = ['day', 'dusk', 'night', 'dawn'] as const;
export type TimePhase = (typeof TIME_PHASES)[number];

export type TargetKind = 'ground' | 'air' | 'both';

/** Visual key for the renderer; has no gameplay meaning on its own. */
export type AttackStyle =
  | 'ember'
  | 'frost'
  | 'venom'
  | 'lightning'
  | 'prism'
  | 'comet'
  | 'pulse'
  | 'needle';

export interface AttackDef {
  damage: number;
  /** Tiles, measured from tower centre to creep centre. */
  range: number;
  /** Seconds between attacks before attack-speed modifiers. */
  cooldown: number;
  targets: TargetKind;
  /** Tiles per second; 0 means the hit lands instantly. */
  projectileSpeed: number;
  style: AttackStyle;
  /** Number of targets struck per attack (default 1). */
  multi?: number;
  splash?: { radius: number; fraction: number };
  slow?: { amount: number; duration: number };
  poison?: { dps: number; duration: number };
  crit?: { chance: number; mult: number };
  chain?: { bounces: number; range: number; falloff: number };
  armorShred?: { amount: number; duration: number };
}

export interface AuraDef {
  radius: number;
  /** Additive attack-speed bonus for towers in radius, e.g. 0.2 = +20%. */
  attackSpeed: number;
}

export interface PhaseMod {
  damageMult?: number;
  rangeAdd?: number;
  cooldownMult?: number;
}

export interface TowerDef {
  name: string;
  description: string;
  attack: AttackDef;
  aura?: AuraDef;
  phaseMods?: Partial<Record<TimePhase, PhaseMod>>;
}

export type Targeting = 'first' | 'last' | 'strongest' | 'weakest' | 'closest';

export interface GemSpec {
  family: Family;
  grade: Grade;
}

export interface Tower {
  id: number;
  x: number;
  y: number;
  kind: 'gem' | 'special';
  family: Family;
  grade: Grade;
  specialId?: string;
  level: number;
  cooldown: number;
  targeting: Targeting;
  auraBonus: number;
  kills: number;
  damage: number;
  builtWave: number;
}

/** A gem placed during the current build phase, awaiting the keep choice. */
export interface PendingGem extends GemSpec {
  id: number;
  x: number;
  y: number;
}

export interface Creep {
  id: number;
  archetype: string;
  air: boolean;
  hp: number;
  maxHp: number;
  armor: number;
  speed: number;
  regen: number;
  bounty: number;
  lifeCost: number;
  /** Distance travelled along its route, in tiles. */
  dist: number;
  seg: number;
  x: number;
  y: number;
  px: number;
  py: number;
  slowAmount: number;
  slowTime: number;
  poisonDps: number;
  poisonTime: number;
  poisonSource: number;
  shredAmount: number;
  shredTime: number;
  /** Damage absorbed before health. */
  shield: number;
  maxShield: number;
  /** Generic ability cooldown (heal, brood, blink, burrow). */
  abilityCd: number;
  /** Remaining time spent burrowed (untargetable). */
  burrowTime: number;
  /** Speed bonus from a nearby haste aura this tick. */
  haste: number;
  enraged: boolean;
  elite: boolean;
  /** Group-matched speed for support creeps travelling with a pack. */
  baseSpeed: number;
}

export interface Projectile {
  id: number;
  towerId: number;
  targetId: number;
  x: number;
  y: number;
  px: number;
  py: number;
  tx: number;
  ty: number;
  speed: number;
  style: AttackStyle;
  air: boolean;
  crit: boolean;
  damage: number;
}

export const Cell = {
  Empty: 0,
  Stone: 1,
  Tower: 2,
  Pending: 3,
  Waypoint: 4,
} as const;

export type GamePhase = 'build' | 'choose' | 'wave' | 'lost' | 'won';

export interface SpawnQueue {
  /** Seconds since the wave started. */
  elapsed: number;
  /** Index of the next entry in the wave's spawn schedule. */
  next: number;
  total: number;
}

export interface Route {
  /** Flattened [x0, y0, x1, y1, ...] in tile-centre coordinates. */
  points: number[];
  /** Cumulative length at each point. */
  lengths: number[];
  total: number;
}

export interface GameState {
  version: 2;
  seed: string;
  rng: RngState;
  tick: number;
  phase: GamePhase;
  /** The wave that is running, or the next wave during build/choose. */
  wave: number;
  lives: number;
  gold: number;
  oddsLevel: number;
  grid: number[];
  towers: Tower[];
  pending: PendingGem[];
  creeps: Creep[];
  projectiles: Projectile[];
  spawn: SpawnQueue | null;
  nextId: number;
  groundRoute: Route;
  airRoute: Route;
  stats: RunStats;
}

export interface RunStats {
  kills: number;
  leaks: number;
  goldEarned: number;
  stonesRemoved: number;
  specialsMade: number;
  mazeLengthByWave: number[];
}

export type KeepOption =
  | { kind: 'keep'; gemId: number; result: GemSpec }
  | { kind: 'combine'; gemId: number; steps: 1 | 2; result: GemSpec }
  | { kind: 'recipe'; gemId: number; recipeId: string; consumed: number[] }
  | { kind: 'upgrade'; gemId: number; towerId: number; specialId: string; toLevel: number };

/** Between-wave actions on towers already on the board. */
export type BoardOption =
  | { kind: 'boardCombine'; towerId: number; consumed: number[]; result: GemSpec }
  | { kind: 'boardRecipe'; towerId: number; recipeId: string; consumed: number[] }
  | { kind: 'boardUpgrade'; towerId: number; consumed: number[]; specialId: string; toLevel: number };

export type Command =
  | { type: 'place'; x: number; y: number }
  | { type: 'keep'; option: KeepOption }
  | { type: 'board'; option: BoardOption }
  | { type: 'upgradeOdds' }
  | { type: 'removeStone'; x: number; y: number }
  | { type: 'setTargeting'; towerId: number; targeting: Targeting };

export type CommandResult = { ok: true } | { ok: false; reason: string };

export type GameEvent =
  | { type: 'placed'; gem: PendingGem }
  | { type: 'kept'; towerId: number; stones: { x: number; y: number }[] }
  | { type: 'stoneRemoved'; x: number; y: number }
  | { type: 'oddsUpgraded'; level: number }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveEnd'; wave: number }
  | { type: 'fire'; towerId: number; targetId: number; style: AttackStyle; x: number; y: number; tx: number; ty: number; air: boolean; crit: boolean; instant: boolean }
  | { type: 'hit'; x: number; y: number; style: AttackStyle; air: boolean; crit: boolean; splash: number }
  | { type: 'chain'; points: number[]; style: AttackStyle }
  | { type: 'death'; creepId: number; x: number; y: number; air: boolean; archetype: string; bounty: number }
  | { type: 'leak'; creepId: number; lifeCost: number }
  | { type: 'boardAction'; towerId: number; x: number; y: number; stones: { x: number; y: number }[] }
  | { type: 'miss'; x: number; y: number; air: boolean }
  | { type: 'heal'; x: number; y: number; radius: number }
  | { type: 'blink'; creepId: number; fromX: number; fromY: number; x: number; y: number }
  | { type: 'burrow'; creepId: number; x: number; y: number }
  | { type: 'shieldBreak'; x: number; y: number; air: boolean }
  | { type: 'gameOver'; won: boolean };
