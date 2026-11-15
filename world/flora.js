// Grass, procedural trees, flowers and scattered rocks / ferns.
import * as THREE from '../vendor/three.bundle.min.js';
import { TSL } from '../vendor/three.bundle.min.js';
import { WORLD, heightAt, isOpenGround, addCollider, rng, lerp, loadTexture, pathMask } from './util.js';
import { playerUniform } from './env.js';

const {
  positionLocal, normalLocal, uv, time, sin, vec2, vec3, float, mix, smoothstep, length, hash, instanceIndex,
  texture, transformNormalToView, max, abs, pow,
} = TSL;

const WIND = new THREE.Vector2(0.8, 0.6);

// ---------------------------------------------------------------------------------
// Grass
// ---------------------------------------------------------------------------------
function grassClumpGeometry() {
  const pos = [], uvs = [], nor = [], idx = [];
  const blades = 3, segs = 3;
  for (let b = 0; b < blades; b++) {
    const ang = b * 2.2 + 0.4;
    const cx = Math.cos(ang), sz = Math.sin(ang);
    const ox = Math.cos(ang * 1.7) * 0.09, oz = Math.sin(ang * 2.3) * 0.09;
    const width = 0.05 - b * 0.007, lean = 0.2 + b * 0.1, tall = 1 - b * 0.17;
    const base = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const w = width * (1 - t * t * 0.92) * 0.5;
      const fwd = lean * t * t;
      for (const side of [-1, 1]) {
        pos.push(ox + cx * w * side - sz * fwd, t * tall, oz + sz * w * side + cx * fwd);
        uvs.push(side * 0.5 + 0.5, t * tall);
        nor.push(0, 1, 0);
      }
      if (s < segs) {
        const i = base + s * 2;
        idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

export function createGrass(scene, quality) {
  const geo = grassClumpGeometry();
  const mat = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });
  const h = uv().y;
  const p = positionLocal;
  const t = time;
  const gust = sin(p.x.mul(0.21).add(t.mul(1.25)).add(sin(p.z.mul(0.13).add(t.mul(0.4))).mul(1.8)))
    .mul(sin(p.z.mul(0.17).sub(t.mul(0.85))));
  const flutter = sin(t.mul(4.3).add(p.x.mul(2.9)).add(p.z.mul(3.7))).mul(0.22);
  const bend = gust.mul(0.6).add(0.28).add(flutter).mul(0.24).mul(h.mul(h));
  const toPlayer = p.xz.sub(playerUniform.xz);
  const dist = max(length(toPlayer), 0.001);
  const push = smoothstep(0.95, 0.15, dist).mul(h).mul(0.38);
  const away = toPlayer.div(dist).mul(push);
  mat.positionNode = p.add(vec3(
    float(WIND.x).mul(bend).add(away.x),
    abs(bend).mul(0.32).add(push.mul(0.7)).mul(h).negate(),
    float(WIND.y).mul(bend).add(away.y),
  ));
  const rnd = hash(instanceIndex);
  const tip = mix(vec3(0.27, 0.5, 0.1), vec3(0.5, 0.6, 0.16), rnd.mul(rnd));
  mat.colorNode = mix(vec3(0.04, 0.13, 0.025), tip, pow(h, 1.2)).mul(gust.mul(0.1).mul(h).add(0.95));
  mat.normalNode = transformNormalToView(vec3(0, 1, 0));

  // Bucket instances into cells so whole patches can be frustum-culled.
  const R = rng(1337);
  const cell = 14, radius = 38;
  const buckets = new Map();
  const dummy = new THREE.Object3D();
  let placed = 0, guard = 0;
  while (placed < quality.grass && guard++ < quality.grass * 6) {
    const r = radius * Math.sqrt(R()), a = R() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (R() > lerp(1, 0.22, smoothstep01(18, radius, r))) continue;
    if (!isOpenGround(x, z, -0.3) || pathMask(x, z) > 0.12 + R() * 0.25) continue;
    const patch = 0.5 + 0.5 * Math.sin(x * 0.31 + 1.1) * Math.cos(z * 0.27 - 0.6);
    dummy.position.set(x, heightAt(x, z) - 0.02, z);
    dummy.rotation.set(0, R() * Math.PI * 2, 0);
    const s = 0.75 + R() * 0.6;
    dummy.scale.set(s, (0.24 + patch * 0.3 + R() * 0.2) * (r > 30 ? 1.3 : 1), s);
    dummy.updateMatrix();
    const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(dummy.matrix.clone());
    placed++;
  }
  const group = new THREE.Group();
  group.name = 'grass';
  for (const list of buckets.values()) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius += 0.6;
    group.add(mesh);
  }
  scene.add(group);
  return group;
}
const smoothstep01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------------------------
// Procedural trees (bark + leaf fronds are CC0 Poly Haven textures)
// ---------------------------------------------------------------------------------
const FRONDS = [
  // [u at stem, u at tip, image-space y top, y bottom]
  [0.16, 0.99, 0.02, 0.47],
  [0.0, 0.43, 0.33, 0.7],
  [1.0, 0.25, 0.59, 0.99],
];
const UP = new THREE.Vector3(0, 1, 0);

