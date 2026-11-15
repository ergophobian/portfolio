// The desk set in the clearing: desk, chair, CRT with a live screen, and props.
import * as THREE from '../vendor/three.bundle.min.js';
import { RoundedBoxGeometry } from '../vendor/three.bundle.min.js';
import { addCollider, heightAt, WORLD } from './util.js';

const DESK_TOP = 0.79;
const TV_SCALE = 1.32;

function place(scene, gltf, { x = 0, y = 0, z = 0, rot = 0, scale = 1, height = 0, shadow = true } = {}) {
  const obj = gltf.scene;
  obj.position.set(x, y, z);
  obj.rotation.y = rot;
  obj.scale.setScalar(scale);
  if (height) {
    // Assets that are not authored in metres (the Fab gaming chair): fit to a height, rest on the floor.
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    obj.scale.multiplyScalar(height / (box.max.y - box.min.y));
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    obj.position.y += y - box.min.y;
  }
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = shadow;
    o.receiveShadow = true;
  });
  scene.add(obj);
  return obj;
}

/** Draws the tiny live desktop that glows on the CRT while you are out in the meadow. */
function drawScreen(g, w, h, t) {
  g.clearRect(0, 0, w, h);
  g.save();
  roundRect(g, 0, 0, w, h, 46);
  g.clip();
  const sky = g.createLinearGradient(0, 0, w, h);
  sky.addColorStop(0, '#16233f');
  sky.addColorStop(0.55, '#3b4f8f');
  sky.addColorStop(1, '#f08a5d');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // soft hills
  g.fillStyle = 'rgba(20,32,52,0.55)';
  g.beginPath(); g.moveTo(0, h * 0.78);
  for (let x = 0; x <= w; x += 16) g.lineTo(x, h * 0.74 + Math.sin(x * 0.012 + 1) * 22 + Math.sin(x * 0.031) * 8);
  g.lineTo(w, h); g.lineTo(0, h); g.fill();
  // menu bar
  g.fillStyle = 'rgba(10,14,26,0.55)';
  g.fillRect(0, 0, w, 30);
  g.fillStyle = '#fff';
  g.font = '600 15px Inter, system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('KyleOS', 14, 16);
  const now = new Date();
  const clock = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  g.textAlign = 'right';
  g.fillText(clock, w - 14, 16);
  g.textAlign = 'left';
  // window
  const wx = w * 0.16, wy = h * 0.2, ww = w * 0.68, wh = h * 0.46;
  g.fillStyle = 'rgba(12,16,30,0.82)';
  roundRect(g, wx, wy, ww, wh, 14); g.fill();
  g.fillStyle = '#ff8a4c'; g.beginPath(); g.arc(wx + 20, wy + 18, 5, 0, 7); g.fill();
  g.fillStyle = '#ffd166'; g.beginPath(); g.arc(wx + 38, wy + 18, 5, 0, 7); g.fill();
  g.fillStyle = '#7bd88f'; g.beginPath(); g.arc(wx + 56, wy + 18, 5, 0, 7); g.fill();
  g.fillStyle = '#fff';
  g.font = '700 34px "Bricolage Grotesque", Inter, sans-serif';
  g.fillText('Kyle K.', wx + 26, wy + 78);
  g.font = '500 16px Inter, system-ui, sans-serif';
  g.fillStyle = 'rgba(255,255,255,0.72)';
  g.fillText('Developer · Builder · Creator', wx + 26, wy + 112);
  g.font = '500 15px "JetBrains Mono", monospace';
  g.fillStyle = '#ffb37a';
  const caret = Math.floor(t * 2) % 2 ? '▍' : ' ';
  g.fillText('> walk up to log in ' + caret, wx + 26, wy + 156);
  // dock
  const dockW = 300, dx = (w - dockW) / 2, dy = h - 64;
  g.fillStyle = 'rgba(255,255,255,0.2)';
  roundRect(g, dx, dy, dockW, 48, 16); g.fill();
  const cols = ['#ff8a4c', '#5ec4ff', '#7bd88f', '#c79bff', '#ffd166', '#ff6b8b'];
  cols.forEach((c, i) => {
    g.fillStyle = c;
    const bob = Math.sin(t * 2 + i) * 1.5;
    roundRect(g, dx + 14 + i * 46, dy + 8 + bob, 32, 32, 9); g.fill();
  });
  // scanlines
  g.fillStyle = 'rgba(0,0,0,0.07)';
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  g.restore();
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function createKeyboard() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new RoundedBoxGeometry(0.44, 0.022, 0.16, 3, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.55, metalness: 0.1 }),
  );
  base.position.y = 0.011;
  group.add(base);
  const rows = 5, cols = 15;
  const keys = new THREE.InstancedMesh(
    new RoundedBoxGeometry(0.023, 0.012, 0.023, 2, 0.003),
    new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.6 }),
    rows * cols,
  );
  const m = new THREE.Matrix4();
  const accent = new THREE.Color(0xff8a4c), plain = new THREE.Color(0xffffff);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      m.makeTranslation(-0.196 + c * 0.028, 0.026, -0.056 + r * 0.028);
      keys.setMatrixAt(i, m);
      keys.setColorAt(i, (r === 0 && c === 0) || (r === 2 && c === 14) ? accent : plain);
      i++;
    }
  }
  group.add(keys);
  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return group;
}

