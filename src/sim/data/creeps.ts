import type { TimePhase } from '../types';

/** Visual body plan; the renderer builds a model from this plus colours. */
export type BodyPlan =
  | 'beetle'
  | 'spider'
  | 'tortoise'
  | 'snail'
  | 'slug'
  | 'rootling'
  | 'wisp'
  | 'worm'
  | 'golem'
  | 'toad'
  | 'hog'
  | 'mushroom'
  | 'moth'
  | 'seedpod'
  | 'dragonfly'
  | 'bat'
  | 'jelly'
  | 'bird';

export interface Abilities {
  /** Chance to dodge a direct hit entirely. */
  evasion?: number;
  /** Shield as a fraction of max health, absorbed before health. */
  shield?: number;
  /** Spawns children on death. */
  split?: { id: string; count: number };
  /** Periodically heals nearby creeps by a fraction of their max health. */
  heal?: { every: number; radius: number; pct: number };
  /** Nearby creeps move faster. */
  haste?: { radius: number; amount: number };
  immuneSlow?: boolean;
  immunePoison?: boolean;
  /** Periodically jumps forward along its route. */
  blink?: { every: number; dist: number };
  /** Periodically burrows, becoming untargetable. */
  burrow?: { every: number; duration: number };
  /** Moves faster below a health threshold. */
  enrage?: { below: number; speedMult: number };
  /** Periodically spawns a child. */
  brood?: { every: number; id: string };
  /** Loses armour below half health. */
  shellBreak?: number;
}

export type CreepRole = 'main' | 'support' | 'child' | 'boss';

export interface Archetype {
  id: string;
  name: string;
  blurb: string;
  plan: BodyPlan;
  colour: string;
  accent: string;
  glow: boolean;
  scale: number;
  air: boolean;
  role: CreepRole;
  /** 0 early, 1 mid, 2 late. */
  tier: 0 | 1 | 2;
  phases: TimePhase[];
  hpMult: number;
  speed: number;
  armor: number;
  /** Fraction of max health regenerated per second. */
  regen: number;
  count: number;
  interval: number;
  lifeCost: number;
  bountyMult: number;
  abilities: Abilities;
}

type Def = Pick<Archetype, 'id' | 'name' | 'blurb' | 'plan' | 'colour' | 'hpMult' | 'speed'> & Partial<Archetype>;

const make = (d: Def): Archetype => ({
  accent: '#1a1a1a',
  glow: false,
  scale: 1,
  air: false,
  role: 'main',
  tier: 0,
  phases: ['day'],
  armor: 0,
  regen: 0,
  count: 10,
  interval: 0.9,
  lifeCost: 1,
  bountyMult: 1,
  abilities: {},
  ...d,
});