function buildTree(seed, opt) {
  const R = rng(seed);
  const wood = { pos: [], nor: [], uv: [], idx: [] };
  const leaf = { pos: [], nor: [], uv: [], idx: [] };
  const tips = [];
  const tmp = new THREE.Vector3(), bx = new THREE.Vector3(), by = new THREE.Vector3();
  const randUnit = () => new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize();

  function branch(start, dir, len, r0, depth) {
    const last = depth === opt.depth;
    const segs = depth === 0 ? 6 : 4;
    const radial = depth === 0 ? 9 : depth === 1 ? 7 : 5;
    const r1 = r0 * (last ? 0.3 : 0.64);
    const p = start.clone(), d = dir.clone();
    let v = 0;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      let r = lerp(r0, r1, t);
      if (depth === 0) r *= 1 + 0.75 * Math.pow(1 - t, 5);            // root flare
      bx.crossVectors(d, Math.abs(d.y) > 0.9 ? tmp.set(1, 0, 0) : UP).normalize();
      by.crossVectors(d, bx).normalize();
      const ring = wood.pos.length / 3;
      for (let k = 0; k <= radial; k++) {
        const a = (k / radial) * Math.PI * 2;
        tmp.copy(bx).multiplyScalar(Math.cos(a)).addScaledVector(by, Math.sin(a));
        wood.nor.push(tmp.x, tmp.y, tmp.z);
        wood.pos.push(p.x + tmp.x * r, p.y + tmp.y * r, p.z + tmp.z * r);
        wood.uv.push((k / radial) * (depth === 0 ? 2 : 1), v);
      }
      if (s > 0) {
        const prev = ring - (radial + 1);
        for (let k = 0; k < radial; k++) {
          wood.idx.push(prev + k, ring + k, prev + k + 1, prev + k + 1, ring + k, ring + k + 1);
        }
      }
      if (s < segs) {
        d.addScaledVector(randUnit(), opt.wobble * (depth === 0 ? 0.5 : 1)).addScaledVector(UP, depth === 0 ? 0.05 : opt.lift).normalize();
        p.addScaledVector(d, len / segs);
        v += (len / segs) * 0.45;
      }
      if (depth >= opt.depth - 1 && s >= 2) tips.push({ p: p.clone(), d: d.clone(), w: last ? 1 : 0.5 });
    }
    if (!last) {
      const n = depth === 0 ? opt.forks : 2 + (R() < 0.45 ? 1 : 0);
      const spin = R() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const tilt = lerp(opt.spread * 0.6, opt.spread * 1.15, R());
        const az = spin + (i / n) * Math.PI * 2 + (R() - 0.5) * 0.7;
        bx.crossVectors(d, Math.abs(d.y) > 0.9 ? tmp.set(1, 0, 0) : UP).normalize();
        by.crossVectors(d, bx).normalize();
        const cd = d.clone().multiplyScalar(Math.cos(tilt))
          .addScaledVector(bx, Math.sin(tilt) * Math.cos(az)).addScaledVector(by, Math.sin(tilt) * Math.sin(az)).normalize();
        branch(p, cd, len * lerp(0.62, 0.8, R()), r1 * 0.95, depth + 1);
      }
    }
  }
  branch(new THREE.Vector3(0, -0.25, 0), new THREE.Vector3((R() - 0.5) * 0.16, 1, (R() - 0.5) * 0.16).normalize(), opt.trunk, opt.radius, 0);

  // Foliage: drooping frond cards with crown-relative normals for soft, volumetric shading.
  const crown = new THREE.Vector3();
  tips.forEach((t) => crown.add(t.p));
  crown.divideScalar(tips.length);
  const side = new THREE.Vector3(), dir = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3();
  for (const tip of tips) {
    const count = Math.round(opt.fronds * tip.w * (0.7 + R() * 0.6));
    for (let j = 0; j < count; j++) {
      dir.copy(tip.d).multiplyScalar(0.45).add(randUnit()).addScaledVector(UP, 0.1).normalize();
      const L = opt.frond * (0.7 + R() * 0.6), W = L * 0.5;
      side.crossVectors(dir, randUnit()).normalize().multiplyScalar(W * 0.5);
      const f = FRONDS[(R() * FRONDS.length) | 0];
      const flip = R() < 0.5 ? 1 : -1;
      const base = leaf.pos.length / 3;
      for (let s = 0; s <= 2; s++) {
        const t = s / 2;
        c.copy(tip.p).addScaledVector(dir, L * t);
        c.y -= L * 0.28 * t * t;                                      // droop
        n.copy(c).sub(crown).normalize().multiplyScalar(0.75).addScaledVector(UP, 0.6).normalize();
        for (const sgn of [-1, 1]) {
          leaf.pos.push(c.x + side.x * sgn, c.y + side.y * sgn, c.z + side.z * sgn);
          leaf.nor.push(n.x, n.y, n.z);
          leaf.uv.push(lerp(f[0], f[1], t), 1 - (sgn * flip > 0 ? f[2] : f[3]));
        }
        if (s < 2) {
          const i = base + s * 2;
          leaf.idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
        }
      }
    }
  }
  const toGeo = (d) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(d.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2));
    g.setIndex(d.idx);
    return g;
  };
  return { wood: toGeo(wood), leaves: toGeo(leaf) };
}