export function createDesk(scene, models) {
  const group = new THREE.Group();
  group.name = 'desk-set';
  group.position.set(WORLD.desk.x, heightAt(WORLD.desk.x, WORLD.desk.z), WORLD.desk.z);
  scene.add(group);

  place(group, models.desk);
  const tv = place(group, models.tv, { y: DESK_TOP, z: -0.1, scale: TV_SCALE });
  place(group, models.chair, { x: 0.95, z: 1.3, rot: 0.55, height: 1.3 }); // Fab chair faces -z (Poly Haven faces +z)
  place(group, models.lamp, { x: 0.78, y: DESK_TOP, z: -0.2, rot: -2.2 });
  place(group, models.plantSmall, { x: 0.5, y: DESK_TOP, z: -0.28, scale: 1.15 });
  place(group, models.boombox, { x: -0.6, y: DESK_TOP, z: -0.18, rot: 0.18, scale: 0.92 });
  place(group, models.plantBig, { x: 1.55, z: -0.25, rot: 1.1, scale: 1.1 });
  const lantern = place(group, models.lantern, { x: -1.45, z: 0.35, rot: 0.6, scale: 1.25 });

  // Lamp bulb + lantern glass glow a little even in daylight.
  models.lamp.scene.traverse((o) => {
    if (o.isMesh && /light/i.test(o.material.name)) {
      o.material.emissive = new THREE.Color(0xffc58a);
      o.material.emissiveIntensity = 2.2;
    }
  });
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 12, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 2.3, 0.7) }),
  );
  flame.position.set(0, 0.2, 0);
  lantern.add(flame);

  const keyboard = createKeyboard();
  keyboard.position.set(-0.04, DESK_TOP, 0.24);
  keyboard.rotation.y = 0.04;
  group.add(keyboard);
  const mouse = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 20, 12),
    new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.45 }),
  );
  mouse.scale.set(0.85, 0.5, 1.35);
  mouse.position.set(0.32, DESK_TOP + 0.015, 0.25);
  mouse.castShadow = true;
  group.add(mouse);
  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.035, 0.09, 20),
    new THREE.MeshStandardMaterial({ color: 0xff8a4c, roughness: 0.35 }),
  );
  mug.position.set(-0.36, DESK_TOP + 0.045, 0.26);
  mug.castShadow = true;
  group.add(mug);

  // Live screen: a canvas texture on a plane just in front of the CRT glass.
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 480;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screenW = 0.29 * TV_SCALE, screenH = 0.214 * TV_SCALE;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }),
  );
  screen.position.set(0, DESK_TOP + 0.277 * TV_SCALE, -0.1 + 0.121 * TV_SCALE);
  screen.name = 'screen';
  group.add(screen);
  const glow = new THREE.PointLight(0x9db8ff, 0.5, 2.6, 2);
  glow.position.copy(screen.position).add(new THREE.Vector3(0, 0, 0.35));
  group.add(glow);

  // Colliders (world space).
  for (const dx of [-0.7, 0, 0.7]) addCollider(group.position.x + dx, group.position.z, 0.56);
  addCollider(group.position.x + 0.95, group.position.z + 1.3, 0.46);
  addCollider(group.position.x + 1.55, group.position.z - 0.25, 0.34);
  addCollider(group.position.x - 1.45, group.position.z + 0.35, 0.18);

  let last = -1;
  const screenWorld = new THREE.Vector3();
  return {
    group, tv, screen,
    /** Where the player has to stand to sit down at the computer. */
    zone: { x: group.position.x - 0.1, z: group.position.z + 1.55, r: 1.15 },
    screenCenter() { return screen.getWorldPosition(screenWorld); },
    screenSize: { w: screenW, h: screenH },
    update(t) {
      const tick = Math.floor(t * 4);
      if (tick === last) return;
      last = tick;
      drawScreen(ctx, canvas.width, canvas.height, t);
      tex.needsUpdate = true;
    },
  };
}

/** Bench by the pond and a stump along the path: a little set dressing with colliders. */
export function createLandmarks(scene, models) {
  const bx = WORLD.pond.x + 6.4, bz = WORLD.pond.z + 2.6;
  const bench = place(scene, models.bench, { x: bx, y: heightAt(bx, bz), z: bz, rot: -Math.PI / 2 - 0.35, scale: 1.25 });
  addCollider(bx, bz - 0.35, 0.5);
  addCollider(bx, bz + 0.35, 0.5);
  const sx = 5.2, sz = 9.6;
  const stump = place(scene, models.stump, { x: sx, y: heightAt(sx, sz) - 0.02, z: sz, rot: 0.8, scale: 0.9 });
  addCollider(sx, sz, 0.62);
  return { bench, stump };
}
