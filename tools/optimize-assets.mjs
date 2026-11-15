// Optimizes raw downloads in tools/raw/ into web-ready assets/ (Meshopt geometry + WebP textures).
// Usage: node optimize-assets.mjs [name-filter]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, 'raw');
const OUT = resolve(here, '..', 'assets');
const BIN = join(here, 'node_modules', '.bin', 'gltf-transform');
const filter = process.argv[2];

for (const d of ['models', 'textures', 'hdri']) mkdirSync(join(OUT, d), { recursive: true });

// --- Poly Haven props (CC0) -------------------------------------------------
const props = [
  { id: 'metal_office_desk', tex: 1024 },
  { id: 'television_02', tex: 1024 },
  { id: 'desk_lamp_arm_01', tex: 512, ratio: 0.5 },
  { id: 'potted_plant_04', tex: 512 },
  { id: 'potted_plant_02', tex: 512, ratio: 0.4 },
  { id: 'boombox', tex: 512 },
  { id: 'rock_moss_set_01', tex: 1024, ratio: 0.12, join: false },
  { id: 'tree_stump_01', tex: 1024, ratio: 0.2 },
  { id: 'fern_02', tex: 512, join: false },
  { id: 'shrub_sorrel_01', tex: 512, join: false },
  { id: 'painted_wooden_bench', tex: 512 },
  { id: 'wooden_lantern_01', tex: 512 },
];

function optimize(input, output, { tex = 1024, ratio, join: doJoin = true, skinned = false } = {}) {
  const args = [
    'optimize', input, output,
    '--compress', 'meshopt',
    '--texture-compress', 'webp',
    '--texture-size', String(tex),
    '--flatten', skinned ? 'false' : 'true',
    '--join', skinned || !doJoin ? 'false' : 'true',
    '--instance', 'false',
    '--palette', 'false',
    '--simplify', ratio ? 'true' : 'false',
  ];
  if (ratio) args.push('--simplify-ratio', String(ratio), '--simplify-error', '0.01');
  execFileSync(BIN, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log(`${output.replace(OUT, 'assets')}  ${(statSync(output).size / 1024).toFixed(0)} KB`);
}

for (const p of props) {
  if (filter && !p.id.includes(filter)) continue;
  optimize(join(RAW, p.id, `${p.id}.gltf`), join(OUT, 'models', `${p.id}.glb`), p);
}

// --- Rigged characters / animals: keep only the clips the world uses ---------
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const rigged = [
  { name: 'shiba', src: join(RAW, 'pizza', 'shiba.glb'), keep: ['Idle', 'Idle_2', 'Idle_2_HeadLow', 'Walk', 'Gallop', 'Eating'] },
  { name: 'husky', src: join(RAW, 'pizza', 'husky.glb'), keep: ['Idle', 'Idle_2', 'Idle_2_HeadLow', 'Walk', 'Gallop', 'Eating'] },
  // Fab (CC-BY) downloads, see CREDITS.md. Raw files live in tools/raw/fab/.
  { name: 'player', src: join(RAW, 'fab', 'soundguy.glb'), keep: ['Idle', 'Walk'], rename: { Walking: 'Walk' }, tex: 1024 },
  { name: 'cat_longhair', src: join(RAW, 'fab', 'longcat.glb'), keep: ['Walk', 'Run'] },
];
for (const r of rigged) {
  if (filter && !r.name.includes(filter)) continue;
  if (!existsSync(r.src)) { console.warn(`skip ${r.name}: missing ${r.src}`); continue; }
  const doc = await io.read(r.src);
  const seen = new Set();
  for (const anim of doc.getRoot().listAnimations()) {
    let short = anim.getName().split('|').pop();
    short = r.rename?.[short] ?? short;
    if (!r.keep.includes(short) || seen.has(short)) { anim.dispose(); continue; }
    seen.add(short);
    anim.setName(short);
  }
  const tmp = join(RAW, `_${r.name}.glb`);
  await io.write(tmp, doc);
  optimize(tmp, join(OUT, 'models', `${r.name}.glb`), { tex: r.tex ?? 512, skinned: true });
}

// --- Fab static props (CC-BY) ---------------------------------------------------
if (!filter || 'gaming_chair'.includes(filter)) {
  const src = join(RAW, 'fab', 'gamerchair.glb');
  if (existsSync(src)) optimize(src, join(OUT, 'models', 'gaming_chair.glb'), { tex: 1024 });
}

// --- Textures -----------------------------------------------------------------
async function webp(src, dst, size, opts = {}) {
  await sharp(src).resize(size, size, { fit: 'fill' }).webp({ quality: 82, ...opts }).toFile(dst);
  console.log(`${dst.replace(OUT, 'assets')}  ${(statSync(dst).size / 1024).toFixed(0)} KB`);
}
if (!filter || filter === 'tex') {
  const T = join(OUT, 'textures');
  for (const t of ['forrest_ground_01', 'dirt_floor']) {
    await webp(join(RAW, 'tex', `${t}_Diffuse.jpg`), join(T, `${t}_diff.webp`), 1024);
    await webp(join(RAW, 'tex', `${t}_nor_gl.jpg`), join(T, `${t}_nor.webp`), 1024, { quality: 88 });
  }
  // Tree bark (tileable) + leaf fronds from the Poly Haven jacaranda (alpha keyed from the black background).
  const J = join(RAW, 'jacaranda_tree', 'textures');
  await webp(join(J, 'jacaranda_tree_branches_diff_1k.jpg'), join(T, 'bark_diff.webp'), 512);
  await webp(join(J, 'jacaranda_tree_branches_nor_gl_1k.jpg'), join(T, 'bark_nor.webp'), 512, { quality: 88 });
  const { data, info } = await sharp(join(J, 'jacaranda_tree_leaves_diff_1k.jpg')).resize(1024, 1024).raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const m = Math.max(r, g, b);
    const a = Math.max(0, Math.min(255, (m - 22) * 9));
    // Bleed leaf colour into transparent texels so mip-mapping does not darken the edges.
    rgba[j] = a ? r : 70; rgba[j + 1] = a ? g : 92; rgba[j + 2] = a ? b : 40; rgba[j + 3] = a;
  }
  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 86, alphaQuality: 90 }).toFile(join(T, 'leaves.webp'));
  console.log(`assets/textures/leaves.webp  ${(statSync(join(T, 'leaves.webp')).size / 1024).toFixed(0)} KB`);
}

// --- Sky ------------------------------------------------------------------------
if (!filter || filter === 'sky') {
  const H = join(OUT, 'hdri');
  await sharp(join(RAW, 'hdri', 'kloofendal_48d_partly_cloudy_puresky_tonemapped.jpg'), { limitInputPixels: false })
    .resize(4096, 2048).jpeg({ quality: 82, mozjpeg: true }).toFile(join(H, 'sky.jpg'));
  console.log(`assets/hdri/sky.jpg  ${(statSync(join(H, 'sky.jpg')).size / 1024).toFixed(0)} KB`);
  copyFileSync(join(RAW, 'hdri', 'kloofendal_48d_partly_cloudy_puresky_1k.hdr'), join(H, 'sky_1k.hdr'));
}
if (!existsSync(join(OUT, 'models'))) throw new Error('no output');
