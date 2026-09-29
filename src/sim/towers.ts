import { gemName, gemTowerDef } from './data/gems';
import { SPECIALS_BY_ID } from './data/recipes';
import type { AttackDef, TimePhase, Tower, TowerDef } from './types';

export function towerDef(t: Pick<Tower, 'kind' | 'family' | 'grade' | 'specialId' | 'level'>): TowerDef {
  if (t.kind === 'special') return SPECIALS_BY_ID[t.specialId!].levels[t.level];
  return gemTowerDef(t.family, t.grade);
}

export function towerName(t: Pick<Tower, 'kind' | 'family' | 'grade' | 'specialId' | 'level'>): string {
  return t.kind === 'special' ? towerDef(t).name : gemName(t.family, t.grade);
}

const effCache = new Map<TowerDef, Map<TimePhase, AttackDef>>();

/** The attack after time-of-day modifiers. Cached per definition and phase. */
export function effectiveAttack(def: TowerDef, phase: TimePhase): AttackDef {
  const mod = def.phaseMods?.[phase];
  if (!mod) return def.attack;
  let byPhase = effCache.get(def);
  if (!byPhase) effCache.set(def, (byPhase = new Map()));
  let a = byPhase.get(phase);
  if (!a) {
    a = {
      ...def.attack,
      damage: Math.round(def.attack.damage * (mod.damageMult ?? 1)),
      range: def.attack.range + (mod.rangeAdd ?? 0),
      cooldown: def.attack.cooldown * (mod.cooldownMult ?? 1),
    };
    byPhase.set(phase, a);
  }
  return a;
}

/** Recomputes aura bonuses; auras don't stack, the strongest applies. */
export function applyAuras(towers: Tower[]) {
  for (const t of towers) t.auraBonus = 0;
  for (const src of towers) {
    const aura = towerDef(src).aura;
    if (!aura) continue;
    const r2 = aura.radius * aura.radius;
    for (const t of towers) {
      if (t === src) continue;
      const dx = t.x - src.x;
      const dy = t.y - src.y;
      if (dx * dx + dy * dy <= r2 && aura.attackSpeed > t.auraBonus) t.auraBonus = aura.attackSpeed;
    }
  }
}

/** Raw sustained single-target DPS estimate, for UI comparisons. */
export function estimateDps(a: AttackDef, auraBonus = 0): number {
  const hits = Math.min(a.multi ?? 1, 3);
  const crit = a.crit ? 1 + a.crit.chance * (a.crit.mult - 1) : 1;
  const chain = a.chain ? 1 + Array.from({ length: a.chain.bounces }, (_, i) => a.chain!.falloff ** (i + 1)).reduce((s, v) => s + v, 0) : 1;
  const poison = a.poison ? a.poison.dps * Math.min(a.poison.duration, a.cooldown) / a.cooldown : 0;
  return ((a.damage * crit * hits * chain) / a.cooldown) * (1 + auraBonus) + poison;
}
