import {
  BufferAttribute,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshStandardNodeMaterial,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  TorusGeometry,
  Vector3,
} from 'three/webgpu';
import type { BufferGeometry } from 'three/webgpu';
import { abs, float, fract, min, mix, mx_noise_float, positionWorld, smoothstep, step, uniform, vec2, vec3 } from 'three/tsl';
import { GRID_H, GRID_W, WAYPOINTS } from '../sim/data/map';
import { Cell } from '../sim/types';
import { hash2, toWorldX, toWorldZ } from './coords';

export class Board {
  readonly group = new Group();
  /** Linear RGB grass tint, driven by the time of day. */
  readonly grass = uniform(new Vector3(0.16, 0.32, 0.06));
  readonly gridOpacity = uniform(0.35);
  private stones = new Map<number, Mesh>();
  private stoneGeoms: BufferGeometry[] = [];
  private stoneMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
  readonly heart: Mesh;
  private heartMat: MeshPhysicalMaterial;
  private runes: MeshStandardMaterial[] = [];
  private rift: Mesh;

  constructor() {
    this.group.add(this.buildGround());
    for (let i = 0; i < 4; i++) this.stoneGeoms.push(makeStoneGeometry(i));

    // Waystones.
    const stoneMat = new MeshStandardMaterial({ color: '#8b8a86', roughness: 0.85, flatShading: true });
    for (let i = 1; i < WAYPOINTS.length - 1; i++) {
      const w = WAYPOINTS[i];
      const g = new Group();
      g.position.set(toWorldX(w.x + 0.5), 0, toWorldZ(w.y + 0.5));
      const pillar = new Mesh(new BoxGeometry(0.42, 1.6, 0.3).translate(0, 0.8, 0), stoneMat);
      pillar.rotation.y = hash2(w.x, w.y) * Math.PI;
      pillar.castShadow = true;
      const rune = new MeshStandardMaterial({ color: '#223', emissive: new Color('#9fe8ff'), emissiveIntensity: 1.2 });
      this.runes.push(rune);
      const glyph = new Mesh(new BoxGeometry(0.1, 0.5, 0.32).translate(0, 1.0, 0), rune);
      glyph.rotation.y = pillar.rotation.y;
      const ring = new Mesh(new TorusGeometry(0.62, 0.035, 6, 32).rotateX(Math.PI / 2), rune);
      ring.position.y = 0.03;
      g.add(pillar, glyph, ring);
      this.group.add(g);
    }

    // The Rift (spawn).
    const s = WAYPOINTS[0];
    this.rift = new Mesh(
      new TorusGeometry(0.55, 0.12, 8, 24).rotateX(Math.PI / 2),
      new MeshStandardMaterial({ color: '#1a0b1f', emissive: new Color('#b44cff'), emissiveIntensity: 1.5 }),
    );
    this.rift.position.set(toWorldX(s.x + 0.5), 0.08, toWorldZ(s.y + 0.5));
    this.group.add(this.rift);

    // The Heart (exit).
    const e = WAYPOINTS[WAYPOINTS.length - 1];
    this.heartMat = new MeshPhysicalMaterial({
      color: '#ffd6ec',
      transmission: 0.6,
      thickness: 1.2,
      ior: 1.6,
      roughness: 0.05,
      emissive: new Color('#ff6fb5'),
      emissiveIntensity: 0.6,
      flatShading: true,
      attenuationColor: new Color('#ff5fa8'),
      attenuationDistance: 1.2,
    });
    this.heart = new Mesh(new OctahedronGeometry(0.8, 0).scale(0.8, 1.5, 0.8), this.heartMat);
    this.heart.position.set(toWorldX(e.x + 0.5), 1.6, toWorldZ(e.y + 0.5));
    this.heart.castShadow = true;
    const base = new Mesh(new CylinderGeometry(0.9, 1.1, 0.3, 8), stoneMat);
    base.position.set(this.heart.position.x, 0.15, this.heart.position.z);
    base.receiveShadow = true;
    this.group.add(this.heart, base);

    this.group.add(this.buildScenery());
  }

  private buildGround(): Mesh {
    const size = 140;
    const geo = new PlaneGeometry(size, size, 1, 1).rotateX(-Math.PI / 2);
    const mat = new MeshStandardNodeMaterial({ roughness: 0.95 });
    const tile = positionWorld.xz.add(vec2(GRID_W / 2, GRID_H / 2));
    const f = fract(tile);
    const edge = min(min(f.x, f.y), min(float(1).sub(f.x), float(1).sub(f.y)));
    const line = float(1).sub(smoothstep(0.0, 0.045, edge));
    const inside = step(0, tile.x).mul(step(tile.x, GRID_W)).mul(step(0, tile.y)).mul(step(tile.y, GRID_H));
    const n = mx_noise_float(positionWorld.xz.mul(0.35)).mul(0.5).add(0.5);
    const n2 = mx_noise_float(positionWorld.xz.mul(2.1)).mul(0.5).add(0.5);
    const grass = this.grass.mul(n.mul(0.35).add(0.8)).mul(n2.mul(0.12).add(0.94));
    const wild = this.grass.mul(vec3(0.72, 0.78, 0.62)).mul(n.mul(0.4).add(0.7));
    // Soft border between the play area and the wild valley.
    const dx = abs(tile.x.sub(GRID_W / 2)).sub(GRID_W / 2);
    const dy = abs(tile.y.sub(GRID_H / 2)).sub(GRID_H / 2);
    const border = smoothstep(0.0, 1.2, dx.max(dy));
    const base = mix(grass, wild, border);
    mat.colorNode = mix(base, base.mul(0.72), line.mul(this.gridOpacity).mul(inside));
    const m = new Mesh(geo, mat);
    m.receiveShadow = true;
    return m;
  }