const LIST: Archetype[] = [
  // ── Day: bright insects ───────────────────────────────────────────────
  make({ id: 'beetle', name: 'Shellback Beetle', blurb: 'Steady and sturdy.', plan: 'beetle', colour: '#2c6f73', hpMult: 1, speed: 2.4, armor: 1 }),
  make({ id: 'skitter', name: 'Skitterling', blurb: 'Fast swarms.', plan: 'spider', colour: '#9b4a2c', hpMult: 0.45, speed: 3.6, count: 16, interval: 0.45, bountyMult: 0.6, phases: ['day', 'night'] }),
  make({ id: 'ladybird', name: 'Lacquer Beetle', blurb: 'Glossy shell; dodges 15% of hits.', plan: 'beetle', colour: '#c8322b', accent: '#111111', hpMult: 0.9, speed: 2.6, abilities: { evasion: 0.15 } }),
  make({ id: 'hopper', name: 'Meadow Hopper', blurb: 'Leaps forward every few seconds.', plan: 'toad', colour: '#8fcf4f', hpMult: 0.8, speed: 2.1, tier: 1, count: 12, interval: 0.7, abilities: { blink: { every: 3.5, dist: 2.5 } } }),
  make({ id: 'stag', name: 'Stag Beetle', blurb: 'Heavy armour that cracks below half health.', plan: 'beetle', colour: '#4a3a2a', accent: '#c9a55a', scale: 1.2, hpMult: 1.4, speed: 2.0, armor: 6, tier: 1, count: 8, interval: 1.0, abilities: { shellBreak: 5 } }),
  make({ id: 'weaver', name: 'Silk Weaver', blurb: 'Mends nearby creeps.', plan: 'spider', colour: '#e8e4d8', accent: '#9a8f7a', hpMult: 0.8, speed: 2.2, tier: 1, role: 'support', count: 3, phases: ['day', 'dusk'], abilities: { heal: { every: 3, radius: 2.5, pct: 0.08 } } }),
  make({ id: 'goliath', name: 'Goliath Beetle', blurb: 'A walking fortress.', plan: 'beetle', colour: '#3a2f5a', accent: '#d8c8ff', scale: 1.5, hpMult: 2.6, speed: 1.7, armor: 7, tier: 2, count: 6, interval: 1.4, lifeCost: 2, bountyMult: 2 }),
  make({ id: 'scarab', name: 'Sun Scarab', blurb: 'Golden shield soaks damage.', plan: 'beetle', colour: '#d9a520', accent: '#fff2b0', glow: true, hpMult: 1.2, speed: 2.4, armor: 3, tier: 2, count: 9, abilities: { shield: 0.5 } }),
  make({ id: 'seedpod', name: 'Gliding Seedpod', blurb: 'Drifts straight between stones.', plan: 'seedpod', colour: '#d8c28a', air: true, hpMult: 0.6, speed: 2.0, count: 8, interval: 1.0, phases: ['day', 'dawn'] }),
  make({ id: 'glasswing', name: 'Glasswing', blurb: 'Fast, darting flyer; dodges 20% of hits.', plan: 'dragonfly', colour: '#6fd3e8', air: true, hpMult: 0.5, speed: 3.1, tier: 1, count: 10, interval: 0.7, abilities: { evasion: 0.2 } }),
  make({ id: 'bumble', name: 'Bumble Drone', blurb: 'Slow, shielded flyer.', plan: 'moth', colour: '#e8c02a', accent: '#1a1a1a', scale: 1.2, air: true, hpMult: 1.1, speed: 1.7, tier: 2, count: 7, interval: 1.1, abilities: { shield: 0.4 } }),

  // ── Dusk: warm, mossy wanderers ───────────────────────────────────────
  make({ id: 'tortoise', name: 'Moss Tortoise', blurb: 'Slow, heavily armoured.', plan: 'tortoise', colour: '#4f6b37', hpMult: 1.6, speed: 1.6, armor: 4, count: 8, interval: 1.2, lifeCost: 2, bountyMult: 1.5, phases: ['dusk', 'dawn'] }),
  make({ id: 'snail', name: 'Amber Snail', blurb: 'Regrows 2.5% health a second.', plan: 'snail', colour: '#d98a2b', accent: '#6b4a2a', hpMult: 1.2, speed: 1.6, regen: 0.025, count: 9, interval: 1.1, phases: ['dusk'] }),
  make({ id: 'toad', name: 'Marsh Toad', blurb: 'Bounds ahead in big hops.', plan: 'toad', colour: '#5b7a3a', hpMult: 1.1, speed: 2.0, tier: 1, phases: ['dusk'], abilities: { blink: { every: 4, dist: 3 } } }),
  make({ id: 'hog', name: 'Thornback Hog', blurb: 'Charges when wounded.', plan: 'hog', colour: '#6b4a3a', accent: '#c9b08a', hpMult: 1.2, speed: 2.1, armor: 2, tier: 1, phases: ['dusk'], abilities: { enrage: { below: 0.5, speedMult: 1.8 } } }),
  make({ id: 'mossling', name: 'Moss Sprite', blurb: 'Hastens the creeps around it.', plan: 'rootling', colour: '#6fbf4a', accent: '#bfff7a', glow: true, hpMult: 0.7, speed: 2.4, tier: 1, role: 'support', count: 3, phases: ['dusk', 'dawn'], abilities: { haste: { radius: 2.5, amount: 0.3 } } }),
  make({ id: 'mudgolem', name: 'Mud Golem', blurb: 'Collapses into mudlings.', plan: 'golem', colour: '#6b5a44', accent: '#4e3e2c', hpMult: 2.0, speed: 1.6, armor: 3, tier: 2, count: 6, interval: 1.4, lifeCost: 2, bountyMult: 1.5, phases: ['dusk'], abilities: { split: { id: 'mudling', count: 3 } } }),
  make({ id: 'ironbark', name: 'Ironbark Tortoise', blurb: 'Near-impervious armour.', plan: 'tortoise', colour: '#5a5a52', accent: '#8a8a80', scale: 1.3, hpMult: 1.9, speed: 1.4, armor: 10, tier: 2, count: 7, interval: 1.3, lifeCost: 2, bountyMult: 2, phases: ['dusk'] }),
  make({ id: 'moth', name: 'Dusk Moth', blurb: 'Fast flyers that ignore your maze.', plan: 'moth', colour: '#6d5a86', accent: '#b9a3d8', air: true, hpMult: 0.5, speed: 2.4, count: 10, interval: 0.8, phases: ['dusk', 'night'] }),
  make({ id: 'emberbat', name: 'Ember Bat', blurb: 'Quick, glowing flyers.', plan: 'bat', colour: '#5a2a2a', accent: '#ff7a3a', glow: true, air: true, hpMult: 0.5, speed: 3.0, tier: 1, count: 12, interval: 0.6, phases: ['dusk', 'night'] }),
  make({ id: 'lanternfly', name: 'Lanternfly', blurb: 'Glowing flyers that slowly heal.', plan: 'dragonfly', colour: '#ffb347', accent: '#fff0c0', glow: true, air: true, hpMult: 0.85, speed: 2.4, regen: 0.02, tier: 2, count: 10, interval: 0.8, phases: ['dusk'] }),

  // ── Night: glowing and eerie ──────────────────────────────────────────
  make({ id: 'wisp', name: 'Lantern Wisp', blurb: 'Glowing night drifters, quick.', plan: 'wisp', colour: '#fff3b0', accent: '#ffd76a', glow: true, hpMult: 0.7, speed: 3.0, count: 12, interval: 0.7, phases: ['night'] }),
  make({ id: 'rootling', name: 'Rootling', blurb: 'Regrows 2% health a second.', plan: 'rootling', colour: '#6b4b2e', accent: '#6fbf4a', hpMult: 1.0, speed: 2.2, armor: 1, regen: 0.02, phases: ['night', 'dawn'] }),
  make({ id: 'glowworm', name: 'Glowworm', blurb: 'Burrows out of reach now and then.', plan: 'worm', colour: '#7cffc4', accent: '#2a6b50', glow: true, hpMult: 1.0, speed: 2.2, tier: 1, phases: ['night'], abilities: { burrow: { every: 4, duration: 1.8 } } }),
  make({ id: 'shade', name: 'Shade', blurb: 'Evasive and immune to slows.', plan: 'wisp', colour: '#6a5acd', accent: '#2a2060', glow: true, hpMult: 0.9, speed: 2.6, tier: 1, phases: ['night'], abilities: { evasion: 0.3, immuneSlow: true } }),
  make({ id: 'crawler', name: 'Night Crawler', blurb: 'Leaves a trail of glowgrubs.', plan: 'spider', colour: '#2a2440', accent: '#b06cff', glow: true, scale: 1.3, hpMult: 1.7, speed: 1.9, armor: 3, tier: 2, count: 6, interval: 1.4, lifeCost: 2, bountyMult: 1.5, phases: ['night'], abilities: { brood: { every: 3, id: 'glowgrub' } } }),
  make({ id: 'wight', name: 'Barrow Wight', blurb: 'Armoured and immune to slows.', plan: 'golem', colour: '#3d4a5c', accent: '#9fe8ff', glow: true, hpMult: 1.9, speed: 1.9, armor: 6, tier: 2, count: 8, interval: 1.1, lifeCost: 2, bountyMult: 1.5, phases: ['night'], abilities: { immuneSlow: true } }),
  make({ id: 'owlet', name: 'Owlet Moth', blurb: 'Soft-winged; dodges 25% of hits.', plan: 'moth', colour: '#a58c6a', accent: '#e8d8b8', air: true, hpMult: 0.55, speed: 2.6, tier: 1, count: 10, interval: 0.8, phases: ['night'], abilities: { evasion: 0.25 } }),
  make({ id: 'skyjelly', name: 'Sky Jelly', blurb: 'Slow, drifting, regenerating flyer.', plan: 'jelly', colour: '#c78bff', accent: '#ffffff', glow: true, air: true, hpMult: 1.5, speed: 1.4, regen: 0.03, tier: 2, count: 6, interval: 1.2, phases: ['night'] }),

  // ── Dawn: dewy and fungal ─────────────────────────────────────────────
  make({ id: 'sporeling', name: 'Sporeling', blurb: 'Bursts into spores.', plan: 'mushroom', colour: '#d8b89a', accent: '#8a6a4a', hpMult: 0.8, speed: 2.3, count: 8, phases: ['dawn'], abilities: { split: { id: 'spore', count: 2 } } }),
  make({ id: 'slug', name: 'Dew Slug', blurb: 'Immune to poison; slowly heals.', plan: 'slug', colour: '#8fb8c8', accent: '#dff4ff', hpMult: 1.2, speed: 1.8, regen: 0.02, count: 9, phases: ['dawn'], abilities: { immunePoison: true } }),
  make({ id: 'capwalker', name: 'Capwalker', blurb: 'Mends nearby creeps.', plan: 'mushroom', colour: '#c84a3a', accent: '#ffffff', hpMult: 0.9, speed: 2.2, tier: 1, role: 'support', count: 3, phases: ['dawn', 'night'], abilities: { heal: { every: 2.5, radius: 2.5, pct: 0.07 } } }),
  make({ id: 'mistpede', name: 'Mistpede', blurb: 'Fast and plated.', plan: 'worm', colour: '#9aa8c8', accent: '#e0e8ff', hpMult: 0.9, speed: 3.0, armor: 3, tier: 1, count: 12, interval: 0.6, phases: ['dawn'] }),
  make({ id: 'hound', name: 'Bramble Hound', blurb: 'Frenzies when wounded.', plan: 'hog', colour: '#5a6b3a', accent: '#a8c878', hpMult: 1.3, speed: 2.5, armor: 3, tier: 2, phases: ['dawn', 'day'], abilities: { enrage: { below: 0.5, speedMult: 1.7 } } }),
  make({ id: 'quartzback', name: 'Quartzback', blurb: 'Crystal shield over thick armour.', plan: 'tortoise', colour: '#cfc6ff', accent: '#ffffff', glow: true, hpMult: 1.7, speed: 1.6, armor: 5, tier: 2, count: 7, interval: 1.2, lifeCost: 2, bountyMult: 2, phases: ['dawn'], abilities: { shield: 0.6 } }),
  make({ id: 'pollenpuff', name: 'Pollen Puff', blurb: 'Bursts into drifting puffs.', plan: 'jelly', colour: '#f2e27a', accent: '#fff6c0', air: true, hpMult: 0.65, speed: 1.9, tier: 1, count: 7, interval: 1.0, phases: ['dawn', 'day'], abilities: { split: { id: 'puff', count: 3 } } }),
  make({ id: 'heron', name: 'Mist Heron', blurb: 'Swift and hard to hit.', plan: 'bird', colour: '#dfe6ef', accent: '#f0b040', air: true, hpMult: 0.95, speed: 2.9, tier: 2, count: 9, interval: 0.8, phases: ['dawn'], abilities: { evasion: 0.15 } }),

  // ── Children (spawned by other creeps) ────────────────────────────────
  make({ id: 'mudling', name: 'Mudling', blurb: 'A clump of living mud.', plan: 'golem', colour: '#7a6a52', scale: 0.5, role: 'child', hpMult: 0.3, speed: 2.6, bountyMult: 0.3, phases: [] }),
  make({ id: 'glowgrub', name: 'Glowgrub', blurb: 'A wriggling light.', plan: 'worm', colour: '#b0ff7a', glow: true, scale: 0.5, role: 'child', hpMult: 0.22, speed: 3.0, bountyMult: 0.2, phases: [] }),
  make({ id: 'spore', name: 'Spore', blurb: 'Tiny and quick.', plan: 'mushroom', colour: '#f0e0c8', scale: 0.5, role: 'child', hpMult: 0.25, speed: 2.8, bountyMult: 0.3, phases: [] }),
  make({ id: 'puff', name: 'Puff', blurb: 'A wisp of pollen.', plan: 'jelly', colour: '#fff6b0', air: true, scale: 0.45, role: 'child', hpMult: 0.2, speed: 2.6, bountyMult: 0.3, phases: [] }),
  make({ id: 'broodling', name: 'Broodling', blurb: 'Hatched mid-march.', plan: 'spider', colour: '#5a3a6a', scale: 0.6, role: 'child', hpMult: 0.3, speed: 3.2, bountyMult: 0.2, phases: [] }),

  // ── Bosses ────────────────────────────────────────────────────────────
  make({ id: 'colossus', name: 'Moss Colossus', blurb: 'Boss. Enormous and armoured.', plan: 'golem', colour: '#6e6a62', accent: '#4e7d34', scale: 1.9, role: 'boss', hpMult: 7, speed: 1.3, armor: 5, count: 1, lifeCost: 10, bountyMult: 20, phases: [] }),
  make({ id: 'mothQueen', name: 'Moth Queen', blurb: 'Boss. Flies, trailed by her brood.', plan: 'moth', colour: '#3b2558', accent: '#8f5fd1', glow: true, scale: 2.4, air: true, role: 'boss', hpMult: 5, speed: 1.6, armor: 2, count: 1, lifeCost: 10, bountyMult: 20, phases: [], abilities: { brood: { every: 3.5, id: 'puff' } } }),
  make({ id: 'treant', name: 'Elder Treant', blurb: 'Boss. Regrows and sheds rootlings.', plan: 'rootling', colour: '#4a3522', accent: '#5f9a3a', scale: 2.4, role: 'boss', hpMult: 8, speed: 1.2, armor: 6, regen: 0.008, count: 1, lifeCost: 10, bountyMult: 20, phases: [], abilities: { brood: { every: 4, id: 'broodling' } } }),
  make({ id: 'matriarch', name: 'Brood Matriarch', blurb: 'Boss. Shielded, hatching as she walks.', plan: 'spider', colour: '#2a1a30', accent: '#ff5f9e', glow: true, scale: 2.4, role: 'boss', hpMult: 8, speed: 1.4, armor: 6, count: 1, lifeCost: 10, bountyMult: 20, phases: [], abilities: { shield: 0.3, brood: { every: 2, id: 'broodling' } } }),
  make({ id: 'blightheart', name: 'The Blightheart', blurb: 'Final boss. Shielded, enraging, endless brood.', plan: 'golem', colour: '#1f1024', accent: '#ff3b6b', glow: true, scale: 2.8, role: 'boss', hpMult: 14, speed: 1.2, armor: 9, count: 1, lifeCost: 25, bountyMult: 30, phases: [], abilities: { shield: 0.4, enrage: { below: 0.4, speedMult: 1.6 }, brood: { every: 2.5, id: 'broodling' } } }),
];

export const ARCHETYPES: Record<string, Archetype> = Object.fromEntries(LIST.map((a) => [a.id, a]));
export const ARCHETYPE_LIST: readonly Archetype[] = LIST;

/** Short human-readable ability tags for UI. */
export function abilityTags(a: Archetype): string[] {
  const t: string[] = [];
  const x = a.abilities;
  if (a.air) t.push('Air');
  if (a.armor >= 5) t.push('Armoured');
  if (a.speed >= 3) t.push('Fast');
  if (a.regen) t.push('Regen');
  if (x.evasion) t.push(`Evasion ${Math.round(x.evasion * 100)}%`);
  if (x.shield) t.push('Shield');
  if (x.split) t.push('Splits');
  if (x.heal) t.push('Healer');
  if (x.haste) t.push('Haste aura');
  if (x.immuneSlow) t.push('Slow immune');
  if (x.immunePoison) t.push('Poison immune');
  if (x.blink) t.push('Leaps');
  if (x.burrow) t.push('Burrows');
  if (x.enrage) t.push('Enrages');
  if (x.brood) t.push('Brood');
  if (x.shellBreak) t.push('Brittle shell');
  return t;
}
