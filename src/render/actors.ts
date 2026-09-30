import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from 'three/webgpu';
import { ARCHETYPES } from '../sim/data/creeps';
import { buildCreepModel } from './creeps';
import type { CreepModel } from './creeps';
import type { Creep, Family, GameState, PendingGem, Tower } from '../sim/types';
import { AIR_HEIGHT, hash2, toWorldX, toWorldZ } from './coords';
import { gemGeometry, gemMaterial, gradeScale, specialGem } from './gems';

const plinthGeo = new CylinderGeometry(0.3, 0.42, 0.24, 8).translate(0, 0.12, 0);
const plinthMat = new MeshStandardMaterial({ color: '#77736b', roughness: 0.85, flatShading: true });
const plinthTrimMat = new MeshStandardMaterial({ color: '#c9a55a', roughness: 0.35, metalness: 0.8 });
const trimGeo = new TorusGeometry(0.4, 0.025, 4, 16).rotateX(Math.PI / 2);
const haloGeo = new TorusGeometry(0.42, 0.018, 6, 40).rotateX(Math.PI / 2);
const pendingRingGeo = new RingGeometry(0.36, 0.46, 32).rotateX(-Math.PI / 2);
const pendingRingMat = new MeshStandardMaterial({ color: '#ffffff', emissive: new Color('#ffffff'), emissiveIntensity: 0.6, transparent: true, opacity: 0.7, side: DoubleSide });

interface TowerView {
  root: Group;
  spinner: Group;
  gem: Mesh;
  halo?: Mesh;
  key: string;
  phase: number;
  born: number;
}

interface PendingView {
  root: Group;
  spinner: Group;
  gem: Mesh;
  ring: Mesh;
  phase: number;
  born: number;
}

interface CreepView {
  root: Group;
  body: Group;
  model: CreepModel;
  hpBg: Sprite;
  hpFg: Sprite;
  shield?: Mesh;
  heading: number;
  phase: number;
  boss: boolean;
  elite: boolean;
  scale: number;
  sink: number;
}

/** Cut gems tilt toward the viewer so their crowns catch the light. */
const GEM_TILT: Record<Family, number> = {
  ruby: 0.9,
  sapphire: 0.8,
  emerald: 0.7,
  topaz: 0.25,
  diamond: 0.9,
  amethyst: 0,
  opal: 0.6,
  aquamarine: 0,
};

const hpBgMat = new SpriteMaterial({ color: '#12060a', depthTest: false, transparent: true, opacity: 0.75 });
const hpColours = { high: new Color('#7dff8a'), mid: new Color('#ffd35c'), low: new Color('#ff4f4f') };

export class Actors {
  readonly group = new Group();
  private towers = new Map<number, TowerView>();
  private pending = new Map<number, PendingView>();
  private creeps = new Map<number, CreepView>();
  private hpMats = new Map<number, SpriteMaterial>();

  /** Drops every view; used when a new run starts (entity ids restart). */
  clear() {
    this.group.clear();
    this.towers.clear();
    this.pending.clear();
    this.creeps.clear();
    for (const m of this.hpMats.values()) m.dispose();
    this.hpMats.clear();
  }

  towerWorldPos(id: number) {
    return this.towers.get(id)?.root.position;
  }

  sync(s: GameState, alpha: number, time: number) {
    this.syncTowers(s.towers, time);
    this.syncPending(s.pending, time);
    this.syncCreeps(s.creeps, alpha, time);
  }

  private syncTowers(towers: Tower[], time: number) {
    const seen = new Set<number>();
    for (const t of towers) {
      seen.add(t.id);
      const key = `${t.kind}:${t.family}:${t.grade}:${t.specialId}:${t.level}`;
      let v = this.towers.get(t.id);
      if (v && v.key !== key) {
        this.group.remove(v.root);
        v = undefined;
      }
      if (!v) {
        v = this.makeTower(t, key, time);
        this.towers.set(t.id, v);
        this.group.add(v.root);
      }
      const age = Math.min(1, (time - v.born) / 0.5);
      const s = gradeScale(t.grade, t.kind === 'special') * (t.kind === 'special' ? 1 + 0.1 * t.level : 1);
      v.spinner.scale.setScalar(s * easeOutBack(age));
      v.spinner.position.y = 0.62 + 0.12 * s + Math.sin(time * 1.6 + v.phase) * 0.06;
      v.spinner.rotation.y = time * 0.5 + v.phase;
      if (v.halo) {
        v.halo.rotation.x = Math.sin(time * 0.9 + v.phase) * 0.4;
        v.halo.rotation.z = Math.cos(time * 0.7 + v.phase) * 0.4;
      }
    }
    for (const [id, v] of this.towers) {
      if (!seen.has(id)) {
        this.group.remove(v.root);
        this.towers.delete(id);
      }
    }
  }

