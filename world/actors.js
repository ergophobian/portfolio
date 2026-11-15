// The player character, wandering animals and small ambient critters.
import * as THREE from '../vendor/three.bundle.min.js';
import { SkeletonUtils } from '../vendor/three.bundle.min.js';
import { WORLD, heightAt, resolveCollisions, isBlocked, damp, dampAngle, clamp, smoothstep, rng } from './util.js';

/** Wraps a rigged glTF so its feet sit on y=0 and it is `height` metres tall. */
function normalized(model, height) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = height / size.y;
  model.scale.multiplyScalar(s);
  model.position.y -= box.min.y * s;
  model.position.x -= ((box.min.x + box.max.x) / 2) * s;
  model.position.z -= ((box.min.z + box.max.z) / 2) * s;
  const root = new THREE.Group();
  root.add(model);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false;              // skinned bounds are unreliable once animated
    if (o.material) { o.material.metalness = 0; o.material.roughness = Math.max(0.7, o.material.roughness ?? 0.7); }
  });
  return root;
}

function actionsOf(mixer, clips) {
  const out = {};
  for (const clip of clips) out[clip.name] = mixer.clipAction(clip);
  return out;
}

// ---------------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------------
const WALK_SPEED = 2.35, RUN_SPEED = 5.4;

export class Player {
  constructor(gltf) {
    this.root = normalized(gltf.scene, 1.74);
    this.root.name = 'player';
    this.mixer = new THREE.AnimationMixer(gltf.scene);
    this.actions = actionsOf(this.mixer, gltf.animations);
    const { Idle, Walk, Run, Wave, Interact } = this.actions;
    this.idle = this.actions.Idle_Neutral || Idle;
    this.walk = Walk; this.run = Run; this.wave = Wave; this.interact = Interact;
    for (const a of [this.idle, this.walk, this.run]) { a.play(); a.setEffectiveWeight(0); }
    this.idle.setEffectiveWeight(1);
    for (const a of [this.wave, this.interact]) {
      if (!a) continue;
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = false;
    }
    this.weights = { idle: 1, walk: 0, run: 0 };
    this.emote = 0;                     // 0..1 blend of a one-shot emote over locomotion
    this.emoteAction = null;
    this.mixer.addEventListener('finished', () => { this.emoteAction = null; });
    this.velocity = new THREE.Vector3();
    this.yaw = Math.PI;
    this.speed = 0;
    this.stride = 0;                    // accumulates distance for footstep sounds
    this.frozen = false;
    this.position.copy(WORLD.spawn);
    this.position.y = heightAt(this.position.x, this.position.z);
    this.root.rotation.y = this.yaw;
  }
  get position() { return this.root.position; }

  playEmote(action) {
    if (!action || this.emoteAction || this.speed > 0.4) return;
    this.emoteAction = action;
    action.reset().setEffectiveWeight(1).fadeIn(0.2).play();
    setTimeout(() => action.fadeOut(0.3), Math.max(0, action.getClip().duration * 1000 - 320));
  }

