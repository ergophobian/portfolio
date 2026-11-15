// Kyle's world — boot, quality tiers, camera rig, game loop and the world ⇄ desktop transition.
import * as THREE from '../vendor/three.bundle.min.js';
import { GLTFLoader, MeshoptDecoder } from '../vendor/three.bundle.min.js';
import { WORLD, heightAt, pathMask, clamp, lerp, damp, dampAngle } from './util.js';
import { createSky, createSun, createTerrain, createWater, playerUniform } from './env.js';
import { createGrass, createTrees, createFlowers, createScatter } from './flora.js';
import { createDesk, createLandmarks } from './desk.js';
import { Player, createAnimals, createCritters } from './actors.js';
import { createInput } from './input.js';
import { createPipeline } from './fx.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------------------------
// Quality tiers
// ---------------------------------------------------------------------------------
const TIERS = {
  low: {
    dpr: 1.5, grass: 12000, flowers: 260, farTrees: 14, pebbles: 24, ferns: 26, sorrel: 24, animals: 3,
    butterflies: 5, birds: 3, shadows: true, shadowSize: 1024, shadowRange: 17, terrainSegments: 110, post: false, ao: false,
  },
  medium: {
    dpr: 1.5, grass: 34000, flowers: 620, farTrees: 26, pebbles: 50, ferns: 60, sorrel: 60, animals: 4,
    butterflies: 9, birds: 5, shadows: true, shadowSize: 2048, shadowRange: 24, terrainSegments: 170, post: true, ao: false,
  },
  high: {
    dpr: 2, grass: 64000, flowers: 900, farTrees: 34, pebbles: 70, ferns: 90, sorrel: 90, animals: 4,
    butterflies: 12, birds: 6, shadows: true, shadowSize: 4096, shadowRange: 28, terrainSegments: 220, post: true, ao: true,
  },
};
const isTouch = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
function pickTier() {
  const forced = params.get('q');
  if (TIERS[forced]) return forced;
  try { const saved = localStorage.getItem('world-quality'); if (TIERS[saved]) return saved; } catch { /* ignore */ }
  if (isTouch || Math.min(innerWidth, innerHeight) < 560) return 'low';
  return (navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium';
}
const tierName = pickTier();
const quality = TIERS[tierName];
document.documentElement.dataset.tier = tierName;
document.documentElement.classList.toggle('touch', isTouch);

// ---------------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------------
const MODELS = {
  player: 'player', shiba: 'shiba', husky: 'husky', cat: 'cat_longhair',
  desk: 'metal_office_desk', chair: 'gaming_chair', tv: 'television_02', lamp: 'desk_lamp_arm_01',
  plantSmall: 'potted_plant_04', plantBig: 'potted_plant_02', boombox: 'boombox', lantern: 'wooden_lantern_01',
  rocks: 'rock_moss_set_01', fern: 'fern_02', sorrel: 'shrub_sorrel_01', bench: 'painted_wooden_bench', stump: 'tree_stump_01',
};
const bar = $('loader-bar'), loaderText = $('loader-text');
let loadDone = 0;
const loadTotal = Object.keys(MODELS).length + 2;
function tick(label) {
  loadDone++;
  const f = loadDone / loadTotal;
  bar.style.transform = `scaleX(${f})`;
  loaderText.textContent = label;
}
async function loadModels() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const out = {};
  await Promise.all(Object.entries(MODELS).map(async ([key, file]) => {
    out[key] = await loader.loadAsync(`assets/models/${file}.glb`);
    tick('Unpacking the meadow…');
  }));
  return out;
}

// ---------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------
const state = { mode: 'loading', fps: 60, backend: '', tier: tierName, dprScale: 1 };
window.__world = state;

