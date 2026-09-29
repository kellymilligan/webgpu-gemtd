import type { TimePhase } from '../types';
import { TIME_PHASES } from '../types';

export const TOTAL_WAVES = 50;
export const WAVES_PER_PHASE = 3;
export const START_LIVES = 50;
export const START_GOLD = 20;

export interface Archetype {
  id: string;
  name: string;
  air: boolean;
  boss: boolean;
  hpMult: number;
  speed: number;
  armor: number;
  /** Fraction of max HP regenerated per second. */
  regen: number;
  count: number;
  interval: number;
  lifeCost: number;
  bountyMult: number;
  blurb: string;
}

const a = (x: Omit<Archetype, 'boss' | 'regen' | 'lifeCost' | 'bountyMult'> & Partial<Archetype>): Archetype => ({
  boss: false,
  regen: 0,
  lifeCost: 1,
  bountyMult: 1,
  ...x,
});

export const ARCHETYPES: Record<string, Archetype> = {
  beetle: a({ id: 'beetle', name: 'Shellback Beetle', air: false, hpMult: 1, speed: 2.4, armor: 1, count: 10, interval: 0.9, blurb: 'Steady and sturdy.' }),
  skitter: a({ id: 'skitter', name: 'Skitterling', air: false, hpMult: 0.45, speed: 3.6, armor: 0, count: 18, interval: 0.45, bountyMult: 0.6, blurb: 'Fast swarms.' }),
  tortoise: a({ id: 'tortoise', name: 'Moss Tortoise', air: false, hpMult: 1.8, speed: 1.6, armor: 4, count: 8, interval: 1.2, lifeCost: 2, bountyMult: 1.5, blurb: 'Slow, heavily armoured.' }),
  rootling: a({ id: 'rootling', name: 'Rootling', air: false, hpMult: 1.1, speed: 2.2, armor: 1, regen: 0.02, count: 10, interval: 0.9, blurb: 'Regrows 2% health a second.' }),
  wisp: a({ id: 'wisp', name: 'Lantern Wisp', air: false, hpMult: 0.8, speed: 3.0, armor: 0, count: 12, interval: 0.7, blurb: 'Glowing night drifters, quick.' }),
  seedpod: a({ id: 'seedpod', name: 'Gliding Seedpod', air: true, hpMult: 0.9, speed: 2.0, armor: 0, count: 8, interval: 1.0, blurb: 'Flies straight between stones.' }),
  moth: a({ id: 'moth', name: 'Dusk Moth', air: true, hpMult: 0.75, speed: 2.8, armor: 0, count: 10, interval: 0.8, blurb: 'Fast flyers that ignore your maze.' }),
  colossus: a({ id: 'colossus', name: 'Moss Colossus', air: false, boss: true, hpMult: 9, speed: 1.3, armor: 5, count: 1, interval: 1, lifeCost: 10, bountyMult: 20, blurb: 'Boss. Enormous and armoured.' }),
  mothQueen: a({ id: 'mothQueen', name: 'Moth Queen', air: true, boss: true, hpMult: 7, speed: 1.6, armor: 2, count: 1, interval: 1, lifeCost: 10, bountyMult: 20, blurb: 'Boss. Flies.' }),
};

const GROUND_BY_PHASE: Record<TimePhase, string[]> = {
  day: ['beetle', 'skitter', 'beetle'],
  dusk: ['tortoise', 'beetle', 'skitter'],
  night: ['wisp', 'rootling', 'skitter'],
  dawn: ['rootling', 'tortoise', 'beetle'],
};

export function phaseForWave(wave: number): TimePhase {
  return TIME_PHASES[Math.floor((wave - 1) / WAVES_PER_PHASE) % TIME_PHASES.length];
}

export interface WaveDef {
  wave: number;
  phase: TimePhase;
  archetype: Archetype;
  hp: number;
  armor: number;
  bounty: number;
  count: number;
}

/** Base hit points for a standard creep on a given wave. Integer, precomputed. */
const HP_TABLE: number[] = Array.from({ length: TOTAL_WAVES + 1 }, (_, n) =>
  n === 0 ? 0 : Math.round(14 + 8 * n + 0.9 * n * n + 0.035 * n * n * n),
);

export function waveDef(wave: number): WaveDef {
  const phase = phaseForWave(wave);
  let archId: string;
  if (wave % 10 === 0) archId = wave % 20 === 0 ? 'mothQueen' : 'colossus';
  else if (wave % 5 === 3) archId = phase === 'day' || phase === 'dawn' ? 'seedpod' : 'moth';
  else {
    const list = GROUND_BY_PHASE[phase];
    archId = list[(wave - 1) % list.length];
  }
  const archetype = ARCHETYPES[archId];
  const hp = Math.round(HP_TABLE[Math.min(wave, TOTAL_WAVES)] * archetype.hpMult);
  const armor = archetype.armor + Math.floor(wave / 8);
  const bounty = Math.max(1, Math.round((1 + wave * 0.2) * archetype.bountyMult));
  return { wave, phase, archetype, hp, armor, bounty, count: archetype.count };
}
