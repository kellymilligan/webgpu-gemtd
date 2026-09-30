import {
  BufferGeometry,
  Color,
  ConeGeometry,
  BoxGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  MeshPhysicalMaterial,
  SphereGeometry,
  Vector2,
} from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SPECIALS_BY_ID } from '../sim/data/recipes';
import type { Family, Grade } from '../sim/types';

export const FAMILY_COLOURS: Record<Family, string> = {
  ruby: '#ff1f45',
  sapphire: '#2d63ff',
  emerald: '#18c96b',
  topaz: '#ffb22e',
  diamond: '#e9f6ff',
  amethyst: '#a052ff',
  opal: '#f6ecff',
  aquamarine: '#47e4ff',
};

const IOR: Record<Family, number> = {
  ruby: 1.77,
  sapphire: 1.77,
  emerald: 1.58,
  topaz: 1.62,
  diamond: 2.42,
  amethyst: 1.54,
  opal: 1.45,
  aquamarine: 1.58,
};

function lathe(profile: [number, number][], segments: number): BufferGeometry {
  return new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segments);
}

/** A brilliant-cut profile: pavilion point, girdle, crown, table. */
const BRILLIANT: [number, number][] = [
  [0, -0.34],
  [0.34, 0.0],
  [0.35, 0.05],
  [0.2, 0.17],
  [0, 0.17],
];

function crystal(radius: number, height: number, tip: number): BufferGeometry {
  const body = new CylinderGeometry(radius, radius, height, 6, 1, true);
  const top = new ConeGeometry(radius, tip, 6).translate(0, height / 2 + tip / 2, 0);
  const bottom = new ConeGeometry(radius, tip * 0.6, 6).rotateX(Math.PI).translate(0, -height / 2 - tip * 0.3, 0);
  return mergeGeometries([body, top, bottom].map((g) => g.toNonIndexed()));
}

/** A brilliant profile with extra crown and pavilion breaks, for Perfect gems. */
const BRILLIANT_FINE: [number, number][] = [
  [0, -0.36],
  [0.2, -0.2],
  [0.35, 0.0],
  [0.36, 0.05],
  [0.3, 0.12],
  [0.2, 0.18],
  [0, 0.18],
];