const NEAR_TREES = [
  [-7.5, -6.5, 1.15], [7, -8.5, 1.0], [12.5, -1.5, 0.9], [-14, -3, 1.05], [0.5, -15, 1.25], [15, 9, 1.1],
  [-7, 18, 1.0], [10, 20, 1.2], [-20, 13, 1.1], [21, -11, 1.3], [-18, -15, 1.2], [-25, 2, 0.95],
  [24, 3, 1.0], [-3, 27, 1.15], [17, 25, 0.9], [-15, 27, 1.2], [8, -24, 1.1], [-9, -26, 1.0],
  [29, -22, 1.3], [-30, -9, 1.25], [31, 14, 1.1], [-28, 22, 1.3],
];

export function createTrees(scene, quality) {
  const barkDiff = loadTexture('assets/textures/bark_diff.webp', { srgb: true });
  const barkNor = loadTexture('assets/textures/bark_nor.webp');
  const woodMat = new THREE.MeshStandardMaterial({ map: barkDiff, normalMap: barkNor, roughness: 0.95, metalness: 0 });

  const leafTex = loadTexture('assets/textures/leaves.webp', { srgb: true, repeat: false });
  const leafMat = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 0.62, metalness: 0, alphaTest: 0.42 });
  const tx = texture(leafTex, uv());
  const p = positionLocal, t = time;
  const tint = mix(vec3(0.72, 1.0, 0.5), vec3(1.08, 1.02, 0.46), hash(instanceIndex.add(7)));
  leafMat.colorNode = tx.rgb.mul(tint).mul(1.45);
  leafMat.opacityNode = tx.a;
  leafMat.normalNode = transformNormalToView(normalLocal);
  const sway = sin(t.mul(1.3).add(p.x.mul(0.55)).add(p.z.mul(0.45))).mul(0.07)
    .add(sin(t.mul(3.4).add(p.x.mul(2.3)).add(p.y.mul(1.9))).mul(0.022));
  leafMat.positionNode = p.add(vec3(sway.mul(WIND.x), sin(t.mul(2.1).add(p.z.mul(1.7))).mul(0.018), sway.mul(WIND.y)));

  const variants = [
    buildTree(11, { depth: 3, forks: 3, trunk: 3.0, radius: 0.27, spread: 0.72, wobble: 0.16, lift: 0.1, fronds: 9, frond: 1.35 }),
    buildTree(29, { depth: 3, forks: 4, trunk: 2.4, radius: 0.3, spread: 0.85, wobble: 0.2, lift: 0.14, fronds: 8, frond: 1.3 }),
    buildTree(53, { depth: 3, forks: 3, trunk: 3.8, radius: 0.24, spread: 0.6, wobble: 0.14, lift: 0.07, fronds: 9, frond: 1.25 }),
  ];
  const R = rng(4242);
  const spots = NEAR_TREES.map(([x, z, s]) => ({ x, z, s, near: true }));
  let guard = 0;
  while (spots.length < NEAR_TREES.length + quality.farTrees && guard++ < 2000) {
    const r = lerp(41, 84, Math.sqrt(R())), a = R() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (spots.some((q) => Math.hypot(q.x - x, q.z - z) < 5.5)) continue;
    spots.push({ x, z, s: 1.1 + R() * 0.9, near: false });
  }
  const lists = variants.map(() => []);
  const dummy = new THREE.Object3D();
  spots.forEach((sp, i) => {
    dummy.position.set(sp.x, heightAt(sp.x, sp.z), sp.z);
    dummy.rotation.set(0, R() * Math.PI * 2, 0);
    dummy.scale.setScalar(sp.s);
    dummy.updateMatrix();
    lists[i % variants.length].push(dummy.matrix.clone());
    if (sp.near) addCollider(sp.x, sp.z, 0.42 * sp.s);
  });
  const group = new THREE.Group();
  group.name = 'trees';
  variants.forEach((v, vi) => {
    for (const [geo, mat] of [[v.wood, woodMat], [v.leaves, leafMat]]) {
      const mesh = new THREE.InstancedMesh(geo, mat, lists[vi].length);
      lists[vi].forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
  });
  scene.add(group);
  return group;
}