async function boot() {
  const canvas = $('scene');
  const renderer = new THREE.WebGPURenderer({
    canvas, antialias: !quality.post, powerPreference: 'high-performance', forceWebGL: params.has('webgl'),
  });
  await renderer.init();
  state.backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
  const basePR = Math.min(window.devicePixelRatio || 1, quality.dpr);
  renderer.setPixelRatio(basePR);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 600);

  const [sky, models] = await Promise.all([
    createSky(scene).then((s) => { tick('Painting the sky…'); return s; }),
    loadModels(),
  ]);
  const sun = createSun(scene, sky.sunDir, quality);
  createTerrain(scene, quality);
  createWater(scene);
  const desk = createDesk(scene, models);
  createLandmarks(scene, models);
  createTrees(scene, quality);
  createScatter(scene, models, quality);
  createGrass(scene, quality);
  createFlowers(scene, quality);
  const player = new Player(models.player);
  scene.add(player.root);
  const animals = createAnimals(scene, models, quality);
  const critters = createCritters(scene, quality);
  const pipeline = createPipeline(renderer, scene, camera, quality);
  const audio = createAudio();
  tick('Almost there…');

  // ---- Camera rig -----------------------------------------------------------------
  const rig = {
    yaw: 0.12, pitch: 0.2, dist: isTouch ? 6.4 : 5.6,
    pos: new THREE.Vector3(), look: new THREE.Vector3(),
    tween: null,
  };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function followPose(outPos, outLook) {
    outLook.copy(player.position).add(tmpA.set(0, 1.32, 0));
    const cp = Math.cos(rig.pitch);
    outPos.set(
      outLook.x + Math.sin(rig.yaw) * cp * rig.dist,
      outLook.y + Math.sin(rig.pitch) * rig.dist,
      outLook.z + Math.cos(rig.yaw) * cp * rig.dist,
    );
    outPos.y = Math.max(outPos.y, heightAt(outPos.x, outPos.z) + 0.45);
  }
  function titlePose(outPos, outLook, t) {
    const a = t * 0.07 + 0.5;
    outPos.set(Math.sin(a) * 6.4, 2.3 + Math.sin(t * 0.13) * 0.35, Math.cos(a) * 6.4 + 1.2);
    outPos.y = Math.max(outPos.y, heightAt(outPos.x, outPos.z) + 1.2);
    outLook.set(0, 1.05, 0.2);
  }
  function screenPose(outPos, outLook) {
    const c = desk.screenCenter();
    const half = THREE.MathUtils.degToRad(camera.fov / 2);
    const dH = desk.screenSize.h / 2 / Math.tan(half);
    const dW = desk.screenSize.w / 2 / (Math.tan(half) * camera.aspect);
    outLook.copy(c);
    outPos.set(c.x, c.y, c.z + Math.max(dH, dW) * 0.98);
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function startTween(toPose, dur, onDone) {
    rig.tween = { fromPos: rig.pos.clone(), fromLook: rig.look.clone(), toPose, t: 0, dur, onDone };
  }

  // ---- UI -------------------------------------------------------------------------
  const ui = {
    loader: $('loader'), title: $('title'), hud: $('hud'), prompt: $('prompt'), promptText: $('prompt-text'),
    ring: $('prompt-ring'), pin: $('pin'), pinText: $('pin-text'), hints: $('hints'), os: $('os'), osFrame: $('os-frame'),
    flash: $('flash'), mute: $('btn-mute'), use: $('btn-use'),
  };
  const setMode = (m) => { state.mode = m; document.body.dataset.mode = m; };

  let armed = true, dwell = 0, movedTime = 0, osLoaded = false;
  function loadOS() {
    if (osLoaded) return;
    osLoaded = true;
    ui.osFrame.src = 'os/index.html';
  }
  function startPlaying() {
    if (state.mode !== 'title') return;
    audio.start();
    audio.blip();
    setMode('intro');
    startTween(followPose, 1.9, () => { setMode('play'); input.enabled = true; });
    loadOS();
  }
  function enterDesktop(instant = false) {
    if (!['play', 'title', 'intro'].includes(state.mode)) return;
    audio.start();
    loadOS();
    input.enabled = false;
    player.frozen = true;
    dwell = 0;
    setMode('entering');
    const open = () => {
      ui.os.classList.add('open');
      ui.flash.classList.remove('on');
      setMode('desktop');
      try { ui.osFrame.contentWindow.postMessage({ type: 'world:enter' }, '*'); } catch { /* not ready */ }
      ui.osFrame.focus();
    };
    if (instant) { open(); return; }
    audio.enter();
    player.playEmote(player.interact);
    startTween(screenPose, 1.5, () => setTimeout(open, 180));
    setTimeout(() => ui.flash.classList.add('on'), 1050);
  }
  function exitDesktop() {
    if (state.mode !== 'desktop') return;
    ui.os.classList.remove('open');
    setMode('leaving');
    armed = false;
    player.frozen = false;
    // If the visitor skipped straight to the desktop, drop them at the desk.
    if (Math.hypot(player.position.x - desk.zone.x, player.position.z - desk.zone.z) > 6) {
      player.position.set(desk.zone.x, 0, desk.zone.z + 0.6);
      player.yaw = Math.PI;
      rig.yaw = 0.35; rig.pitch = 0.22;
    }
    screenPose(rig.pos, rig.look);
    startTween(followPose, 1.1, () => { setMode('play'); input.enabled = true; });
    canvas.focus();
  }

  const input = createInput(canvas, {
    onInteract: () => { if (state.mode === 'play' && inZone()) enterDesktop(); },
    onEmote: () => { if (state.mode === 'play') player.playEmote(player.wave); },
    onAny: () => audio.start(),
  });
  const inZone = () => Math.hypot(player.position.x - desk.zone.x, player.position.z - desk.zone.z) < desk.zone.r;

  $('btn-start').addEventListener('click', startPlaying);
  $('btn-skip').addEventListener('click', () => enterDesktop(true));
  $('btn-desktop').addEventListener('click', () => enterDesktop(true));
  ui.use.addEventListener('click', () => enterDesktop());
  ui.mute.addEventListener('click', () => {
    audio.start();
    audio.setMuted(!audio.muted);
    ui.mute.setAttribute('aria-pressed', String(audio.muted));
  });
  ui.mute.setAttribute('aria-pressed', String(audio.muted));
  $('btn-quality').addEventListener('click', () => {
    const order = ['low', 'medium', 'high'];
    const next = order[(order.indexOf(tierName) + 1) % order.length];
    try { localStorage.setItem('world-quality', next); } catch { /* ignore */ }
    const u = new URL(location.href);
    u.searchParams.delete('q');
    location.href = u.toString();
  });
  $('quality-label').textContent = tierName[0].toUpperCase() + tierName.slice(1);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.mode === 'desktop') exitDesktop();
    if ((e.key === 'Enter' || e.key === ' ') && state.mode === 'title' && document.activeElement === document.body) startPlaying();
  });
  window.addEventListener('message', (e) => {
    if (e.source !== ui.osFrame.contentWindow) return;
    if (e.data === 'exitDesktop' || e.data?.type === 'os:exit') exitDesktop();
  });
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
  });

  // ---- Loop ---------------------------------------------------------------------------
  titlePose(rig.pos, rig.look, 0);
  const timer = new THREE.Timer();
  let elapsed = 0, fpsAcc = 0, fpsFrames = 0, slowWindows = 0, steps = 0;
  const ndc = new THREE.Vector3();

  function frame(now) {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);
    elapsed += dt;
    if (state.mode === 'desktop') return;                 // the world sleeps while the computer is in use

    input.poll(dt);
    if (state.mode === 'play') {
      rig.yaw -= input.lookX;
      rig.pitch = clamp(rig.pitch + input.lookY, -0.12, 1.15);
      rig.dist = clamp(rig.dist * (1 + input.zoom), 2.6, 11);
      // Gently swing the camera behind the player while they walk without steering the view.
      if (player.speed > 1 && !input.lookX && Math.abs(input.move.x) > 0.25) {
        rig.yaw = dampAngle(rig.yaw, rig.yaw - input.move.x * 0.6, 1.4, dt);
      }
    }
    input.lookX = input.lookY = input.zoom = 0;

    player.update(dt, input.move, input.run, rig.yaw);
    playerUniform.value.copy(player.position);
    for (const a of animals) a.update(dt, player);
    critters.update(elapsed);
    desk.update(elapsed);
    sun.follow(state.mode === 'title' ? WORLD.desk : player.position);
    audio.update(elapsed, state.mode !== 'loading');

    // Footsteps
    const stepLen = player.speed > 3.4 ? 1.25 : 0.72;
    if (player.stride > stepLen) {
      player.stride = 0;
      audio.footstep(player.speed > 3.4, pathMask(player.position.x, player.position.z) > 0.5);
    }

    // Camera
    if (rig.tween) {
      const tw = rig.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      tw.toPose(tmpA, tmpB);
      const k = ease(tw.t);
      rig.pos.lerpVectors(tw.fromPos, tmpA, k);
      rig.look.lerpVectors(tw.fromLook, tmpB, k);
      if (tw.t >= 1) { rig.tween = null; tw.onDone?.(); }
    } else if (state.mode === 'title') {
      titlePose(rig.pos, rig.look, elapsed);
    } else if (state.mode === 'play') {
      followPose(tmpA, tmpB);
      rig.pos.x = damp(rig.pos.x, tmpA.x, 9, dt);
      rig.pos.y = damp(rig.pos.y, tmpA.y, 7, dt);
      rig.pos.z = damp(rig.pos.z, tmpA.z, 9, dt);
      rig.look.x = damp(rig.look.x, tmpB.x, 14, dt);
      rig.look.y = damp(rig.look.y, tmpB.y, 10, dt);
      rig.look.z = damp(rig.look.z, tmpB.z, 14, dt);
    }
    camera.position.copy(rig.pos);
    camera.lookAt(rig.look);

    // Desk interaction: stand in the zone for a moment (or press E) to sit down.
    if (state.mode === 'play') {
      const zone = inZone();
      if (!zone) { armed = true; dwell = 0; }
      else if (armed) {
        dwell += player.speed < 1.2 ? dt : dt * 0.35;
        if (dwell > 1.15) enterDesktop();
      }
      ui.prompt.classList.toggle('show', zone && armed);
      ui.use.classList.toggle('show', zone);
      ui.ring.style.strokeDashoffset = String(100 - clamp(dwell / 1.15, 0, 1) * 100);
      if (player.speed > 0.5) movedTime += dt;
      ui.hints.classList.toggle('faded', movedTime > 7);

      // Floating pin that points at the desk.
      ndc.copy(desk.screenCenter()).add(tmpA.set(0, 0.55, 0)).project(camera);
      const behind = ndc.z > 1;
      const dist = Math.hypot(player.position.x - WORLD.desk.x, player.position.z - WORLD.desk.z);
      let nx = behind ? -ndc.x : ndc.x, ny = behind ? -0.85 : ndc.y;
      const off = behind || Math.abs(nx) > 0.92 || Math.abs(ny) > 0.86;
      nx = clamp(nx, -0.9, 0.9); ny = clamp(ny, -0.7, 0.82);
      ui.pin.style.transform = `translate(${((nx + 1) / 2) * innerWidth}px, ${((1 - ny) / 2) * innerHeight}px)`;
      ui.pin.classList.toggle('show', dist > 4.2 || off);
      ui.pin.classList.toggle('off', off);
      ui.pinText.textContent = `${Math.round(dist)} m`;
    } else {
      ui.prompt.classList.remove('show');
      ui.use.classList.remove('show');
      ui.pin.classList.remove('show');
    }

    if (pipeline) pipeline.render();
    else renderer.render(scene, camera);

    // FPS meter + one-way dynamic resolution if the device struggles.
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 1) {
      state.fps = Math.round(fpsFrames / fpsAcc);
      fpsAcc = 0; fpsFrames = 0;
      if (state.mode === 'play' && !document.hidden) {
        slowWindows = state.fps < 33 ? slowWindows + 1 : 0;
        if (slowWindows >= 3 && steps < 3) {
          steps++; slowWindows = 0;
          state.dprScale = [1, 0.8, 0.66, 0.55][steps];
          renderer.setPixelRatio(basePR * state.dprScale);
        }
      }
    }
  }

  // Compile shaders before revealing anything so the first frames do not hitch.
  camera.position.copy(rig.pos);
  camera.lookAt(rig.look);
  sun.follow(WORLD.desk);
  desk.update(0);
  try { await renderer.compileAsync(scene, camera); } catch { /* optional */ }
  tick('Ready');
  renderer.setAnimationLoop(frame);

  setMode('title');
  ui.loader.classList.add('done');
  audio.ready();
  Object.assign(window.__world, {
    player, rig, desk, animals, renderer, scene, camera, sun, enterDesktop, exitDesktop, startPlaying,
    info: () => ({ ...renderer.info.render, backend: state.backend }),
  });
  if (params.has('desktop') || location.hash === '#desktop') enterDesktop(true);
  setTimeout(loadOS, 2500);
}

boot().catch((err) => {
  console.error('World failed to start', err);
  document.body.dataset.mode = 'failed';
  const f = $('fallback');
  if (f) f.hidden = false;
});
