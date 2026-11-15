// Sky, sun, fog, terrain and water.
import * as THREE from '../vendor/three.bundle.min.js';
import { HDRLoader, TSL } from '../vendor/three.bundle.min.js';
import { WORLD, PATH, heightAt, loadTexture } from './util.js';

const {
  positionWorld, texture, normalMap, mix, smoothstep, vec2, vec3, float, min, max, clamp, dot, length,
  mx_noise_float, time, sin, cos, normalize, transformNormalToView, uniform,
} = TSL;

/** Desired compass direction of the sun (from the scene towards the sun), so shadows rake across the clearing. */
const SUN_AZIMUTH = Math.atan2(0.62, -0.78);

export async function createSky(scene) {
  const [bg, hdr] = await Promise.all([
    new THREE.TextureLoader().loadAsync('assets/hdri/sky.jpg'),
    new HDRLoader().setDataType(THREE.FloatType).loadAsync('assets/hdri/sky_1k.hdr'),
  ]);
  bg.mapping = THREE.EquirectangularReflectionMapping;
  bg.colorSpace = THREE.SRGBColorSpace;
  hdr.mapping = THREE.EquirectangularReflectionMapping;

  // Find the sun in the HDRI (brightest region) so the shadow-casting light matches the sky.
  const { data, width, height } = hdr.image;
  const stride = data.length / (width * height);
  let best = 0, sx = 0, sy = 0, sw = 0;
  for (let i = 0; i < width * height; i++) {
    const l = data[i * stride] * 0.2126 + data[i * stride + 1] * 0.7152 + data[i * stride + 2] * 0.0722;
    if (l > best) best = l;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * stride;
      const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      if (l > best * 0.5) { sx += x * l; sy += y * l; sw += l; }
    }
  }
  const u = (sx / sw + 0.5) / width;
  let v = (sy / sw + 0.5) / height;
  if (v > 0.5) v = 1 - v;                       // the sun is always in the upper hemisphere
  const elevation = (0.5 - v) * Math.PI;
  const hdrAzimuth = (u - 0.5) * Math.PI * 2;

  // Rotate sky + lighting together so the sun ends up where the layout wants it.
  const rot = hdrAzimuth - SUN_AZIMUTH;
  scene.background = bg;
  scene.environment = hdr;
  scene.backgroundRotation.set(0, rot, 0);
  scene.environmentRotation.set(0, rot, 0);
  scene.backgroundIntensity = 1.0;
  scene.environmentIntensity = 0.3;

  const sunDir = new THREE.Vector3(
    Math.cos(SUN_AZIMUTH) * Math.cos(elevation), Math.sin(elevation), Math.sin(SUN_AZIMUTH) * Math.cos(elevation),
  ).normalize();

  const fogColor = new THREE.Color(0xb7cde2);
  scene.fog = new THREE.FogExp2(fogColor, 0.0085);
  return { sunDir };
}

export function createSun(scene, sunDir, quality) {
  const sun = new THREE.DirectionalLight(0xfff0d8, 4.4);
  sun.castShadow = quality.shadows;
  const s = quality.shadowSize;
  sun.shadow.mapSize.set(s, s);
  const cam = sun.shadow.camera;
  const half = quality.shadowRange;
  cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
  cam.near = 1; cam.far = 160;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  const texel = (half * 2) / s;
  const focus = new THREE.Vector3();
  return {
    light: sun,
    /** Keeps the shadow frustum centred on a point, snapped to texels so shadows do not shimmer. */
    follow(p) {
      focus.set(Math.round(p.x / texel) * texel, 0, Math.round(p.z / texel) * texel);
      sun.target.position.copy(focus);
      sun.position.copy(focus).addScaledVector(sunDir, 80);
    },
  };
}

/** Signed distance (in metres) to the dirt path, evaluated per pixel so the edge stays crisp. */
function pathDistanceNode(p) {
  let d = float(1000);
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = vec2(PATH[i][0], PATH[i][1]);
    const ba = vec2(PATH[i + 1][0] - PATH[i][0], PATH[i + 1][1] - PATH[i][1]);
    const pa = p.sub(a);
    const h = clamp(dot(pa, ba).div(dot(ba, ba)), 0, 1);
    d = min(d, length(pa.sub(ba.mul(h))));
  }
  return d;
}

