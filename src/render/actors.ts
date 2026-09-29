import {
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  DoubleSide,
} from 'three/webgpu';
import type { BufferGeometry, Material } from 'three/webgpu';
import { ARCHETYPES } from '../sim/data/waves';
import type { Creep, Family, GameState, PendingGem, Tower } from '../sim/types';
import { AIR_HEIGHT, hash2, toWorldX, toWorldZ } from './coords';
import { familyGeometry, gemMaterial, gradeScale, specialGem } from './gems';

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
  body: Object3D;
  wings?: Mesh[];
  hpBg: Sprite;
  hpFg: Sprite;
  heading: number;
  phase: number;
  boss: boolean;
  scale: number;
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
    const gem = new Mesh(special ? specialGem() : familyGeometry(t.family), gm.material);
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
        const gem = new Mesh(familyGeometry(p.family), gemMaterial(p.family, p.grade).material);
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
      if (dx * dx + dy * dy > 1e-6) {
        const target = Math.atan2(dx, dy);
        let d = target - v.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        v.heading += d * 0.25;
      }
      const bob = c.air ? Math.sin(time * 3 + v.phase) * 0.12 : Math.abs(Math.sin(time * 10 + v.phase)) * 0.04;
      v.root.position.set(toWorldX(x), (c.air ? AIR_HEIGHT : 0) + bob, toWorldZ(y));
      v.body.rotation.y = v.heading;
      if (v.wings) {
        const flap = Math.sin(time * 14 + v.phase) * 0.7;
        v.wings[0].rotation.z = flap;
        v.wings[1].rotation.z = -flap;
      }
      const frac = Math.max(0, c.hp / c.maxHp);
      const w = v.boss ? 1.6 : 0.7;
      v.hpFg.scale.set(w * frac, 0.09, 1);
      v.hpFg.position.x = -w / 2;
      v.hpBg.scale.set(w + 0.04, 0.13, 1);
      const mat = v.hpFg.material as SpriteMaterial;
      mat.color.copy(frac > 0.6 ? hpColours.high : frac > 0.3 ? hpColours.mid : hpColours.low);
      const showBar = frac < 0.999;
      v.hpFg.visible = v.hpBg.visible = showBar;
      // Status tints.
      const tint = v.body.userData.tint as MeshStandardMaterial | undefined;
      if (tint) {
        const base = v.body.userData.baseColour as Color;
        tint.color.copy(base);
        if (c.slowAmount > 0) tint.color.lerp(new Color('#9fdcff'), 0.55);
        if (c.poisonTime > 0) tint.color.lerp(new Color('#5dff7a'), 0.4);
      }
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
    const { parts, wings, tint, colour, scale } = creepModel(c.archetype);
    for (const p of parts) {
      p.castShadow = true;
      body.add(p);
    }
    for (const w of wings ?? []) body.add(w);
    body.scale.setScalar(scale);
    body.userData.tint = tint;
    body.userData.baseColour = colour;
    const hpMat = new SpriteMaterial({ color: '#7dff8a', depthTest: false, transparent: true });
    this.hpMats.set(c.id, hpMat);
    const hpBg = new Sprite(hpBgMat);
    const hpFg = new Sprite(hpMat);
    hpFg.center.set(0, 0.5);
    const barY = (arch.boss ? 1.9 : 0.95) * (scale / 1);
    hpBg.position.y = barY;
    hpFg.position.y = barY;
    hpBg.renderOrder = 10;
    hpFg.renderOrder = 11;
    root.add(hpBg, hpFg);
    return { root, body, wings, hpBg, hpFg, heading: 0, phase: hash2(c.id, 0) * 10, boss: arch.boss, scale };
  }
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

interface CreepModel {
  parts: Mesh[];
  wings?: Mesh[];
  tint: MeshStandardMaterial;
  colour: Color;
  scale: number;
}

const geoCache = new Map<string, BufferGeometry>();
const geo = (key: string, make: () => BufferGeometry) => {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
};

function std(colour: string, extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) {
  return new MeshStandardMaterial({ color: colour, roughness: 0.55, flatShading: true, ...extra });
}