// ---------------------------------------------------------------------------------
// Flowers (tiny instanced cards with a canvas-drawn bloom)
// ---------------------------------------------------------------------------------
function flowerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  for (let i = 0; i < 7; i++) {
    g.rotate((Math.PI * 2) / 7);
    const grad = g.createLinearGradient(0, 0, 0, -58);
    grad.addColorStop(0, '#e9e9e9');
    grad.addColorStop(1, '#ffffff');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(0, -34, 13, 26, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#b8862b';
  g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e0aa3a';
  g.beginPath(); g.arc(-2, -2, 8, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFlowers(scene, quality) {
  const head = new THREE.PlaneGeometry(1, 1);
  head.rotateX(-Math.PI / 2 + 0.5);
  const tex = flowerTexture();
  const mat = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.6, metalness: 0 });
  const tx = texture(tex, uv());
  const p = positionLocal, t = time;
  mat.colorNode = tx.rgb;                               // multiplied by the per-instance colour
  mat.opacityNode = tx.a;
  mat.normalNode = transformNormalToView(vec3(0, 1, 0));
  const sway = sin(t.mul(1.9).add(p.x.mul(1.3)).add(p.z.mul(1.1))).mul(0.035);
  mat.positionNode = p.add(vec3(sway.mul(WIND.x), 0, sway.mul(WIND.y)));

  const palette = [0xffffff, 0xffffff, 0xffe27a, 0xf3b6ff, 0xff9fb5, 0xa9c8ff, 0xffd24d];
  const mesh = new THREE.InstancedMesh(head, mat, quality.flowers);
  const R = rng(777);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let i = 0, guard = 0;
  while (i < quality.flowers && guard++ < quality.flowers * 20) {
    // Flowers grow in drifts: pick a drift centre, then scatter around it.
    const r = 34 * Math.sqrt(R()), a = R() * Math.PI * 2;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const hue = palette[(R() * palette.length) | 0];
    const n = 5 + ((R() * 14) | 0);
    for (let k = 0; k < n && i < quality.flowers; k++) {
      const x = cx + (R() - 0.5) * 3.2, z = cz + (R() - 0.5) * 3.2;
      if (!isOpenGround(x, z, 0.4)) continue;
      const s = 0.13 + R() * 0.1;
      dummy.position.set(x, heightAt(x, z) + 0.3 + R() * 0.25, z);
      dummy.rotation.set(0, R() * Math.PI * 2, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, col.set(hue).multiplyScalar(0.92 + R() * 0.16));
      i++;
    }
  }
  mesh.count = i;
  mesh.frustumCulled = false;
  mesh.name = 'flowers';
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------------
// Scattered Poly Haven props (rocks, ferns, sorrel), instanced per mesh variant
// ---------------------------------------------------------------------------------
/** Splits a multi-object glTF into recentred variants that can be instanced anywhere. */
function variantsOf(gltf) {
  const out = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const box = new THREE.Box3().setFromObject(o);
    const size = box.getSize(new THREE.Vector3());
    const centre = new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    out.push({ mesh: o, size, base: centre.multiply(o.matrixWorld) });
  });
  return out;
}

