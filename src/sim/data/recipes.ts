import type { Family, GemSpec, Grade, TowerDef } from '../types';

/**
 * Special gems. DRAFT set: this keeps the shape of the original recipes
 * (early Chipped combos through to late Perfect ones) with our own
 * ingredients, mechanics and upgrade paths. Tuned via `npm run balance`.
 */
/** A recipe ingredient: a graded gem, or an existing special gem. */
export type Ingredient = GemSpec | { special: string };

export const isSpecialIngredient = (i: Ingredient): i is { special: string } => 'special' in i;

export interface SpecialDef {
  id: string;
  /** Primary family, used for colour and codex grouping. */
  family: Family;
  colour: string;
  /** Master specials are forged from other specials on the board. */
  master?: boolean;
  ingredients: Ingredient[];
  /** levels[0] is what the recipe makes; later entries are upgrades. */
  levels: TowerDef[];
  /** upgrades[i] is the gem that upgrades levels[i] into levels[i + 1]. */
  upgrades: GemSpec[];
}

const g = (family: Family, grade: Grade): GemSpec => ({ family, grade });

export const SPECIALS: readonly SpecialDef[] = [
  {
    id: 'quicksilver',
    family: 'sapphire',
    colour: '#cfd8e3',
    ingredients: [g('sapphire', 0), g('diamond', 0), g('topaz', 0)],
    upgrades: [g('diamond', 3)],
    levels: [
      {
        name: 'Quicksilver',
        description: 'Bolts that leap between creeps, chilling each one.',
        attack: { damage: 20, range: 3.8, cooldown: 0.9, targets: 'both', projectileSpeed: 0, style: 'lightning', chain: { bounces: 3, range: 2.5, falloff: 0.8 }, slow: { amount: 0.2, duration: 1.5 } },
      },
      {
        name: 'Living Quicksilver',
        description: 'Chains further and harder.',
        attack: { damage: 85, range: 4.2, cooldown: 0.8, targets: 'both', projectileSpeed: 0, style: 'lightning', chain: { bounces: 5, range: 3, falloff: 0.85 }, slow: { amount: 0.3, duration: 2 } },
      },
    ],
  },
  {
    id: 'malachite',
    family: 'emerald',
    colour: '#1faa6b',
    ingredients: [g('opal', 0), g('emerald', 0), g('aquamarine', 0)],
    upgrades: [g('emerald', 2), g('emerald', 4)],
    levels: [
      {
        name: 'Malachite',
        description: 'Rapid venom darts at several creeps at once.',
        attack: { damage: 8, range: 3.4, cooldown: 0.5, targets: 'both', projectileSpeed: 12, style: 'venom', multi: 3, poison: { dps: 4, duration: 3 } },
      },
      {
        name: 'Vivid Malachite',
        description: 'More darts, stronger venom.',
        attack: { damage: 22, range: 3.6, cooldown: 0.45, targets: 'both', projectileSpeed: 12, style: 'venom', multi: 4, poison: { dps: 12, duration: 3 } },
      },
      {
        name: 'Verdant Heart',
        description: 'A storm of venom.',
        attack: { damage: 70, range: 4, cooldown: 0.4, targets: 'both', projectileSpeed: 14, style: 'venom', multi: 6, poison: { dps: 40, duration: 4 } },
      },
    ],
  },
  {
    id: 'sunstone',
    family: 'ruby',
    colour: '#ff8a3d',
    ingredients: [g('ruby', 1), g('ruby', 0), g('topaz', 0)],
    upgrades: [g('ruby', 3)],
    levels: [
      {
        name: 'Sunstone',
        description: 'Wide burning splash that can reach the air.',
        attack: { damage: 30, range: 3.5, cooldown: 1.1, targets: 'both', projectileSpeed: 9, style: 'ember', splash: { radius: 1.6, fraction: 0.6 }, poison: { dps: 6, duration: 2 } },
      },
      {
        name: 'Solar Flare',
        description: 'Scorches whole packs.',
        attack: { damage: 110, range: 3.8, cooldown: 1.0, targets: 'both', projectileSpeed: 10, style: 'ember', splash: { radius: 2.0, fraction: 0.65 }, poison: { dps: 25, duration: 2.5 } },
      },
    ],
  },
  {
    id: 'moonstone',
    family: 'opal',
    colour: '#bcd4ff',
    ingredients: [g('sapphire', 1), g('opal', 1), g('amethyst', 0)],
    upgrades: [g('amethyst', 3)],
    levels: [
      {
        name: 'Moonstone',
        description: 'Waxes with the dark: weak by day, fierce at night.',
        attack: { damage: 26, range: 4.2, cooldown: 1.0, targets: 'both', projectileSpeed: 10, style: 'pulse', slow: { amount: 0.3, duration: 2 } },
        phaseMods: { day: { damageMult: 0.8 }, dusk: { damageMult: 1.5 }, night: { damageMult: 2.2, rangeAdd: 1 }, dawn: { damageMult: 1.25 } },
      },
      {
        name: 'Harvest Moon',
        description: 'A second moon rises.',
        attack: { damage: 95, range: 4.6, cooldown: 0.9, targets: 'both', projectileSpeed: 11, style: 'pulse', slow: { amount: 0.4, duration: 2 } },
        phaseMods: { day: { damageMult: 0.8 }, dusk: { damageMult: 1.5 }, night: { damageMult: 2.4, rangeAdd: 1.5 }, dawn: { damageMult: 1.25 } },
      },
    ],
  },
  {
    id: 'jade',
    family: 'emerald',
    colour: '#58c29a',
    ingredients: [g('emerald', 2), g('opal', 2), g('sapphire', 1)],
    upgrades: [g('opal', 4)],
    levels: [
      {
        name: 'Jade',
        description: 'Heavy poison and slow on two targets; hastens neighbours.',
        attack: { damage: 40, range: 4, cooldown: 0.8, targets: 'both', projectileSpeed: 11, style: 'venom', multi: 2, poison: { dps: 25, duration: 4 }, slow: { amount: 0.25, duration: 2 } },
        aura: { radius: 2.5, attackSpeed: 0.1 },
      },
      {
        name: 'Imperial Jade',
        description: 'A court of venom.',
        attack: { damage: 120, range: 4.4, cooldown: 0.7, targets: 'both', projectileSpeed: 12, style: 'venom', multi: 3, poison: { dps: 80, duration: 4 }, slow: { amount: 0.3, duration: 2 } },
        aura: { radius: 3, attackSpeed: 0.2 },
      },
    ],
  },
  {
    id: 'bloodstone',
    family: 'ruby',
    colour: '#a3122c',
    ingredients: [g('ruby', 3), g('aquamarine', 2), g('amethyst', 1)],
    upgrades: [g('aquamarine', 4)],
    levels: [
      {
        name: 'Bloodstone',
        description: 'Rapid-fire splash.',
        attack: { damage: 45, range: 3.4, cooldown: 0.45, targets: 'both', projectileSpeed: 14, style: 'ember', splash: { radius: 1.2, fraction: 0.4 } },
      },
      {
        name: 'Heartblood',
        description: 'Relentless.',
        attack: { damage: 150, range: 3.6, cooldown: 0.4, targets: 'both', projectileSpeed: 15, style: 'ember', splash: { radius: 1.4, fraction: 0.45 } },
      },
    ],
  },
  {
    id: 'alexandrite',
    family: 'amethyst',
    colour: '#6f4bd8',
    ingredients: [g('amethyst', 2), g('sapphire', 2), g('emerald', 1)],
    upgrades: [g('amethyst', 4)],
    levels: [
      {
        name: 'Alexandrite',
        description: 'Changes with the light: harder hits by day, faster and farther by night.',
        attack: { damage: 70, range: 4.2, cooldown: 0.9, targets: 'both', projectileSpeed: 0, style: 'prism', crit: { chance: 0.25, mult: 2.5 } },
        phaseMods: { day: { damageMult: 1.3 }, night: { rangeAdd: 1.5, cooldownMult: 0.75 } },
      },
      {
        name: 'Royal Alexandrite',
        description: 'Brilliant in any light.',
        attack: { damage: 220, range: 4.6, cooldown: 0.85, targets: 'both', projectileSpeed: 0, style: 'prism', crit: { chance: 0.3, mult: 3 } },
        phaseMods: { day: { damageMult: 1.3 }, night: { rangeAdd: 1.5, cooldownMult: 0.75 } },
      },
    ],
  },
  {
    id: 'obsidian',
    family: 'diamond',
    colour: '#2b2233',
    ingredients: [g('diamond', 3), g('ruby', 2), g('opal', 1)],
    upgrades: [g('diamond', 4)],
    levels: [
      {
        name: 'Obsidian',
        description: 'Shatters armour on everything it splashes.',
        attack: { damage: 120, range: 3.6, cooldown: 1.2, targets: 'ground', projectileSpeed: 0, style: 'prism', splash: { radius: 1, fraction: 0.5 }, armorShred: { amount: 4, duration: 5 } },
      },
      {
        name: 'Dragonglass',
        description: 'Nothing stays armoured for long.',
        attack: { damage: 380, range: 3.8, cooldown: 1.1, targets: 'ground', projectileSpeed: 0, style: 'prism', splash: { radius: 1.3, fraction: 0.5 }, armorShred: { amount: 8, duration: 6 } },
      },
    ],
  },
  {
    id: 'starSapphire',
    family: 'sapphire',
    colour: '#2f5bff',
    ingredients: [g('sapphire', 4), g('topaz', 3), g('ruby', 2)],
    upgrades: [g('topaz', 4)],
    levels: [
      {
        name: 'Star Sapphire',
        description: 'Freezing bolts that chain through a pack.',
        attack: { damage: 180, range: 4.5, cooldown: 1.0, targets: 'both', projectileSpeed: 0, style: 'frost', chain: { bounces: 4, range: 3, falloff: 0.85 }, slow: { amount: 0.45, duration: 3 } },
      },
      {
        name: 'Six-Rayed Star',
        description: 'Winter in a stone.',
        attack: { damage: 480, range: 4.8, cooldown: 0.9, targets: 'both', projectileSpeed: 0, style: 'frost', chain: { bounces: 6, range: 3.2, falloff: 0.88 }, slow: { amount: 0.55, duration: 3 } },
      },
    ],
  },
  {
    id: 'blackOpal',
    family: 'opal',
    colour: '#20233a',
    ingredients: [g('opal', 4), g('diamond', 3), g('aquamarine', 2)],
    upgrades: [g('aquamarine', 4)],
    levels: [
      {
        name: 'Black Opal',
        description: 'A powerful attack-speed aura over a wide area.',
        attack: { damage: 150, range: 4, cooldown: 0.8, targets: 'both', projectileSpeed: 12, style: 'pulse' },
        aura: { radius: 3.5, attackSpeed: 0.45 },
      },
      {
        name: 'Abyssal Opal',
        description: 'Everything nearby moves at a sprint.',
        attack: { damage: 400, range: 4.3, cooldown: 0.75, targets: 'both', projectileSpeed: 13, style: 'pulse' },
        aura: { radius: 4, attackSpeed: 0.65 },
      },
    ],
  },
  {
    id: 'pinkDiamond',
    family: 'diamond',
    colour: '#ff9fd0',
    ingredients: [g('diamond', 4), g('topaz', 2), g('diamond', 2)],
    upgrades: [g('diamond', 4)],
    levels: [
      {
        name: 'Pink Diamond',
        description: 'Colossal critical strikes against ground creeps.',
        attack: { damage: 420, range: 4, cooldown: 1.0, targets: 'ground', projectileSpeed: 0, style: 'prism', crit: { chance: 0.3, mult: 4 } },
      },
      {
        name: 'Great Pink Diamond',
        description: 'The rarest light.',
        attack: { damage: 1100, range: 4.3, cooldown: 0.95, targets: 'ground', projectileSpeed: 0, style: 'prism', crit: { chance: 0.35, mult: 5 } },
      },
    ],
  },
  {
    id: 'uranium',
    family: 'topaz',
    colour: '#b6ff3a',
    ingredients: [g('topaz', 4), g('sapphire', 2), g('opal', 1)],
    upgrades: [g('emerald', 4)],
    levels: [
      {
        name: 'Uranium',
        description: 'Pulses damage and slow into everything in range.',
        attack: { damage: 90, range: 3.0, cooldown: 1.0, targets: 'both', projectileSpeed: 0, style: 'pulse', multi: 99, slow: { amount: 0.3, duration: 1.5 } },
      },
      {
        name: 'Enriched Uranium',
        description: 'Now it lingers.',
        attack: { damage: 280, range: 3.5, cooldown: 1.0, targets: 'both', projectileSpeed: 0, style: 'pulse', multi: 99, slow: { amount: 0.35, duration: 1.5 }, poison: { dps: 60, duration: 3 } },
      },
    ],
  },
  {
    id: 'paraiba',
    family: 'aquamarine',
    colour: '#19e3e0',
    ingredients: [g('aquamarine', 4), g('opal', 3), g('aquamarine', 1), g('emerald', 1)],
    upgrades: [g('opal', 4)],
    levels: [
      {
        name: 'Paraiba',
        description: 'Neon chain lightning at a furious pace.',
        attack: { damage: 220, range: 4, cooldown: 0.35, targets: 'both', projectileSpeed: 0, style: 'lightning', chain: { bounces: 3, range: 2.5, falloff: 0.8 } },
      },
      {
        name: 'Electric Paraiba',
        description: 'The valley hums.',
        attack: { damage: 520, range: 4.3, cooldown: 0.3, targets: 'both', projectileSpeed: 0, style: 'lightning', chain: { bounces: 4, range: 2.8, falloff: 0.82 } },
      },
    ],
  },
  {
    id: 'sunheart',
    family: 'ruby',
    colour: '#ff5a1f',
    master: true,
    ingredients: [{ special: 'sunstone' }, { special: 'bloodstone' }, g('ruby', 4)],
    upgrades: [],
    levels: [
      {
        name: 'Sunheart',
        description: 'A captive sun: enormous burning splash on land and air.',
        attack: { damage: 900, range: 4.4, cooldown: 0.9, targets: 'both', projectileSpeed: 11, style: 'ember', splash: { radius: 2.4, fraction: 0.7 }, poison: { dps: 150, duration: 3 } },
      },
    ],
  },
  {
    id: 'eclipse',
    family: 'opal',
    colour: '#3a2a6a',
    master: true,
    ingredients: [{ special: 'moonstone' }, { special: 'blackOpal' }, g('amethyst', 4)],
    upgrades: [],
    levels: [
      {
        name: 'Eclipse',
        description: 'Darkness made solid. Vast aura; terrifying at night.',
        attack: { damage: 1100, range: 5.5, cooldown: 0.9, targets: 'both', projectileSpeed: 12, style: 'pulse' },
        aura: { radius: 4.5, attackSpeed: 0.6 },
        phaseMods: { dusk: { damageMult: 1.3 }, night: { damageMult: 1.8, rangeAdd: 1 } },
      },
    ],
  },
  {
    id: 'prismheart',
    family: 'diamond',
    colour: '#ffffff',
    master: true,
    ingredients: [{ special: 'quicksilver' }, { special: 'pinkDiamond' }, g('topaz', 4)],
    upgrades: [],
    levels: [
      {
        name: 'Prismheart',
        description: 'Splits light into chaining, critical beams.',
        attack: { damage: 1300, range: 4.8, cooldown: 0.8, targets: 'both', projectileSpeed: 0, style: 'prism', chain: { bounces: 5, range: 3, falloff: 0.9 }, crit: { chance: 0.3, mult: 3 } },
      },
    ],
  },
  {
    id: 'worldroot',
    family: 'emerald',
    colour: '#0f8a4a',
    master: true,
    ingredients: [{ special: 'jade' }, { special: 'malachite' }, g('emerald', 4)],
    upgrades: [],
    levels: [
      {
        name: 'Worldroot',
        description: 'Poisons and roots everything in its reach.',
        attack: { damage: 480, range: 3.8, cooldown: 1.0, targets: 'both', projectileSpeed: 0, style: 'venom', multi: 99, poison: { dps: 400, duration: 4 }, slow: { amount: 0.4, duration: 2 } },
      },
    ],
  },
];

export const SPECIALS_BY_ID: Record<string, SpecialDef> = Object.fromEntries(
  SPECIALS.map((s) => [s.id, s]),
);