/** Grey-box creature silhouettes, one per archetype. */
function creepModel(id: string): CreepModel {
  const mesh = (g: BufferGeometry, m: Material, x = 0, y = 0, z = 0) => {
    const o = new Mesh(g, m);
    o.position.set(x, y, z);
    return o;
  };
  switch (id) {
    case 'beetle': {
      const shell = std('#2c6f73', { metalness: 0.4, roughness: 0.3 });
      return {
        parts: [
          mesh(geo('beetleShell', () => new SphereGeometry(0.3, 10, 6).scale(1, 0.6, 1.35)), shell, 0, 0.22, 0),
          mesh(geo('beetleHead', () => new SphereGeometry(0.14, 8, 6)), std('#1a2a2a'), 0, 0.2, 0.42),
        ],
        tint: shell,
        colour: new Color('#2c6f73'),
        scale: 1,
      };
    }
    case 'skitter': {
      const m = std('#9b4a2c');
      return {
        parts: [mesh(geo('skitter', () => new ConeGeometry(0.18, 0.55, 5).rotateX(Math.PI / 2)), m, 0, 0.15, 0)],
        tint: m,
        colour: new Color('#9b4a2c'),
        scale: 1,
      };
    }
    case 'tortoise': {
      const shell = std('#4f6b37');
      return {
        parts: [
          mesh(geo('tortShell', () => new SphereGeometry(0.42, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1.1)), shell, 0, 0.1, 0),
          mesh(geo('tortHead', () => new SphereGeometry(0.13, 8, 6)), std('#7b6a4a'), 0, 0.18, 0.5),
        ],
        tint: shell,
        colour: new Color('#4f6b37'),
        scale: 1,
      };
    }
    case 'rootling': {
      const bark = std('#6b4b2e');
      return {
        parts: [
          mesh(geo('rootBody', () => new CapsuleGeometry(0.17, 0.35, 3, 6)), bark, 0, 0.35, 0),
          mesh(geo('rootLeaf', () => new ConeGeometry(0.22, 0.3, 5)), std('#6fbf4a'), 0, 0.75, 0),
        ],
        tint: bark,
        colour: new Color('#6b4b2e'),
        scale: 1,
      };
    }
    case 'wisp': {
      const glow = new MeshStandardMaterial({ color: '#fff3b0', emissive: new Color('#ffd76a'), emissiveIntensity: 2.5 });
      return {
        parts: [mesh(geo('wisp', () => new SphereGeometry(0.2, 12, 8)), glow, 0, 0.55, 0)],
        tint: glow,
        colour: new Color('#fff3b0'),
        scale: 1,
      };
    }
    case 'seedpod': {
      const m = std('#d8c28a');
      return {
        parts: [mesh(geo('seed', () => new ConeGeometry(0.2, 0.35, 6).translate(0, 0.17, 0).rotateX(Math.PI / 2)), m)],
        wings: seedWings(),
        tint: m,
        colour: new Color('#d8c28a'),
        scale: 1,
      };
    }
    case 'moth':
    case 'mothQueen': {
      const m = std(id === 'moth' ? '#6d5a86' : '#3b2558');
      const wingMat = new MeshStandardMaterial({ color: id === 'moth' ? '#b9a3d8' : '#8f5fd1', side: DoubleSide, transparent: true, opacity: 0.85, emissive: new Color('#5b3a9a'), emissiveIntensity: 0.4 });
      const wingGeo = geo('mothWing', () => new PlaneGeometry(0.55, 0.4).translate(0.3, 0, 0).rotateX(-Math.PI / 2));
      const left = new Mesh(wingGeo, wingMat);
      const right = new Mesh(wingGeo, wingMat);
      right.rotation.y = Math.PI;
      return {
        parts: [mesh(geo('mothBody', () => new CapsuleGeometry(0.08, 0.35, 3, 6).rotateX(Math.PI / 2)), m)],
        wings: [left, right],
        tint: m,
        colour: m.color.clone(),
        scale: id === 'mothQueen' ? 2.4 : 1,
      };
    }
    case 'colossus': {
      const rock = std('#6e6a62');
      return {
        parts: [
          mesh(geo('colBody', () => new DodecahedronGeometry(0.5, 0).scale(1, 0.9, 1.2)), rock, 0, 0.5, 0),
          mesh(geo('colMoss', () => new SphereGeometry(0.42, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.5, 1.2)), std('#4e7d34'), 0, 0.72, 0),
        ],
        tint: rock,
        colour: new Color('#6e6a62'),
        scale: 1.8,
      };
    }
    default: {
      const m = std('#aa33aa');
      return { parts: [mesh(geo('unknown', () => new SphereGeometry(0.25)), m, 0, 0.25, 0)], tint: m, colour: new Color('#aa33aa'), scale: 1 };
    }
  }
}

function seedWings(): Mesh[] {
  const m = new MeshStandardMaterial({ color: '#f4ecd2', side: DoubleSide, transparent: true, opacity: 0.8 });
  const g = geo('seedWing', () => new PlaneGeometry(0.5, 0.14).translate(0.25, 0, 0).rotateX(-Math.PI / 2));
  const a = new Mesh(g, m);
  const b = new Mesh(g, m);
  b.rotation.y = Math.PI;
  return [a, b];
}