/** Offsets vertices by a hash of their position, so shared corners stay welded. */
function roughen(geo: BufferGeometry, amount: number, seed: number): BufferGeometry {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = Math.round(x * 97) * 73856093 ^ Math.round(y * 97) * 19349663 ^ Math.round(z * 97) * 83492791 ^ seed;
    const r = (n: number) => ((((k * (n + 1) * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 2 * amount;
    pos.setXYZ(i, x + r(1), y + r(2), z + r(3));
  }
  return geo;
}

const FAMILY_SEED: Record<Family, number> = { ruby: 11, sapphire: 23, emerald: 37, topaz: 41, diamond: 53, amethyst: 67, opal: 79, aquamarine: 97 };

/**
 * Gems grow from rough stones into cut jewels:
 * Chipped = a rough chunk, Flawed = a tumbled pebble, Clear = a simple cut,
 * Flawless = the family cut, Perfect = a finely faceted version of it.
 */
function buildGemGeometry(f: Family, grade: Grade): BufferGeometry {
  const seed = FAMILY_SEED[f];
  if (grade === 0) {
    const tall = f === 'amethyst' || f === 'aquamarine' || f === 'topaz';
    return roughen(new BoxGeometry(0.3, tall ? 0.42 : 0.3, 0.28), 0.06, seed).toNonIndexed();
  }
  if (grade === 1) {
    const g = roughen(new DodecahedronGeometry(0.24, 0), 0.045, seed);
    return f === 'amethyst' || f === 'aquamarine' ? g.scale(0.85, 1.4, 0.85) : g.scale(1.1, 0.85, 1);
  }
  const d = grade - 2; // 0 simple, 1 standard, 2 fine
  switch (f) {
    case 'diamond':
      return lathe(d === 2 ? BRILLIANT_FINE : BRILLIANT, [6, 8, 16][d]);
    case 'ruby':
      return lathe(d === 2 ? BRILLIANT_FINE : BRILLIANT, [6, 10, 16][d]).scale(1, 1, 0.72);
    case 'sapphire':
      // Cushion: a softened square brilliant.
      return d === 2
        ? lathe(BRILLIANT_FINE, 8).rotateY(Math.PI / 8).scale(1.05, 0.95, 1.05)
        : lathe([[0, -0.3], [0.36, 0.0], [0.36, 0.05], [0.22, 0.16], [0, 0.16]], 4).rotateY(Math.PI / 4);
    case 'emerald': {
      // Step cut: an elongated octagonal table, gaining a stepped pavilion.
      const top = new CylinderGeometry(0.22, 0.3, 0.26, 8).rotateY(Math.PI / 8);
      if (d < 2) return (d === 0 ? new CylinderGeometry(0.26, 0.3, 0.26, 4).rotateY(Math.PI / 4) : top).scale(1.35, 1, 0.85);
      const pav = new CylinderGeometry(0.3, 0.12, 0.16, 8).rotateY(Math.PI / 8).translate(0, -0.21, 0);
      return mergeGeometries([top.toNonIndexed(), pav.toNonIndexed()]).scale(1.35, 1, 0.85);
    }
    case 'topaz':
      // Pear: a teardrop spike.
      return d === 2
        ? lathe([[0, -0.22], [0.14, -0.17], [0.23, -0.06], [0.26, 0.05], [0.2, 0.18], [0.1, 0.33], [0, 0.44]], 12)
        : lathe([[0, -0.2], [0.22, -0.08], [0.25, 0.05], [0.12, 0.3], [0, 0.42]], [5, 7][d]);
    case 'amethyst': {
      const parts = [crystal(0.1, 0.42, 0.18)];
      if (d >= 1) {
        parts.push(crystal(0.08, 0.3, 0.14).rotateZ(0.45).translate(0.12, -0.06, 0.02));
        parts.push(crystal(0.075, 0.26, 0.12).rotateZ(-0.5).rotateY(1.2).translate(-0.1, -0.08, 0.05));
      }
      if (d >= 2) {
        parts.push(crystal(0.06, 0.22, 0.1).rotateX(0.5).translate(0, -0.1, 0.12));
        parts.push(crystal(0.065, 0.24, 0.1).rotateX(-0.45).rotateZ(0.2).translate(0.03, -0.1, -0.12));
      }
      return mergeGeometries(parts);
    }
    case 'opal':
      return new SphereGeometry(0.34, [10, 20, 40][d], [5, 10, 16][d], 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 0.82);
    case 'aquamarine': {
      if (d === 0) return crystal(0.15, 0.36, 0.16).rotateZ(0.25);
      const main = crystal(0.15, 0.48, 0.2).rotateZ(0.25);
      if (d === 1) return main;
      return mergeGeometries([main, crystal(0.08, 0.26, 0.12).rotateZ(-0.5).translate(0.14, -0.1, 0.04), crystal(0.07, 0.22, 0.1).rotateX(0.5).translate(-0.06, -0.12, 0.1)]);
    }
  }
}

const geometries = new Map<string, BufferGeometry>();
export function gemGeometry(f: Family, grade: Grade): BufferGeometry {
  const key = `${f}:${grade}`;
  let g = geometries.get(key);
  if (!g) {
    g = buildGemGeometry(f, grade);
    g.computeVertexNormals();
    geometries.set(key, g);
  }
  return g;
}

let specialGeometry: BufferGeometry | null = null;
export function specialGem(): BufferGeometry {
  return (specialGeometry ??= new IcosahedronGeometry(0.34, 0));
}

export interface GemMaterial {
  material: MeshPhysicalMaterial;
  baseEmissive: number;
}

const materials = new Map<string, GemMaterial>();

export function gemMaterial(family: Family, grade: Grade, specialId?: string, level = 0): GemMaterial {
  const key = specialId ? `s:${specialId}:${level}` : `${family}:${grade}`;
  let m = materials.get(key);
  if (m) return m;
  const hex = specialId ? SPECIALS_BY_ID[specialId].colour : FAMILY_COLOURS[family];
  const colour = new Color(hex);
  const g = specialId ? 4 : grade;
  const mat = new MeshPhysicalMaterial({
    // Rough stones are cloudier and duller; polish brings clarity.
    color: colour.clone().lerp(new Color('#ffffff'), g <= 1 ? 0.05 : 0.25),
    metalness: 0,
    roughness: [0.55, 0.32, 0.12, 0.05, 0.02][g],
    transmission: [0.12, 0.35, 0.7, 0.85, 0.95][g],
    thickness: 0.6,
    ior: IOR[family],
    attenuationColor: colour,
    attenuationDistance: 0.35,
    dispersion: family === 'diamond' ? 5 : 1.5,
    clearcoat: g <= 1 ? 0.2 : 1,
    clearcoatRoughness: 0.05,
    emissive: colour,
    emissiveIntensity: 0,
    flatShading: family !== 'opal',
  });
  if (family === 'opal' || specialId === 'blackOpal') {
    mat.iridescence = 1;
    mat.iridescenceIOR = 1.8;
    mat.iridescenceThicknessRange = [200, 900];
  }
  m = { material: mat, baseEmissive: specialId ? 0.9 + 0.4 * level : 0.12 + 0.22 * grade };
  materials.set(key, m);
  return m;
}

/** Applies the current time-of-day glow to every gem material. */
export function updateGemGlow(glow: number) {
  for (const m of materials.values()) m.material.emissiveIntensity = m.baseEmissive * glow;
}

export const gradeScale = (grade: Grade, special: boolean) => (special ? 1.55 : [1.0, 1.08, 1.12, 1.3, 1.5][grade]);
