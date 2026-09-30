import { ARCHETYPES } from './data/creeps';
import type { Archetype } from './data/creeps';
import { TOTAL_WAVES, childHp, phaseForWave, spawnSchedule, waveDef } from './data/waves';
import { nextFloat } from './rng';
import { effectiveAttack, towerDef } from './towers';
import type { AttackDef, Creep, GameEvent, GameState, Route, Tower } from './types';

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;

export function beginSpawns(s: GameState) {
  const def = waveDef(s.seed, s.wave);
  s.spawn = { elapsed: 0, next: 0, total: spawnSchedule(def).length };
}

function routeFor(s: GameState, air: boolean): Route {
  return air ? s.airRoute : s.groundRoute;
}

interface SpawnSpec {
  arch: Archetype;
  hp: number;
  armor: number;
  bounty: number;
  lifeCost: number;
  speed: number;
  elite: boolean;
  dist: number;
}

function spawnCreep(s: GameState, spec: SpawnSpec): Creep {
  const { arch } = spec;
  const route = routeFor(s, arch.air);
  const shield = arch.abilities.shield ? Math.round(spec.hp * arch.abilities.shield) : 0;
  const c: Creep = {
    id: s.nextId++,
    archetype: arch.id,
    air: arch.air,
    hp: spec.hp,
    maxHp: spec.hp,
    armor: spec.armor,
    speed: spec.speed,
    baseSpeed: spec.speed,
    regen: arch.regen,
    bounty: spec.bounty,
    lifeCost: spec.lifeCost,
    dist: Math.min(spec.dist, route.total - 0.01),
    seg: 0,
    x: route.points[0],
    y: route.points[1],
    px: 0,
    py: 0,
    slowAmount: 0,
    slowTime: 0,
    poisonDps: 0,
    poisonTime: 0,
    poisonSource: -1,
    shredAmount: 0,
    shredTime: 0,
    shield,
    maxShield: shield,
    // Stagger ability timers so packs don't act in lockstep.
    abilityCd: 1 + ((s.nextId * 0.37) % 1.5),
    burrowTime: 0,
    haste: 0,
    enraged: false,
    elite: spec.elite,
  };
  placeOnRoute(c, route);
  c.px = c.x;
  c.py = c.y;
  s.creeps.push(c);
  return c;
}

function spawnChild(s: GameState, parent: Creep, id: string, offset: number) {
  const arch = ARCHETYPES[id];
  const air = arch.air;
  // A ground child of a flyer (or vice versa) starts its own route from the beginning.
  const dist = air === parent.air ? Math.max(0, parent.dist - offset) : 0;
  spawnCreep(s, {
    arch,
    hp: childHp(s.wave, arch),
    armor: arch.armor + Math.floor(s.wave / 8),
    bounty: Math.max(1, Math.round((1 + s.wave * 0.2) * arch.bountyMult)),
    lifeCost: arch.lifeCost,
    speed: arch.speed,
    elite: false,
    dist,
  });
}

function placeOnRoute(c: Creep, route: Route) {
  const { lengths, points } = route;
  if (lengths[c.seg] > c.dist) c.seg = 0;
  while (c.seg < lengths.length - 2 && lengths[c.seg + 1] <= c.dist) c.seg++;
  const segLen = lengths[c.seg + 1] - lengths[c.seg];
  const t = segLen > 0 ? Math.min(1, (c.dist - lengths[c.seg]) / segLen) : 0;
  const i = c.seg * 2;
  c.x = points[i] + (points[i + 2] - points[i]) * t;
  c.y = points[i + 1] + (points[i + 3] - points[i + 1]) * t;
}

export function armorMultiplier(armor: number): number {
  if (armor >= 0) return 1 - (0.06 * armor) / (1 + 0.06 * armor);
  return Math.min(1.5, 1 - 0.05 * armor);
}

function effectiveArmor(c: Creep): number {
  const a = ARCHETYPES[c.archetype];
  let armor = c.armor - c.shredAmount;
  if (a.abilities.shellBreak && c.hp < c.maxHp * 0.5) armor -= a.abilities.shellBreak;
  return armor;
}