  /** @param move {x,y} stick vector in camera space (y = forward), @param camYaw camera heading */
  update(dt, move, running, camYaw) {
    const pos = this.position;
    let mx = this.frozen ? 0 : move.x, my = this.frozen ? 0 : move.y;
    const mag = Math.min(1, Math.hypot(mx, my));
    const target = new THREE.Vector3();
    if (mag > 0.05) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      target.set(fx * my + rx * mx, 0, fz * my + rz * mx).normalize()
        .multiplyScalar(mag * (running ? RUN_SPEED : WALK_SPEED));
    }
    const accel = mag > 0.05 ? 9 : 12;
    this.velocity.x = damp(this.velocity.x, target.x, accel, dt);
    this.velocity.z = damp(this.velocity.z, target.z, accel, dt);
    const before = pos.clone();
    pos.x += this.velocity.x * dt;
    pos.z += this.velocity.z * dt;
    resolveCollisions(pos, 0.33);
    pos.y = damp(pos.y, heightAt(pos.x, pos.z), 18, dt);
    const moved = Math.hypot(pos.x - before.x, pos.z - before.z);
    this.speed = damp(this.speed, moved / Math.max(dt, 1e-4), 14, dt);
    this.stride += moved;
    if (this.speed > 0.25) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.velocity.x, this.velocity.z), 11, dt);
    }
    this.root.rotation.y = this.yaw;

    // Locomotion blend: idle → walk → run, with playback speed matched to ground speed.
    const sp = this.speed;
    const wRun = smoothstep(2.9, 4.6, sp);
    const wIdle = 1 - smoothstep(0.12, 0.9, sp);
    const wWalk = Math.max(0, 1 - wRun - wIdle);
    this.emote = damp(this.emote, this.emoteAction ? 1 : 0, 8, dt);
    const loco = 1 - this.emote * 0.95;
    this.weights.idle = damp(this.weights.idle, wIdle, 10, dt);
    this.weights.walk = damp(this.weights.walk, wWalk, 10, dt);
    this.weights.run = damp(this.weights.run, wRun, 10, dt);
    this.idle.setEffectiveWeight(this.weights.idle * loco);
    this.walk.setEffectiveWeight(this.weights.walk * loco);
    this.run.setEffectiveWeight(this.weights.run * loco);
    this.walk.setEffectiveTimeScale(clamp(sp / 1.75, 0.6, 1.7));
    this.run.setEffectiveTimeScale(clamp(sp / 5.0, 0.7, 1.35));
    this.mixer.update(dt);
  }
}

// ---------------------------------------------------------------------------------
// Animals
// ---------------------------------------------------------------------------------
/**
 * Procedural walk for rigs that only ship an idle clip (the cat): swings the leg, tail and head bones
 * on top of whatever the mixer wrote this frame. Axes are derived from the bind pose, so it does not
 * depend on how the bones happen to be oriented.
 */
class QuadrupedGait {
  constructor(model) {
    const bone = (name) => { let b = null; model.traverse((o) => { if (!b && o.isBone && o.name.startsWith(name)) b = o; }); return b; };
    model.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    const prep = (b) => {
      if (!b) return null;
      b.getWorldQuaternion(q).invert();
      return { b, side: new THREE.Vector3(1, 0, 0).applyQuaternion(q), up: new THREE.Vector3(0, 1, 0).applyQuaternion(q) };
    };
    this.legs = [
      ['L_Leg', 0], ['R_Leg', Math.PI], ['L_BLeg', Math.PI], ['R_BLeg', 0],
    ].map(([n, ph]) => ({ up: prep(bone(`${n}_Upper`)), low: prep(bone(`${n}_Lower`)), ph }));
    this.tail = ['tail1', 'tail2', 'tail3', 'tail4'].map((n) => prep(bone(n)));
    this.head = prep(bone('Head'));
    this.all = [...this.legs.flatMap((l) => [l.up, l.low]), ...this.tail, this.head].filter(Boolean);
    for (const j of this.all) j.rest = j.b.quaternion.clone();
    this.phase = 0;
    this.q = new THREE.Quaternion();
  }
  spin(j, axis, angle) {
    if (!j) return;
    j.b.quaternion.multiply(this.q.setFromAxisAngle(axis, angle));
  }
  apply(dt, speed, amount, t) {
    // Start every frame from the bind pose, then layer the motion on top.
    for (const j of this.all) j.b.quaternion.copy(j.rest);
    this.phase += dt * (4.5 + speed * 4.2);
    for (const leg of this.legs) {
      const k = this.phase + leg.ph;
      this.spin(leg.up, leg.up?.side, Math.sin(k) * 0.5 * amount);
      this.spin(leg.low, leg.low?.side, Math.max(0, Math.cos(k)) * 0.65 * amount);
    }
    this.tail.forEach((j, i) => this.spin(j, j?.up, Math.sin(t * 2.3 - i * 0.8) * (0.16 + amount * 0.08)));
    const calm = 1 - Math.min(1, amount);
    this.spin(this.head, this.head?.up, Math.sin(t * 0.55) * 0.5 * calm);            // look around when resting
    this.spin(this.head, this.head?.side, Math.sin(this.phase * 2) * 0.04 * amount + Math.sin(t * 0.8) * 0.06 * calm);
    return Math.abs(Math.sin(this.phase)) * 0.012 * amount + Math.sin(t * 1.6) * 0.003 * calm;
  }
}