  private makeTower(t: Tower, key: string, time: number): TowerView {
    const root = new Group();
    root.position.set(toWorldX(t.x + 0.5), 0, toWorldZ(t.y + 0.5));
    const plinth = new Mesh(plinthGeo, plinthMat);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    root.add(plinth);
    if (t.grade >= 3 || t.kind === 'special') {
      const trim = new Mesh(trimGeo, plinthTrimMat);
      trim.position.y = 0.2;
      root.add(trim);
    }
    const special = t.kind === 'special';
    const gm = gemMaterial(t.family, t.grade, t.specialId, t.level);
    const gem = new Mesh(special ? specialGem() : gemGeometry(t.family, t.grade), gm.material);
    gem.castShadow = true;
    gem.rotation.x = GEM_TILT[t.family];
    const spinner = new Group();
    spinner.add(gem);
    root.add(spinner);
    let halo: Mesh | undefined;
    if (special) {
      halo = new Mesh(haloGeo, gm.material);
      spinner.add(halo);
    }
    return { root, spinner, gem, halo, key, phase: hash2(t.x, t.y) * 10, born: time };
  }

  private syncPending(pending: PendingGem[], time: number) {
    const seen = new Set<number>();
    for (const p of pending) {
      seen.add(p.id);
      let v = this.pending.get(p.id);
      if (!v) {
        const root = new Group();
        root.position.set(toWorldX(p.x + 0.5), 0, toWorldZ(p.y + 0.5));
        const gem = new Mesh(gemGeometry(p.family, p.grade), gemMaterial(p.family, p.grade).material);
        gem.castShadow = true;
        gem.rotation.x = GEM_TILT[p.family];
        const spinner = new Group();
        spinner.add(gem);
        const ring = new Mesh(pendingRingGeo, pendingRingMat);
        ring.position.y = 0.03;
        root.add(spinner, ring);
        v = { root, spinner, gem, ring, phase: hash2(p.x, p.y) * 10, born: time };
        this.pending.set(p.id, v);
        this.group.add(root);
      }
      const age = Math.min(1, (time - v.born) / 0.6);
      v.spinner.scale.setScalar(gradeScale(p.grade, false) * easeOutBack(age));
      v.spinner.position.y = 0.4 + 0.3 * easeOutBack(age) + Math.sin(time * 2 + v.phase) * 0.05;
      v.spinner.rotation.y = time * 0.9 + v.phase;
      v.ring.scale.setScalar(1 + Math.sin(time * 3 + v.phase) * 0.06);
    }
    for (const [id, v] of this.pending) {
      if (!seen.has(id)) {
        this.group.remove(v.root);
        this.pending.delete(id);
      }
    }
  }

  private syncCreeps(creeps: Creep[], alpha: number, time: number) {
    const seen = new Set<number>();
    for (const c of creeps) {
      seen.add(c.id);
      let v = this.creeps.get(c.id);
      if (!v) {
        v = this.makeCreep(c);
        this.creeps.set(c.id, v);
        this.group.add(v.root);
      }
      const x = c.px + (c.x - c.px) * alpha;
      const y = c.py + (c.y - c.py) * alpha;
      const dx = c.x - c.px;
      const dy = c.y - c.py;
      const moving = dx * dx + dy * dy > 1e-6;
      if (moving) {
        const target = Math.atan2(dx, dy);
        let d = target - v.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        v.heading += d * 0.25;
      }
      const t = time * (0.6 + c.speed * 0.4) + v.phase;
      const bob = c.air ? Math.sin(time * 3 + v.phase) * 0.12 : Math.abs(Math.sin(t * 4)) * 0.04;
      // Burrowed creeps sink into the ground.
      v.sink += ((c.burrowTime > 0 ? 1 : 0) - v.sink) * 0.2;
      v.root.position.set(toWorldX(x), (c.air ? AIR_HEIGHT : 0) + bob - v.sink * 0.5 * v.scale, toWorldZ(y));
      v.body.rotation.y = v.heading;
      animateModel(v.model, time, t, v.phase);
      const frac = Math.max(0, c.hp / c.maxHp);
      const w = v.boss ? 1.6 : v.elite ? 1.0 : 0.7;
      v.hpFg.scale.set(w * frac, 0.09, 1);
      v.hpFg.position.x = -w / 2;
      v.hpBg.scale.set(w + 0.04, 0.13, 1);
      const mat = v.hpFg.material as SpriteMaterial;
      mat.color.copy(frac > 0.6 ? hpColours.high : frac > 0.3 ? hpColours.mid : hpColours.low);
      v.hpFg.visible = v.hpBg.visible = (frac < 0.999 || c.shield < c.maxShield) && v.sink < 0.5;
      if (v.shield) {
        const sf = c.maxShield > 0 ? c.shield / c.maxShield : 0;
        v.shield.visible = sf > 0.01;
        v.shield.scale.setScalar(v.model.height * v.scale * (0.9 + 0.05 * Math.sin(time * 5)));
        (v.shield.material as MeshStandardMaterial).opacity = 0.12 + 0.25 * sf;
      }
      // Status tints.
      const tint = v.model.tint;
      tint.color.copy(v.model.colour);
      if (c.enraged) tint.color.lerp(hpColours.low, 0.5);
      if (c.slowAmount > 0) tint.color.lerp(statusFrost, 0.55);
      if (c.poisonTime > 0) tint.color.lerp(statusVenom, 0.4);
    }
    for (const [id, v] of this.creeps) {
      if (!seen.has(id)) {
        this.group.remove(v.root);
        this.hpMats.get(id)?.dispose();
        this.hpMats.delete(id);
        this.creeps.delete(id);
      }
    }
  }