function damageCreep(s: GameState, c: Creep, amount: number, tower: Tower | undefined, events: GameEvent[]) {
  if (c.hp <= 0 || amount <= 0) return;
  if (c.shield > 0) {
    const absorbed = Math.min(c.shield, amount);
    c.shield -= absorbed;
    amount -= absorbed;
    if (tower) tower.damage += absorbed;
    if (c.shield <= 0) events.push({ type: 'shieldBreak', x: c.x, y: c.y, air: c.air });
    if (amount <= 0) return;
  }
  const dealt = Math.min(amount, c.hp);
  c.hp -= amount;
  if (tower) tower.damage += dealt;
  if (c.hp <= 0) {
    s.gold += c.bounty;
    s.stats.goldEarned += c.bounty;
    s.stats.kills++;
    if (tower) tower.kills++;
    events.push({ type: 'death', creepId: c.id, x: c.x, y: c.y, air: c.air, archetype: c.archetype, bounty: c.bounty });
    const split = ARCHETYPES[c.archetype].abilities.split;
    if (split) for (let i = 0; i < split.count; i++) spawnChild(s, c, split.id, i * 0.35);
  }
}

function applyEffects(c: Creep, a: AttackDef, towerId: number) {
  const ab = ARCHETYPES[c.archetype].abilities;
  if (a.slow && !ab.immuneSlow && (a.slow.amount > c.slowAmount || c.slowTime <= 0 || a.slow.amount === c.slowAmount)) {
    c.slowTime = a.slow.amount === c.slowAmount ? Math.max(c.slowTime, a.slow.duration) : a.slow.duration;
    c.slowAmount = a.slow.amount;
  }
  if (a.poison && !ab.immunePoison && (a.poison.dps >= c.poisonDps || c.poisonTime <= 0)) {
    c.poisonDps = a.poison.dps;
    c.poisonTime = a.poison.duration;
    c.poisonSource = towerId;
  }
  if (a.armorShred && (a.armorShred.amount >= c.shredAmount || c.shredTime <= 0)) {
    c.shredAmount = a.armorShred.amount;
    c.shredTime = a.armorShred.duration;
  }
}

const targetable = (c: Creep) => c.hp > 0 && c.burrowTime <= 0;
const canTarget = (a: AttackDef, c: Creep) => targetable(c) && (a.targets === 'both' || (a.targets === 'air') === c.air);

/** A direct hit may be dodged by evasive creeps. */
function evades(s: GameState, c: Creep, events: GameEvent[]): boolean {
  const ev = ARCHETYPES[c.archetype].abilities.evasion;
  if (!ev || nextFloat(s.rng) >= ev) return false;
  events.push({ type: 'miss', x: c.x, y: c.y, air: c.air });
  return true;
}

function hit(s: GameState, tower: Tower | undefined, a: AttackDef, target: Creep | undefined, x: number, y: number, damage: number, crit: boolean, air: boolean, events: GameEvent[]) {
  const towerId = tower?.id ?? -1;
  if (target && target.hp > 0) {
    if (evades(s, target, events)) return;
    damageCreep(s, target, damage * armorMultiplier(effectiveArmor(target)), tower, events);
    applyEffects(target, a, towerId);
  }
  if (a.splash) {
    const r2 = a.splash.radius * a.splash.radius;
    for (const c of s.creeps) {
      if (c === target || !canTarget(a, c)) continue;
      const dx = c.x - x;
      const dy = c.y - y;
      if (dx * dx + dy * dy > r2) continue;
      damageCreep(s, c, damage * a.splash.fraction * armorMultiplier(effectiveArmor(c)), tower, events);
      applyEffects(c, a, towerId);
    }
  }
  events.push({ type: 'hit', x, y, style: a.style, air, crit, splash: a.splash ? a.splash.radius : 0 });
}

function chainFrom(s: GameState, tower: Tower, a: AttackDef, first: Creep, damage: number, events: GameEvent[]) {
  const chain = a.chain!;
  const hitIds = new Set<number>([first.id]);
  const points = [tower.x + 0.5, tower.y + 0.5, first.x, first.y];
  let from = first;
  let dmg = damage;
  const r2 = chain.range * chain.range;
  for (let b = 0; b < chain.bounces; b++) {
    let best: Creep | undefined;
    let bestD = Infinity;
    for (const c of s.creeps) {
      if (hitIds.has(c.id) || !canTarget(a, c)) continue;
      const dx = c.x - from.x;
      const dy = c.y - from.y;
      const d = dx * dx + dy * dy;
      if (d <= r2 && (d < bestD || (d === bestD && best && c.id < best.id))) {
        best = c;
        bestD = d;
      }
    }
    if (!best) break;
    dmg *= chain.falloff;
    hitIds.add(best.id);
    points.push(best.x, best.y);
    hit(s, tower, a, best, best.x, best.y, dmg, false, best.air, events);
    from = best;
  }
  if (points.length > 4) events.push({ type: 'chain', points, style: a.style });
}