function scatter(scene, variants, placements, { castShadow = true } = {}) {
  const lists = variants.map(() => []);
  const dummy = new THREE.Object3D();
  placements.forEach((pl) => {
    const v = pl.variant % variants.length;
    dummy.position.set(pl.x, heightAt(pl.x, pl.z) + (pl.y || 0), pl.z);
    dummy.rotation.set(pl.tilt || 0, pl.rot || 0, 0);
    dummy.scale.setScalar(pl.scale || 1);
    dummy.updateMatrix();
    lists[v].push(dummy.matrix.clone().multiply(variants[v].base));
  });
  const group = new THREE.Group();
  variants.forEach((v, vi) => {
    if (!lists[vi].length) return;
    const mesh = new THREE.InstancedMesh(v.mesh.geometry, v.mesh.material, lists[vi].length);
    lists[vi].forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  });
  scene.add(group);
  return group;
}

export function createScatter(scene, models, quality) {
  const R = rng(9001);
  const pick = (count, rMin, rMax, margin, fn) => {
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 40) {
      const r = lerp(rMin, rMax, Math.sqrt(R())), a = R() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!isOpenGround(x, z, margin)) continue;
      out.push(fn(x, z));
    }
    return out;
  };

  // Rocks: a few big hand-placed ones (with colliders) plus pebbles.
  const rocks = variantsOf(models.rocks);
  const bigRocks = [
    [-6.2, 3.4, 0, 0.85], [5.4, 5.6, 2, 0.7], [-15.5, 10.8, 4, 1.1], [-8.6, 11.6, 1, 0.6], [9.5, -4.5, 3, 0.9],
    [-4, -9.5, 5, 1.2], [17, 14, 0, 1.3], [-22, -6, 2, 1.5], [6, 30, 4, 1.4], [26, -4, 1, 1.2], [-12, 22, 3, 1.0],
  ].map(([x, z, variant, scale], i) => {
    const size = rocks[variant % rocks.length].size;
    addCollider(x, z, Math.max(size.x, size.z) * 0.36 * scale);
    return { x, z, variant, scale, rot: i * 1.7, y: -0.12 * scale };
  });
  const pebbles = pick(quality.pebbles, 3.5, 38, 0, (x, z) => ({
    x, z, variant: (R() * 6) | 0, scale: 0.12 + R() * 0.22, rot: R() * 6.28, y: -0.03,
  }));
  scatter(scene, rocks, [...bigRocks, ...pebbles]);

  // Ferns cluster in the shade of the near trees and around the pond.
  const ferns = variantsOf(models.fern);
  const fernSpots = [];
  for (const [tx, tz] of NEAR_TREES) {
    const n = 2 + ((R() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, r = 0.9 + R() * 2.2;
      const x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r;
      if (isOpenGround(x, z, 0.3)) fernSpots.push({ x, z, variant: (R() * 4) | 0, scale: 0.9 + R() * 0.8, rot: R() * 6.28, y: -0.02 });
    }
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.28 + R() * 0.4, r = WORLD.pondRadius + 0.7 + R() * 1.1;
    fernSpots.push({ x: WORLD.pond.x + Math.cos(a) * r, z: WORLD.pond.z + Math.sin(a) * r, variant: i, scale: 0.8 + R() * 0.6, rot: R() * 6.28, y: -0.02 });
  }
  scatter(scene, ferns, fernSpots.slice(0, quality.ferns), { castShadow: false });

  // Flowering wood-sorrel as low ground cover.
  const sorrel = variantsOf(models.sorrel);
  const sorrelSpots = pick(quality.sorrel, 3.8, 30, 0.3, (x, z) => ({
    x, z, variant: (R() * sorrel.length) | 0, scale: 5 + R() * 4, rot: R() * 6.28,
  }));
  scatter(scene, sorrel, sorrelSpots, { castShadow: false });
}
