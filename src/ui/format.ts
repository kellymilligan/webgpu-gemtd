import { estimateDps } from '../sim/towers';
import type { AttackDef, TowerDef } from '../sim/types';

export function attackTags(def: TowerDef): string[] {
  const a: AttackDef = def.attack;
  const tags: string[] = [];
  if (a.targets === 'air') tags.push('Air only');
  if (a.targets === 'ground') tags.push('Ground only');
  if (a.splash) tags.push(`Splash ${a.splash.radius.toFixed(1)}`);
  if (a.slow) tags.push(`Slow ${Math.round(a.slow.amount * 100)}%`);
  if (a.poison) tags.push(`Poison ${Math.round(a.poison.dps)}/s`);
  if (a.multi && a.multi >= 99) tags.push('Hits all in range');
  else if (a.multi && a.multi > 1) tags.push(`${a.multi} targets`);
  if (a.chain) tags.push(`Chains ×${a.chain.bounces}`);
  if (a.crit) tags.push(`Crit ${Math.round(a.crit.chance * 100)}% ×${a.crit.mult}`);
  if (a.armorShred) tags.push(`Shred ${a.armorShred.amount}`);
  if (def.aura) tags.push(`Aura +${Math.round(def.aura.attackSpeed * 100)}% speed`);
  if (def.phaseMods) tags.push('Changes with the light');
  return tags;
}

export function statLine(def: TowerDef): string {
  const a = def.attack;
  return `${Math.round(estimateDps(a))} dps · ${a.range.toFixed(1)} range`;
}