export function createTerrain(scene, quality) {
  const size = 240, seg = quality.terrainSegments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  const grassDiff = loadTexture('assets/textures/forrest_ground_01_diff.webp', { srgb: true });
  const grassNor = loadTexture('assets/textures/forrest_ground_01_nor.webp');
  const dirtDiff = loadTexture('assets/textures/dirt_floor_diff.webp', { srgb: true });
  const dirtNor = loadTexture('assets/textures/dirt_floor_nor.webp');

  const p = positionWorld.xz;
  const wobble = mx_noise_float(p.mul(1.15)).mul(0.45).add(mx_noise_float(p.mul(4.3)).mul(0.12));
  const trail = smoothstep(0.5, 1.45, pathDistanceNode(p).add(wobble)).oneMinus();
  const clearing = smoothstep(2.2, 3.5, length(p.sub(vec2(0, 0.35))).add(wobble.mul(1.3))).oneMinus();
  const pondD = length(p.sub(vec2(WORLD.pond.x, WORLD.pond.z)));
  const shore = smoothstep(WORLD.pondRadius - 0.2, WORLD.pondRadius + 1.5, pondD.add(wobble)).oneMinus();
  const dirt = max(max(trail, clearing), shore);

  const macro = mx_noise_float(p.mul(0.045)).mul(0.5).add(0.5);          // large colour patches
  const grassUV = p.mul(0.3);
  const grassCol = texture(grassDiff, grassUV).rgb.mul(texture(grassDiff, p.mul(0.047)).rgb.mul(2.2).add(0.35))
    .mul(mix(vec3(0.62, 0.98, 0.34), vec3(0.95, 1.05, 0.42), macro)).mul(1.25);
  const dirtUV = p.mul(0.42);
  const dirtCol = texture(dirtDiff, dirtUV).rgb.mul(vec3(0.9, 0.8, 0.68));

  const mat = new THREE.MeshStandardNodeMaterial();
  mat.colorNode = mix(grassCol, dirtCol, dirt);
  mat.normalNode = normalMap(mix(texture(grassNor, grassUV), texture(dirtNor, dirtUV), dirt), vec2(0.8, 0.8));
  mat.roughnessNode = mix(float(0.96), float(0.88), dirt);
  mat.metalness = 0;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);
  return mesh;
}

export function createWater(scene) {
  const geo = new THREE.CircleGeometry(WORLD.pondRadius + 2.2, 56);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhysicalNodeMaterial({ transparent: true, roughness: 0.06, metalness: 0 });
  const p = positionWorld.xz;
  const t = time;
  // Sum of travelling ripples; the analytic gradient becomes the surface normal.
  const ripple = (dir, freq, speed, amp) => {
    const phase = dot(p, dir).mul(freq).add(t.mul(speed));
    return dir.mul(cos(phase).mul(freq * amp));
  };
  const grad = ripple(vec2(0.8, 0.6), 2.1, 1.1, 0.035)
    .add(ripple(vec2(-0.5, 0.86), 3.7, 1.6, 0.02))
    .add(ripple(vec2(0.2, -0.98), 6.3, 2.3, 0.01))
    .add(vec2(mx_noise_float(vec3(p.mul(1.7), t.mul(0.4))), mx_noise_float(vec3(p.mul(1.7).add(31.4), t.mul(0.4)))).mul(0.06));
  mat.normalNode = transformNormalToView(normalize(vec3(grad.x.negate(), 1, grad.y.negate())));
  const depth = smoothstep(WORLD.pondRadius + 1.4, WORLD.pondRadius - 2.5, length(p.sub(vec2(WORLD.pond.x, WORLD.pond.z))));
  mat.colorNode = mix(vec3(0.16, 0.36, 0.33), vec3(0.03, 0.14, 0.17), depth);
  mat.opacityNode = mix(float(0.35), float(0.9), depth);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(WORLD.pond.x, WORLD.waterLevel, WORLD.pond.z);
  mesh.receiveShadow = true;
  mesh.name = 'water';
  scene.add(mesh);
  return mesh;
}

export const playerUniform = uniform(new THREE.Vector3());
