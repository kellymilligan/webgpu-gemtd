import type { AttackDef, Family, Grade, TowerDef } from '../types';
import { GRADE_NAMES } from '../types';

interface FamilyDef {
  name: string;
  role: string;
  base: AttackDef;
  /** Applies grade scaling on top of the generic damage/range curve. */
  scale?: (a: AttackDef, g: Grade) => void;
  aura?: (g: Grade) => { radius: number; attackSpeed: number };
}

/** Damage multiplier per grade. Steep, so upgrading odds matters. */
export const GRADE_DAMAGE = [1, 2.2, 4.8, 10.5, 24] as const;
export const GRADE_RANGE_BONUS = 0.25;

export const FAMILY_DEFS: Record<Family, FamilyDef> = {
  ruby: {
    name: 'Ruby',
    role: 'Splash, land and air',
    base: { damage: 9, range: 3.2, cooldown: 1.0, targets: 'both', projectileSpeed: 9, style: 'ember', splash: { radius: 1.0, fraction: 0.5 } },
    scale: (a, g) => {
      a.splash = { radius: 1.0 + 0.15 * g, fraction: 0.5 };
    },
  },
  sapphire: {
    name: 'Sapphire',
    role: 'Slow',
    base: { damage: 6, range: 3.5, cooldown: 1.0, targets: 'both', projectileSpeed: 12, style: 'frost', slow: { amount: 0.2, duration: 2 } },
    scale: (a, g) => {
      a.slow = { amount: 0.2 + 0.06 * g, duration: 2 + 0.25 * g };
    },
  },
  emerald: {
    name: 'Emerald',
    role: 'Poison',
    base: { damage: 5, range: 3.2, cooldown: 1.0, targets: 'both', projectileSpeed: 10, style: 'venom', poison: { dps: 3, duration: 3 }, slow: { amount: 0.1, duration: 1.5 } },
    scale: (a, g) => {
      a.poison = { dps: 3 * GRADE_DAMAGE[g], duration: 3 + 0.5 * g };
    },
  },
  topaz: {
    name: 'Topaz',
    role: 'Multi-target',
    base: { damage: 6, range: 3.2, cooldown: 1.0, targets: 'both', projectileSpeed: 0, style: 'lightning', multi: 2 },
    scale: (a, g) => {
      a.multi = 2 + Math.floor((g + 1) / 2);
    },
  },
  diamond: {
    name: 'Diamond',
    role: 'Burst, ground only',
    base: { damage: 14, range: 3.3, cooldown: 1.0, targets: 'ground', projectileSpeed: 0, style: 'prism', crit: { chance: 0.2, mult: 2 } },
    scale: (a, g) => {
      a.crit = { chance: 0.2 + 0.02 * g, mult: 2 + 0.25 * g };
    },
  },
  amethyst: {
    name: 'Amethyst',
    role: 'Long range, air only',
    base: { damage: 26, range: 5.5, cooldown: 1.1, targets: 'air', projectileSpeed: 10, style: 'comet' },
  },
  opal: {
    name: 'Opal',
    role: 'Attack-speed aura',
    base: { damage: 4, range: 3.0, cooldown: 1.0, targets: 'both', projectileSpeed: 10, style: 'pulse' },
    aura: (g) => ({ radius: 2.5 + 0.25 * g, attackSpeed: 0.1 + 0.05 * g }),
  },
  aquamarine: {
    name: 'Aquamarine',
    role: 'Rapid fire, short range',
    base: { damage: 4, range: 2.6, cooldown: 0.4, targets: 'both', projectileSpeed: 16, style: 'needle' },
  },
};

const cache = new Map<string, TowerDef>();

export function gemName(family: Family, grade: Grade): string {
  return `${GRADE_NAMES[grade]} ${FAMILY_DEFS[family].name}`;
}

export function gemTowerDef(family: Family, grade: Grade): TowerDef {
  const key = `${family}:${grade}`;
  let def = cache.get(key);
  if (def) return def;
  const f = FAMILY_DEFS[family];
  const attack: AttackDef = structuredClone(f.base);
  attack.damage = Math.round(f.base.damage * GRADE_DAMAGE[grade]);
  attack.range = f.base.range + GRADE_RANGE_BONUS * grade;
  f.scale?.(attack, grade);
  def = {
    name: gemName(family, grade),
    description: f.role,
    attack,
    aura: f.aura?.(grade),
  };
  cache.set(key, def);
  return def;
}
