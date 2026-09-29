import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
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

function buildFamilyGeometry(f: Family): BufferGeometry {
  switch (f) {
    case 'diamond':
      return lathe(BRILLIANT, 8);
    case 'ruby':
      return lathe(BRILLIANT, 10).scale(1, 1, 0.72);
    case 'sapphire':
      // Cushion: a softened square brilliant.
      return lathe([[0, -0.3], [0.36, 0.0], [0.36, 0.05], [0.22, 0.16], [0, 0.16]], 4).rotateY(Math.PI / 4).scale(1, 1, 1);
    case 'emerald':
      // Step cut: an elongated octagonal table.
      return new CylinderGeometry(0.22, 0.3, 0.26, 8).rotateY(Math.PI / 8).scale(1.35, 1, 0.85);
    case 'topaz':
      // Pear: a teardrop spike.
      return lathe([[0, -0.2], [0.22, -0.08], [0.25, 0.05], [0.12, 0.3], [0, 0.42]], 7);
    case 'amethyst': {
      const parts = [
        crystal(0.1, 0.42, 0.18),
        crystal(0.08, 0.3, 0.14).rotateZ(0.45).translate(0.12, -0.06, 0.02),
        crystal(0.075, 0.26, 0.12).rotateZ(-0.5).rotateY(1.2).translate(-0.1, -0.08, 0.05),
      ];
      return mergeGeometries(parts);
    }
    case 'opal':
      return new SphereGeometry(0.34, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 0.82);
    case 'aquamarine':
      return crystal(0.15, 0.48, 0.2).rotateZ(0.25);
  }
}

const geometries = new Map<Family, BufferGeometry>();
export function familyGeometry(f: Family): BufferGeometry {
  let g = geometries.get(f);
  if (!g) {
    g = buildFamilyGeometry(f);
    g.computeVertexNormals();
    geometries.set(f, g);
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
  const quality = specialId ? 1 : grade / 4;
  const mat = new MeshPhysicalMaterial({
    color: colour.clone().lerp(new Color('#ffffff'), 0.25),
    metalness: 0,
    roughness: 0.18 - 0.14 * quality,
    transmission: 0.55 + 0.35 * quality,
    thickness: 0.6,
    ior: IOR[family],
    attenuationColor: colour,
    attenuationDistance: 0.35,
    dispersion: family === 'diamond' ? 5 : 1.5,
    clearcoat: 1,
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

export const gradeScale = (grade: Grade, special: boolean) => (special ? 1.55 : 1.05 + 0.17 * grade);