class Animal {
  constructor(gltf, opt, seed) {
    const model = SkeletonUtils.clone(gltf.scene);
    if (opt.tint) {
      model.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        o.material.color.setRGB(...opt.tint);
      });
    }
    if (opt.yawOffset) model.rotation.y = opt.yawOffset;
    this.root = normalized(model, opt.height);
    this.root.name = opt.name;
    this.opt = opt;
    this.clock = seed;
    this.rand = rng(seed);
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = actionsOf(this.mixer, gltf.animations);
    this.current = null;
    this.home = new THREE.Vector2(opt.home[0], opt.home[1]);
    this.root.position.set(opt.home[0], heightAt(opt.home[0], opt.home[1]), opt.home[1]);
    this.yaw = this.rand() * Math.PI * 2;
    this.target = new THREE.Vector2(opt.home[0], opt.home[1]);
    this.state = 'idle';
    this.timer = 1 + this.rand() * 3;
    this.followTime = 0;
    this.stuck = 0;
    this.speed = 0;
    this.gait = opt.procedural ? new QuadrupedGait(model) : null;
    this.model = model;
    this.baseY = model.position.y;
    if (!this.gait) this.play(opt.idles[0], 0);
  }

  play(name, fade = 0.35) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }

  pickWanderTarget() {
    for (let i = 0; i < 12; i++) {
      const a = this.rand() * Math.PI * 2, r = 2 + this.rand() * this.opt.range;
      const x = this.home.x + Math.cos(a) * r, z = this.home.y + Math.sin(a) * r;
      if (!isBlocked(x, z, 0.5)) { this.target.set(x, z); return; }
    }
    this.target.copy(this.home);
  }

  update(dt, player) {
    const pos = this.root.position;
    const o = this.opt;
    const toPlayer = Math.hypot(player.position.x - pos.x, player.position.z - pos.z);
    this.timer -= dt;
    let desired = 0;

    switch (this.state) {
      case 'idle': {
        if (o.shy && toPlayer < 2.4 && player.speed > 3) { this.flee(player); break; }
        if (this.timer <= 0) {
          if (o.friendly && toPlayer < 16 && toPlayer > 3 && this.rand() < 0.6) {
            this.state = 'follow'; this.followTime = 9 + this.rand() * 9;
          } else {
            this.state = 'walk'; this.pickWanderTarget();
          }
        }
        // Friendly animals turn to look at you when you are close.
        if (o.friendly && toPlayer < 3.2) {
          this.yaw = dampAngle(this.yaw, Math.atan2(player.position.x - pos.x, player.position.z - pos.z), 4, dt);
        }
        break;
      }
      case 'walk': {
        if (o.shy && toPlayer < 2.4 && player.speed > 3) { this.flee(player); break; }
        desired = o.walk;
        if (this.arrived(0.5) || this.timer < -14) this.rest();
        break;
      }
      case 'flee': {
        desired = o.run;
        if (this.arrived(0.7) || this.timer < -4) this.rest();
        break;
      }
      case 'follow': {
        this.followTime -= dt;
        // Aim for a spot beside the player rather than on top of them.
        const side = o.side || 1;
        const px = player.position.x + Math.cos(player.yaw) * 1.25 * side;
        const pz = player.position.z - Math.sin(player.yaw) * 1.25 * side;
        this.target.set(px, pz);
        const d = Math.hypot(px - pos.x, pz - pos.z);
        desired = d > 5.5 ? o.run : d > 1.1 ? Math.min(o.run, Math.max(o.walk, player.speed * 1.05)) : 0;
        if (d <= 1.1 && player.speed < 0.3) {
          this.yaw = dampAngle(this.yaw, Math.atan2(player.position.x - pos.x, player.position.z - pos.z), 5, dt);
        }
        if (this.followTime <= 0 || toPlayer > 30) this.rest();
        break;
      }
    }

    if (desired > 0) {
      const heading = Math.atan2(this.target.x - pos.x, this.target.y - pos.z);
      this.yaw = dampAngle(this.yaw, heading, 5.5, dt);
      let diff = Math.abs(((heading - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      desired *= clamp(1.15 - diff / 1.6, 0.15, 1);
    }
    this.speed = damp(this.speed, desired, 6, dt);
    if (this.speed > 0.02) {
      const bx = pos.x, bz = pos.z;
      pos.x += Math.sin(this.yaw) * this.speed * dt;
      pos.z += Math.cos(this.yaw) * this.speed * dt;
      resolveCollisions(pos, 0.3);
      // Keep a little personal space from the player.
      const dx = pos.x - player.position.x, dz = pos.z - player.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.7 && d > 0.001) { pos.x += (dx / d) * (0.7 - d); pos.z += (dz / d) * (0.7 - d); }
      const moved = Math.hypot(pos.x - bx, pos.z - bz);
      this.stuck = moved < this.speed * dt * 0.35 ? this.stuck + dt : 0;
      if (this.stuck > 0.8) { this.stuck = 0; this.state === 'follow' ? this.rest() : this.pickWanderTarget(); }
    }
    pos.y = damp(pos.y, heightAt(pos.x, pos.z), 14, dt);
    this.root.rotation.y = this.yaw;

    // Pick the clip that matches how fast we are actually moving.
    if (this.gait) {
      const amount = clamp(this.speed / o.walk, 0, 1.25);
      this.model.position.y = this.baseY + this.gait.apply(dt, this.speed, amount, this.clock += dt);
      return;
    }
    if (this.speed > o.walk * 1.5) {
      this.play(o.runClip);
      this.current.setEffectiveTimeScale(clamp(this.speed / o.run, 0.7, 1.25));
    } else if (this.speed > 0.12) {
      this.play('Walk');
      this.current.setEffectiveTimeScale(clamp(this.speed / o.walk, 0.6, 1.5) * (o.walkRate || 1));
    } else if (this.state === 'idle' || this.state === 'follow') {
      if (!o.idles.includes(this.current?.getClip().name)) this.play(this.idleClip || o.idles[0]);
    }
    this.mixer.update(dt);
  }

  arrived(r) {
    return Math.hypot(this.target.x - this.root.position.x, this.target.y - this.root.position.z) < r;
  }
  rest() {
    this.state = 'idle';
    this.timer = 2 + this.rand() * 6;
    this.idleClip = this.opt.idles[(this.rand() * this.opt.idles.length) | 0];
    if (this.speed < 0.3 && !this.gait) this.play(this.idleClip);
  }
  flee(player) {
    const pos = this.root.position;
    const a = Math.atan2(pos.x - player.position.x, pos.z - player.position.z) + (this.rand() - 0.5);
    for (const r of [7, 5, 3]) {
      const x = pos.x + Math.sin(a) * r, z = pos.z + Math.cos(a) * r;
      if (!isBlocked(x, z, 0.5)) { this.target.set(x, z); break; }
    }
    this.state = 'flee';
    this.timer = 0;
  }
}

export function createAnimals(scene, models, quality) {
  const dogIdles = ['Idle', 'Idle_2', 'Idle_2_HeadLow', 'Eating'];
  const catIdles = ['IdleCat'];
  const specs = [
    { model: models.shiba, name: 'shiba', height: 0.62, home: [4.2, 11.5], range: 9, walk: 1.05, run: 4.6, runClip: 'Gallop', idles: dogIdles, friendly: true, side: 1 },
    { model: models.cat, name: 'cat-grey', height: 0.44, home: [-3.4, 3.2], range: 6, walk: 0.75, run: 3.4, idles: catIdles, shy: true, procedural: true, yawOffset: -Math.PI / 2, tint: [1.9, 1.9, 2.05] },
    { model: models.husky, name: 'husky', height: 0.7, home: [-5.5, 12.5], range: 10, walk: 1.1, run: 5.0, runClip: 'Gallop', idles: dogIdles, friendly: true, side: -1 },
    { model: models.cat, name: 'cat-ginger', height: 0.4, home: [7.5, -2.5], range: 7, walk: 0.75, run: 3.4, idles: catIdles, shy: true, procedural: true, yawOffset: -Math.PI / 2, tint: [3.0, 1.7, 0.75] },
  ].slice(0, quality.animals);
  const animals = specs.map((s, i) => new Animal(s.model, s, 100 + i * 17));
  animals.forEach((a) => scene.add(a.root));
  return animals;
}

// ---------------------------------------------------------------------------------
// Butterflies and birds (cheap, CPU-animated)
// ---------------------------------------------------------------------------------
export function createCritters(scene, quality) {
  const R = rng(321);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.5, 1, 0, -0.75, 1.05, 0, 0.35, 0, 0, 0.45], 3));
  wingGeo.setIndex([0, 1, 2, 0, 2, 3]);
  wingGeo.computeVertexNormals();

  const butterflies = [];
  const hues = [0xffa24a, 0xfff2a8, 0x9fd0ff, 0xf7a8ff, 0xffffff];
  for (let i = 0; i < quality.butterflies; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: hues[i % hues.length], side: THREE.DoubleSide });
    const g = new THREE.Group();
    const l = new THREE.Mesh(wingGeo, mat), r = new THREE.Mesh(wingGeo, mat);
    r.scale.x = -1;
    g.add(l, r);
    g.scale.setScalar(0.07 + R() * 0.03);
    const a = R() * 6.28, d = 4 + R() * 20;
    butterflies.push({ g, l, r, cx: Math.cos(a) * d, cz: Math.sin(a) * d, ph: R() * 10, sp: 0.35 + R() * 0.3, rad: 1.5 + R() * 2.5 });
    scene.add(g);
  }

  const birds = [];
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1d2530, side: THREE.DoubleSide });
  for (let i = 0; i < quality.birds; i++) {
    const g = new THREE.Group();
    const l = new THREE.Mesh(wingGeo, birdMat), r = new THREE.Mesh(wingGeo, birdMat);
    r.scale.x = -1;
    g.add(l, r);
    g.scale.setScalar(0.55 + R() * 0.2);
    birds.push({ g, l, r, rad: 22 + R() * 30, h: 17 + R() * 12, ph: R() * 6.28, sp: (0.07 + R() * 0.05) * (i % 2 ? 1 : -1) });
    scene.add(g);
  }

  return {
    update(t) {
      for (const b of butterflies) {
        const k = t * b.sp + b.ph;
        const x = b.cx + Math.cos(k) * b.rad + Math.sin(k * 2.3) * 0.6;
        const z = b.cz + Math.sin(k * 1.3) * b.rad;
        b.g.position.set(x, heightAt(x, z) + 0.75 + Math.sin(k * 3.1) * 0.35, z);
        b.g.rotation.y = Math.atan2(-Math.sin(k) * b.rad, Math.cos(k * 1.3) * 1.3 * b.rad) + Math.PI / 2;
        const flap = Math.sin(t * 22 + b.ph) * 1.05;
        b.l.rotation.z = flap; b.r.rotation.z = -flap;
      }
      for (const b of birds) {
        const k = t * b.sp + b.ph;
        b.g.position.set(Math.cos(k) * b.rad, b.h + Math.sin(k * 3) * 1.5, Math.sin(k) * b.rad);
        b.g.rotation.y = -k + (b.sp > 0 ? 0 : Math.PI);
        const flap = Math.sin(t * 6 + b.ph) * 0.55;
        b.l.rotation.z = flap; b.r.rotation.z = -flap;
      }
    },
  };
}
