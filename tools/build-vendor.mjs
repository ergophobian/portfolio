// Bundles three.js (r187, MIT) + the addons the world uses into vendor/three.bundle.min.js.
import { build } from 'esbuild';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync, copyFileSync } from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..', 'vendor', 'three.bundle.min.js');
await build({
  entryPoints: [join(here, 'vendor-entry.js')],
  bundle: true, format: 'esm', minify: true, target: 'es2022',
  legalComments: 'none', outfile: out,
  banner: { js: '/* three.js r187 + addons | MIT License | Copyright 2010-2026 three.js authors | https://threejs.org */' },
});
copyFileSync(join(here, 'node_modules', 'three', 'LICENSE'), resolve(here, '..', 'vendor', 'THREE-LICENSE'));
console.log(out, (statSync(out).size / 1024).toFixed(0), 'KB');