  private makeCreep(c: Creep): CreepView {
    const arch = ARCHETYPES[c.archetype];
    const root = new Group();
    const body = new Group();
    root.add(body);
    // Each creep gets its own materials (for status tints); geometries are shared.
    const model = buildCreepModel(arch);
    body.add(model.root);
    const scale = arch.scale * (c.elite ? 1.5 : 1);
    body.scale.setScalar(scale);
    const hpMat = new SpriteMaterial({ color: '#7dff8a', depthTest: false, transparent: true });
    this.hpMats.set(c.id, hpMat);
    const hpBg = new Sprite(hpBgMat);
    const hpFg = new Sprite(hpMat);
    hpFg.center.set(0, 0.5);
    const barY = model.height * scale + 0.3;
    hpBg.position.y = barY;
    hpFg.position.y = barY;
    hpBg.renderOrder = 10;
    hpFg.renderOrder = 11;
    root.add(hpBg, hpFg);
    if (c.elite || arch.role === 'boss') {
      const crown = new Mesh(crownGeo, arch.role === 'boss' ? bossCrownMat : eliteCrownMat);
      crown.position.y = 0.04;
      crown.scale.setScalar(0.5 * scale);
      root.add(crown);
    }
    let shield: Mesh | undefined;
    if (c.maxShield > 0) {
      shield = new Mesh(shieldGeo, shieldMat.clone());
      shield.position.y = (model.height * scale) / 2;
      root.add(shield);
    }
    return { root, body, model, hpBg, hpFg, shield, heading: 0, phase: hash2(c.id, 0) * 10, boss: arch.role === 'boss', elite: c.elite, scale, sink: 0 };
  }
}

const statusFrost = new Color('#9fdcff');
const statusVenom = new Color('#5dff7a');
const crownGeo = new TorusGeometry(1, 0.06, 6, 32).rotateX(Math.PI / 2);
const eliteCrownMat = new MeshStandardMaterial({ color: '#ffd27a', emissive: new Color('#ffb52e'), emissiveIntensity: 1.5 });
const bossCrownMat = new MeshStandardMaterial({ color: '#ff5f7a', emissive: new Color('#ff2f5a'), emissiveIntensity: 1.8 });
const shieldGeo = new IcosahedronGeometry(0.75, 2);
const shieldMat = new MeshStandardMaterial({ color: '#bfe8ff', emissive: new Color('#7fc8ff'), emissiveIntensity: 0.8, transparent: true, opacity: 0.3, depthWrite: false });

function animateModel(m: CreepModel, time: number, t: number, phase: number) {
  for (const w of m.wings) w.rotation.z = Math.sin(time * 14 + phase) * 0.7 * (w.userData.side ?? 1);
  for (const l of m.legs) l.rotation.x = Math.sin(t * 8 + (l.userData.index ?? 0) * 1.3 + (l.userData.side ?? 1) * 1.5) * 0.4;
  for (const sgm of m.segments) sgm.rotation.y = Math.sin(t * 5 - (sgm.userData.index ?? 0) * 0.9) * 0.3;
  for (const p of m.pulse) p.scale.setScalar(1 + Math.sin(time * 3 + phase) * 0.08);
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