function selectTargets(s: GameState, t: Tower, a: AttackDef): Creep[] {
  const cx = t.x + 0.5;
  const cy = t.y + 0.5;
  const r2 = a.range * a.range;
  const inRange: { c: Creep; key: number }[] = [];
  for (const c of s.creeps) {
    if (!canTarget(a, c)) continue;
    const dx = c.x - cx;
    const dy = c.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    const remaining = routeFor(s, c.air).total - c.dist;
    let key: number;
    switch (t.targeting) {
      case 'first': key = remaining; break;
      case 'last': key = -remaining; break;
      case 'strongest': key = -(c.hp + c.shield); break;
      case 'weakest': key = c.hp + c.shield; break;
      case 'closest': key = d2; break;
    }
    inRange.push({ c, key });
  }
  inRange.sort((p, q) => p.key - q.key || p.c.id - q.c.id);
  return inRange.slice(0, a.multi ?? 1).map((e) => e.c);
}

function fire(s: GameState, t: Tower, a: AttackDef, targets: Creep[], events: GameEvent[]) {
  const ox = t.x + 0.5;
  const oy = t.y + 0.5;
  for (const c of targets) {
    const crit = !!a.crit && nextFloat(s.rng) < a.crit.chance;
    const damage = crit ? a.damage * a.crit!.mult : a.damage;
    const instant = a.projectileSpeed <= 0;
    events.push({ type: 'fire', towerId: t.id, targetId: c.id, style: a.style, x: ox, y: oy, tx: c.x, ty: c.y, air: c.air, crit, instant });
    if (instant) {
      hit(s, t, a, c, c.x, c.y, damage, crit, c.air, events);
      if (a.chain) chainFrom(s, t, a, c, damage, events);
    } else {
      s.projectiles.push({ id: s.nextId++, towerId: t.id, targetId: c.id, x: ox, y: oy, px: ox, py: oy, tx: c.x, ty: c.y, speed: a.projectileSpeed, style: a.style, air: c.air, crit, damage });
    }
  }
}

function runSpawner(s: GameState) {
  const sp = s.spawn;
  if (!sp || sp.next >= sp.total) return;
  sp.elapsed += DT;
  const def = waveDef(s.seed, s.wave);
  const schedule = spawnSchedule(def);
  while (sp.next < sp.total && schedule[sp.next].time <= sp.elapsed) {
    const g = def.groups[schedule[sp.next].group];
    spawnCreep(s, { arch: g.archetype, hp: g.hp, armor: g.armor, bounty: g.bounty, lifeCost: g.lifeCost, speed: g.speed, elite: g.elite, dist: 0 });
    sp.next++;
  }
}

/** Auras, heals, broods, blinks and burrows. */
function runAbilities(s: GameState, events: GameEvent[]) {
  for (const c of s.creeps) c.haste = 0;
  const snapshot = s.creeps.slice();
  for (const c of snapshot) {
    if (c.hp <= 0) continue;
    const ab = ARCHETYPES[c.archetype].abilities;
    if (ab.haste) {
      const r2 = ab.haste.radius * ab.haste.radius;
      for (const o of snapshot) {
        if (o === c || o.hp <= 0 || o.air !== c.air) continue;
        const dx = o.x - c.x;
        const dy = o.y - c.y;
        if (dx * dx + dy * dy <= r2 && ab.haste.amount > o.haste) o.haste = ab.haste.amount;
      }
    }
    if (c.burrowTime > 0) c.burrowTime = Math.max(0, c.burrowTime - DT);
    if (!(ab.heal || ab.brood || ab.blink || ab.burrow)) continue;
    c.abilityCd -= DT;
    if (c.abilityCd > 0) continue;
    if (ab.heal) {
      c.abilityCd = ab.heal.every;
      const r2 = ab.heal.radius * ab.heal.radius;
      for (const o of snapshot) {
        if (o.hp <= 0 || o.air !== c.air) continue;
        const dx = o.x - c.x;
        const dy = o.y - c.y;
        if (dx * dx + dy * dy <= r2) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * ab.heal.pct);
      }
      events.push({ type: 'heal', x: c.x, y: c.y, radius: ab.heal.radius });
    } else if (ab.brood) {
      c.abilityCd = ab.brood.every;
      spawnChild(s, c, ab.brood.id, 0.2);
    } else if (ab.blink) {
      c.abilityCd = ab.blink.every;
      const route = routeFor(s, c.air);
      const fx = c.x;
      const fy = c.y;
      c.dist = Math.min(route.total - 0.5, c.dist + ab.blink.dist);
      placeOnRoute(c, route);
      c.px = c.x;
      c.py = c.y;
      events.push({ type: 'blink', creepId: c.id, fromX: fx, fromY: fy, x: c.x, y: c.y });
    } else if (ab.burrow) {
      c.abilityCd = ab.burrow.every + ab.burrow.duration;
      c.burrowTime = ab.burrow.duration;
      events.push({ type: 'burrow', creepId: c.id, x: c.x, y: c.y });
    }
  }
}