  private buildScenery(): Group {
    const g = new Group();
    const dummy = new Object3D();
    const trunkGeo = new CylinderGeometry(0.12, 0.18, 1.2, 6).translate(0, 0.6, 0);
    const pineGeo = new ConeGeometry(1, 2.6, 7).translate(0, 2.3, 0);
    const bushGeo = new IcosahedronGeometry(0.7, 1);
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 260; i++) {
      const x = (hash2(i, 1, 7) - 0.5) * 110;
      const z = (hash2(i, 2, 7) - 0.5) * 110;
      if (Math.abs(x) < GRID_W / 2 + 2.5 && Math.abs(z) < GRID_H / 2 + 2.5) continue;
      positions.push([x, z, hash2(i, 3, 7)]);
    }
    const trees = positions.filter((p) => p[2] < 0.6);
    const bushes = positions.filter((p) => p[2] >= 0.6);
    const trunk = new InstancedMesh(trunkGeo, new MeshStandardMaterial({ color: '#5b4331', roughness: 0.9 }), trees.length);
    const pine = new InstancedMesh(pineGeo, new MeshStandardMaterial({ color: '#2f5a3a', roughness: 0.8, flatShading: true }), trees.length);
    trees.forEach(([x, z, r], i) => {
      dummy.position.set(x, 0, z);
      dummy.scale.setScalar(0.8 + r * 0.9);
      dummy.rotation.y = r * 10;
      dummy.updateMatrix();
      trunk.setMatrixAt(i, dummy.matrix);
      pine.setMatrixAt(i, dummy.matrix);
    });
    const bush = new InstancedMesh(bushGeo, new MeshStandardMaterial({ color: '#4d7a3a', roughness: 0.85, flatShading: true }), bushes.length);
    bushes.forEach(([x, z, r], i) => {
      dummy.position.set(x, 0.3, z);
      dummy.scale.set(0.8 + r, 0.6 + r * 0.4, 0.8 + r);
      dummy.rotation.y = r * 10;
      dummy.updateMatrix();
      bush.setMatrixAt(i, dummy.matrix);
    });
    for (const m of [trunk, pine, bush]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    g.add(trunk, pine, bush);
    return g;
  }

  /** Adds and removes stone meshes to match the grid. */
  syncStones(grid: readonly number[], onAdd?: (x: number, y: number) => void, onRemove?: (x: number, y: number) => void) {
    for (let i = 0; i < grid.length; i++) {
      const has = this.stones.has(i);
      const want = grid[i] === Cell.Stone;
      if (want === has) continue;
      const x = i % GRID_W;
      const y = (i / GRID_W) | 0;
      if (want) {
        const variant = Math.floor(hash2(x, y, 3) * this.stoneGeoms.length);
        const m = new Mesh(this.stoneGeoms[variant], this.stoneMat);
        m.position.set(toWorldX(x + 0.5), 0.22, toWorldZ(y + 0.5));
        m.rotation.y = hash2(x, y, 4) * Math.PI * 2;
        m.scale.setScalar(0.9 + hash2(x, y, 5) * 0.2);
        m.castShadow = true;
        m.receiveShadow = true;
        this.group.add(m);
        this.stones.set(i, m);
        onAdd?.(x, y);
      } else {
        const m = this.stones.get(i)!;
        this.group.remove(m);
        this.stones.delete(i);
        onRemove?.(x, y);
      }
    }
  }

  update(time: number, glow: number, lives01: number) {
    this.rift.rotation.y = time * 0.8;
    this.heart.rotation.y = time * 0.3;
    this.heart.position.y = 1.6 + Math.sin(time * 1.3) * 0.08;
    this.heartMat.emissiveIntensity = (0.3 + 0.9 * glow) * (0.35 + 0.65 * lives01);
    this.heartMat.color.setRGB(1, 0.84 * lives01 + 0.3 * (1 - lives01), 0.93 * lives01 + 0.3 * (1 - lives01));
    for (const r of this.runes) r.emissiveIntensity = 0.4 + glow * 1.2;
  }
}

/** A mossy boulder: displaced low-poly rock with green on upward faces. */
function makeStoneGeometry(variant: number): BufferGeometry {
  const geo = new DodecahedronGeometry(0.4, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = 0.82 + 0.3 * hash2(Math.round(x * 50), Math.round(y * 50) + Math.round(z * 50) * 7, variant);
    pos.setXYZ(i, x * k * 1.05, y * k * 0.7, z * k * 1.05);
  }
  geo.computeVertexNormals();
  const nrm = geo.getAttribute('normal');
  const colours = new Float32Array(pos.count * 3);
  const rock = new Color('#8d8c86');
  const moss = new Color('#5f8a3b');
  const c = new Color();
  for (let i = 0; i < pos.count; i += 3) {
    const up = (nrm.getY(i) + nrm.getY(i + 1) + nrm.getY(i + 2)) / 3;
    c.copy(rock).lerp(moss, Math.max(0, Math.min(1, (up - 0.35) * 2.2)));
    c.multiplyScalar(0.85 + hash2(i, variant, 9) * 0.25);
    for (let j = 0; j < 3; j++) colours.set([c.r, c.g, c.b], (i + j) * 3);
  }
  geo.setAttribute('color', new BufferAttribute(colours, 3));
  return geo;
}
