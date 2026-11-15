// Shared math, world layout and collision helpers.
import * as THREE from '../vendor/three.bundle.min.js';

export const WORLD = {
  playRadius: 40,          // the player is kept inside this circle
  desk: new THREE.Vector3(0, 0, 0),
  spawn: new THREE.Vector3(2.4, 0, 15.5),
  pond: new THREE.Vector3(-11.5, 0, 7.5),
  pondRadius: 4.6,
  waterLevel: -0.42,
};

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential damping. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function dampAngle(a, b, lambda, dt) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

/** Small deterministic PRNG (mulberry32) so the world looks the same on every visit. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Path from the spawn point to the desk ----------------------------------
export const PATH = [
  [2.4, 17.5], [2.4, 14], [3.6, 11], [2.2, 8], [-0.4, 6], [-0.6, 3.6], [0, 1.8],
];
function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
/** 0..1 — how much bare dirt (path / desk clearing) there is at a point. */
export function pathMask(x, z) {
  let d = Infinity;
  for (let i = 0; i < PATH.length - 1; i++) {
    d = Math.min(d, distToSegment(x, z, PATH[i][0], PATH[i][1], PATH[i + 1][0], PATH[i + 1][1]));
  }
  const trail = 1 - smoothstep(0.55, 1.5, d);
  const clearing = 1 - smoothstep(2.3, 3.6, Math.hypot(x, z - 0.35));
  return Math.max(trail, clearing);
}

/** Analytic terrain height: rolling meadow, flat clearing at the desk, a pond bowl, hills at the rim. */
export function heightAt(x, z) {
  const d = Math.hypot(x, z);
  let h = Math.sin(x * 0.07 + 1.3) * Math.cos(z * 0.06 - 0.4) * 1.5
    + Math.sin(x * 0.19 - z * 0.13) * 0.32
    + Math.cos(x * 0.045 + z * 0.09) * 1.0
    + Math.sin(x * 0.41 + 2.0) * Math.sin(z * 0.37) * 0.1;
  h = lerp(h, 0, smoothstep(15, 5.5, d));                       // clearing around the desk
  h = lerp(h, 0, smoothstep(3.2, 1.2, pathDistance(x, z)) * 0.6); // gentle grade along the path
  const dp = Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z);
  h = lerp(h, 0, smoothstep(10, 6, dp));
  h -= smoothstep(6.2, 2.2, dp) * 1.35;                          // pond bowl
  h += Math.pow(smoothstep(40, 82, d), 1.5) * 13                 // rim hills
    * (0.75 + 0.25 * Math.sin(Math.atan2(z, x) * 5 + 0.7) + 0.18 * Math.sin(Math.atan2(z, x) * 11));
  return h;
}
function pathDistance(x, z) {
  let d = Infinity;
  for (let i = 0; i < PATH.length - 1; i++) {
    d = Math.min(d, distToSegment(x, z, PATH[i][0], PATH[i][1], PATH[i + 1][0], PATH[i + 1][1]));
  }
  return d;
}

// --- Circle colliders ------------------------------------------------------------
export const colliders = [];
export function addCollider(x, z, r) { colliders.push({ x, z, r }); }

/** Pushes a point (with radius) out of every collider and keeps it inside the play area. */
export function resolveCollisions(pos, radius) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const min = c.r + radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.0001;
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }
  }
  const d = Math.hypot(pos.x, pos.z);
  if (d > WORLD.playRadius) {
    pos.x *= WORLD.playRadius / d;
    pos.z *= WORLD.playRadius / d;
  }
}
export function isBlocked(x, z, radius) {
  for (const c of colliders) {
    if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return true;
  }
  return Math.hypot(x, z) > WORLD.playRadius - 1;
}

/** True where scattered things (grass, flowers, rocks…) may grow. */
export function isOpenGround(x, z, margin = 0) {
  if (pathMask(x, z) > 0.35) return false;
  if (Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z) < WORLD.pondRadius + margin) return false;
  return true;
}

export function loadTexture(url, { srgb = false, repeat = true, anisotropy = 8 } = {}) {
  const tex = new THREE.TextureLoader().load(url);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}