/** Advances an active wave by one tick. */
export function stepWave(s: GameState, events: GameEvent[]) {
  const phase = phaseForWave(s.wave);
  runSpawner(s);

  const towersById = new Map<number, Tower>();
  for (const t of s.towers) towersById.set(t.id, t);

  runAbilities(s, events);

  // Creeps: status effects, then movement.
  for (const c of s.creeps) {
    c.px = c.x;
    c.py = c.y;
    if (c.hp <= 0) continue;
    if (c.regen > 0) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * c.regen * DT);
    if (c.poisonTime > 0) {
      damageCreep(s, c, c.poisonDps * DT, towersById.get(c.poisonSource), events);
      c.poisonTime -= DT;
      if (c.poisonTime <= 0) c.poisonDps = 0;
    }
    if (c.slowTime > 0) {
      c.slowTime -= DT;
      if (c.slowTime <= 0) c.slowAmount = 0;
    }
    if (c.shredTime > 0) {
      c.shredTime -= DT;
      if (c.shredTime <= 0) c.shredAmount = 0;
    }
    if (c.hp <= 0) continue;
    const enrage = ARCHETYPES[c.archetype].abilities.enrage;
    if (enrage && !c.enraged && c.hp < c.maxHp * enrage.below) c.enraged = true;
    c.speed = c.baseSpeed * (c.enraged && enrage ? enrage.speedMult : 1) * (1 + c.haste);
    const route = routeFor(s, c.air);
    c.dist += c.speed * Math.max(0.1, 1 - c.slowAmount) * DT;
    if (c.dist >= route.total) {
      c.hp = 0;
      s.lives = Math.max(0, s.lives - c.lifeCost);
      s.stats.leaks++;
      events.push({ type: 'leak', creepId: c.id, lifeCost: c.lifeCost });
      continue;
    }
    placeOnRoute(c, route);
  }

  // Towers.
  for (const t of s.towers) {
    const a = effectiveAttack(towerDef(t), phase);
    t.cooldown -= DT * (1 + t.auraBonus);
    if (t.cooldown > 0) continue;
    const targets = selectTargets(s, t, a);
    if (targets.length === 0) {
      t.cooldown = 0;
      continue;
    }
    fire(s, t, a, targets, events);
    t.cooldown += a.cooldown;
  }

  // Projectiles.
  const creepsById = new Map<number, Creep>();
  for (const c of s.creeps) if (c.hp > 0) creepsById.set(c.id, c);
  const flying = [];
  for (const p of s.projectiles) {
    p.px = p.x;
    p.py = p.y;
    const target = creepsById.get(p.targetId);
    const live = target && target.burrowTime <= 0 ? target : undefined;
    if (live) {
      p.tx = live.x;
      p.ty = live.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const step = p.speed * DT;
    if (d <= step) {
      const tower = towersById.get(p.towerId);
      const a = tower ? effectiveAttack(towerDef(tower), phase) : undefined;
      if (a) hit(s, tower, a, live, p.tx, p.ty, p.damage, p.crit, p.air, events);
      continue;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    flying.push(p);
  }
  s.projectiles = flying;
  s.creeps = s.creeps.filter((c) => c.hp > 0);

  if (s.lives <= 0) {
    s.phase = 'lost';
    events.push({ type: 'gameOver', won: false });
    return;
  }
  if (s.spawn && s.spawn.next >= s.spawn.total && s.creeps.length === 0) {
    events.push({ type: 'waveEnd', wave: s.wave });
    s.spawn = null;
    s.projectiles = [];
    if (s.wave >= TOTAL_WAVES) {
      s.phase = 'won';
      events.push({ type: 'gameOver', won: true });
    } else {
      s.wave++;
      s.phase = 'build';
    }
  }
}
